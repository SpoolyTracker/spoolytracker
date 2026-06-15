import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FilamentMappingMemory } from './filament-mapping-memory.entity';
import { buildSignatureHash, normalizeSignaturePart, MappingHint } from './filament-signature';

export interface MappingConfirmation {
  hint: MappingHint;
  filamentId: number;
}

@Injectable()
export class FilamentMappingMemoryService {
  constructor(
    @InjectRepository(FilamentMappingMemory)
    private readonly repo: Repository<FilamentMappingMemory>,
  ) {}

  async recordConfirmations(
    organizationId: number,
    confirmations: MappingConfirmation[],
  ): Promise<{ recorded: number }> {
    let recorded = 0;
    for (const c of confirmations) {
      const filamentId = Number(c?.filamentId);
      if (!Number.isFinite(filamentId) || filamentId <= 0) continue;

      const signatureHash = buildSignatureHash(c.hint || {});
      const existing = await this.repo.findOne({
        where: { organizationId, signatureHash, filamentId },
      });

      if (existing) {
        await this.repo.update(existing.id, {
          usageCount: existing.usageCount + 1,
          lastUsedAt: new Date(),
        });
      } else {
        await this.repo.save(
          this.repo.create({
            organizationId,
            sourceMaterial: normalizeSignaturePart(c.hint?.material) || null,
            sourceColor: normalizeSignaturePart(c.hint?.colorName) || null,
            sourceColorHex: c.hint?.colorHex || null,
            sourceBrand: normalizeSignaturePart(c.hint?.brand) || null,
            sourcePresetName: normalizeSignaturePart(c.hint?.presetName) || null,
            signatureHash,
            filamentId,
            usageCount: 1,
            lastUsedAt: new Date(),
          }),
        );
      }
      recorded += 1;
    }
    return { recorded };
  }

  async getSignatureIndex(organizationId: number): Promise<Map<string, Set<number>>> {
    const rows = await this.repo.find({ where: { organizationId } });
    const index = new Map<string, Set<number>>();
    for (const row of rows) {
      const set = index.get(row.signatureHash) ?? new Set<number>();
      set.add(row.filamentId);
      index.set(row.signatureHash, set);
    }
    return index;
  }

  async listForOrg(organizationId: number): Promise<FilamentMappingMemory[]> {
    return this.repo.find({
      where: { organizationId },
      order: { usageCount: 'DESC', lastUsedAt: 'DESC' },
      take: 200,
    });
  }

  async deleteForOrg(id: string, organizationId: number): Promise<void> {
    await this.repo.delete({ id, organizationId });
  }
}
