import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { BrandCatalog } from './brand-catalog.entity'; // Admin defined catalog
import { FilamentBrand } from './brand.entity';
import { FilamentMaterial } from './filament-material.entity';
import { FilamentType } from './filament-type.entity';
import { FilamentColorReference } from './filament-color-reference.entity';

interface SpoolmanFilament {
  id: string;
  manufacturer: string;
  name: string;
  material: string;
  color_name?: string;
  color_hex?: string;
  color_hexes?: string[];
  multi_color_hexes?: string[] | string;
  density: number; // g/cm3
  weight: number;
  spool_weight: number;
  diameter: number;
  extruder_temp: number; // Recommended temp
  bed_temp: number; // Recommended bed temp
  finish?: string;
  pattern?: string;
  translucent?: boolean;
  glow?: boolean;
  multi_color_direction?: string;
}

@Injectable()
export class SpoolmanService {
  private readonly logger = new Logger(SpoolmanService.name);
  private readonly FILAMENTS_URL =
    'https://donkie.github.io/SpoolmanDB/filaments.json';

  constructor(
    @InjectRepository(BrandCatalog)
    private brandCatalogRepo: Repository<BrandCatalog>,
    @InjectRepository(FilamentBrand)
    private brandRepo: Repository<FilamentBrand>,
    @InjectRepository(FilamentMaterial)
    private materialRepo: Repository<FilamentMaterial>,
    @InjectRepository(FilamentType)
    private typeRepo: Repository<FilamentType>,
    @InjectRepository(FilamentColorReference)
    private colorReferenceRepo: Repository<FilamentColorReference>,
  ) {}

  private calculateSpoolmanStats(filaments: SpoolmanFilament[]) {
    const stats = new Map<
      string,
      {
        count: number;
        densitySum: number;
        nozzleSum: number;
        bedSum: number;
        minNozzle: number;
        maxNozzle: number;
        minBed: number;
        maxBed: number;
      }
    >();

    for (const f of filaments) {
      if (!f.manufacturer || !f.material) continue;

      const key = `${f.manufacturer.trim().toLowerCase()}|${f.material.trim().toLowerCase()}`;

      if (!stats.has(key)) {
        stats.set(key, {
          count: 0,
          densitySum: 0,
          nozzleSum: 0,
          bedSum: 0,
          minNozzle: 999,
          maxNozzle: 0,
          minBed: 999,
          maxBed: 0,
        });
      }

      const s = stats.get(key)!;
      s.count++;
      if (f.density) s.densitySum += f.density;
      if (f.extruder_temp) {
        s.nozzleSum += f.extruder_temp;
        if (f.extruder_temp < s.minNozzle) s.minNozzle = f.extruder_temp;
        if (f.extruder_temp > s.maxNozzle) s.maxNozzle = f.extruder_temp;
      }
      if (f.bed_temp) {
        s.bedSum += f.bed_temp;
        if (f.bed_temp < s.minBed) s.minBed = f.bed_temp;
        if (f.bed_temp > s.maxBed) s.maxBed = f.bed_temp;
      }
    }
    return stats;
  }

  private parseSpoolmanHexes(f: SpoolmanFilament): string[] {
    const rawHexes =
      f.color_hexes ||
      f.multi_color_hexes ||
      (f.color_hex ? [f.color_hex] : []);

    const list = Array.isArray(rawHexes)
      ? rawHexes
      : String(rawHexes)
          .split(',')
          .map((hex) => hex.trim());

    return list
      .filter(Boolean)
      .map((hex) => (hex.startsWith('#') ? hex : `#${hex}`))
      .map((hex) => hex.toUpperCase());
  }

  private findTypeForSpoolmanName(
    spoolmanName: string,
    types: FilamentType[],
  ): FilamentType | null {
    const normalizedName = spoolmanName.toLowerCase();
    const candidates = types
      .filter((type) => type.name.toLowerCase() !== 'generic')
      .filter((type) => normalizedName.includes(type.name.toLowerCase()))
      .sort((a, b) => b.name.length - a.name.length);

    return candidates[0] || null;
  }

