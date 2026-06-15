import { ConflictException, HttpException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiAction, AiActionStatus, AiActionType } from './ai-action.entity';
import { AiActionExecutor } from './ai-action.executor';

type TenantUser = { organizationId: number; userId: number; [k: string]: any };

export interface ProposalInput {
  type: AiActionType;
  label: string;
  payload: Record<string, any>;
}

@Injectable()
export class AiActionPersistenceService {
  private readonly logger = new Logger(AiActionPersistenceService.name);

  constructor(
    @InjectRepository(AiAction)
    private readonly repo: Repository<AiAction>,
    private readonly executor: AiActionExecutor,
  ) {}

  async persistProposals(proposals: ProposalInput[], user: TenantUser): Promise<AiAction[]> {
    const saved: AiAction[] = [];
    for (const proposal of proposals) {
      if (!Object.values(AiActionType).includes(proposal.type)) {
        continue;
      }
      const entity = this.repo.create({
        organizationId: user.organizationId,
        userId: user.userId,
        type: proposal.type,
        label: (proposal.label || proposal.type).slice(0, 200),
        payload: proposal.payload || {},
        status: AiActionStatus.PROPOSED,
        result: null,
        failureReason: null,
      });
      saved.push(await this.repo.save(entity));
    }
    return saved;
  }

  async list(user: TenantUser, status?: AiActionStatus): Promise<AiAction[]> {
    return this.repo.find({
      where: {
        organizationId: user.organizationId,
        userId: user.userId,
        ...(status ? { status } : {}),
      },
      order: { createdAt: 'DESC' },
      // Phase 1: cap à 50, pagination à introduire si besoin.
      take: 50,
    });
  }

  async approve(id: string, user: TenantUser): Promise<AiAction> {
    const action = await this.getProposed(id, user);
    try {
      const result = await this.executor.execute(action, user);
      action.status = AiActionStatus.EXECUTED;
      action.result = result;
      action.failureReason = null;
    } catch (error) {
      if (!(error instanceof HttpException)) {
        // Erreur inattendue (bug/infra) : on trace pour le diagnostic, tout en persistant l'échec.
        this.logger.error(
          `Echec inattendu de l'exécution de l'action ${action.id}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
      action.status = AiActionStatus.FAILED;
      action.failureReason = (error instanceof Error ? error.message : String(error)).slice(0, 500);
    }
    return this.repo.save(action);
  }

  async reject(id: string, user: TenantUser): Promise<AiAction> {
    const action = await this.getProposed(id, user);
    action.status = AiActionStatus.REJECTED;
    return this.repo.save(action);
  }

  private async getProposed(id: string, user: TenantUser): Promise<AiAction> {
    const action = await this.repo.findOne({
      where: { id, organizationId: user.organizationId, userId: user.userId },
    });
    if (!action) {
      throw new NotFoundException('Action introuvable');
    }
    if (action.status !== AiActionStatus.PROPOSED) {
      throw new ConflictException(`Action non modifiable depuis le statut ${action.status}`);
    }
    return action;
  }
}
