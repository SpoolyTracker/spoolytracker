import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { GcodeAnalyzerService } from './gcode-analyzer.service';
import { FilamentMatchingService } from './filament-matching.service';
import { BadRequestException, Logger } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';
import AdmZip = require('adm-zip');
import { createReadStream, unlinkSync } from 'node:fs';

export interface InspectJobData {
  filePath: string;
  originalName: string;
  maxTool: number;
  d: number;
  rho: number;
  organizationId: number;
}

export interface ComputeJobData {
  filePath: string;
  originalName: string;
  maxTool: number;
  d: number;
  rhoDefault: number;
  toolToSpool?: Record<string, string>;
  plateMappings?: Record<string, Record<string, string>>;
  spools?: Record<string, any>;
  organizationId: number;
}

@Processor('gcode')
export class GcodeProcessor extends WorkerHost {
  private readonly logger = new Logger(GcodeProcessor.name);

  constructor(
    private readonly analyzer: GcodeAnalyzerService,
    private readonly filamentMatcher: FilamentMatchingService,
  ) {
    super();
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.log(`Worker starting job ${job.id} (${job.name})`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Worker completed job ${job.id} (${job.name})`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(
      `Worker failed job ${job.id} (${job.name}): ${error.message}`,
      error.stack,
    );
  }

  @OnWorkerEvent('error')
  onError(error: Error) {
    this.logger.error(`Worker connection error: ${error.message}`, error.stack);
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`Processing job ${job.id} of type ${job.name}`);
    job.updateProgress(10); // Indicate started

    try {
      if (job.name === 'inspect') {
        return await this.processInspect(job as Job<InspectJobData>);
      } else if (job.name === 'compute') {
        return await this.processCompute(job as Job<ComputeJobData>);
      } else {
        throw new Error(`Unknown job name: ${job.name}`);
      }
    } catch (error) {
      this.logger.error(`Job ${job.id} failed:`, error.stack);
      throw error;
    }
  }

  private async processInspect(job: Job<InspectJobData>): Promise<any> {
    const { filePath, originalName, maxTool, d, rho, organizationId } = job.data;
    let files: Array<{ name: string; path: string }> = [];
    let isTemp = false;

    if (originalName.toLowerCase().endsWith('.3mf')) {
      try {
        files = this.analyzer.extract3MFGCode(filePath);
        if (files.length === 0) {
          throw new Error('No G-code files found in 3MF archive');
        }
        isTemp = true;
      } catch (err: any) {
        throw new Error(`Failed to extract 3MF: ${err.message}`);
      }
    } else {
      files = [{ name: originalName, path: filePath }];
    }

    try {
      const aggregatedPerTool: Record<
        string,
        { volumeMm3: number; lengthMm: number; gramDefault: number }
      > = {};
      const allTools = new Set<string>();
      const plates: any[] = [];
      const grandTotal = { volumeMm3: 0, lengthMm: 0, gramDefault: 0 };
      const aggregatedHints: Record<string, any> = {};

      await job.updateProgress(20);

      const firstFile = files[0];
      const detected = await this.analyzer.detectSettingsFromFile(
        firstFile.path,
        d,
        5000,
      );

      await job.updateProgress(30);

      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const toolsFound = await this.analyzer.scanToolsFromFile(f.path, maxTool);
        toolsFound.forEach((t) => allTools.add(t));
        const toolHints = await this.analyzer.extractFilamentHintsFromFile(
          f.path,
          maxTool,
        );
        Object.entries(toolHints).forEach(([tool, hint]) => {
          aggregatedHints[tool] = {
            ...(aggregatedHints[tool] || {}),
            ...hint,
          };
        });

        const stream = createReadStream(f.path, { encoding: 'utf8' });
        const volumes = await this.analyzer.analyzeVolumesLocked(
          stream,
          { filamentDiameterMm: d, maxToolId: maxTool },
          { eMode: detected.eMode, eUnit: detected.eUnit },
        );

        const areaMm2 = Math.PI * Math.pow(d / 2, 2);
        const perTool: Record<string, any> = {};

        for (const t of toolsFound) {
          const vol = volumes.tools[t]?.volumeMm3 ?? 0;
          const lengthMm = vol / areaMm2;
          const gramDefault = (vol / 1000) * rho;

          perTool[t] = {
            volumeMm3: this.round2(vol),
            lengthMm: this.round2(lengthMm),
            gramDefault: this.round2(gramDefault),
          };

          if (!aggregatedPerTool[t]) {
            aggregatedPerTool[t] = {
              volumeMm3: 0,
              lengthMm: 0,
              gramDefault: 0,
            };
          }
          aggregatedPerTool[t].volumeMm3 += perTool[t].volumeMm3;
          aggregatedPerTool[t].lengthMm += perTool[t].lengthMm;
          aggregatedPerTool[t].gramDefault += perTool[t].gramDefault;
        }

        const plateTotal = {
          volumeMm3: this.round2(volumes.totals.volumeMm3),
          lengthMm: this.round2(volumes.totals.volumeMm3 / areaMm2),
          gramDefault: this.round2((volumes.totals.volumeMm3 / 1000) * rho),
        };

        grandTotal.volumeMm3 += plateTotal.volumeMm3;
        grandTotal.lengthMm += plateTotal.lengthMm;
        grandTotal.gramDefault += plateTotal.gramDefault;

        plates.push({
          name: f.name,
          tools: toolsFound,
          perTool,
          toolHints,
          total: plateTotal,
        });

        await job.updateProgress(
          30 + Math.floor(((i + 1) / files.length) * 60),
        );
      }

      Object.values(aggregatedPerTool).forEach((v) => {
        v.volumeMm3 = this.round2(v.volumeMm3);
        v.lengthMm = this.round2(v.lengthMm);
        v.gramDefault = this.round2(v.gramDefault);
      });

      const computedTotals = {
        volumeMm3: this.round2(grandTotal.volumeMm3),
        lengthMm: this.round2(grandTotal.lengthMm),
        gramDefault: this.round2(grandTotal.gramDefault),
      };

      const slicerTotals =
        detected.slicer && this.hasAnySlicerValue(detected.slicer)
          ? {
              filamentUsedMm:
                detected.slicer.filamentUsedMm ??
                (detected.slicer.filamentUsedM
                  ? detected.slicer.filamentUsedM * 1000
                  : null),
              filamentUsedM: detected.slicer.filamentUsedM ?? null,
              filamentUsedCm3: detected.slicer.filamentUsedCm3 ?? null,
              filamentUsedG: detected.slicer.filamentUsedG ?? null,
              impliedDensityGcm3: detected.slicer.impliedDensityGcm3 ?? null,
            }
          : null;

      await job.updateProgress(100);

      const result: any = {
        tools: Array.from(allTools).sort(),
        plates,
        perTool: aggregatedPerTool,
        totals: {
          computed: computedTotals,
          slicer: slicerTotals,
        },
        meta: {
          eMode: detected.eMode,
          eUnit: detected.eUnit,
          maxE: detected.maxE ?? null,
          slicerReport: detected.slicer || null, 
        },
        defaults: { diameterMm: d, densityGcm3: rho },
        toolHints: aggregatedHints,
      };

      // FALLBACK: If computed total is 0 but slicer has data, use slicer data as fallback for UI
      if (computedTotals.volumeMm3 === 0 && slicerTotals) {
          const firstTool = result.tools[0] || 'T0';
          if (!result.tools.includes(firstTool)) result.tools.push(firstTool);
          
          let fallbackLengthMm = slicerTotals.filamentUsedMm || (slicerTotals.filamentUsedM ? slicerTotals.filamentUsedM * 1000 : 0);
          if (fallbackLengthMm === 0 && slicerTotals.filamentUsedCm3) {
              fallbackLengthMm = (slicerTotals.filamentUsedCm3 * 1000) / (Math.PI * Math.pow(d/2, 2));
          }

          if (fallbackLengthMm > 0) {
              const fallbackVol = fallbackLengthMm * (Math.PI * Math.pow(d/2, 2));
              const fallbackGram = (fallbackVol / 1000) * rho;
              
              result.perTool[firstTool] = {
                  volumeMm3: this.round2(fallbackVol),
                  lengthMm: this.round2(fallbackLengthMm),
                  gramDefault: this.round2(fallbackGram)
              };
              result.totals.computed = {
                  volumeMm3: result.perTool[firstTool].volumeMm3,
                  lengthMm: result.perTool[firstTool].lengthMm,
                  gramDefault: result.perTool[firstTool].gramDefault
              };
              result.meta.isFallback = true;
              // Add a fake plate if none found
              if (result.plates.length === 0) {
                  result.plates.push({
                      name: originalName,
                      tools: [firstTool],
                      perTool: { [firstTool]: result.perTool[firstTool] },
                      total: result.totals.computed
                  });
              }
          }
      }

      result.matching = await this.filamentMatcher.suggestForInspection(
        organizationId,
        result,
        originalName,
      );

      return result;
    } finally {
      if (isTemp) {
        files.forEach((f) => {
          if (fs.existsSync(f.path))
            try {
              unlinkSync(f.path);
            } catch {}
        });
      }
      if (filePath && fs.existsSync(filePath)) {
        try {
          unlinkSync(filePath);
        } catch {}
      }
    }
  }

  private async processCompute(job: Job<ComputeJobData>): Promise<any> {
    const {
      filePath,
      originalName,
      maxTool,
      d,
      rhoDefault,
      toolToSpool,
      plateMappings,
      spools,
    } = job.data;
    let files: Array<{ name: string; path: string }> = [];
    let isTemp = false;

    if (originalName.toLowerCase().endsWith('.3mf')) {
      files = this.analyzer.extract3MFGCode(filePath);
      isTemp = true;
    } else {
      files = [{ name: originalName, path: filePath }];
    }

    try {
      const platesUsage: any[] = [];
      const grandTotalUsage: Record<string, number> = {};

      await job.updateProgress(20);

      const firstFile = files[0];
      const detected = await this.analyzer.detectSettingsFromFile(
        firstFile.path,
        d,
        5000,
      );

      await job.updateProgress(30);

      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const stream = createReadStream(f.path, { encoding: 'utf8' });
        const volumes = await this.analyzer.analyzeVolumesLocked(
          stream,
          { filamentDiameterMm: d, maxToolId: maxTool },
          { eMode: detected.eMode, eUnit: detected.eUnit },
        );

        const currentMapping = plateMappings?.[f.name] ?? toolToSpool;

        const volumeById = new Map<string, number>();
        for (const [tool, v] of Object.entries(volumes.tools)) {
          const id = currentMapping?.[tool.toUpperCase()] ?? tool;
          volumeById.set(id, (volumeById.get(id) ?? 0) + v.volumeMm3);
        }

        const plateUsage: Array<{ id: string; gram: number }> = [];
        for (const [id, volMm3] of volumeById.entries()) {
          const rho = spools?.[id]?.densityGcm3 ?? rhoDefault;
          if (!Number.isFinite(rho) || rho <= 0)
            throw new BadRequestException(`Invalid densityGcm3 for id=${id}`);

          const gram = this.round2((volMm3 / 1000) * rho);
          plateUsage.push({ id, gram });

          grandTotalUsage[id] = (grandTotalUsage[id] || 0) + gram;
        }
        plateUsage.sort((a, b) => a.id.localeCompare(b.id));

        platesUsage.push({
          name: f.name,
          usage: plateUsage,
        });

        await job.updateProgress(
          30 + Math.floor(((i + 1) / files.length) * 60),
        );
      }

      const totalUsage = Object.entries(grandTotalUsage)
        .map(([id, gram]) => ({ id, gram: this.round2(gram) }))
        .sort((a, b) => a.id.localeCompare(b.id));

      await job.updateProgress(100);

      return {
        usage: totalUsage,
        plates: platesUsage,
        slicer: detected.slicer,
      };
    } finally {
      if (isTemp) {
        files.forEach((f) => {
          if (fs.existsSync(f.path))
            try {
              unlinkSync(f.path);
            } catch {}
        });
      }
      if (filePath && fs.existsSync(filePath)) {
        try {
          unlinkSync(filePath);
        } catch {}
      }
    }
  }

  private hasAnySlicerValue(s: any): boolean {
    return (
      s?.filamentUsedMm !== undefined ||
      s?.filamentUsedM !== undefined ||
      s?.filamentUsedCm3 !== undefined ||
      s?.filamentUsedG !== undefined
    );
  }

  private round2(n: number): number {
    return Number(n.toFixed(2));
  }
}
