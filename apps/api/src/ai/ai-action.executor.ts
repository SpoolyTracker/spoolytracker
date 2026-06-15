import { BadRequestException, Injectable } from '@nestjs/common';
import { FilamentService } from '../filament/filament.service';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/notification.entity';
import { AiAction, AiActionType } from './ai-action.entity';

type ExecUser = { organizationId: number; userId: number; [k: string]: any };

@Injectable()
export class AiActionExecutor {
  constructor(
    private readonly filamentService: FilamentService,
    private readonly notificationService: NotificationService,
  ) {}

  async execute(action: Pick<AiAction, 'type' | 'payload'>, user: ExecUser): Promise<Record<string, any>> {
    switch (action.type) {
      case AiActionType.CREATE_CONSUMPTION:
        return this.createConsumption(action.payload, user);
      case AiActionType.UPDATE_STOCK_THRESHOLD:
        return this.updateThreshold(action.payload, user);
      case AiActionType.CREATE_ALERT:
      case AiActionType.PREPARE_NOTIFICATION:
        return this.createAlert(action.payload, user);
      case AiActionType.PROPOSE_SUPPLIER_ORDER:
        return this.proposeSupplierOrder(action.payload);
      default:
        throw new BadRequestException(`Type d'action non exécutable: ${action.type}`);
    }
  }

  private async createConsumption(payload: any, user: ExecUser): Promise<Record<string, any>> {
    const filamentId = Number(payload?.filament_id);
    const amount = Number(payload?.amount_g);
    if (!Number.isFinite(filamentId) || filamentId <= 0) {
      throw new BadRequestException('filament_id invalide');
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('amount_g doit être strictement positif');
    }

    const filament = await this.filamentService.findOne(filamentId, user.organizationId);
    if ((filament.weightRemaining || 0) < amount) {
      throw new BadRequestException('Quantité supérieure au stock restant');
    }

    const type: 'MANUAL' | 'PRINT' | 'FAIL' =
      payload?.type === 'FAIL' ? 'FAIL' : payload?.type === 'MANUAL' ? 'MANUAL' : 'PRINT';

    await this.filamentService.logConsumption(
      filamentId, amount, type, 'Ajouté via assistant', user.organizationId,
      undefined, undefined, user.userId, user,
    );

    let remainingAfter = Math.round(((filament.weightRemaining || 0) - amount) * 100) / 100;
    try {
      const updated = await this.filamentService.findOne(filamentId, user.organizationId);
      if (updated && typeof updated.weightRemaining === 'number') {
        remainingAfter = Math.round(updated.weightRemaining * 100) / 100;
      }
    } catch {
      // garder la valeur optimiste si la relecture échoue
    }

    return {
      executed: true,
      filament_id: filamentId,
      amount_g: amount,
      remaining_after_g: remainingAfter,
    };
  }

  private async updateThreshold(payload: any, user: ExecUser): Promise<Record<string, any>> {
    const filamentId = Number(payload?.filament_id);
    const threshold = Number(payload?.threshold);
    if (!Number.isFinite(filamentId) || filamentId <= 0) {
      throw new BadRequestException('filament_id invalide');
    }
    if (!Number.isFinite(threshold) || threshold < 0) {
      throw new BadRequestException('threshold invalide');
    }
    await this.filamentService.findOne(filamentId, user.organizationId);
    await this.filamentService.update(filamentId, { lowStockThreshold: threshold }, user.organizationId, user);
    return { executed: true, filament_id: filamentId, threshold };
  }

  private async createAlert(payload: any, user: ExecUser): Promise<Record<string, any>> {
    const message = String(payload?.message || '').trim();
    if (!message) {
      throw new BadRequestException('message requis pour une alerte');
    }
    const title = String(payload?.title || 'Alerte stock').slice(0, 200);
    await this.notificationService.create(
      user.userId, NotificationType.LOW_STOCK, title, message, { source: 'ai' },
    );
    return { executed: true, notified: true };
  }

  private proposeSupplierOrder(payload: any): Record<string, any> {
    const raw = typeof payload?.url === 'string' ? payload.url : null;
    let url: string | null = null;
    if (raw) {
      try {
        const parsed = new URL(raw);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          url = raw;
        }
      } catch {
        url = null;
      }
    }
    return { executed: true, navigational: true, url };
  }
}