  private async syncSpoolmanColorReferences(
    filaments: SpoolmanFilament[],
  ): Promise<{ created: number; updated: number; skipped: number }> {
    const brands = await this.brandRepo.find();
    const materials = await this.materialRepo.find();
    const types = await this.typeRepo.find();

    const brandByName = new Map(
      brands.map((brand) => [brand.name.trim().toLowerCase(), brand]),
    );
    const materialByName = new Map(
      materials.map((material) => [
        material.name.trim().toLowerCase(),
        material,
      ]),
    );

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const f of filaments) {
      const hexes = this.parseSpoolmanHexes(f);
      const colorName = (f.color_name || f.name)?.trim();

      if (!f.manufacturer || !f.material || !colorName || hexes.length === 0) {
        skipped++;
        continue;
      }

      const brand = brandByName.get(f.manufacturer.trim().toLowerCase());
      const material = materialByName.get(f.material.trim().toLowerCase());

      if (!brand || !material) {
        skipped++;
        continue;
      }

      const type = this.findTypeForSpoolmanName(f.name || '', types);
      const sourceExternalId = f.id ? String(f.id) : null;

      let existing = await this.colorReferenceRepo
        .createQueryBuilder('color')
        .where('color.brandId = :brandId', { brandId: brand.id })
        .andWhere('color.materialId = :materialId', {
          materialId: material.id,
        })
        .andWhere(
          type ? 'color.typeId = :typeId' : 'color.typeId IS NULL',
          type ? { typeId: type.id } : {},
        )
        .andWhere('color.organizationId IS NULL')
        .andWhere('LOWER(color.name) = LOWER(:name)', { name: colorName })
        .getOne();

      if (!existing && sourceExternalId) {
        existing = await this.colorReferenceRepo.findOne({
          where: { source: 'spoolman', sourceExternalId },
        });
      }

      if (existing) {
        let changed = false;
        if (existing.primaryHex !== hexes[0]) {
          existing.primaryHex = hexes[0];
          changed = true;
        }
        if ((existing.hexes || []).join(',') !== hexes.join(',')) {
          existing.hexes = hexes;
          changed = true;
        }
        if (!existing.sourceExternalId && sourceExternalId) {
          existing.sourceExternalId = sourceExternalId;
          changed = true;
        }
        if (existing.finish !== (f.finish ?? null)) {
          existing.finish = f.finish ?? null;
          changed = true;
        }
        if (existing.pattern !== (f.pattern ?? null)) {
          existing.pattern = f.pattern ?? null;
          changed = true;
        }
        if (existing.multiColorDirection !== (f.multi_color_direction ?? null)) {
          existing.multiColorDirection = f.multi_color_direction ?? null;
          changed = true;
        }
        if (existing.translucent !== (f.translucent ?? null)) {
          existing.translucent = f.translucent ?? null;
          changed = true;
        }
        if (existing.glow !== (f.glow ?? null)) {
          existing.glow = f.glow ?? null;
          changed = true;
        }
        if (changed) {
          await this.colorReferenceRepo.save(existing);
          updated++;
        }
        continue;
      }

      await this.colorReferenceRepo.save(
        this.colorReferenceRepo.create({
          brandId: brand.id,
          materialId: material.id,
          typeId: type?.id ?? null,
          organizationId: null,
          name: colorName,
          primaryHex: hexes[0],
          hexes,
          source: 'spoolman',
          sourceExternalId,
          finish: f.finish ?? null,
          pattern: f.pattern ?? null,
          multiColorDirection: f.multi_color_direction ?? null,
          translucent: f.translucent ?? null,
          glow: f.glow ?? null,
          isActive: true,
        }),
      );
      created++;
    }

