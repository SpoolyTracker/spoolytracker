import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, LessThan, MoreThan, IsNull } from 'typeorm';
import { Filament } from './filament.entity';
import { CreateFilamentDto } from './dto/create-filament.dto';
import {
  ConsumptionLog,
  ConsumptionType,
  PrintStatus,
} from './consumption-log.entity';
import { ConsumeGroupDto } from './dto/consume-group.dto';
import { UserOrganization } from '../organization/user-organization.entity';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/notification.entity';
import { FilamentBrand } from './brand.entity';
import { FilamentMaterial } from './filament-material.entity';
import { FilamentType } from './filament-type.entity';
import { FilamentOption } from './filament-option.entity';
import { BrandCatalog } from './brand-catalog.entity';
import { FilamentColorReference } from './filament-color-reference.entity';
import { StorageUnit } from './storage-unit.entity';
import {
  CreateStorageUnitDto,
  PlaceFilamentDto,
  UpdateStorageUnitDto,
} from './dto/storage-unit.dto';
import { Organization } from '../organization/organization.entity';
import { PLAN_LIMITS } from '../common/constants';
import { isSelfHosted, SELF_HOSTED_PLAN } from '../common/self-hosted';

export interface TigerTagData {
  tagId: string;
  tigerTagVersion?: number;
  productId?: number;
  materialId?: number;
  diameter?: number;
  aspectId1?: number;
  aspectId2?: number;
  typeId?: number;
  brandId?: number;
  unitId?: number;
  transmissionDistance?: number;
  timestamp?: number;
  weightRemaining?: number;
  rawData?: any;
}

import { TigerMappingService } from '../tigertag/tiger-mapping.service';
import { generateSpoolReference } from '../common/utils/reference';

@Injectable()
export class FilamentService {
  constructor(
    @InjectRepository(Filament)
    private filamentRepository: Repository<Filament>,
    @InjectRepository(FilamentBrand)
    private brandRepository: Repository<FilamentBrand>,
    @InjectRepository(FilamentMaterial)
    private materialRepository: Repository<FilamentMaterial>,
    @InjectRepository(FilamentType)
    private typeRepository: Repository<FilamentType>,
    @InjectRepository(FilamentOption)
    private optionRepository: Repository<FilamentOption>,
    @InjectRepository(BrandCatalog)
    private brandCatalogRepository: Repository<BrandCatalog>,
    @InjectRepository(FilamentColorReference)
    private colorReferenceRepository: Repository<FilamentColorReference>,
    @InjectRepository(StorageUnit)
    private storageUnitRepository: Repository<StorageUnit>,
    @InjectRepository(ConsumptionLog)
    private consumptionRepository: Repository<ConsumptionLog>,
    @InjectRepository(UserOrganization)
    private userOrganizationRepository: Repository<UserOrganization>,
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
    private notificationService: NotificationService,
    private tigerMappingService: TigerMappingService,
  ) {}

  async checkPlanLimits(
    organizationId: number,
    user?: any,
    requestedCount: number = 1,
  ) {
    if (isSelfHosted()) return;

    // Bypass for System Admins
    const isSystemAdmin =
      user?.systemRole === 'admin' ||
      user?.systemRole === 'super_admin' ||
      user?.systemRole === 'moderator' ||
      user?.isSuperAdmin;
    if (isSystemAdmin) return;

    const org = await this.organizationRepository.findOne({
      where: { id: organizationId },
    });
    if (!org) throw new NotFoundException('Organization not found');

    const currentSpoolCount = await this.filamentRepository.count({
      where: {
        organization: { id: organizationId },
        weightRemaining: MoreThan(0),
      },
    });

    const limits = (PLAN_LIMITS as any)[(org.plan || 'free').toLowerCase()];
    if (
      limits.maxSpoolsPerOrg !== Infinity &&
      currentSpoolCount + (requestedCount - 1) >= limits.maxSpoolsPerOrg
    ) {
      throw new BadRequestException(
        `Plan limit reached: This organization cannot exceed ${limits.maxSpoolsPerOrg} spools. You are trying to add ${requestedCount} spool(s) but only have room for ${Math.max(0, limits.maxSpoolsPerOrg - currentSpoolCount)}.`,
      );
    }

    if (org.requiresQuotaSelection) {
      throw new ForbiddenException(
        'You must resolve your quota restrictions before adding new filaments.',
      );
    }
  }

  async evaluateOrganizationQuota(organizationId: number) {
    const org = await this.organizationRepository.findOne({
      where: { id: organizationId },
    });
    if (!org) return;

    if (isSelfHosted()) {
      await this.organizationRepository.update(organizationId, {
        requiresQuotaSelection: false,
      });
      await this.filamentRepository.update(
        { organization: { id: organizationId } },
        { isLocked: false },
      );
      return;
    }

    const limits = (PLAN_LIMITS as any)[(org.plan || 'free').toLowerCase()];
    if (limits.maxSpoolsPerOrg === Infinity) {
      if (org.requiresQuotaSelection) {
        await this.organizationRepository.update(organizationId, {
          requiresQuotaSelection: false,
        });
      }
      return;
    }

    const activeSpoolCount = await this.filamentRepository.count({
      where: {
        organization: { id: organizationId },
        isLocked: false,
        weightRemaining: MoreThan(0),
      },
    });

    if (activeSpoolCount > limits.maxSpoolsPerOrg) {
      if (!org.requiresQuotaSelection) {
        await this.organizationRepository.update(organizationId, {
          requiresQuotaSelection: true,
        });
        // We don't automatically lock spools here, we let the user choose which ones to keep in resolve-quota
        // But we could lock the most recent ones if we wanted to be proactive.
        // For now, setting the flag is enough to trigger the UI blocker.
      }
    } else if (
      org.requiresQuotaSelection &&
      activeSpoolCount <= limits.maxSpoolsPerOrg
    ) {
      await this.organizationRepository.update(organizationId, {
        requiresQuotaSelection: false,
      });
      // AUTO-UNLOCK filaments since we are now within limits
      await this.filamentRepository.update(
        { organization: { id: organizationId } },
        { isLocked: false },
      );
    }
  }

  async create(
    createFilamentDto: CreateFilamentDto,
    organizationId?: number,
    user?: any,
  ): Promise<Filament> {
    const {
      brandId,
      materialId,
      typeIds,
      color,
      colors,
      options,
      quantity = 1,
      ...rest
    } = createFilamentDto as any;

    const targetOrgId =
      organizationId || (createFilamentDto as any).organizationId;

    if (targetOrgId) {
      await this.checkPlanLimits(targetOrgId, user, quantity);
    }

    const count = Math.max(1, Math.min(quantity, 50)); // Cap at 50 for safety
    let firstSavedFilament: Filament | null = null;

    for (let i = 0; i < count; i++) {
      const filament = this.filamentRepository.create(
        rest,
      ) as unknown as Filament;

      if (brandId) {
        const brand = await this.brandRepository.findOne({
          where: { id: brandId },
        });
        filament.brand = brand || null;
      }
      if (materialId) {
        const material = await this.materialRepository.findOne({
          where: { id: materialId },
        });
        filament.material = material || null;
      }
      if (typeIds && typeIds.length > 0) {
        const types = await this.typeRepository.findBy({ id: In(typeIds) });
        filament.types = types;
      }

      // Handle color array
      filament.color = color;
      filament.colors = colors || (color ? [color] : []);

      if (options && options.length > 0) {
        const filamentOptions = await this.optionRepository.findBy({
          id: In(options),
        });
        filament.options = filamentOptions;
      }

      filament.virtualWeightRemaining = filament.weightRemaining;
      filament.plannedWeight = 0;
      filament.organizationId = targetOrgId;

      const { tigerBrandId, tigerMaterialId, tigerTypeId } =
        createFilamentDto as any;
      if (tigerBrandId) filament.tigerBrandId = tigerBrandId;
      if (tigerMaterialId) filament.tigerMaterialId = tigerMaterialId;
      if (tigerTypeId) filament.tigerTypeId = tigerTypeId;

      if (!filament.spoolReference) {
        filament.spoolReference = generateSpoolReference();
      }

      const savedFilament = await this.filamentRepository.save(filament);
      if (i === 0) firstSavedFilament = savedFilament;

      // Notify only once for bulk creation or once per spool? Let's do once for first or summary if possible.
      // For now, once per spool is noisy but matches existing logic.
      if (targetOrgId && user && user.userId && i === 0) {
        const message =
          count > 1
            ? `${user.firstName || 'Un membre'} a ajouté ${count} nouvelles bobines de ${savedFilament.brand?.name || 'filament'} ${savedFilament.types?.[0]?.name || ''}.`
            : `${user.firstName || 'Un membre'} a ajouté une nouvelle bobine de ${savedFilament.brand?.name || 'filament'} ${savedFilament.types?.[0]?.name || ''}.`;

        this.notifyOtherMembers(
          targetOrgId,
          user.userId,
          NotificationType.NEW_SPOOL,
          count > 1 ? 'Nouvelles bobines' : 'Nouvelle bobine',
          message,
          { filamentId: savedFilament.id, count },
        ).catch((e) =>
          console.error('Failed to notify members of new spool', e),
        );
      }

      // CREATE TIGER TAG MAPPINGS (Only once)
      if (i === 0) {
        try {
          const { tigerBrandId, tigerMaterialId, tigerTypeId } =
            createFilamentDto as any;
          if (tigerBrandId && savedFilament.brand) {
            await this.tigerMappingService.createBrandMapping(
              tigerBrandId,
              savedFilament.brand,
            );
          }
          if (tigerMaterialId && savedFilament.material) {
            await this.tigerMappingService.createMaterialMapping(
              tigerMaterialId,
              savedFilament.material,
            );
          }
          if (
            tigerTypeId &&
            savedFilament.types &&
            savedFilament.types.length > 0
          ) {
            await this.tigerMappingService.createTypeMapping(
              tigerTypeId,
              savedFilament.types[0],
            );
          }
        } catch (e) {
          console.error('Failed to create TigerTag mappings', e);
        }
      }
    }

    if (targetOrgId) {
      await this.evaluateOrganizationQuota(targetOrgId);
    }

    return firstSavedFilament!;
  }

