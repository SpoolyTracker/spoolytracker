// Mock ESM-only packages that Jest cannot transform
jest.mock('marked', () => ({
  marked: jest.fn((v: string) => v),
  __esModule: true,
}));
jest.mock('expo-server-sdk', () => ({
  Expo: jest.fn().mockImplementation(() => ({})),
  __esModule: true,
}));

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FilamentMatchingService } from './filament-matching.service';
import { Filament } from '../filament/filament.entity';
import { buildSignatureHash } from './filament-signature';

describe('FilamentMatchingService — bonus previously_confirmed', () => {
  let service: FilamentMatchingService;

  const filaments = [
    { id: 12, material: { name: 'PLA' }, brand: { name: 'BambuLab' }, colorHex: '#000000', color: 'Noir', weightRemaining: 1000, nozzleTempMin: 200, nozzleTempMax: 230 },
    { id: 7, material: { name: 'PLA' }, brand: { name: 'BambuLab' }, colorHex: '#000000', color: 'Noir', weightRemaining: 1000 },
  ];

  beforeEach(async () => {
    const repo = { find: jest.fn().mockResolvedValue(filaments) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilamentMatchingService,
        { provide: getRepositoryToken(Filament), useValue: repo },
      ],
    }).compile();
    service = module.get(FilamentMatchingService);
  });

  const inspection = {
    tools: ['T0'],
    perTool: { T0: { gramDefault: 50 } },
    toolHints: { T0: { tool: 'T0', material: 'PLA', colorName: 'Noir', colorHex: '#000000', brand: 'BambuLab' } },
  };

  it('place la bobine déjà confirmée en tête quand canLearn et index fournis', async () => {
    const sig = buildSignatureHash(inspection.toolHints.T0 as any);
    const index = new Map<string, Set<number>>([[sig, new Set([7])]]);

    const result = await service.suggestForInspection(1, inspection, 'piece.gcode', { canLearn: true, signatureIndex: index });
    const best = result.toolSuggestions[0].candidates[0];
    expect(best.filamentId).toBe(7);
    expect(best.reasons).toContain('previously_confirmed');
  });

  it('ne change rien sans canLearn (comportement Free identique)', async () => {
    const sig = buildSignatureHash(inspection.toolHints.T0 as any);
    const index = new Map<string, Set<number>>([[sig, new Set([7])]]);

    const result = await service.suggestForInspection(1, inspection, 'piece.gcode', { canLearn: false, signatureIndex: index });
    const reasons = result.toolSuggestions[0].candidates.flatMap((c: any) => c.reasons);
    expect(reasons).not.toContain('previously_confirmed');
  });
});
