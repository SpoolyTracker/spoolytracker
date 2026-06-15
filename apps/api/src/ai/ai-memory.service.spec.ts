import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AiMemoryService } from './ai-memory.service';
import { AiMemory } from './ai-memory.entity';

describe('AiMemoryService', () => {
  let service: AiMemoryService;
  let repo: any;
  const user = { organizationId: 1, userId: 7 };

  beforeEach(async () => {
    repo = {
      create: jest.fn((x) => ({ ...x })),
      save: jest.fn(async (x) => ({ id: 'mem1', ...x })),
      find: jest.fn(),
      delete: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [AiMemoryService, { provide: getRepositoryToken(AiMemory), useValue: repo }],
    }).compile();
    service = module.get(AiMemoryService);
  });

  it('persiste une mémoire capturée', async () => {
    const saved = await service.persistCaptured({ type: 'preference', content: 'seuil PLA noir 2kg', tags: ['pla'] }, user);
    expect(repo.save).toHaveBeenCalled();
    expect(saved.id).toBe('mem1');
    expect(saved.organizationId).toBe(1);
    expect(saved.userId).toBe(7);
  });

  it('liste par tenant', async () => {
    repo.find.mockResolvedValue([{ id: 'mem1' }]);
    const items = await service.list(user);
    expect(repo.find).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: 1, userId: 7 } }));
    expect(items).toHaveLength(1);
  });

  it('recherche pour le snapshot et renvoie un format léger', async () => {
    repo.find.mockResolvedValue([
      { type: 'preference', content: 'garder 200g de PLA Matte', tags: ['pla'] },
      { type: 'correction', content: 'ce projet consomme 1.2kg', tags: [] },
    ]);
    const out = await service.searchForSnapshot(user, 'combien de pla');
    expect(out[0]).toEqual({ type: 'preference', content: 'garder 200g de PLA Matte', tags: ['pla'] });
  });

  it('supprime par tenant', async () => {
    await service.delete('mem1', user);
    expect(repo.delete).toHaveBeenCalledWith({ id: 'mem1', organizationId: 1, userId: 7 });
  });
});
