import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { TigerBrandMapping } from './tiger-brand-mapping.entity';
import { TigerMaterialMapping } from './tiger-material-mapping.entity';
import { TigerTypeMapping } from './tiger-type-mapping.entity';
import { TigerTagApiService } from './tigertag-api.service';

type TigerTagSyncKind = 'brands' | 'materials' | 'aspects';

@Processor('tigertag-sync')
export class TigerTagProcessor extends WorkerHost {
  private readonly logger = new Logger(TigerTagProcessor.name);

  constructor(
    @InjectRepository(TigerBrandMapping)
    private tigerBrandMappingRepository: Repository<TigerBrandMapping>,
    @InjectRepository(TigerMaterialMapping)
    private tigerMaterialMappingRepository: Repository<TigerMaterialMapping>,
    @InjectRepository(TigerTypeMapping)
    private tigerTypeMappingRepository: Repository<TigerTypeMapping>,
    private tigerTagApiService: TigerTagApiService,
  ) {
    super();
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.log(`Starting TigerTag job ${job.id} (${job.name})`);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Completed TigerTag job ${job.id} (${job.name})`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(
      `Failed TigerTag job ${job.id} (${job.name}): ${error.message}`,
      error.stack,
    );
  }

  async process(job: Job<{ type: TigerTagSyncKind }, any, string>) {
    await job.updateProgress(5);

    if (job.name !== 'sync') {
      throw new Error(`Unknown TigerTag job: ${job.name}`);
    }

    const type = job.data.type;
    if (type === 'brands') return this.syncBrands(job);
    if (type === 'materials') return this.syncMaterials(job);
    if (type === 'aspects') return this.syncAspects(job);

    throw new Error(`Unknown TigerTag sync type: ${type}`);
  }

  private async syncBrands(job: Job) {
    const brands = await this.tigerTagApiService.fetchBrands();
    let count = 0;
    await job.updateProgress(20);

    for (let i = 0; i < brands.length; i++) {
      const brand = brands[i];
      const name = brand.name || brand.label;
      if (!brand.id || !name) continue;

      const existing = await this.tigerBrandMappingRepository.findOne({
        where: { tigerId: brand.id },
      });

      if (!existing) {
        await this.tigerBrandMappingRepository.save(
          this.tigerBrandMappingRepository.create({
            tigerId: brand.id,
            tigerName: name,
            brandId: null,
            organizationId: null,
          }),
        );
        count++;
      } else if (existing.tigerName !== name) {
        await this.tigerBrandMappingRepository.update(existing.id, {
          tigerName: name,
        });
      }

      await this.updateLoopProgress(job, i, brands.length);
    }

    await job.updateProgress(100);
    return { success: true, count, total: brands.length, type: 'brands' };
  }

  private async syncMaterials(job: Job) {
    const materials = await this.tigerTagApiService.fetchMaterials();
    let count = 0;
    await job.updateProgress(20);

    for (let i = 0; i < materials.length; i++) {
      const material = materials[i];
      if (!material.id || !material.label) continue;

      const existing = await this.tigerMaterialMappingRepository.findOne({
        where: { tigerId: material.id },
      });

      if (!existing) {
        await this.tigerMaterialMappingRepository.save(
          this.tigerMaterialMappingRepository.create({
            tigerId: material.id,
            tigerName: material.label,
            materialId: null,
            organizationId: null,
          }),
        );
        count++;
      } else if (existing.tigerName !== material.label) {
        await this.tigerMaterialMappingRepository.update(existing.id, {
          tigerName: material.label,
        });
      }

      await this.updateLoopProgress(job, i, materials.length);
    }

    await job.updateProgress(100);
    return { success: true, count, total: materials.length, type: 'materials' };
  }

  private async syncAspects(job: Job) {
    const aspects = await this.tigerTagApiService.fetchAspects();
    let count = 0;
    await job.updateProgress(20);

    for (let i = 0; i < aspects.length; i++) {
      const aspect = aspects[i];
      const name = aspect.label || aspect.name;
      if (!aspect.id || !name) continue;

      const existing = await this.tigerTypeMappingRepository.findOne({
        where: { tigerId: aspect.id },
      });

      if (!existing) {
        await this.tigerTypeMappingRepository.save(
          this.tigerTypeMappingRepository.create({
            tigerId: aspect.id,
            tigerName: name,
            typeId: null,
            organizationId: null,
          }),
        );
        count++;
      } else if (existing.tigerName !== name) {
        await this.tigerTypeMappingRepository.update(existing.id, {
          tigerName: name,
        });
      }

      await this.updateLoopProgress(job, i, aspects.length);
    }

    await job.updateProgress(100);
    return { success: true, count, total: aspects.length, type: 'aspects' };
  }

  private async updateLoopProgress(job: Job, index: number, total: number) {
    if (total <= 0) return;
    if (index % 25 !== 0 && index !== total - 1) return;
    await job.updateProgress(20 + Math.floor(((index + 1) / total) * 75));
  }
}
