import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Filament } from '../filament/filament.entity';
import { ToolFilamentHint } from './gcode-analyzer.service';

type MatchReason =
  | 'material_match'
  | 'material_mismatch'
  | 'color_match'
  | 'color_close'
  | 'color_mismatch'
  | 'brand_or_preset_match'
  | 'enough_stock'
  | 'insufficient_stock'
  | 'temperature_compatible'
  | 'locked'
  | 'empty';

export interface FilamentCandidate {
  filamentId: number;
  score: number;
  confidence: 'high' | 'medium' | 'low';
  reasons: MatchReason[];
  warnings: string[];
}

export interface ToolMatchSuggestion {
  tool: string;
  hint: ToolFilamentHint;
  requiredWeightG: number;
  candidates: FilamentCandidate[];
}

export interface PrintIntentSuggestion {
  intent: 'decorative' | 'technical' | 'heat_resistant' | 'flexible' | 'unknown';
  confidence: 'high' | 'medium' | 'low';
  recommendedMaterials: string[];
  reasons: string[];
}

@Injectable()
export class FilamentMatchingService {
  constructor(
    @InjectRepository(Filament)
    private readonly filamentRepository: Repository<Filament>,
  ) {}

  async suggestForInspection(
    organizationId: number,
    inspection: any,
    fileName: string,
  ) {
    // Keep the first version deliberately deterministic and explainable.
    // The UI can show "why" a spool was suggested, and we can tune weights
    // without retraining or introducing another runtime.
    const filaments = await this.filamentRepository.find({
      where: { organizationId },
      relations: { brand: true, material: true, types: true },
    });

    const hints = (inspection?.toolHints || {}) as Record<string, ToolFilamentHint>;
    const perTool = inspection?.perTool || {};
    const tools = (inspection?.tools || Object.keys(perTool || {})) as string[];

    const toolSuggestions = tools.map((tool) => {
      const requiredWeightG =
        perTool?.[tool]?.gramDefault ||
        getPlateWeightForTool(inspection?.plates || [], tool);

      return this.matchTool(
        tool,
        hints[tool] || { tool },
        Number(requiredWeightG) || 0,
        filaments,
      );
    });

    return {
      printIntent: this.inferPrintIntent(fileName, hints, inspection),
      toolSuggestions,
    };
  }

  private matchTool(
    tool: string,
    hint: ToolFilamentHint,
    requiredWeightG: number,
    filaments: Filament[],
  ): ToolMatchSuggestion {
    // Score every active spool, then keep only the most useful candidates.
    // Negative but non-fatal scores are kept because they can still be useful
    // when the slicer provides poor metadata.
    const candidates = filaments
      .map((filament) => this.scoreFilament(filament, hint, requiredWeightG))
      .filter((candidate) => candidate.score > -80)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return { tool, hint, requiredWeightG, candidates };
  }

