import { Injectable } from '@nestjs/common';
import * as readline from 'node:readline';
import { Readable } from 'node:stream';
import { createReadStream, writeFileSync, existsSync } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';
import AdmZip = require('adm-zip');

export type ToolId = string;
export type EMode = 'absolute' | 'relative';
export type EUnit = 'filament_mm' | 'mm3';

export interface SlicerReport {
  filamentUsedMm?: number; // mm
  filamentUsedM?: number; // m (if present)
  filamentUsedCm3?: number; // cm^3
  filamentUsedG?: number; // g
  impliedDensityGcm3?: number; // filamentUsedG / filamentUsedCm3
  estimatedTimeSeconds?: number; // Estimated print time in seconds
  nozzleDiameter?: number; // mm
  raw?: {
    filamentUsedMmLine?: string;
    filamentUsedMLikeLine?: string;
    filamentUsedCm3Line?: string;
    filamentUsedGLine?: string;
    estimatedTimeLine?: string;
    nozzleDiameterLine?: string;
  };
}

export interface ToolFilamentHint {
  tool: ToolId;
  material?: string;
  colorHex?: string;
  colorName?: string;
  presetName?: string;
  brand?: string;
  nozzleTemp?: number;
  bedTemp?: number;
}

export interface DetectSettingsResult {
  eMode: EMode;
  eUnit: EUnit;
  maxE?: number;
  slicer?: SlicerReport;
}

export interface AnalyzeVolumesOptions {
  filamentDiameterMm: number; // used when eUnit=filament_mm to convert to volume
  maxToolId?: number; // ignore tool changes above this id
  maxDeltaEPerLine?: number; // safety clamp in E units
}

export interface AnalyzeVolumesResult {
  tools: Record<ToolId, { volumeMm3: number }>;
  totals: { volumeMm3: number };
  meta: {
    eMode: EMode;
    eUnit: EUnit;
    linesParsed: number;
    toolCount: number;
    nozzleDiameter?: number;
  };
}