  async findAll(organizationId?: number): Promise<Filament[]> {
    if (organizationId) {
      return this.filamentRepository
        .find({
          where: { organization: { id: organizationId } },
          relations: ['brand', 'material', 'types', 'options', 'storageUnit'],
          order: { id: 'DESC' },
        })
        .then((filaments) =>
          filaments.map((f) => ({ ...f, type: f.types?.[0] }) as Filament),
        );
    }

    return Promise.resolve([]);
  }

  async getStorageUnits(organizationId: number): Promise<StorageUnit[]> {
    return this.storageUnitRepository.find({
      where: { organizationId },
      order: { location: 'ASC', name: 'ASC' },
    });
  }

  async createStorageUnit(
    organizationId: number,
    dto: CreateStorageUnitDto,
  ): Promise<StorageUnit> {
    const unit = this.storageUnitRepository.create({
      name: dto.name.trim(),
      location: dto.location?.trim() || null,
      kind: dto.kind || 'shelf',
      levels: Math.max(1, Number(dto.levels || 1)),
      slotsPerLevel: Math.max(1, Number(dto.slotsPerLevel || 1)),
      tagId: dto.tagId?.trim() || null,
      favorite: dto.favorite ?? false,
      organizationId,
    });
    if (!unit.tagId) {
      unit.tagId = `STORAGE-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }
    return this.storageUnitRepository.save(unit);
  }

  async updateStorageUnit(
    id: number,
    organizationId: number,
    dto: UpdateStorageUnitDto,
  ): Promise<StorageUnit> {
    const unit = await this.storageUnitRepository.findOne({
      where: { id, organizationId },
    });
    if (!unit) throw new NotFoundException('Storage unit not found');

    if (dto.name !== undefined) unit.name = dto.name.trim() || unit.name;
    if (dto.location !== undefined) unit.location = dto.location?.trim() || null;
    if (dto.kind !== undefined) unit.kind = dto.kind;
    if (dto.levels !== undefined) unit.levels = Math.max(1, Number(dto.levels));
    if (dto.slotsPerLevel !== undefined) {
      unit.slotsPerLevel = Math.max(1, Number(dto.slotsPerLevel));
    }
    if (dto.tagId !== undefined) unit.tagId = dto.tagId?.trim() || null;
    if (dto.favorite !== undefined) unit.favorite = dto.favorite;

    await this.filamentRepository
      .createQueryBuilder()
      .update(Filament)
      .set({ storageUnitId: null, storageLevel: null, storageSlot: null })
      .where('"storageUnitId" = :id', { id })
      .andWhere('("storageLevel" >= :levels OR "storageSlot" >= :slots)', {
        levels: unit.levels,
        slots: unit.slotsPerLevel,
      })
      .execute();

    return this.storageUnitRepository.save(unit);
  }

  async deleteStorageUnit(id: number, organizationId: number): Promise<void> {
    const unit = await this.storageUnitRepository.findOne({
      where: { id, organizationId },
    });
    if (!unit) throw new NotFoundException('Storage unit not found');

    await this.filamentRepository.update(
      { storageUnitId: id, organizationId },
      { storageUnitId: null, storageLevel: null, storageSlot: null },
    );
    await this.storageUnitRepository.remove(unit);
  }

  async placeFilament(
    filamentId: number,
    organizationId: number,
    dto: PlaceFilamentDto,
  ): Promise<Filament> {
    const filament = await this.filamentRepository.findOne({
      where: { id: filamentId, organizationId },
      relations: ['brand', 'material', 'types', 'options', 'storageUnit'],
    });
    if (!filament) throw new NotFoundException('Filament not found');

    if (!dto.storageUnitId) {
      filament.storageUnitId = null;
      filament.storageUnit = null;
      filament.storageLevel = null;
      filament.storageSlot = null;
      return this.filamentRepository.save(filament);
    }

    const unit = await this.storageUnitRepository.findOne({
      where: { id: dto.storageUnitId, organizationId },
    });
    if (!unit) throw new NotFoundException('Storage unit not found');

    const level = Number(dto.storageLevel);
    const slot = Number(dto.storageSlot);
    if (
      !Number.isInteger(level) ||
      !Number.isInteger(slot) ||
      level < 0 ||
      slot < 0 ||
      level >= unit.levels ||
      slot >= unit.slotsPerLevel
    ) {
      throw new BadRequestException('Invalid storage slot');
    }

    const occupied = await this.filamentRepository.findOne({
      where: {
        organizationId,
        storageUnitId: unit.id,
        storageLevel: level,
        storageSlot: slot,
      },
    });
    if (occupied && occupied.id !== filament.id) {
      throw new BadRequestException('Storage slot already occupied');
    }

    filament.storageUnitId = unit.id;
    filament.storageUnit = unit;
    filament.storageLevel = level;
    filament.storageSlot = slot;
    return this.filamentRepository.save(filament);
  }

  async getMobilePullSnapshot(
    organizationId: number,
    includeAllReferenceData = false,
  ) {
    const org = await this.organizationRepository.findOne({
      where: { id: organizationId },
    });
    if (!org) throw new NotFoundException('Organization not found');

    const scopedWhere = includeAllReferenceData
      ? undefined
      : [{ organizationId: IsNull() }, { organizationId }];

    const filaments = await this.findAll(organizationId);
    const usedBrandIds = [
      ...new Set(filaments.map((f) => f.brand?.id).filter(Boolean)),
    ] as number[];
    const usedMaterialIds = [
      ...new Set(filaments.map((f) => f.material?.id).filter(Boolean)),
    ] as number[];
    const usedTypeIds = [
      ...new Set(
        filaments
          .flatMap((f) => f.types?.map((type) => type.id) || [])
          .filter(Boolean),
      ),
    ] as number[];
    const usedColorReferenceIds = [
      ...new Set(filaments.map((f) => f.colorReferenceId).filter(Boolean)),
    ] as number[];

    const brandCatalogWhere: any = includeAllReferenceData
      ? undefined
      : [
          { organizationId },
          ...(usedBrandIds.length &&
          usedMaterialIds.length &&
          usedTypeIds.length
            ? [
                {
                  organizationId: IsNull(),
                  brandId: In(usedBrandIds),
                  materialId: In(usedMaterialIds),
                  typeId: In(usedTypeIds),
                },
              ]
            : []),
        ];
    const colorReferenceWhere: any = includeAllReferenceData
      ? { isActive: true }
      : [
          { organizationId, isActive: true },
          ...(usedColorReferenceIds.length
            ? [{ id: In(usedColorReferenceIds), isActive: true }]
            : []),
        ];

    const [
      brands,
      materials,
      types,
      options,
      brandCatalog,
      colorReferences,
      tigerMappings,
      consumptionLogs,
      storageUnits,
    ] = await Promise.all([
      this.brandRepository.find({
        where: scopedWhere,
        order: { name: 'ASC' },
        relations: ['organization'],
      }),
      this.materialRepository.find({
        where: scopedWhere,
        order: { name: 'ASC' },
        relations: ['organization'],
      }),
      this.typeRepository.find({
        where: scopedWhere,
        order: { name: 'ASC' },
        relations: ['organization'],
      }),
      this.optionRepository.find({
        where: scopedWhere,
        order: { category: 'ASC', name: 'ASC' },
        relations: ['organization'],
      }),
      this.brandCatalogRepository.find({
        where: brandCatalogWhere,
        relations: ['brand', 'material', 'type', 'organization'],
        order: { brand: { name: 'ASC' } },
      }),
      this.colorReferenceRepository.find({
        where: colorReferenceWhere,
        relations: ['brand', 'material', 'type', 'organization'],
        order: { name: 'ASC' },
      }),
      this.tigerMappingService.getMappingsForSync(
        includeAllReferenceData ? null : organizationId,
      ),
      this.getConsumptionLogsForMobileSync(organizationId),
      this.getStorageUnits(organizationId),
    ]);

    const optionsGrouped = options.reduce(
      (acc, option) => {
        if (!acc[option.category]) {
          acc[option.category] = [];
        }
        acc[option.category].push(option);
        return acc;
      },
      {} as Record<string, FilamentOption[]>,
    );

    const normalizedBrandCatalog = brandCatalog.map((item) => ({
      ...item,
      density: item.density_gcm3,
      densityGcm3: item.density_gcm3,
      nozzleTempMin: item.nozzle_temp_min,
      nozzleTempMax: item.nozzle_temp_max,
      bedTempMin: item.bed_temp_min,
      bedTempMax: item.bed_temp_max,
    }));

    return {
      filaments,
      brands,
      materials,
      types,
      optionsGrouped,
      consumptionLogs: { logs: consumptionLogs },
      brandCatalog: normalizedBrandCatalog,
      colorReferences,
      tigerMappings,
      storageUnits,
      organization: org,
    };
  }

  private async getConsumptionLogsForMobileSync(organizationId: number) {
    const rows = await this.consumptionRepository
      .createQueryBuilder('log')
      .innerJoin('log.filament', 'filament')
      .where('filament.organizationId = :organizationId', { organizationId })
      .select([
        'log.id AS id',
        'log.filamentId AS "filamentId"',
        'log.amount AS amount',
        'log.type AS type',
        'log.notes AS notes',
        'log.date AS date',
        'log.is_planned AS "isPlanned"',
        'log.printTaskId AS "printTaskId"',
        'log.printStatus AS "printStatus"',
      ])
      .orderBy('log.date', 'DESC')
      .getRawMany();

    return rows.map((row) => ({
      id: Number(row.id),
      amount: Number(row.amount),
      type: row.type,
      notes: row.notes,
      date: row.date,
      is_planned: Boolean(row.isPlanned),
      isPlanned: Boolean(row.isPlanned),
      printTaskId: row.printTaskId ?? null,
      printStatus: row.printStatus ?? null,
      filament: { id: Number(row.filamentId) },
    }));
  }

  async findAllGlobal(options: {
    page: number;
    limit: number;
    search?: string;
    organizationId?: number;
    brand?: string;
    material?: string;
    type?: string;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  }): Promise<{ items: Filament[]; total: number }> {
    const {
      page,
      limit,
      search,
      organizationId,
      brand,
      material,
      type,
      sortBy,
      sortOrder,
    } = options;
    const query = this.filamentRepository
      .createQueryBuilder('filament')
      .leftJoinAndSelect('filament.organization', 'organization')
      .leftJoinAndSelect('filament.brand', 'brand')
      .leftJoinAndSelect('filament.material', 'material')
      .leftJoinAndSelect('filament.types', 'types')
      .skip((page - 1) * limit)
      .take(limit);

    if (sortBy) {
      let column = 'filament.id';
      switch (sortBy) {
        case 'organization':
          column = 'organization.name';
          break;
        case 'brand':
          column = 'brand.name';
          break;
        case 'material':
          column = 'material.name';
          break;
        // 'type' uses many-to-many, sorting is complex, we skip or sort by first type name
        case 'type':
          column = 'types.name';
          break;
        case 'color':
          column = 'filament.color';
          break;
        case 'weightRemaining':
          column = 'filament.weightRemaining';
          break;
        default:
          column = `filament.${sortBy}`;
      }
      query.orderBy(column, sortOrder || 'DESC');
    } else {
      query.orderBy('filament.id', 'DESC');
    }

    if (organizationId) {
      query.andWhere('filament.organizationId = :organizationId', {
        organizationId,
      });
    }

    // Granular Filters
    if (brand) {
      query.andWhere('brand.name ILIKE :brand', { brand: `%${brand}%` });
    }
    if (material) {
      query.andWhere('material.name ILIKE :material', {
        material: `%${material}%`,
      });
    }
    if (type) {
      // Since it's ManyToMany, filtering by one type name is enough to include the filament
      query.andWhere('types.name ILIKE :type', { type: `%${type}%` });
    }

    // Global Search (fallback if specific filters aren't used, or additive?)
    // Usually global search is "OR" across fields.
    // If granular filters are provided, search might be separate.
    // Let's treat them additively: Filter by Brand AND search text if provided.
    if (search) {
      query.andWhere(
        '(brand.name ILIKE :search OR material.name ILIKE :search OR types.name ILIKE :search OR filament.color ILIKE :search OR organization.name ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const [items, total] = await query.getManyAndCount();
    const mappedItems = items.map(
      (f) => ({ ...f, type: f.types?.[0] }) as Filament,
    );
    return { items: mappedItems, total };
  }

  async getAll(organizationId?: number): Promise<Filament[]> {
    const where: any = {};
    if (organizationId) {
      where.organization = { id: organizationId };
    }
    return this.filamentRepository
      .find({
        where,
        relations: ['brand', 'material', 'types', 'options'],
        order: { createdAt: 'DESC' },
      })
      .then((filaments) =>
        filaments.map((f) => ({ ...f, type: f.types?.[0] }) as Filament),
      );
  }

  async findOne(id: number, organizationId?: number): Promise<Filament> {
    const where: any = { id };
    if (organizationId) {
      where.organization = { id: organizationId };
    }
    const filament = await this.filamentRepository.findOne({
      where,
      relations: ['brand', 'material', 'types', 'options'],
    });
    if (filament) {
      (filament as any).type = filament.types?.[0];
    }
    if (!filament) {
      throw new NotFoundException(`Filament #${id} not found`);
    }
    return filament;
  }

