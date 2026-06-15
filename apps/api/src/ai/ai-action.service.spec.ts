// Mock ESM-only packages that Jest cannot transform
jest.mock('marked', () => ({
  marked: jest.fn((v: string) => v),
  __esModule: true,
}));

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { AiActionPersistenceService } from './ai-action.service';
import { AiAction, AiActionStatus, AiActionType } from './ai-action.entity';
import { AiActionExecutor } from './ai-action.executor';

describe('AiActionPersistenceService', () => {
  let service: AiActionPersistenceService;
  let repo: any;
  let executor: { execute: jest.Mock };

  const user = { organizationId: 1, userId: 7 };

  beforeEach(async () => {
    repo = {
      create: jest.fn((x) => ({ ...x })),
      save: jest.fn(async (x) => ({ id: 'a1', ...x })),
      find: jest.fn(),
      findOne: jest.fn(),
    };
    executor = { execute: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiActionPersistenceService,
        { provide: getRepositoryToken(AiAction), useValue: repo },
        { provide: AiActionExecutor, useValue: executor },
      ],
    }).compile();

    service = module.get(AiActionPersistenceService);
  });

  it('persists proposed actions with real ids', async () => {
    const saved = await service.persistProposals(
      [{ type: AiActionType.CREATE_CONSUMPTION, label: 'Conso 50g', payload: { filament_id: '12', amount_g: 50 } }],
      user,
    );
    expect(repo.save).toHaveBeenCalled();
    expect(saved[0].status).toBe(AiActionStatus.PROPOSED);
    expect(saved[0].id).toBe('a1');
  });

  it('approves: executes and marks executed with result', async () => {
    repo.findOne.mockResolvedValue({
      id: 'a1', organizationId: 1, userId: 7, status: AiActionStatus.PROPOSED,
      type: AiActionType.CREATE_CONSUMPTION, payload: { filament_id: '12', amount_g: 50 },
    });
    executor.execute.mockResolvedValue({ executed: true, remaining_after_g: 450 });

    const result = await service.approve('a1', user);

    expect(executor.execute).toHaveBeenCalled();
    expect(result.status).toBe(AiActionStatus.EXECUTED);
    expect(result.result!.remaining_after_g).toBe(450);
  });

  it('approves: marks failed when executor throws', async () => {
    repo.findOne.mockResolvedValue({
      id: 'a1', organizationId: 1, userId: 7, status: AiActionStatus.PROPOSED,
      type: AiActionType.CREATE_CONSUMPTION, payload: {},
    });
    executor.execute.mockRejectedValue(new Error('Quantité supérieure au stock restant'));

    const result = await service.approve('a1', user);

    expect(result.status).toBe(AiActionStatus.FAILED);
    expect(result.failureReason).toContain('stock restant');
  });

  it('rejects a proposed action', async () => {
    repo.findOne.mockResolvedValue({
      id: 'a1', organizationId: 1, userId: 7, status: AiActionStatus.PROPOSED,
      type: AiActionType.CREATE_ALERT, payload: {},
    });
    const result = await service.reject('a1', user);
    expect(result.status).toBe(AiActionStatus.REJECTED);
    expect(executor.execute).not.toHaveBeenCalled();
  });

  it('throws 404 when the action belongs to another tenant', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.approve('a1', user)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws 409 when approving a non-proposed action', async () => {
    repo.findOne.mockResolvedValue({
      id: 'a1', organizationId: 1, userId: 7, status: AiActionStatus.EXECUTED,
      type: AiActionType.CREATE_ALERT, payload: {},
    });
    await expect(service.approve('a1', user)).rejects.toBeInstanceOf(ConflictException);
  });
});