  private scoreFilament(
    filament: Filament,
    hint: ToolFilamentHint,
    requiredWeightG: number,
  ): FilamentCandidate {
    let score = 0;
    const reasons: MatchReason[] = [];
    const warnings: string[] = [];

    const filamentMaterial = normalize(filament.material?.name);
    const hintMaterial = normalize(hint.material || materialFromPreset(hint.presetName));

    // Material compatibility is the strongest signal: printing PETG with PLA
    // is the kind of mistake this feature is meant to catch.
    if (hintMaterial && filamentMaterial) {
      if (materialsCompatible(hintMaterial, filamentMaterial)) {
        score += 45;
        reasons.push('material_match');
      } else {
        score -= 55;
        reasons.push('material_mismatch');
        warnings.push('Material differs from the slicer hint');
      }
    }

    const hintColor = hint.colorHex;
    const filamentColor = filament.colorHex || filament.color;
    // Color is helpful but intentionally weaker than material. A user might
    // accept a different color; a wrong material is usually a failed print.
    if (hintColor && filamentColor) {
      const distance = colorDistance(hintColor, filamentColor);
      if (distance <= 35) {
        score += 25;
        reasons.push('color_match');
      } else if (distance <= 95) {
        score += 12;
        reasons.push('color_close');
      } else {
        score -= 12;
        reasons.push('color_mismatch');
      }
    }

    const brand = normalize(filament.brand?.name);
    const preset = normalize(`${hint.brand || ''} ${hint.presetName || ''}`);
    // Brand/preset names are noisy across slicers, so this is a small bonus
    // rather than a hard requirement.
    if (brand && preset && preset.includes(brand)) {
      score += 12;
      reasons.push('brand_or_preset_match');
    }

    // Stock sufficiency is a strong practical signal. We still return
    // insufficient candidates with a warning so the UI can explain the issue.
    if (requiredWeightG > 0) {
      if ((filament.weightRemaining || 0) >= requiredWeightG) {
        score += 20;
        reasons.push('enough_stock');
      } else {
        score -= 45;
        reasons.push('insufficient_stock');
        warnings.push('Not enough filament remaining');
      }
    }

    // Temperature compatibility is a secondary sanity check. Slicer temps can
    // be custom, and local filament ranges can be missing, so keep it gentle.
    if (hint.nozzleTemp && filament.nozzleTempMin && filament.nozzleTempMax) {
      if (
        hint.nozzleTemp >= filament.nozzleTempMin - 5 &&
        hint.nozzleTemp <= filament.nozzleTempMax + 5
      ) {
        score += 8;
        reasons.push('temperature_compatible');
      }
    }

    // Locked/empty spools should almost never be suggested, but returning them
    // with warnings can help explain why no good candidates exist.
    if (filament.isLocked) {
      score -= 100;
      reasons.push('locked');
      warnings.push('Filament is locked by quota or plan');
    }

    if ((filament.weightRemaining || 0) <= 0) {
      score -= 100;
      reasons.push('empty');
      warnings.push('Filament is empty');
    }

    return {
      filamentId: filament.id,
      score,
      confidence: score >= 75 ? 'high' : score >= 40 ? 'medium' : 'low',
      reasons,
      warnings,
    };
  }

  private inferPrintIntent(
    fileName: string,
    hints: Record<string, ToolFilamentHint>,
    inspection: any,
  ): PrintIntentSuggestion {
    // This is not trying to "understand" the model geometry. It is a lightweight
    // product hint based on filename and slicer metadata, useful for nudging
    // users toward material families when the source file is ambiguous.
    const text = normalize(fileName);
    const reasons: string[] = [];
    let intent: PrintIntentSuggestion['intent'] = 'unknown';
    let confidence: PrintIntentSuggestion['confidence'] = 'low';

    const technicalWords = [
      'bracket',
      'mount',
      'holder',
      'gear',
      'hinge',
      'clip',
      'fixture',
      'support',
      'adapter',
      'tool',
      'functional',
      'enclosure',
      'boitier',
      'boîtier',
      'charniere',
      'charnière',
      'support',
      'fixation',
      'engrenage',
    ];
    const decorativeWords = [
      'vase',
      'figurine',
      'statue',
      'decor',
      'décor',
      'deco',
      'déco',
      'cosplay',
      'lithophane',
      'toy',
      'ornament',
    ];
    const heatWords = ['hot', 'heat', 'engine', 'car', 'automotive', 'motor', 'chamber'];
    const flexWords = ['flex', 'seal', 'gasket', 'tpu', 'rubber', 'joint'];

    if (hasAny(text, flexWords)) {
      intent = 'flexible';
      confidence = 'medium';
      reasons.push('Filename suggests a flexible part');
    } else if (hasAny(text, heatWords)) {
      intent = 'heat_resistant';
      confidence = 'medium';
      reasons.push('Filename suggests heat or mechanical environment');
    } else if (hasAny(text, technicalWords)) {
      intent = 'technical';
      confidence = 'medium';
      reasons.push('Filename suggests a functional/technical part');
    } else if (hasAny(text, decorativeWords)) {
      intent = 'decorative';
      confidence = 'medium';
      reasons.push('Filename suggests a decorative print');
    }

    const hintedMaterials = Object.values(hints)
      .map((hint) => normalize(hint.material || materialFromPreset(hint.presetName)))
      .filter(Boolean);

    // If the slicer already says ABS/ASA/CF, trust that more than filename
    // heuristics because it came from the prepared print profile.
    if (hintedMaterials.some((m) => m.includes('abs') || m.includes('asa'))) {
      intent = intent === 'unknown' ? 'heat_resistant' : intent;
      reasons.push('Slicer material hint includes ABS/ASA');
    }
    if (hintedMaterials.some((m) => m.includes('cf') || m.includes('carbon'))) {
      intent = 'technical';
      confidence = 'high';
      reasons.push('Slicer material hint includes carbon fiber');
    }

    const estimatedHours =
      (inspection?.meta?.slicerReport?.estimatedTimeSeconds || 0) / 3600;
    if (estimatedHours > 8 && intent === 'unknown') {
      intent = 'technical';
      reasons.push('Long print duration may indicate a functional part');
    }

    return {
      intent,
      confidence,
      recommendedMaterials: recommendedMaterialsForIntent(intent),
      reasons,
    };
  }
}