  async update(
    id: number,
    updateFilamentDto: any,
    organizationId?: number,
    user?: any,
  ): Promise<Filament> {
    const filament = await this.findOne(id, organizationId);

    // Bypass for System Admins
    const isSystemAdmin =
      user?.systemRole === 'admin' ||
      user?.systemRole === 'super_admin' ||
      user?.systemRole === 'moderator' ||
      user?.isSuperAdmin;

    const orgId = filament.organization?.id || filament.organizationId;
    if (orgId && !isSystemAdmin && !isSelfHosted()) {
      const org = await this.organizationRepository.findOne({
        where: { id: orgId },
      });
      if (org?.requiresQuotaSelection) {
        throw new ForbiddenException(
          'You must resolve your quota restrictions before modifying your inventory.',
        );
      }
    }

    if (filament.isLocked && !isSelfHosted()) {
      // Allow unlocking if explicitly requested and under quota
      if (updateFilamentDto.isLocked === false) {
        if (orgId && !isSystemAdmin) {
          const activeSpoolCount = await this.filamentRepository.count({
            where: { organization: { id: orgId }, isLocked: false },
          });
          const org = await this.organizationRepository.findOne({
            where: { id: orgId },
          });
          const limits = isSelfHosted()
            ? PLAN_LIMITS[SELF_HOSTED_PLAN]
            : PLAN_LIMITS[org?.plan ?? 'free'];
          if (
            limits.maxSpoolsPerOrg !== Infinity &&
            activeSpoolCount >= limits.maxSpoolsPerOrg
          ) {
            throw new BadRequestException(
              `Plan limit reached: You cannot have more than ${limits.maxSpoolsPerOrg} active spools.`,
            );
          }
        }
      } else {
        throw new ForbiddenException(
          'This filament is locked due to quota restrictions. Please upgrade your plan or resolve quota issues to use it.',
        );
      }
    }

    const { brandId, materialId, typeIds, options, ...rest } =
      updateFilamentDto;

    Object.assign(filament, rest);

    // Recalculate virtual weight if weightRemaining was updated
    if (
      rest.weightRemaining !== undefined ||
      rest.plannedWeight !== undefined
    ) {
      filament.virtualWeightRemaining =
        (filament.weightRemaining || 0) - (filament.plannedWeight || 0);
    }

    // Auto-generate spool reference if missing (legacy data)
    if (!filament.spoolReference) {
      filament.spoolReference = generateSpoolReference();
    }

    if (brandId) {
      filament.brand = await this.brandRepository.findOne({
        where: { id: brandId },
      });
    }
    if (materialId) {
      filament.material = await this.materialRepository.findOne({
        where: { id: materialId },
      });
    }
    if (typeIds && typeIds.length > 0) {
      filament.types = await this.typeRepository.findBy({ id: In(typeIds) });
    }
    if (options) {
      const filamentOptions = await this.optionRepository.findBy({
        id: In(options),
      });
      filament.options = filamentOptions;
    }

    return this.filamentRepository.save(filament);
  }

  async bulkUpdate(
    ids: number[],
    updateFilamentDto: any,
    organizationId?: number,
    user?: any,
  ): Promise<{ successCount: number; failCount: number }> {
    let successCount = 0;
    let failCount = 0;

    for (const id of ids) {
      try {
        await this.update(id, updateFilamentDto, organizationId, user);
        successCount++;
      } catch (e) {
        console.error(`Bulk update failed for filament #${id}:`, e.message);
        failCount++;
      }
    }

    return { successCount, failCount };
  }