    return { created, updated, skipped };
  }

  async analyzeSpoolmanData() {
    this.logger.log('Starting SpoolmanDB Analysis...');
    try {
      const { data: filaments } = await axios.get<SpoolmanFilament[]>(
        this.FILAMENTS_URL,
      );

      const spoolmanBrands = new Set<string>();
      const spoolmanMaterials = new Set<string>();

      filaments.forEach((f) => {
        if (f.manufacturer) spoolmanBrands.add(f.manufacturer.trim());
        if (f.material) spoolmanMaterials.add(f.material.trim());
      });

      // Get local
      const localBrands = await this.brandRepo.find();
      const localMaterials = await this.materialRepo.find();

      const localBrandNames = new Set(
        localBrands.map((b) => b.name.toLowerCase()),
      );
      const localMaterialNames = new Set(
        localMaterials.map((m) => m.name.toLowerCase()),
      );

      const missingBrands = Array.from(spoolmanBrands)
        .filter((b) => !localBrandNames.has(b.toLowerCase()))
        .sort();
      const missingMaterials = Array.from(spoolmanMaterials)
        .filter((m) => !localMaterialNames.has(m.toLowerCase()))
        .sort();

      // Detect Missing Combinations & Conflicts
      const missingCombinations = [];
      const conflicts = [];

      const existingCatalogs = await this.brandCatalogRepo.find({
        relations: ['brand', 'material'],
      });
      const existingCatalogKeys = new Set(
        existingCatalogs.map(
          (c) =>
            `${c.brand.name.toLowerCase()}|${c.material.name.toLowerCase()}`,
        ),
      );

      // Use stats for conflict detection
      const stats = this.calculateSpoolmanStats(filaments);

      // 1. Find Missing Combinations
      const spoolmanPairs = new Set<string>();
      filaments.forEach((f) => {
        if (f.manufacturer && f.material) {
          spoolmanPairs.add(`${f.manufacturer.trim()}|${f.material.trim()}`);
        }
      });

      for (const pair of spoolmanPairs) {
        const [sBrand, sMaterial] = pair.split('|');
        const sBrandKey = sBrand.toLowerCase();
        const sMaterialKey = sMaterial.toLowerCase();
        const comboKey = `${sBrandKey}|${sMaterialKey}`;

        const localBrand = localBrands.find(
          (b) => b.name.toLowerCase() === sBrandKey,
        );
        const localMaterial = localMaterials.find(
          (m) => m.name.toLowerCase() === sMaterialKey,
        );

        if (localBrand && localMaterial) {
          if (!existingCatalogKeys.has(comboKey)) {
            missingCombinations.push({
              brandId: localBrand.id,
              brandName: localBrand.name,
              materialId: localMaterial.id,
              materialName: localMaterial.name,
            });
          }
        }
      }

      // 2. Find Conflicts in Existing Entries
      for (const entry of existingCatalogs) {
        const key = `${entry.brand.name.trim().toLowerCase()}|${entry.material.name.trim().toLowerCase()}`;
        const s = stats.get(key);
        if (s) {
          const conflict: any = {
            id: entry.id,
            brandName: entry.brand.name,
            materialName: entry.material.name,
            current: {
              density: entry.density_gcm3,
              nozzle_min: entry.nozzle_temp_min,
              nozzle_max: entry.nozzle_temp_max,
              bed_min: entry.bed_temp_min,
              bed_max: entry.bed_temp_max,
            },
            new: {},
          };

          let hasDiff = false;

          // Density
          if (s.densitySum > 0) {
            const avgDensity = parseFloat((s.densitySum / s.count).toFixed(2));
            if (entry.density_gcm3 !== avgDensity) {
              conflict.new.density = avgDensity;
              hasDiff = true;
            }
          }

          // Nozzle
          if (s.nozzleSum > 0) {
            let min = s.minNozzle;
            let max = s.maxNozzle;
            if (s.count === 1 && min === max) {
              min -= 5;
              max += 5;
            }

            if (
              entry.nozzle_temp_min !== min ||
              entry.nozzle_temp_max !== max
            ) {
              conflict.new.nozzle_min = min;
              conflict.new.nozzle_max = max;
              hasDiff = true;
            }
          }

          // Bed
          if (s.bedSum > 0) {
            let min = s.minBed;
            let max = s.maxBed;
            if (s.count === 1 && min === max) {
              min = Math.max(0, min - 5);
              max += 5;
            }

            if (entry.bed_temp_min !== min || entry.bed_temp_max !== max) {
              conflict.new.bed_min = min;
              conflict.new.bed_max = max;
              hasDiff = true;
            }
          }

          if (hasDiff) {
            conflicts.push(conflict);
          }
        }
      }

      return {
        missingBrands,
        missingMaterials,
        missingCombinations,
        conflicts,
      };
    } catch (error) {
      this.logger.error('Failed to analyze SpoolmanDB', error);
      throw error;
    }
  }

  async importSpoolmanData(data: {
    brands: string[];
    materials: string[];
    importCombinations?: boolean;
    updates?: {
      id: number;
      density?: number;
      nozzle_min?: number;
      nozzle_max?: number;
      bed_min?: number;
      bed_max?: number;
    }[];
  }) {
    this.logger.log(
      `Importing... Brands: ${data.brands.length}, Materials: ${data.materials.length}, Combinations: ${data.importCombinations}, Updates: ${data.updates?.length || 0}`,
    );

    // Create Brands
    for (const name of data.brands) {
      const exists = await this.brandRepo.findOne({ where: { name } });
      if (!exists) {
        await this.brandRepo.save(
          this.brandRepo.create({ name, organizationId: null }),
        );
      }
    }

    // Create Materials
    for (const name of data.materials) {
      const exists = await this.materialRepo.findOne({ where: { name } });
      if (!exists) {
        await this.materialRepo.save(
          this.materialRepo.create({ name, organizationId: null }),
        );
      }
    }

    // Import Combinations
    if (data.importCombinations) {
      const analysis = await this.analyzeSpoolmanData();
      const combinations = analysis.missingCombinations;

      if (combinations.length > 0) {
        let genericType = await this.typeRepo.findOne({
          where: { name: 'Generic' },
        });
        if (!genericType) {
          genericType = await this.typeRepo.save(
            this.typeRepo.create({ name: 'Generic', organizationId: null }),
          );
        }

        for (const combo of combinations) {
          await this.brandCatalogRepo.save(
            this.brandCatalogRepo.create({
              brand: { id: combo.brandId } as any,
              material: { id: combo.materialId } as any,
              type: genericType,
              isActive: true,
              organizationId: null,
            }),
          );
        }
        this.logger.log(
          `Imported ${combinations.length} missing combinations.`,
        );
      }
    }

    // Apply Updates
    if (data.updates && data.updates.length > 0) {
      for (const update of data.updates) {
        const entry = await this.brandCatalogRepo.findOne({
          where: { id: update.id },
        });
        if (entry) {
          if (update.density !== undefined) entry.density_gcm3 = update.density;
          if (update.nozzle_min !== undefined)
            entry.nozzle_temp_min = update.nozzle_min;
          if (update.nozzle_max !== undefined)
            entry.nozzle_temp_max = update.nozzle_max;
          if (update.bed_min !== undefined) entry.bed_temp_min = update.bed_min;
          if (update.bed_max !== undefined) entry.bed_temp_max = update.bed_max;
          await this.brandCatalogRepo.save(entry);
        }
      }
      this.logger.log(`Applied ${data.updates.length} updates.`);
    }

    // Only sync if we just created combinations to ensure they have data
    if (data.importCombinations) {
      await this.syncSpoolmanData();
    }

    const { data: filaments } = await axios.get<SpoolmanFilament[]>(
      this.FILAMENTS_URL,
    );
    const colorSync = await this.syncSpoolmanColorReferences(filaments);

    return { success: true, colorSync };
  }

  async syncSpoolmanData() {
    this.logger.log('Starting SpoolmanDB sync...');
    try {
      const { data: filaments } = await axios.get<SpoolmanFilament[]>(
        this.FILAMENTS_URL,
      );
      const stats = this.calculateSpoolmanStats(filaments);
      const colorSync = await this.syncSpoolmanColorReferences(filaments);

      const catalogs = await this.brandCatalogRepo.find({
        relations: ['brand', 'material'],
      });
      const updatedCount = 0;

      for (const entry of catalogs) {
        const key = `${entry.brand.name.trim().toLowerCase()}|${entry.material.name.trim().toLowerCase()}`;
        const s = stats.get(key);

        if (s) {
          let changed = false;

          // Density
          if (s.densitySum > 0) {
            const avgDensity = parseFloat((s.densitySum / s.count).toFixed(2));
            if (entry.density_gcm3 !== avgDensity) {
              entry.density_gcm3 = avgDensity;
              changed = true;
            }
          }

          // Nozzle Temp
          if (s.nozzleSum > 0) {
            let min = s.minNozzle;
            let max = s.maxNozzle;
            if (s.count === 1 && min === max) {
              min -= 5;
              max += 5;
            }

            if (s.minNozzle !== 999) entry.nozzle_temp_min = min;
            if (s.maxNozzle !== 0) entry.nozzle_temp_max = max;
            changed = true;
          }

          // Bed Temp
          if (s.bedSum > 0) {
            let min = s.minBed;
            let max = s.maxBed;
            if (s.count === 1 && min === max) {
              min = Math.max(0, min - 5);
              max += 5;
            }

            if (s.minBed !== 999) entry.bed_temp_min = min;
            if (s.maxBed !== 0) entry.bed_temp_max = max;
            changed = true;
          }

          if (changed) {
          }
        }
      }

      this.logger.log(
        `Updated ${updatedCount} catalog entries with SpoolmanDB data`,
      );
      return {
        updated: updatedCount,
        total_analyzed: catalogs.length,
        colorSync,
      };
    } catch (error) {
      this.logger.error('Failed to sync SpoolmanDB', error);
      throw error;
    }
  }
}