function getPlateWeightForTool(plates: any[], tool: string): number {
  return plates.reduce((sum, plate) => {
    return sum + (plate?.perTool?.[tool]?.gramDefault || 0);
  }, 0);
}

function normalize(value?: string | null): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function materialFromPreset(preset?: string): string {
  // Slicer presets are often richer than "filament_type"; examples:
  // "Bambu PETG-CF Black @BBL X1C" or "Generic PLA Matte".
  const value = normalize(preset);
  const known = ['petg-cf', 'pa-cf', 'pla-cf', 'petg', 'pla', 'abs', 'asa', 'tpu', 'pc', 'pa', 'nylon'];
  return known.find((material) => value.includes(material)) || '';
}

function materialsCompatible(hint: string, actual: string): boolean {
  // Use broad compatibility rather than strict equality because catalogs often
  // store variants such as "PLA+", "PETG CF", or "Nylon" differently.
  if (hint === actual || actual.includes(hint) || hint.includes(actual)) {
    return true;
  }

  const aliases: Record<string, string[]> = {
    nylon: ['pa'],
    pa: ['nylon'],
    'petg-cf': ['petg cf', 'petg carbon'],
    'pa-cf': ['nylon cf', 'pa carbon'],
  };

  return (aliases[hint] || []).some((alias) => actual.includes(alias));
}

function colorDistance(a: string, b: string): number {
  // Simple RGB Euclidean distance is good enough for candidate ordering.
  // It is not color-science perfect, but it is predictable and cheap.
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca || !cb) return 999;
  return Math.sqrt(
    Math.pow(ca.r - cb.r, 2) +
      Math.pow(ca.g - cb.g, 2) +
      Math.pow(ca.b - cb.b, 2),
  );
}

function parseHex(value: string) {
  const match = value.match(/#?([0-9a-f]{6})/i);
  if (!match) return null;
  const n = parseInt(match[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function hasAny(value: string, words: string[]): boolean {
  return words.some((word) => value.includes(word));
}

function recommendedMaterialsForIntent(
  intent: PrintIntentSuggestion['intent'],
): string[] {
  switch (intent) {
    case 'decorative':
      return ['PLA', 'PLA Matte', 'PLA Silk'];
    case 'technical':
      return ['PETG', 'PETG-CF', 'ABS', 'ASA', 'PA-CF'];
    case 'heat_resistant':
      return ['ASA', 'ABS', 'PC', 'PA', 'PA-CF'];
    case 'flexible':
      return ['TPU', 'TPE'];
    default:
      return ['PLA', 'PETG'];
  }
}