  async remove(id: number, organizationId?: number): Promise<void> {
    const filament = await this.findOne(id, organizationId);
    await this.filamentRepository.remove(filament);
  }

  async findByTagId(tagId: string, organizationId?: number): Promise<Filament> {
    const where: any = { nfcTagId: tagId };
    // We might want to allow finding by tag across orgs if tags are pre-assigned?
    // For now, enforce org scope if provided
    if (organizationId) {
      where.organization = { id: organizationId };
    }

    const filament = await this.filamentRepository.findOne({
      where,
      relations: ['brand', 'material', 'types', 'options'],
    });
    if (filament) {
      (filament as any).type = filament.types?.[0];
    }

    if (!filament) {
      throw new NotFoundException(`No filament found with NFC Tag ID ${tagId}`);
    }
    return filament;
  }

  async updateWeight(
    id: number,
    newWeight: number,
    organizationId?: number,
  ): Promise<Filament | null> {
    let filament: Filament | null = null;
    if (organizationId) {
      try {
        filament = await this.findOne(id, organizationId);
      } catch (e) {
        return null;
      }
    } else {
      filament = await this.findOne(id);
    }

    if (!filament) return null;

    filament.weightRemaining = newWeight;
    filament.virtualWeightRemaining = newWeight - (filament.plannedWeight || 0);
    await this.filamentRepository.save(filament);

    // Re-fetch to get updated state and check low stock
    const updated = await this.findOne(id);
    if (updated) {
      await this.checkLowStock(updated);
    }

    return updated;
  }

  async createOption(
    name: string,
    category: string,
    isCharacteristic: boolean = false,
    isGlobal: boolean = false,
    organizationId?: number,
  ) {
    const option = new FilamentOption();
    option.name = name;
    option.category = category;
    option.isCharacteristic = isCharacteristic;
    option.organizationId = isGlobal ? null : (organizationId ?? null);

    return this.optionRepository.save(option);
  }

  async updateOption(
    id: number,
    name: string,
    category: string,
    isCharacteristic: boolean,
  ) {
    const option = await this.optionRepository.findOne({ where: { id } });
    if (!option) throw new Error('Option not found');
    option.name = name;
    option.category = category;
    // isCharacteristic is deprecated/moved to Type, but keep for now or migrate logic
    option.isCharacteristic = isCharacteristic;
    return this.optionRepository.save(option);
  }

  async updateBrandCatalogEntry(
    id: number,
    updates: {
      isActive?: boolean;
      density?: number;
      nozzle_min?: number;
      nozzle_max?: number;
      bed_min?: number;
      bed_max?: number;
    },
  ) {
    const entry = await this.brandCatalogRepository.findOne({ where: { id } });
    if (!entry) throw new NotFoundException('Catalog entry not found');

    if (updates.isActive !== undefined) entry.isActive = updates.isActive;
    if (updates.density !== undefined) entry.density_gcm3 = updates.density;
    if (updates.nozzle_min !== undefined)
      entry.nozzle_temp_min = updates.nozzle_min;
    if (updates.nozzle_max !== undefined)
      entry.nozzle_temp_max = updates.nozzle_max;
    if (updates.bed_min !== undefined) entry.bed_temp_min = updates.bed_min;
    if (updates.bed_max !== undefined) entry.bed_temp_max = updates.bed_max;

    return this.brandCatalogRepository.save(entry);
  }

  // New Mappings
  async createMaterial(name: string, organizationId?: number) {
    const material = this.materialRepository.create({ name, organizationId });
    return this.materialRepository.save(material);
  }

  async getMaterials(organizationId?: number) {
    // Global (null) + Custom (orgId)
    return this.materialRepository.find({
      where: [
        { organizationId: IsNull() }, // Global
        organizationId ? { organizationId } : {},
      ],
    });
  }

  async createType(name: string, organizationId?: number) {
    const type = this.typeRepository.create({ name, organizationId });
    return this.typeRepository.save(type);
  }

  async getTypes(organizationId?: number) {
    return this.typeRepository.find({
      where: [
        { organizationId: IsNull() },
        organizationId ? { organizationId } : {},
      ],
    });
  }

  async logConsumption(
    id: number,
    amount: number,
    type: 'MANUAL' | 'PRINT' | 'FAIL' = 'MANUAL',
    notes?: string,
    organizationId?: number,
    date?: Date,
    externalJobId?: string,
    userId?: number,
    user?: any,
    isPlanned: boolean = false,
    printTaskId?: string,
    printStatus?: PrintStatus,
  ) {
    const filament = await this.findOne(id, organizationId);

    // Bypass check and Quota check
    const isSystemAdmin =
      user?.systemRole === 'admin' ||
      user?.systemRole === 'super_admin' ||
      user?.systemRole === 'moderator' ||
      user?.isSuperAdmin;
    const orgId = filament.organization?.id || filament.organizationId;
    if (orgId && !isSystemAdmin && !isSelfHosted()) {
      const org = await this.organizationRepository.findOne({
        where: { id: orgId },
      });
      if (org?.requiresQuotaSelection) {
        throw new ForbiddenException(
          'You must resolve your quota restrictions before consuming your inventory.',
        );
      }
    }

    if (filament.isLocked && !isSelfHosted()) {
      throw new ForbiddenException(
        'This filament is locked due to quota restrictions. Please upgrade your plan or resolve quota issues to consume it.',
      );
    }

    return this._performConsumption(
      filament,
      amount,
      type as ConsumptionType,
      notes,
      date,
      externalJobId,
      userId,
      organizationId,
      isPlanned,
      printTaskId,
      printStatus,
    );
  }

  private async _performConsumption(
    filament: Filament,
    amount: number,
    type: ConsumptionType,
    notes?: string,
    date?: Date,
    externalJobId?: string,
    userId?: number,
    organizationId?: number,
    isPlanned: boolean = false,
    printTaskId?: string,
    printStatus?: PrintStatus,
  ) {
    if (externalJobId) {
      const existingLog = await this.consumptionRepository.findOne({
        where: { externalJobId },
      });
      if (existingLog) {
        throw new BadRequestException(
          'Duplicate consumption log for this job ID',
        );
      }
    }

    if (printTaskId) {
      const existingTaskLog = await this.consumptionRepository.findOne({
        where: { filament: { id: filament.id }, printTaskId },
      });
      if (existingTaskLog) {
        throw new BadRequestException(
          `A consumption log has already been created for print task ${printTaskId}`,
        );
      }
    }

    const log = new ConsumptionLog();
    log.filament = filament;
    log.amount = amount;
    log.is_planned = isPlanned;
    log.type = type;
    if (notes) log.notes = notes;
    if (date) log.date = date;
    if (externalJobId) log.externalJobId = externalJobId;
    if (printTaskId) log.printTaskId = printTaskId;
    if (printStatus) log.printStatus = printStatus;

    // Update weights
    if (isPlanned) {
      filament.plannedWeight = (filament.plannedWeight || 0) + amount;
      filament.virtualWeightRemaining =
        (filament.virtualWeightRemaining ?? filament.weightRemaining) - amount;
    } else {
      filament.weightRemaining = Math.max(0, filament.weightRemaining - amount);
      filament.virtualWeightRemaining = Math.max(
        0,
        (filament.virtualWeightRemaining ?? filament.weightRemaining + amount) -
          amount,
      );
    }

    await this.filamentRepository.save(filament);
    const savedLog = await this.consumptionRepository.save(log);

    // Notify other members
    if (organizationId && userId) {
      this.notifyOtherMembers(
        organizationId,
        userId,
        NotificationType.CONSUMPTION,
        'Consommation',
        `${amount}g ont été consommés sur la bobine ${filament.brand?.name || ''} ${filament.types?.[0]?.name || ''}.`,
        { filamentId: filament.id, amount },
      ).catch((e) =>
        console.error('Failed to notify members of consumption', e),
      );
    }

    // Check Low Stock
    await this.checkLowStock(filament);

    return savedLog;
  }

