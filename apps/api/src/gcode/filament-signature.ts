import { createHash } from 'node:crypto';

export interface MappingHint {
  material?: string | null;
  colorName?: string | null;
  colorHex?: string | null;
  brand?: string | null;
  presetName?: string | null;
}

export function normalizeSignaturePart(value?: string | null): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function buildSignatureHash(hint: MappingHint): string {
  const parts = [
    normalizeSignaturePart(hint.material),
    normalizeSignaturePart(hint.colorName),
    normalizeSignaturePart(hint.colorHex),
    normalizeSignaturePart(hint.brand),
    normalizeSignaturePart(hint.presetName),
  ];
  return createHash('sha256').update(parts.join('|')).digest('hex');
}
