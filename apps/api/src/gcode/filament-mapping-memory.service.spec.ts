import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FilamentMappingMemoryService } from './filament-mapping-memory.service';
import { FilamentMappingMemory } from './filament-mapping-memory.entity';
import { buildSignatureHash } from './filament-signature';

describe('FilamentMappingMemoryService', () => {
  let service: FilamentMappingMemoryService;
  let repo: any;

  beforeEach(async () => {
    repo = {
      findOne: jest.fn(),
      create: jest.fn((x) => ({ ...x })),
      save: jest.fn(async (x) => ({ id: 'm1', ...x })),
      update: jest.fn(),
      find: jest.fn(),
      delete: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilamentMappingMemoryService,
        { provide: getRepositoryToken(FilamentMappingMemory), useValue: repo },
      ],
    }).compile();
    service = module.get(FilamentMappingMemoryService);
  });

  it('insère un nouveau mapping avec usageCount 1', async () => {
    repo.findOne.mockResolvedValue(null);
    const res = await service.recordConfirmations(1, [
      { hint: { material: 'PLA', colorName: 'Noir' }, filamentId: 12 },
    ]);
    expect(repo.save).toHaveBeenCalled();
    expect(res.recorded).toBe(1);
  });

  it('incrémente usageCount si le mapping existe déjà', async () => {
    repo.findOne.mockResolvedValue({ id: 'm1', usageCount: 2 });
    await service.recordConfirmations(1, [
      { hint: { material: 'PLA', colorName: 'Noir' }, filamentId: 12 },
    ]);
    expect(repo.update).toHaveBeenCalledWith(
      'm1',
      expect.objectContaining({ usageCount: 3 }),
    );
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('ignore les mappings sans filamentId', async () => {
    const res = await service.recordConfirmations(1, [
      { hint: { material: 'PLA' }, filamentId: 0 as any },
    ]);
    expect(res.recorded).toBe(0);
  });

  it('construit un index signatureHash -> set de filamentId', async () => {
    const sig = buildSignatureHash({ material: 'PLA', colorName: 'Noir' });
    repo.find.mockResolvedValue([{ signatureHash: sig, filamentId: 12 }, { signatureHash: sig, filamentId: 7 }]);
    const index = await service.getSignatureIndex(1);
    expect(index.get(sig)?.has(12)).toBe(true);
    expect(index.get(sig)?.has(7)).toBe(true);
  });
});