  async consumeFromGroup(
    dto: ConsumeGroupDto,
    organizationId: number,
    userId?: number,
    user?: any,
  ) {
    return this.filamentRepository.manager.transaction(
      async (transactionalEntityManager) => {
        const {
          brandId,
          materialId,
          typeId,
          color,
          amount,
          type = 'MANUAL',
          notes,
          isPlanned = false,
          date,
        } = dto;
        const consumptionDate = date ? new Date(date) : new Date();

        // 1. Find all active filaments in this group
        // We use the transactional manager here
        const query = transactionalEntityManager
          .createQueryBuilder(Filament, 'f')
          .leftJoinAndSelect('f.brand', 'brand')
          .leftJoinAndSelect('f.material', 'material')
          .leftJoinAndSelect('f.types', 'types')
          .leftJoinAndSelect('f.organization', 'organization')
          .where('f.organizationId = :organizationId', { organizationId })
          .andWhere('f.isLocked = false')
          .andWhere('f.weightRemaining > 0')
          .andWhere('f.brandId = :brandId', { brandId })
          .andWhere('f.materialId = :materialId', { materialId })
          .andWhere('f.color = :color', { color });

        if (typeId) {
          query.andWhere('types.id = :typeId', { typeId });
        } else {
          // To match the UI grouping, if no typeId is provided,
          // we should only find filaments that HAVE NO types.
          // However, TypeORM's getMany produces duplicates with left joins.
          // Better: query filaments where NO types exist.
          query.andWhere((qb) => {
            const subQuery = qb
              .subQuery()
              .select('ft.filamentId')
              .from('filament_types', 'ft')
              .getQuery();
            return 'f.id NOT IN ' + subQuery;
          });
        }

        const rawFilaments = await query.getMany();
        // Deduplicate (getMany can double count if joined many-to-many)
        const filaments = Array.from(
          new Map(rawFilaments.map((item) => [item.id, item])).values(),
        );

        if (filaments.length === 0) {
          throw new BadRequestException('No filaments available in this group');
        }

        const totalAvailable = filaments.reduce(
          (sum, f) => sum + f.weightRemaining,
          0,
        );
        if (amount > totalAvailable) {
          throw new BadRequestException(
            `Insufficient stock. Total available: ${totalAvailable}g, requested: ${amount}g`,
          );
        }

        // 2. Prioritization Logic:
        // - Started spools first (weightRemaining < weightInitial)
        // - Sorted by weightRemaining ASC (finish the emptiest first)
        // - Then New spools (sorted by id or date)

        const started = filaments
          .filter((f) => f.weightRemaining < f.weightInitial)
          .sort((a, b) => a.weightRemaining - b.weightRemaining);

        const full = filaments
          .filter((f) => f.weightRemaining >= f.weightInitial)
          .sort((a, b) => a.id - b.id);

        const sortedQueue = [...started, ...full];

        let remainingToConsume = amount;
        const results = [];

        for (const filament of sortedQueue) {
          if (remainingToConsume <= 0) break;

          const consumeFromThis = Math.min(
            filament.weightRemaining,
            remainingToConsume,
          );

          // We must use a version of _performConsumption that uses the transaction!
          // Or better, let _performConsumption accept the manager.
          const res = await this._performConsumptionWithManager(
            transactionalEntityManager,
            filament,
            consumeFromThis,
            type as ConsumptionType,
            notes
              ? `${notes} (Part of group consumption)`
              : 'Group consumption',
            consumptionDate,
            undefined,
            userId,
            organizationId,
            isPlanned,
          );
          results.push(res);
          remainingToConsume -= consumeFromThis;
        }

        return {
          consumed: amount - remainingToConsume,
          logs: results,
        };
      },
    );
  }

  private async _performConsumptionWithManager(
    manager: any, // transactionalEntityManager
    filament: Filament,
    amount: number,
    type: ConsumptionType,
    notes?: string,
    date?: Date,
    externalJobId?: string,
    userId?: number,
    organizationId?: number,
    isPlanned: boolean = false,
    printTaskId?: string,
    printStatus?: PrintStatus,
  ) {
    const log = new ConsumptionLog();
    log.filament = filament;
    log.amount = amount;
    log.is_planned = isPlanned;
    log.type = type;
    if (notes) log.notes = notes;
    if (date) log.date = date;
    if (externalJobId) log.externalJobId = externalJobId;
    if (printTaskId) log.printTaskId = printTaskId;
    if (printStatus) log.printStatus = printStatus;

    // Update weights
    if (isPlanned) {
      filament.plannedWeight = (filament.plannedWeight || 0) + amount;
      filament.virtualWeightRemaining =
        (filament.virtualWeightRemaining ?? filament.weightRemaining) - amount;
    } else {
      filament.weightRemaining = Math.max(0, filament.weightRemaining - amount);
      filament.virtualWeightRemaining = Math.max(
        0,
        (filament.virtualWeightRemaining ?? filament.weightRemaining + amount) -
          amount,
      );
    }

    await manager.save(filament);
    const savedLog = await manager.save(log);

    // Notify other members (async, no need for transaction block but orgId/userId needed)
    if (organizationId && userId) {
      this.notifyOtherMembers(
        organizationId,
        userId,
        NotificationType.CONSUMPTION,
        'Consommation',
        `${amount}g ont été consommés sur la bobine ${filament.brand?.name || ''} ${filament.types?.[0]?.name || ''}.`,
        { filamentId: filament.id, amount },
      ).catch((e) =>
        console.error('Failed to notify members of consumption', e),
      );
    }

    // Check Low Stock (async)
    this.checkLowStock(filament).catch((e) =>
      console.error('Low stock check failed', e),
    );

    return savedLog;
  }

  async checkLowStock(filament: Filament) {
    let isLowStock = false;
    let org: Organization | null = null;

    if (filament.organizationId) {
      org = await this.organizationRepository.findOne({
        where: { id: filament.organizationId },
      });
    }

    const systemDefaultPercentage = 0.1;
    const maxSystemDefaultGrams = 100;

    if (
      filament.lowStockThreshold !== null &&
      filament.lowStockThreshold !== undefined
    ) {
      if (filament.lowStockThresholdType === 'PERCENTAGE') {
        const thresholdGrams =
          filament.weightInitial * (filament.lowStockThreshold / 100);
        isLowStock = filament.weightRemaining < thresholdGrams;
      } else {
        isLowStock = filament.weightRemaining < filament.lowStockThreshold;
      }
    } else if (
      org?.settings?.lowStockThreshold !== undefined &&
      org?.settings?.lowStockThreshold !== null
    ) {
      if (org.settings.lowStockThresholdType === 'PERCENTAGE') {
        const thresholdGrams =
          filament.weightInitial * (org.settings.lowStockThreshold / 100);
        isLowStock = filament.weightRemaining < thresholdGrams;
      } else {
        isLowStock = filament.weightRemaining < org.settings.lowStockThreshold;
      }
    } else {
      const thresholdGrams = Math.min(
        maxSystemDefaultGrams,
        filament.weightInitial * systemDefaultPercentage,
      );
      isLowStock = filament.weightRemaining < thresholdGrams;
    }

    if (isLowStock) {
      // Find organization admins
      const admins = await this.userOrganizationRepository.find({
        where: {
          organizationId: filament.organizationId,
          role: 'admin',
          hasConfirmed: true,
        },
      });
      // Also owners
      const owners = await this.userOrganizationRepository.find({
        where: {
          organizationId: filament.organizationId,
          role: 'owner',
          hasConfirmed: true,
        },
      });

      const recipients = [...admins, ...owners];
      const uniqueUserIds = [...new Set(recipients.map((r) => r.userId))];

      for (const userId of uniqueUserIds) {
        await this.notificationService.create(
          userId,
          NotificationType.LOW_STOCK,
          'Alerte de Stock Faible',
          `Le filament ${filament.brand?.name} ${filament.types?.map((t) => t.name).join(', ')} (${filament.color}) est presque épuisé (${Number(filament.weightRemaining).toFixed(2)}g restants).`,
          { filamentId: filament.id, organizationId: filament.organizationId },
        );
      }
    }
  }

  async getConsumptionHistory(id: number, organizationId?: number) {
    if (organizationId) {
      await this.findOne(id, organizationId);
    }

    return this.consumptionRepository.find({
      where: { filamentId: id },
      order: { date: 'DESC' },
    });
  }

  async cloneFilament(
    id: number,
    organizationId?: number,
    user?: any,
  ): Promise<Filament> {
    const original = await this.findOne(id, organizationId);

    const orgId = original.organization?.id || original.organizationId;
    if (orgId) {
      await this.checkPlanLimits(orgId, user);
    }

    if (original.isLocked && !isSelfHosted()) {
      throw new ForbiddenException('You cannot duplicate a locked filament.');
    }

    // Create copy with same specs but reset inventory data
    const clone = this.filamentRepository.create({
      ...original,
      id: undefined, // New ID
      weightInitial: original.weightInitial, // Full spool? Or should we ask? assuming full based on logic usually
      weightRemaining: original.weightInitial,
      purchaseDate: new Date(),
      isRefill: original.isRefill, // Assume same type of spool
      nfcTagId: undefined, // New tag needed
      consumptionLogs: [], // Reset history

      // Tech specs copied
      nozzleTempMin: original.nozzleTempMin,
      nozzleTempMax: original.nozzleTempMax,
      bedTemp: original.bedTemp,
      bedTempMin: original.bedTempMin,
      bedTempMax: original.bedTempMax,
      chamberTempMin: original.chamberTempMin,
      chamberTempMax: original.chamberTempMax,
      dryTemp: original.dryTemp,
      dryTime: original.dryTime,
      printSpeedMin: original.printSpeedMin,
      printSpeedMax: original.printSpeedMax,
      retractionDistanceMm: original.retractionDistanceMm,
      retractionSpeedMmS: original.retractionSpeedMmS,
      retractionZHopMm: original.retractionZHopMm,
      retractionNotes: original.retractionNotes,
      conditionalTemperatureRules: original.conditionalTemperatureRules,
      kFactor: original.kFactor,
      densityGcm3: original.densityGcm3,
      diameterMm: original.diameterMm,
      colors: original.colors,
      plannedWeight: 0,
      virtualWeightRemaining: original.weightInitial,
    });

    const savedClone = (await this.filamentRepository.save(
      clone,
    )) as unknown as Filament;
    if (orgId) {
      await this.evaluateOrganizationQuota(orgId);
    }
    return savedClone;
  }

