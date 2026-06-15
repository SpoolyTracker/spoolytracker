import { buildSignatureHash, normalizeSignaturePart } from './filament-signature';

describe('filament-signature', () => {
  it('normalise (minuscule, sans accents, trim)', () => {
    expect(normalizeSignaturePart('  Béta Noir ')).toBe('beta noir');
    expect(normalizeSignaturePart(null)).toBe('');
  });

  it('produit un hash stable, insensible à la casse/accents', () => {
    const a = buildSignatureHash({ material: 'PLA', colorName: 'Noir', colorHex: '#000000', brand: 'BambuLab', presetName: 'Bambu PLA' });
    const b = buildSignatureHash({ material: 'pla', colorName: 'noir', colorHex: '#000000', brand: 'bambulab', presetName: 'bambu pla' });
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it('produit un hash différent pour une bobine différente', () => {
    const a = buildSignatureHash({ material: 'PLA', colorName: 'Noir' });
    const b = buildSignatureHash({ material: 'PETG', colorName: 'Noir' });
    expect(a).not.toBe(b);
  });
});