@Injectable()
export class GcodeAnalyzerService {
  /**
   * FAST scan: returns all tools used in file (T0..Tmax). If none found, returns ["T0"].
   */
  async scanToolsFromFile(filePath: string, maxToolId = 15): Promise<ToolId[]> {
    const stream = createReadStream(filePath, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    const tools = new Set<ToolId>();

    try {
      for await (const raw of rl) {
        const line = stripComment(raw).trim();
        if (!line) continue;

        const m = line.match(/^T(\d+)$/i);
        if (!m) continue;

        const n = Number(m[1]);
        if (Number.isFinite(n) && n >= 0 && n <= maxToolId) tools.add(`T${n}`);
      }
    } finally {
      rl.close();
      stream.close();
    }

    const list = Array.from(tools).sort(
      (a, b) => Number(a.slice(1)) - Number(b.slice(1)),
    );
    return list.length ? list : ['T0'];
  }

  /**
   * Detect eMode from header M82/M83 (first N lines).
   * Detect slicer report anywhere in file (Orca/Bambu comments).
   * Detect maxE from moves (G0/G1/G2/G3).
   * Infer eUnit using slicer filamentUsed (mm or m) when available.
   *
   * IMPORTANT: We'll later LOCK settings (ignore mid-file M82/M83 macro noise).
   */
  async detectSettingsFromFile(
    filePath: string,
    filamentDiameterMm: number,
    headerLines = 5000,
  ): Promise<DetectSettingsResult> {
    const areaMm2 = Math.PI * Math.pow(filamentDiameterMm / 2, 2);

    const eMode = await this.detectHeaderEMode(filePath, headerLines);
    const slicer = await this.readSlicerReport(filePath);
    const maxE = await this.scanMaxE(filePath);

    // Infer E unit
    let eUnit: EUnit = 'filament_mm';
    const filamentUsedMm =
      slicer.filamentUsedMm ??
      (slicer.filamentUsedM ? slicer.filamentUsedM * 1000 : undefined);

    if (filamentUsedMm && maxE !== undefined) {
      const expectedFilMm = filamentUsedMm;
      const expectedMm3 = filamentUsedMm * areaMm2;
      eUnit =
        relErr(maxE, expectedMm3) < relErr(maxE, expectedFilMm)
          ? 'mm3'
          : 'filament_mm';
    }

    return { eMode, eUnit, maxE, slicer };
  }

  /**
   * Analyze volumes (mm³) per tool with LOCKED settings (do NOT follow in-file M82/M83).
   *
   * Crucial: we count "filament used" like slicers do by tracking the MAX reached E position:
   * - relative: ePos += E
   * - absolute: ePos = E
   * - usedDelta = max(0, ePos - eMax)
   * This automatically ignores retract/unretract cycles.
   */
  async analyzeVolumesLocked(
    stream: Readable,
    opts: AnalyzeVolumesOptions,
    locked: { eMode: EMode; eUnit: EUnit; nozzleDiameter?: number },
  ): Promise<AnalyzeVolumesResult> {
    const filamentDiameterMm = mustPositive(
      opts.filamentDiameterMm,
      'filamentDiameterMm',
    );
    const areaMm2 = Math.PI * Math.pow(filamentDiameterMm / 2, 2);

    const maxToolId = opts.maxToolId ?? 15;
    const maxDeltaEPerLine =
      opts.maxDeltaEPerLine ?? (locked.eUnit === 'mm3' ? 5000 : 1000);

    const eMode = locked.eMode;
    const eUnit = locked.eUnit;

    let currentTool: ToolId = 'T0';
    let linesParsed = 0;

    const volByTool = new Map<ToolId, number>();
    const ePos = new Map<ToolId, number>(); // current E position
    const eMax = new Map<ToolId, number>(); // max E position reached (counts as "used")

    const ensure = (t: ToolId) => {
      if (!volByTool.has(t)) volByTool.set(t, 0);
      if (!ePos.has(t)) ePos.set(t, 0);
      if (!eMax.has(t)) eMax.set(t, 0);
    };
    ensure(currentTool);

    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

    for await (const rawLine of rl) {
      linesParsed++;
      const line = stripComment(rawLine).trim();
      if (!line) continue;

      // Tool change: accept only T0..Tmax (ignore T255/T1000/etc.)
      const tm = line.match(/^T(\d+)$/i);
      if (tm) {
        const toolNum = Number(tm[1]);
        if (Number.isFinite(toolNum) && toolNum >= 0 && toolNum <= maxToolId) {
          currentTool = `T${toolNum}`;
          ensure(currentTool);
        }
        continue;
      }

      // Reset extruder axis
      if (line.toUpperCase().startsWith('G92')) {
        const e = readParamNumber(line, 'E');
        if (e !== null) {
          ensure(currentTool);
          ePos.set(currentTool, e);
          eMax.set(currentTool, e);
        }
        continue;
      }

      const up = line.toUpperCase();
      // ✅ include arcs; Orca/Bambu can extrude on G2/G3
      if (
        !(
          up.startsWith('G0') ||
          up.startsWith('G1') ||
          up.startsWith('G2') ||
          up.startsWith('G3')
        )
      )
        continue;

      const e = readParamNumber(line, 'E');
      if (e === null) continue;

      ensure(currentTool);

      const prevPos = ePos.get(currentTool)!;

      let newPos: number;
      if (eMode === 'relative') newPos = prevPos + e;
      else newPos = e;

      // Safety clamp on sudden jumps (dialect/macro noise)
      if (Math.abs(newPos - prevPos) > maxDeltaEPerLine) {
        ePos.set(currentTool, newPos);
        continue;
      }

      ePos.set(currentTool, newPos);

      const prevMax = eMax.get(currentTool)!;
      if (newPos > prevMax) {
        const usedDelta = newPos - prevMax;
        eMax.set(currentTool, newPos);

        const deltaVolMm3 = eUnit === 'mm3' ? usedDelta : usedDelta * areaMm2;
        volByTool.set(currentTool, volByTool.get(currentTool)! + deltaVolMm3);
      }
    }

    const toolsObj: Record<ToolId, { volumeMm3: number }> = {};
    let totalVol = 0;

    for (const [tool, vol] of volByTool.entries()) {
      toolsObj[tool] = { volumeMm3: vol };
      totalVol += vol;
    }

    return {
      tools: toolsObj,
      totals: { volumeMm3: totalVol },
      meta: {
        eMode,
        eUnit,
        linesParsed,
        toolCount: Object.keys(toolsObj).length,
        nozzleDiameter: locked.nozzleDiameter,
      },
    };
  }

  // ---------------- internal ----------------

  private async detectHeaderEMode(
    filePath: string,
    maxLines: number,
  ): Promise<EMode> {
    const stream = createReadStream(filePath, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

    const mode: EMode = 'absolute';
    let n = 0;

    try {
      for await (const raw of rl) {
        n++;
        const line = stripComment(raw).trim().toUpperCase();
        if (line.startsWith('M82')) return 'absolute';
        if (line.startsWith('M83')) return 'relative';
        if (n >= maxLines) break;
      }
    } finally {
      rl.close();
      stream.close();
    }

    return mode;
  }

  /**
   * Orca/Bambu comment variants commonly seen:
   *  - ; filament used [mm] = 4398.52, 0.00
   *  - ; filament used [cm3] = 10.58, 0.00
   *  - ; filament used [g] = 13.75, 0.00
   *  - ;Filament used: 3.87475m
   */
  private async readSlicerReport(filePath: string): Promise<SlicerReport> {
    const stream = createReadStream(filePath, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

    const report: SlicerReport = { raw: {} };

    const reMm = /^\s*;\s*filament used\s*\[mm\]\s*=\s*([0-9]*\.?[0-9, ]+)/i;
    const reCm3 = /^\s*;\s*filament used\s*\[cm3\]\s*=\s*([0-9]*\.?[0-9, ]+)/i;
    const reG = /^\s*;\s*filament used\s*\[g\]\s*=\s*([0-9]*\.?[0-9, ]+)/i;
    const reM = /^\s*;\s*Filament used:\s*([0-9]*\.?[0-9]+)\s*m\s*$/i;
    const reNozzle = /^\s*;\s*nozzle_diameter\s*=\s*([0-9]*\.?[0-9]+)/i;
    const reNozzleAlt = /^\s*;\s*nozzle\s*diameter\s*=\s*([0-9]*\.?[0-9]+)/i;

    try {
      for await (const raw of rl) {
        const s = raw.trim();
        if (!s.startsWith(';')) continue;

        let m = s.match(reMm);
        if (m && report.filamentUsedMm === undefined) {
          // Handle comma separated values (multi-tool) - take sum or first? 
          // Slicers usually put "T0, T1, ..." 
          const parts = m[1].split(/[ ,]+/).filter(x => x.length > 0);
          report.filamentUsedMm = parts.reduce((acc, x) => acc + Number(x), 0);
          report.raw!.filamentUsedMmLine = s;
        }

        m = s.match(reCm3);
        if (m && report.filamentUsedCm3 === undefined) {
          const parts = m[1].split(/[ ,]+/).filter(x => x.length > 0);
          report.filamentUsedCm3 = parts.reduce((acc, x) => acc + Number(x), 0);
          report.raw!.filamentUsedCm3Line = s;
        }

        m = s.match(reG);
        if (m && report.filamentUsedG === undefined) {
          const parts = s.includes('cm3') ? null : m; // Avoid collision if same line
          if (parts) {
            const valParts = parts[1].split(/[ ,]+/).filter(x => x.length > 0);
            report.filamentUsedG = valParts.reduce((acc, x) => acc + Number(x), 0);
            report.raw!.filamentUsedGLine = s;
          }
        }

        m = s.match(reM);
        if (m && report.filamentUsedM === undefined) {
          report.filamentUsedM = Number(m[1]);
          report.raw!.filamentUsedMLikeLine = s;
        }

        m = s.match(reNozzle) || s.match(reNozzleAlt);
        if (m && report.nozzleDiameter === undefined) {
          report.nozzleDiameter = Number(m[1]);
          report.raw!.nozzleDiameterLine = s;
        }

        // Time parsing
        // Prusa/Orca/Bambu: ; estimated printing time = 1h 23m 45s
        if (s.includes('estimated printing time') || s.startsWith(';TIME:')) {
          const time = parseSlicerTime(s);
          if (time !== undefined && report.estimatedTimeSeconds === undefined) {
            report.estimatedTimeSeconds = time;
            report.raw!.estimatedTimeLine = s;
          }
        }
      }
    } finally {
      rl.close();
      stream.close();
    }

    if (
      report.filamentUsedG !== undefined &&
      report.filamentUsedCm3 !== undefined &&
      report.filamentUsedCm3 > 0
    ) {
      report.impliedDensityGcm3 = report.filamentUsedG / report.filamentUsedCm3;
    }

    // If nothing found, return empty object (raw stays)
    // Trim raw if it’s empty
    if (report.raw && Object.keys(report.raw).length === 0) delete report.raw;

    return report;
  }

  async scanMaxE(filePath: string): Promise<number | undefined> {
    const stream = createReadStream(filePath, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

    let maxE: number | undefined;

    try {
      for await (const raw of rl) {
        const line = stripComment(raw).trim();
        if (!line) continue;

        const up = line.toUpperCase();
        if (
          !(
            up.startsWith('G0') ||
            up.startsWith('G1') ||
            up.startsWith('G2') ||
            up.startsWith('G3')
          )
        )
          continue;

        const e = readParamNumber(line, 'E');
        if (e === null) continue;

        if (maxE === undefined || e > maxE) maxE = e;
      }
    } finally {
      rl.close();
      stream.close();
    }

    return maxE;
  }

  /**
   * Extract GCode from .3mf file (Bambu Studio format)
   * .3mf files are ZIP archives containing GCode in Metadata/plate_*.gcode
   * Returns list of extracted files { name, path }
   */
  extract3MFGCode(filePath: string): Array<{ name: string; path: string }> {
    try {
      const zip = new AdmZip(filePath);
      const zipEntries = zip.getEntries();
      const results: Array<{ name: string; path: string }> = [];

      const gcodeEntries = zipEntries.filter(
        (entry: any) =>
          entry.entryName.match(/Metadata\/plate_\d+\.gcode$/i) ||
          entry.entryName.toLowerCase().endsWith('.gcode'),
      );

      if (gcodeEntries.length === 0) {
        return [];
      }

      for (const entry of gcodeEntries) {
        if (entry.header.size > 200 * 1024 * 1024) {
          throw new Error('File too large (Zip Bomb protection)');
        }
        const tempPath = path.join(
          os.tmpdir(),
          `extracted-${crypto.randomBytes(16).toString('hex')}-${path.basename(entry.entryName)}`,
        );
        writeFileSync(tempPath, entry.getData());
        results.push({
          name: path.basename(entry.entryName),
          path: tempPath,
        });
      }

      return results;
    } catch (error) {
      console.error('Failed to extract GCode from .3mf file:', error);
      return [];
    }
  }

  async extractFilamentHintsFromFile(
    filePath: string,
    maxToolId = 15,
  ): Promise<Record<ToolId, ToolFilamentHint>> {
    const stream = createReadStream(filePath, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

    const arrays: Record<string, string[]> = {};
    const scalarByTool = new Map<ToolId, ToolFilamentHint>();

    const setToolValue = (
      tool: ToolId,
      key: keyof ToolFilamentHint,
      value: string | number | undefined,
    ) => {
      if (value === undefined || value === null || value === '') return;
      const current = scalarByTool.get(tool) || { tool };
      (current as any)[key] = value;
      scalarByTool.set(tool, current);
    };

    try {
      for await (const raw of rl) {
        const line = raw.trim();
        if (!line.startsWith(';')) continue;

        const cleaned = line.replace(/^;\s*/, '');
        const pair = cleaned.match(/^([a-zA-Z0-9_ .-]+)\s*=\s*(.+)$/);
        if (!pair) continue;

        const key = pair[1].trim().toLowerCase().replace(/\s+/g, '_');
        const value = pair[2].trim();

        if (
          [
            'filament_type',
            'filament_colour',
            'filament_color',
            'filament_settings_id',
            'filament_vendor',
            'nozzle_temperature',
            'temperature',
            'bed_temperature',
          ].includes(key)
        ) {
          arrays[key] = splitSlicerList(value);
        }
      }
    } finally {
      rl.close();
      stream.close();
    }

    const maxLen = Math.max(1, ...Object.values(arrays).map((v) => v.length));
    const count = Math.min(maxLen, maxToolId + 1);

    for (let i = 0; i < count; i++) {
      const tool = `T${i}`;
      const material = pickArrayValue(arrays.filament_type, i);
      const color =
        pickArrayValue(arrays.filament_colour, i) ||
        pickArrayValue(arrays.filament_color, i);
      const presetName = pickArrayValue(arrays.filament_settings_id, i);
      const brand = pickArrayValue(arrays.filament_vendor, i);
      const nozzleTemp = parseOptionalNumber(
        pickArrayValue(arrays.nozzle_temperature, i) ||
          pickArrayValue(arrays.temperature, i),
      );
      const bedTemp = parseOptionalNumber(
        pickArrayValue(arrays.bed_temperature, i),
      );

      setToolValue(tool, 'material', normalizeHintText(material));
      setToolValue(tool, 'presetName', normalizeHintText(presetName));
      setToolValue(tool, 'brand', normalizeHintText(brand));
      setToolValue(tool, 'nozzleTemp', nozzleTemp);
      setToolValue(tool, 'bedTemp', bedTemp);

      if (color) {
        const hex = normalizeHexColor(color);
        if (hex) setToolValue(tool, 'colorHex', hex);
        else setToolValue(tool, 'colorName', normalizeHintText(color));
      }
    }

    return Object.fromEntries(scalarByTool.entries());
  }
}

function stripComment(line: string): string {
  const idx = line.indexOf(';');
  return idx >= 0 ? line.slice(0, idx) : line;
}

// ✅ accepts: 12 | 12.34 | .34 | -.8 | 12. | -0.
function readParamNumber(line: string, letter: string): number | null {
  const re = new RegExp(`\\b${letter}(-?(?:\\d+\\.?\\d*|\\.\\d+))\\b`, 'i');
  const m = line.match(re);
  return m ? Number(m[1]) : null;
}

function mustPositive(n: number, name: string): number {
  if (!Number.isFinite(n) || n <= 0) throw new Error(`Invalid ${name}`);
  return n;
}

function relErr(value: number, expected: number): number {
  const denom = Math.max(1e-9, Math.abs(expected));
  return Math.abs(value - expected) / denom;
}

function splitSlicerList(value: string): string[] {
  const normalized = value
    .replace(/^\[|\]$/g, '')
    .replace(/^"|"$/g, '')
    .trim();

  return normalized
    .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)|;(?=\s*#?[a-zA-Z0-9])/)
    .map((part) => part.trim().replace(/^"|"$/g, ''))
    .filter(Boolean);
}

function pickArrayValue(values: string[] | undefined, index: number) {
  if (!values || values.length === 0) return undefined;
  return values[index] ?? values[0];
}

function parseOptionalNumber(value?: string): number | undefined {
  if (!value) return undefined;
  const match = value.match(/-?\d+(\.\d+)?/);
  if (!match) return undefined;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeHintText(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function normalizeHexColor(value: string): string | undefined {
  const match = value.trim().match(/#?([0-9a-f]{6}|[0-9a-f]{8})/i);
  if (!match) return undefined;
  return `#${match[1].slice(0, 6).toUpperCase()}`;
}

/**
 * Parses time strings like:
 * - "; estimated printing time = 1h 23m 45s"
 * - ";TIME:5025" (Cura seconds)
 */
function parseSlicerTime(line: string): number | undefined {
  // Cura: ;TIME:1234
  const curaMatch = line.match(/^;TIME:(\d+(\.\d+)?)/);
  if (curaMatch) {
    return Number(curaMatch[1]);
  }

  // Prusa/Bambu/Orca: ; estimated printing time = ...
  // formats: 1h 23m 45s, 23m 45s, 45s, 1d 2h ...
  const idx = line.indexOf('=');
  if (idx < 0) return undefined;

  const timeStr = line.slice(idx + 1).trim();
  let totalSeconds = 0;

  const d = timeStr.match(/(\d+)d/);
  if (d) totalSeconds += Number(d[1]) * 86400;

  const h = timeStr.match(/(\d+)h/);
  if (h) totalSeconds += Number(h[1]) * 3600;

  const m = timeStr.match(/(\d+)m/);
  if (m) totalSeconds += Number(m[1]) * 60;

  const s = timeStr.match(/(\d+)s/);
  if (s) totalSeconds += Number(s[1]);

  return totalSeconds > 0 ? totalSeconds : undefined;
}