  async transferFilamentsToOrganization(
    fromOrgId: number,
    toOrgId: number,
  ): Promise<number> {
    const result = await this.filamentRepository.update(
      { organizationId: fromOrgId },
      { organizationId: toOrgId },
    );
    return result.affected || 0;
  }

  async syncFromNfc(
    tagData: TigerTagData,
    organizationId: number,
  ): Promise<Filament> {
    // Try to find by Tag ID AND Organization (security)
    const filament = await this.filamentRepository.findOne({
      where: { nfcTagId: tagData.tagId },
    });

    if (filament && filament.organizationId !== organizationId) {
      throw new Error('Filament belongs to another organization');
    }

    // Apply Quota Check for NEW spools through NFC
    if (!filament) {
      await this.checkPlanLimits(organizationId);
    }

    const filamentData: any = {
      nfcTagId: tagData.tagId,
      tigerTagVersion: tagData.tigerTagVersion,
      productId: tagData.productId,
      materialId: tagData.materialId,
      diameter: tagData.diameter,
      aspectId1: tagData.aspectId1,
      aspectId2: tagData.aspectId2,
      unitId: tagData.unitId,
      transmissionDistance: tagData.transmissionDistance,
      timestamp: tagData.timestamp,
      rawNfcData: JSON.stringify(tagData.rawData),
    };

    if (tagData.weightRemaining !== undefined) {
      filamentData.weightRemaining = tagData.weightRemaining;
    }

    filamentData.tigerBrandId = tagData.brandId;
    filamentData.tigerMaterialId = tagData.materialId;
    filamentData.tigerTypeId = tagData.typeId;

    if (filament) {
      await this.filamentRepository.update(filament.id, filamentData);
      return this.findOne(filament.id);
    } else {
      // New filament from NFC
      const newFilament = this.filamentRepository.create({
        ...filamentData,
        organizationId, // Assign to current organization
        brandId: 1, // Default to first brand (e.g. Prusament or Unknown)
        typeId: 1, // Default to first type (e.g. PLA)
        color: '#808080', // Default color
        weightInitial: tagData.weightRemaining || 1000,
        weightRemaining: tagData.weightRemaining || 1000,
      });
      const saved = (await this.filamentRepository.save(
        newFilament,
      )) as unknown as Filament;
      await this.evaluateOrganizationQuota(organizationId);
      return saved;
    }
  }

  async getAllConsumptionHistory(
    organizationId: number,
    isSuperAdmin: boolean = false,
  ) {
    const org = await this.organizationRepository.findOne({
      where: { id: organizationId },
    });
    if (!org) throw new NotFoundException('Organization not found');

    // 1. Fetch all detailed logs for this organization (ALWAYS ALLOWED)
    const logs = await this.consumptionRepository.find({
      where: { filament: { organization: { id: organizationId } } },
      relations: [
        'filament',
        'filament.brand',
        'filament.types',
        'filament.material',
      ],
      order: { date: 'DESC' },
    });

    // 2. Check Plan for Analytics
    const canViewAnalytics = isSelfHosted() || org.plan !== 'free' || isSuperAdmin;

    if (!canViewAnalytics) {
      return {
        logs,
        dailyUsage: {},
        forecasts: [],
        restricted: true, // Flag for frontend to show upsell
      };
    }

    // 3. Aggregate Data for Analytics
    // Group by Date (last 30 days) to show trend
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    const dailyUsage: Record<
      string,
      {
        amount: number;
        cost: number;
        plannedAmount: number;
        plannedCost: number;
      }
    > = {};
    logs.forEach((log) => {
      const dateStr =
        log.date instanceof Date
          ? log.date.toISOString().split('T')[0]
          : new Date(log.date).toISOString().split('T')[0];
      if (new Date(log.date) >= last30Days) {
        if (!dailyUsage[dateStr]) {
          dailyUsage[dateStr] = {
            amount: 0,
            cost: 0,
            plannedAmount: 0,
            plannedCost: 0,
          };
        }

        if (log.is_planned) {
          dailyUsage[dateStr].plannedAmount += log.amount;
        } else {
          dailyUsage[dateStr].amount += log.amount;
        }

        // Calculate Cost
        if (
          log.filament &&
          log.filament.price &&
          log.filament.weightInitial > 0
        ) {
          const pricePerGram = log.filament.price / log.filament.weightInitial;
          const cost = log.amount * pricePerGram;
          if (log.is_planned) {
            dailyUsage[dateStr].plannedCost += cost;
          } else {
            dailyUsage[dateStr].cost += cost;
          }
        }
      }
    });

    // 3. Forecast per Filament (Grouped by Signature)
    // We fetch ALL filaments to get full history, even from depleted spools
    const allFilaments = await this.filamentRepository.find({
      where: { organization: { id: organizationId } },
      relations: ['consumptionLogs', 'brand', 'types', 'material'],
    });

    // Group by Signature: BrandId-MaterialId-TypeIds-Color
    const groups: Record<
      string,
      {
        filaments: any[];
        totalWeightRemaining: number;
        totalPlannedWeight: number;
        allLogs: any[];
        brand: any;
        material: any;
        types: any[];
        color: string;
        colors: string[];
        colorName: string;
      }
    > = {};

    allFilaments.forEach((f) => {
      // Create Signature
      const brandId = f.brand?.id || '0';
      const materialId = f.material?.id || '0';
      const typeIds =
        f.types
          ?.map((t) => t.id)
          .sort()
          .join(',') || '0';
      const color = f.color || '#000000';
      const key = `${brandId}-${materialId}-${typeIds}-${color}`;

      if (!groups[key]) {
        groups[key] = {
          filaments: [],
          totalWeightRemaining: 0,
          totalPlannedWeight: 0,
          allLogs: [],
          brand: f.brand,
          material: f.material,
          types: f.types,
          color: f.color,
          colors: f.colors,
          colorName: f.colorName,
        };
      }
      groups[key].filaments.push(f);
      groups[key].totalWeightRemaining += f.weightRemaining;
      if (f.consumptionLogs) {
        groups[key].allLogs.push(...f.consumptionLogs);
        // Sum planned weight for virtual stock calculation
        f.consumptionLogs.forEach((l) => {
          if (l.is_planned) {
            groups[key].totalPlannedWeight += l.amount;
          }
        });
      }
    });

    const forecasts = Object.values(groups)
      .map((group) => {
        // Only forecast if we have logs
        if (group.allLogs.length < 2) {
          // If we have stock but no logs, return insufficient data
          // If we have no stock and no logs, maybe skip? Let's return for visibility if stock > 0
          if (group.totalWeightRemaining <= 0) return null;

          return {
            id: group.filaments[0].id, // Use ID of first filament as proxy
            name: `${group.brand?.name} - ${group.types?.[0]?.name}`,
            brand: group.brand,
            material: group.material,
            types: group.types,
            color: group.color,
            colors: group.colors,
            colorName: group.colorName,
            weightRemaining: group.totalWeightRemaining,
            dailyUsage: 0,
            daysRemaining: Infinity,
            estimatedDepletionDate: null,
            status: 'insufficient_data',
            confidence: 'low',
          };
        }

        // Consolidate logs and sort by date
        const sortedLogs = group.allLogs.sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
        );

        // --- SMART FORECAST LOGIC ---
        // We use a Rolling Window approach: 30 days and 90 days.
        // If we have reliable data for 30 days, we use it (reflects recent bursts).
        // If not, we fall back to 90 days (reflects medium term).
        // Lifetime is used only as a last resort or for comparison.

        const now = new Date();
        const oneDayMs = 1000 * 3600 * 24;

        // Helper to get rate for a window
        const getUsageRate = (
          daysWindow: number,
        ): { rate: number; count: number } => {
          const cutoffDate = new Date(now.getTime() - daysWindow * oneDayMs);
          const recentLogs = sortedLogs.filter(
            (l) => new Date(l.date) >= cutoffDate,
          );

          if (recentLogs.length === 0) return { rate: 0, count: 0 };

          const totalConsumed = recentLogs.reduce(
            (sum, log) => sum + log.amount,
            0,
          );

          // Effective days span in this window:
          // If first log in window is 5 days ago, span is 5 days (or until now).
          // But generally, for a rate over "Last 30 days", we simply divide Total / 30?
          // NO: If I printed 1kg yesterday, and nothing else, my rate is not 1kg/30.
          // It's technically 1kg/1 day effectively.
          // BUT, "Depletion" assumes this rate continues.
          // If I print 1kg/month, my rate IS 1kg/30.
          // A correct rolling average for "Sustainability" usually implies dividing by the full window
          // IF we assume the user is "active" throughout.
          // However, closer to reality: average daily usage on *active* days vs *calendar* days.
          // For "When will I run out?", Calendar Days is the only metric that matters.

          // So: Rate = TotalConsumedInWindow / daysWindow.
          // Caveat: If the user JUST started printing 2 days ago, dividing by 30 is wrong (too low).
          // So denominator should be: Min(daysWindow, DaysSinceFirstLogInWindow).

          // Exception: If first log in window is "today", prevent div by zero -> use 1.
          const firstLogInWindow = recentLogs[0];
          const daysSinceFirst = Math.max(
            1,
            (now.getTime() - new Date(firstLogInWindow.date).getTime()) /
              oneDayMs,
          );

          // If data is very sparse (e.g. 1 log), confidence is low.
          const denominator = Math.min(daysWindow, daysSinceFirst);
          return {
            rate: totalConsumed / denominator,
            count: recentLogs.length,
          };
        };

        const rate30 = getUsageRate(30);
        const rate90 = getUsageRate(90);

        let selectedRate = 0;
        let confidence: 'high' | 'medium' | 'low' = 'low';

        if (rate30.count >= 2 && rate30.rate > 0) {
          // Active recent usage
          selectedRate = rate30.rate;
          confidence = rate30.count > 5 ? 'high' : 'medium';
        } else if (rate90.count >= 2 && rate90.rate > 0) {
          // Warning: Falling back to 90 days
          selectedRate = rate90.rate;
          confidence = 'medium';
        } else {
          // Fallback to lifetime (Rate over total span)
          const firstDate = new Date(sortedLogs[0].date);
          const totalSpan = Math.max(
            1,
            (now.getTime() - firstDate.getTime()) / oneDayMs,
          );
          const totalConsumed = sortedLogs.reduce(
            (sum, log) => sum + log.amount,
            0,
          );
          selectedRate = totalConsumed / totalSpan;
          confidence = 'low';
        }

        // If rate is effectively 0 or data too weird
        if (selectedRate <= 0.1) {
          // Less than 0.1g per day is negligible
          return {
            id: group.filaments[0].id,
            name: `${group.brand?.name} - ${group.types?.[0]?.name}`,
            brand: group.brand,
            material: group.material,
            types: group.types,
            color: group.color,
            colors: group.colors,
            colorName: group.colorName,
            weightRemaining: group.totalWeightRemaining,
            dailyUsage: 0,
            daysRemaining: Infinity,
            estimatedDepletionDate: null,
            status: 'good',
            confidence: 'low',
          };
        }

        // Calculate Depletion
        // If we have no stock left, we don't need a forecast
        if (group.totalWeightRemaining <= 0) return null;

        const daysRemaining = group.totalWeightRemaining / selectedRate;

        let estimatedDepletionDate: Date | null = null;
        if (daysRemaining !== Infinity) {
          const d = new Date();
          d.setDate(d.getDate() + daysRemaining);
          estimatedDepletionDate = d;
        }

        return {
          id: group.filaments[0].id, // Proxy ID
          name: `${group.brand?.name} - ${group.types?.[0]?.name}`,
          brand: group.brand,
          material: group.material,
          types: group.types,
          color: group.color,
          colors: group.colors,
          colorName: group.colorName,
          weightRemaining: group.totalWeightRemaining,
          plannedWeight: group.totalPlannedWeight,
          virtualWeightRemaining:
            group.totalWeightRemaining - group.totalPlannedWeight,
          dailyUsage: Math.round(selectedRate * 100) / 100,
          daysRemaining: Math.round(daysRemaining),
          estimatedDepletionDate,
          status:
            daysRemaining < 7
              ? 'critical'
              : daysRemaining < 30
                ? 'warning'
                : 'good',
          confidence,
        };
      })
      .filter((f) => f !== null);

