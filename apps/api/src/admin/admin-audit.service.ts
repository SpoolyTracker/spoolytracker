import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AdminAuditLog } from './admin-audit-log.entity';

export interface AuditLogData {
  action: string;
  performedBy: { id: number; username: string };
  targetType?: string;
  targetId?: number;
  targetLabel?: string;
  reason?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
}

export interface AuditLogFilters {
  page?: number;
  limit?: number;
  action?: string;
  performedById?: number;
  targetType?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
}

@Injectable()
export class AdminAuditService {
  private readonly logger = new Logger(AdminAuditService.name);

  constructor(
    @InjectRepository(AdminAuditLog)
    private auditLogRepository: Repository<AdminAuditLog>,
  ) {}

  async log(data: AuditLogData): Promise<AdminAuditLog> {
    const entry = this.auditLogRepository.create({
      action: data.action,
      performedById: data.performedBy.id,
      performedByUsername: data.performedBy.username,
      targetType: data.targetType || null,
      targetId: data.targetId || null,
      targetLabel: data.targetLabel || null,
      reason: data.reason || null,
      metadata: data.metadata || null,
      ipAddress: data.ipAddress || null,
    });

    const saved = await this.auditLogRepository.save(entry);
    this.logger.log(
      `[AUDIT] ${data.performedBy.username} → ${data.action} on ${data.targetType || '-'}#${data.targetId || '-'} | reason: ${data.reason || 'N/A'}`,
    );
    return saved;
  }

  async findAll(
    filters: AuditLogFilters,
  ): Promise<{ items: AdminAuditLog[]; total: number }> {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 25, 100);
    const skip = (page - 1) * limit;

    const qb = this.auditLogRepository.createQueryBuilder('log');

    if (filters.action) {
      qb.andWhere('log.action = :action', { action: filters.action });
    }

    if (filters.performedById) {
      qb.andWhere('log.performedById = :performedById', {
        performedById: filters.performedById,
      });
    }

    if (filters.targetType) {
      qb.andWhere('log.targetType = :targetType', {
        targetType: filters.targetType,
      });
    }

    if (filters.search) {
      qb.andWhere(
        '(log.performedByUsername ILIKE :search OR log.targetLabel ILIKE :search OR log.reason ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    if (filters.startDate) {
      qb.andWhere('log.createdAt >= :startDate', {
        startDate: new Date(filters.startDate),
      });
    }

    if (filters.endDate) {
      qb.andWhere('log.createdAt <= :endDate', {
        endDate: new Date(filters.endDate),
      });
    }

    qb.orderBy('log.createdAt', 'DESC');
    qb.skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async getStats(): Promise<{
    today: number;
    thisWeek: number;
    thisMonth: number;
    total: number;
    topActions: { action: string; count: number }[];
    topAdmins: { username: string; count: number }[];
  }> {
    const now = new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1); // Monday
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [today, thisWeek, thisMonth, total] = await Promise.all([
      this.auditLogRepository
        .createQueryBuilder('log')
        .where('log.createdAt >= :start', { start: startOfDay })
        .getCount(),
      this.auditLogRepository
        .createQueryBuilder('log')
        .where('log.createdAt >= :start', { start: startOfWeek })
        .getCount(),
      this.auditLogRepository
        .createQueryBuilder('log')
        .where('log.createdAt >= :start', { start: startOfMonth })
        .getCount(),
      this.auditLogRepository.count(),
    ]);

    const topActions = await this.auditLogRepository
      .createQueryBuilder('log')
      .select('log.action', 'action')
      .addSelect('COUNT(*)', 'count')
      .groupBy('log.action')
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany();

    const topAdmins = await this.auditLogRepository
      .createQueryBuilder('log')
      .select('log.performedByUsername', 'username')
      .addSelect('COUNT(*)', 'count')
      .groupBy('log.performedByUsername')
      .orderBy('count', 'DESC')
      .limit(5)
      .getRawMany();

    return {
      today,
      thisWeek,
      thisMonth,
      total,
      topActions: topActions.map((a) => ({
        action: a.action,
        count: parseInt(a.count),
      })),
      topAdmins: topAdmins.map((a) => ({
        username: a.username,
        count: parseInt(a.count),
      })),
    };
  }

  /**
   * Cron job: purge audit logs older than 2 years.
   * Runs every day at 3:00 AM.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeOldLogs(): Promise<void> {
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    const result = await this.auditLogRepository.delete({
      createdAt: LessThan(twoYearsAgo),
    });

    if (result.affected && result.affected > 0) {
      this.logger.log(
        `[AUDIT PURGE] Deleted ${result.affected} audit logs older than 2 years.`,
      );
    }
  }
}
