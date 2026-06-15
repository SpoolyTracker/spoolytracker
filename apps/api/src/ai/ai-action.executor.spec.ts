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
import { BadRequestException } from '@nestjs/common';
import { AiActionExecutor } from './ai-action.executor';
import { AiActionType } from './ai-action.entity';
import { FilamentService } from '../filament/filament.service';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/notification.entity';

describe('AiActionExecutor', () => {
  let executor: AiActionExecutor;
  let filamentService: { findOne: jest.Mock; logConsumption: jest.Mock; update: jest.Mock };
  let notificationService: { create: jest.Mock };

  const user = { organizationId: 1, userId: 7 };

  beforeEach(async () => {
    filamentService = {
      findOne: jest.fn(),
      logConsumption: jest.fn(),
      update: jest.fn(),
    };
    notificationService = { create: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiActionExecutor,
        { provide: FilamentService, useValue: filamentService },
        { provide: NotificationService, useValue: notificationService },
      ],
    }).compile();

    executor = module.get(AiActionExecutor);
  });

  it('executes create_consumption when the spool has enough remaining', async () => {
    filamentService.findOne
      .mockResolvedValueOnce({ id: 12, weightRemaining: 500, organizationId: 1 })
      .mockResolvedValueOnce({ id: 12, weightRemaining: 450, organizationId: 1 });
    filamentService.logConsumption.mockResolvedValue({ id: 99 });

    const result = await executor.execute(
      { type: AiActionType.CREATE_CONSUMPTION, payload: { filament_id: '12', amount_g: 50, type: 'PRINT' } } as any,
      user,
    );

    expect(filamentService.logConsumption).toHaveBeenCalledWith(
      12, 50, 'PRINT', expect.any(String), 1, undefined, undefined, 7, expect.anything(),
    );
    expect(result.remaining_after_g).toBe(450);
  });

  it('rejects create_consumption when amount exceeds remaining', async () => {
    filamentService.findOne.mockResolvedValue({ id: 12, weightRemaining: 30, organizationId: 1 });

    await expect(
      executor.execute(
        { type: AiActionType.CREATE_CONSUMPTION, payload: { filament_id: '12', amount_g: 50 } } as any,
        user,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(filamentService.logConsumption).not.toHaveBeenCalled();
  });

  it('rejects create_consumption with a non-positive amount', async () => {
    await expect(
      executor.execute(
        { type: AiActionType.CREATE_CONSUMPTION, payload: { filament_id: '12', amount_g: 0 } } as any,
        user,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('executes update_stock_threshold', async () => {
    filamentService.findOne.mockResolvedValue({ id: 12, organizationId: 1 });
    filamentService.update.mockResolvedValue({ id: 12, lowStockThreshold: 150 });

    const result = await executor.execute(
      { type: AiActionType.UPDATE_STOCK_THRESHOLD, payload: { filament_id: '12', threshold: 150 } } as any,
      user,
    );

    expect(filamentService.update).toHaveBeenCalledWith(
      12, { lowStockThreshold: 150 }, 1, user,
    );
    expect(result.threshold).toBe(150);
  });

  it('executes create_alert via the notification service', async () => {
    notificationService.create.mockResolvedValue({ id: 5 });

    const result = await executor.execute(
      { type: AiActionType.CREATE_ALERT, payload: { message: 'PLA noir presque vide', title: 'Stock faible' } } as any,
      user,
    );

    expect(notificationService.create).toHaveBeenCalledWith(
      7, NotificationType.LOW_STOCK, 'Stock faible', 'PLA noir presque vide', expect.anything(),
    );
    expect(result.notified).toBe(true);
  });

  it('returns a navigational result for propose_supplier_order without writing', async () => {
    const result = await executor.execute(
      { type: AiActionType.PROPOSE_SUPPLIER_ORDER, payload: { url: 'https://example.com/search' } } as any,
      user,
    );

    expect(result.navigational).toBe(true);
    expect(result.url).toBe('https://example.com/search');
    expect(filamentService.logConsumption).not.toHaveBeenCalled();
  });

  it('executes prepare_notification via the notification service', async () => {
    notificationService.create.mockResolvedValue({ id: 6 });
    const result = await executor.execute(
      { type: AiActionType.PREPARE_NOTIFICATION, payload: { message: 'Rappel', title: 'Info' } } as any,
      user,
    );
    expect(notificationService.create).toHaveBeenCalled();
    expect(result.notified).toBe(true);
  });

  it('drops a non-http(s) supplier url', async () => {
    const result = await executor.execute(
      { type: AiActionType.PROPOSE_SUPPLIER_ORDER, payload: { url: 'javascript:alert(1)' } } as any,
      user,
    );
    expect(result.url).toBeNull();
    expect(result.navigational).toBe(true);
  });
});
