import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiMemory } from './ai-memory.entity';

type TenantUser = { organizationId: number; userId: number };

export interface CapturedMemory {
  type: string;
  content: string;
  tags?: string[];
  metadata?: Record<string, any> | null;
}

@Injectable()
export class AiMemoryService {
  constructor(
    @InjectRepository(AiMemory)
    private readonly repo: Repository<AiMemory>,
  ) {}

  async persistCaptured(memory: CapturedMemory, user: TenantUser): Promise<AiMemory> {
    return this.repo.save(
      this.repo.create({
        organizationId: user.organizationId,
        userId: user.userId,
        type: (memory.type || 'preference').slice(0, 32),
        content: memory.content,
        tags: Array.isArray(memory.tags) ? memory.tags : [],
        metadata: memory.metadata ?? null,
      }),
    );
  }

  async list(user: TenantUser): Promise<AiMemory[]> {
    return this.repo.find({
      where: { organizationId: user.organizationId, userId: user.userId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async searchForSnapshot(
    user: TenantUser,
    message: string,
    limit = 50,
  ): Promise<Array<{ type: string; content: string; tags: string[] }>> {
    const rows = await this.list(user);
    const tokens = (message || '')
      .toLowerCase()
      .replace(/'/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 3);

    const scored = rows
      .map((row) => {
        const haystack = `${row.content} ${(row.tags || []).join(' ')}`.toLowerCase();
        const score = tokens.reduce((acc, t) => acc + (haystack.includes(t) ? 1 : 0), 0);
        return { row, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    const selected = scored.some((s) => s.score > 0)
      ? scored.filter((s) => s.score > 0)
      : scored;

    return selected.map(({ row }) => ({ type: row.type, content: row.content, tags: row.tags || [] }));
  }

  async delete(id: string, user: TenantUser): Promise<void> {
    await this.repo.delete({ id, organizationId: user.organizationId, userId: user.userId });
  }
}