    return {
      logs,
      analytics: {
        dailyUsage: Object.entries(dailyUsage)
          .map(([date, data]) => ({
            date,
            amount: data.amount,
            cost: Math.round(data.cost * 100) / 100,
            plannedAmount: data.plannedAmount,
            plannedCost: Math.round(data.plannedCost * 100) / 100,
          }))
          .sort((a, b) => a.date.localeCompare(b.date)),
      },
      forecasts: forecasts.sort(
        (a, b) => (a.daysRemaining || 9999) - (b.daysRemaining || 9999),
      ), // Critical first
    };
  }

  async deleteConsumptionLog(
    id: number,
    organizationId?: number,
  ): Promise<void> {
    const query: any = { id };
    if (organizationId) {
      query.filament = { organization: { id: organizationId } };
    }

    const log = await this.consumptionRepository.findOne({
      where: query,
      relations: ['filament', 'filament.organization'],
    });

    if (!log) {
      throw new NotFoundException('Consumption log not found');
    }

    if (log.filament?.isLocked && !isSelfHosted()) {
      throw new ForbiddenException(
        'Cannot modify consumption history of a locked filament.',
      );
    }

    // Credit back the weight to the filament
    if (log.filament) {
      const orgId =
        log.filament.organizationId || log.filament.organization?.id;

      // PRE-EMPTIVE QUOTA CHECK
      // If restoring weight to a depleted spool (0g -> >0g), check if it makes the org over-quota
      if (
        !log.is_planned &&
        log.filament.weightRemaining <= 0 &&
        log.amount > 0 &&
        orgId
      ) {
        const activeSpoolCount = await this.filamentRepository.count({
          where: {
            organization: { id: orgId },
            isLocked: false,
            weightRemaining: MoreThan(0),
          },
        });
        const org = await this.organizationRepository.findOne({
          where: { id: orgId },
        });
        const limits = isSelfHosted()
          ? PLAN_LIMITS[SELF_HOSTED_PLAN]
          : PLAN_LIMITS[org?.plan ?? 'free'];

        if (
          limits.maxSpoolsPerOrg !== Infinity &&
          activeSpoolCount >= limits.maxSpoolsPerOrg
        ) {
          throw new BadRequestException(
            `Plan limit reached: Restoring this weight would exceed your organization's active spool limit (${limits.maxSpoolsPerOrg}). Please lock another spool before undoing this consumption.`,
          );
        }
      }

      if (log.is_planned) {
        log.filament.plannedWeight =
          (log.filament.plannedWeight || 0) - log.amount;
        log.filament.virtualWeightRemaining =
          (log.filament.virtualWeightRemaining ??
            log.filament.weightRemaining) + log.amount;
      } else {
        log.filament.weightRemaining += log.amount;
        log.filament.virtualWeightRemaining =
          (log.filament.virtualWeightRemaining ??
            log.filament.weightRemaining - log.amount) + log.amount;
      }
      await this.filamentRepository.save(log.filament);

      // Re-evaluate quota flag to be safe
      if (orgId) {
        this.evaluateOrganizationQuota(orgId).catch((e) => console.error(e));
      }
    }

    await this.consumptionRepository.remove(log);
  }

  async updateConsumptionLog(
    id: number,
    data: {
      amount?: number;
      notes?: string;
      date?: string;
      type?: ConsumptionType;
      is_planned?: boolean;
      printTaskId?: string;
      printStatus?: PrintStatus;
    },
    organizationId?: number,
  ): Promise<ConsumptionLog> {
    const query: any = { id };
    if (organizationId) {
      query.filament = { organization: { id: organizationId } };
    }

    const log = await this.consumptionRepository.findOne({
      where: query,
      relations: ['filament', 'filament.organization'],
    });

    if (!log) {
      throw new NotFoundException('Consumption log not found');
    }

    if (log.filament?.isLocked && !isSelfHosted()) {
      throw new ForbiddenException(
        'Cannot modify consumption history of a locked filament.',
      );
    }
    if (log.filament) {
      const filament = log.filament;
      // Ensure virtual is initialized
      if (filament.virtualWeightRemaining === null)
        filament.virtualWeightRemaining = filament.weightRemaining;

      // 1. Remove OLD effect
      if (log.is_planned) {
        filament.plannedWeight -= log.amount;
        filament.virtualWeightRemaining += log.amount;
      } else {
        filament.weightRemaining += log.amount;
        filament.virtualWeightRemaining += log.amount;
      }

      // 2. Apply NEW effect
      const newIsPlanned =
        data.is_planned !== undefined ? data.is_planned : log.is_planned;
      const newAmount = data.amount !== undefined ? data.amount : log.amount;

      if (newIsPlanned) {
        filament.plannedWeight += newAmount;
        filament.virtualWeightRemaining -= newAmount;
      } else {
        filament.weightRemaining -= newAmount;
        filament.virtualWeightRemaining -= newAmount;
      }

      // PRE-EMPTIVE QUOTA CHECK FOR UPDATE
      // If the adjustment makes an inactive spool active
      const orgId = filament.organizationId || filament.organization?.id;
      if (orgId && !newIsPlanned) {
        // Check if it was depleted before this change and is now active
        const wasDepleted =
          filament.weightRemaining + newAmount - log.amount <= 0;
        const isNowActive = filament.weightRemaining > 0;

        if (wasDepleted && isNowActive) {
          const activeSpoolCount = await this.filamentRepository.count({
            where: {
              organization: { id: orgId },
              isLocked: false,
              weightRemaining: MoreThan(0),
            },
          });
          const org = await this.organizationRepository.findOne({
            where: { id: orgId },
          });
          const limits = isSelfHosted()
            ? PLAN_LIMITS[SELF_HOSTED_PLAN]
            : PLAN_LIMITS[org?.plan ?? 'free'];

          if (
            limits.maxSpoolsPerOrg !== Infinity &&
            activeSpoolCount >= limits.maxSpoolsPerOrg
          ) {
            throw new BadRequestException(
              `Plan limit reached: This update would restore weight to a depleted spool, exceeding your organization's active spool limit (${limits.maxSpoolsPerOrg}).`,
            );
          }
        }
      }

      filament.plannedWeight = Math.max(0, filament.plannedWeight);
      filament.weightRemaining = Math.max(0, filament.weightRemaining);
      filament.virtualWeightRemaining = Math.max(
        0,
        filament.virtualWeightRemaining,
      );

      await this.filamentRepository.save(filament);

      if (orgId) {
        this.evaluateOrganizationQuota(orgId).catch((e) => console.error(e));
      }
    }

    // Update fields
    if (data.amount !== undefined) log.amount = data.amount;
    if (data.notes !== undefined) log.notes = data.notes;
    if (data.date !== undefined) log.date = new Date(data.date);
    if (data.type !== undefined) log.type = data.type;
    if (data.is_planned !== undefined) log.is_planned = data.is_planned;
    if (data.printTaskId !== undefined) log.printTaskId = data.printTaskId;
    if (data.printStatus !== undefined) log.printStatus = data.printStatus;

    return this.consumptionRepository.save(log);
  }

  async mergeReferenceData(
    type: 'brand' | 'material' | 'type',
    sourceId: number,
    targetId: number,
  ) {
    if (sourceId === targetId)
      throw new BadRequestException('Source and target cannot be the same');

    let notificationTargetUsers: any[] = [];
    let sourceItemName = '';

    if (type === 'brand') {
      const source = await this.brandRepository.findOne({
        where: { id: sourceId },
        relations: ['organization'],
      });
      const target = await this.brandRepository.findOne({
        where: { id: targetId },
      });
      if (!source || !target)
        throw new NotFoundException('Source or target not found');

      if (source.organization) {
        const userOrgs = await this.userOrganizationRepository.find({
          where: { organizationId: source.organization.id, hasConfirmed: true },
          relations: ['user'],
        });
        notificationTargetUsers = userOrgs.map((uo) => uo.user);
        sourceItemName = source.name;
      }

      // 1. Update Filaments
      await this.filamentRepository.update(
        { brand: { id: sourceId } },
        { brand: target },
      );

      // 2. Update BrandCatalog
      const sourceCatalogs = await this.brandCatalogRepository.find({
        where: { brand: { id: sourceId } },
        relations: ['material', 'type'],
      });

      for (const cat of sourceCatalogs) {
        const existing = await this.brandCatalogRepository.findOne({
          where: {
            brand: { id: targetId },
            material: { id: cat.material?.id },
            type: { id: cat.type?.id },
          },
        });

        if (existing) {
          await this.brandCatalogRepository.remove(cat);
        } else {
          cat.brand = target;
          await this.brandCatalogRepository.save(cat);
        }
      }

      // 3. Delete Source
      await this.brandRepository.remove(source);
    } else if (type === 'material') {
      const source = await this.materialRepository.findOne({
        where: { id: sourceId },
        relations: ['organization'],
      });
      const target = await this.materialRepository.findOne({
        where: { id: targetId },
      });
      if (!source || !target)
        throw new NotFoundException('Source or target not found');

      if (source.organization) {
        const userOrgs = await this.userOrganizationRepository.find({
          where: { organizationId: source.organization.id, hasConfirmed: true },
          relations: ['user'],
        });
        notificationTargetUsers = userOrgs.map((uo) => uo.user);
        sourceItemName = source.name;
      }

      // 1. Update Filaments
      await this.filamentRepository.update(
        { material: { id: sourceId } },
        { material: target },
      );

      // 2. Update BrandCatalog
      const sourceCatalogs = await this.brandCatalogRepository.find({
        where: { material: { id: sourceId } },
        relations: ['brand', 'type'],
      });

      for (const cat of sourceCatalogs) {
        const existing = await this.brandCatalogRepository.findOne({
          where: {
            brand: { id: cat.brand?.id },
            material: { id: targetId },
            type: { id: cat.type?.id },
          },
        });

        if (existing) {
          await this.brandCatalogRepository.remove(cat);
        } else {
          cat.material = target;
          await this.brandCatalogRepository.save(cat);
        }
      }

      // 3. Delete Source
      await this.materialRepository.remove(source);
    } else if (type === 'type') {
      const source = await this.typeRepository.findOne({
        where: { id: sourceId },
        relations: ['organization'],
      });
      const target = await this.typeRepository.findOne({
        where: { id: targetId },
      });
      if (!source || !target)
        throw new NotFoundException('Source or target not found');

      if (source.organization) {
        const userOrgs = await this.userOrganizationRepository.find({
          where: { organizationId: source.organization.id, hasConfirmed: true },
          relations: ['user'],
        });
        notificationTargetUsers = userOrgs.map((uo) => uo.user);
        sourceItemName = source.name;
      }

      // 1. Update Filaments (Many-to-Many)
      const filaments = await this.filamentRepository.find({
        where: { types: { id: sourceId } },
        relations: ['types'],
      });

      for (const f of filaments) {
        f.types = f.types.filter((t) => t.id !== sourceId);
        if (!f.types.find((t) => t.id === targetId)) {
          f.types.push(target);
        }
        await this.filamentRepository.save(f);
      }

      // 2. Update BrandCatalog
      const sourceCatalogs = await this.brandCatalogRepository.find({
        where: { type: { id: sourceId } },
        relations: ['brand', 'material'],
      });

      for (const cat of sourceCatalogs) {
        const existing = await this.brandCatalogRepository.findOne({
          where: {
            brand: { id: cat.brand?.id },
            material: { id: cat.material?.id },
            type: { id: targetId },
          },
        });

        if (existing) {
          await this.brandCatalogRepository.remove(cat);
        } else {
          cat.type = target;
          await this.brandCatalogRepository.save(cat);
        }
      }

      // 3. Delete Source
      await this.typeRepository.remove(source);
    }

    // Notify users
    if (notificationTargetUsers.length > 0) {
      // Send notification to all org users
      for (const user of notificationTargetUsers) {
        await this.notificationService.create(
          user.id,
          NotificationType.SYSTEM,
          'referenceData.mergedTitle',
          'referenceData.mergedBody',
          { type, name: sourceItemName },
        );
      }
    }

    // 4. Delete Source
    if (type === 'brand') {
      /* for forecast data structure update */
    }

    return { success: true };
  }

  async convertProjectPlannedConsumptions(
    projectId: number,
    organizationId: number,
  ) {
    const logs = await this.consumptionRepository.find({
      where: {
        projectId: projectId,
        is_planned: true,
        filament: { organization: { id: organizationId } },
      },
      relations: ['filament'],
    });

    if (logs.length === 0) return { count: 0 };

    for (const log of logs) {
      log.is_planned = false;
      const filament = log.filament;

      // Update weights
      // Physical weight decreases because it's now 'real' consumption
      filament.weightRemaining = Math.max(
        0,
        filament.weightRemaining - log.amount,
      );
      // Planned weight decreases because it's no longer planned
      filament.plannedWeight = Math.max(
        0,
        (filament.plannedWeight || 0) - log.amount,
      );
      // virtualWeightRemaining remains the same (it already accounted for the 'planned' weight)

      await this.filamentRepository.save(filament);
      await this.consumptionRepository.save(log);
    }

    return { count: logs.length };
  }

  private async notifyOtherMembers(
    organizationId: number,
    executorId: number | undefined,
    type: any,
    title: string,
    message: string,
    data: any,
  ) {
    if (!organizationId) return;

    const members = await this.userOrganizationRepository.find({
      where: { organizationId, hasConfirmed: true },
    });
    for (const member of members) {
      // Fix: Use Number() to ensure type-safe comparison (string vs number from JWT)
      if (Number(member.userId) !== Number(executorId)) {
        await this.notificationService
          .create(member.userId, type, title, message, data)
          .catch((e) => console.error(e));
      }
    }
  }
}
// Force rebuild for forecast data structure update
