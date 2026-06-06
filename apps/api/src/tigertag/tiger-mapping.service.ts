import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { TigerBrandMapping } from './tiger-brand-mapping.entity';
import { TigerMaterialMapping } from './tiger-material-mapping.entity';
import { TigerTypeMapping } from './tiger-type-mapping.entity';
import { FilamentBrand } from '../filament/brand.entity';
import { FilamentMaterial } from '../filament/filament-material.entity';
import { FilamentType } from '../filament/filament-type.entity';

@Injectable()
export class TigerMappingService {
  constructor(
    @InjectRepository(TigerBrandMapping)
    private brandMappingRepo: Repository<TigerBrandMapping>,
    @InjectRepository(TigerMaterialMapping)
    private materialMappingRepo: Repository<TigerMaterialMapping>,
    @InjectRepository(TigerTypeMapping)
    private typeMappingRepo: Repository<TigerTypeMapping>,
  ) {}

  async createBrandMapping(
    tigerId: number,
    spoolyBrand: FilamentBrand,
    tigerName?: string,
  ) {
    const existing = await this.brandMappingRepo.findOne({
      where: { tigerId },
    });
    if (existing) {
      // Update if needed, or just return.
      // Maybe we want to update the link if it was null?
      if (!existing.brand) {
        existing.brand = spoolyBrand;
        return this.brandMappingRepo.save(existing);
      }
      return existing;
    }
    const mapping = this.brandMappingRepo.create({
      tigerId,
      tigerName: tigerName || 'Unknown',
      brand: spoolyBrand,
    });
    return this.brandMappingRepo.save(mapping);
  }

  async createMaterialMapping(
    tigerId: number,
    spoolyMaterial: FilamentMaterial,
    tigerName?: string,
  ) {
    const existing = await this.materialMappingRepo.findOne({
      where: { tigerId },
    });
    if (existing) {
      if (!existing.material) {
        existing.material = spoolyMaterial;
        return this.materialMappingRepo.save(existing);
      }
      return existing;
    }
    const mapping = this.materialMappingRepo.create({
      tigerId,
      tigerName: tigerName || 'Unknown',
      material: spoolyMaterial,
    });
    return this.materialMappingRepo.save(mapping);
  }

  async createTypeMapping(
    tigerId: number,
    spoolyType: FilamentType,
    tigerName?: string,
  ) {
    const existing = await this.typeMappingRepo.findOne({ where: { tigerId } });
    if (existing) {
      if (!existing.type) {
        existing.type = spoolyType;
        return this.typeMappingRepo.save(existing);
      }
      return existing;
    }
    const mapping = this.typeMappingRepo.create({
      tigerId,
      tigerName: tigerName || 'Unknown',
      type: spoolyType,
    });
    return this.typeMappingRepo.save(mapping);
  }

  async getMappingsForSync(organizationId?: number | null) {
    const whereConditions: any[] = [{ organizationId: IsNull() }];
    if (organizationId) {
      whereConditions.push({ organizationId });
    }

    const [brands, materials, types] = await Promise.all([
      this.brandMappingRepo.find({
        where: whereConditions,
        select: ['tigerId', 'tigerName', 'brandId'],
      }),
      this.materialMappingRepo.find({
        where: whereConditions,
        select: ['tigerId', 'tigerName', 'materialId'],
      }),
      this.typeMappingRepo.find({
        where: whereConditions,
        select: ['tigerId', 'tigerName', 'typeId'],
      }),
    ]);

    return { brands, materials, types };
  }
}
