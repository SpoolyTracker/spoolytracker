import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import * as apiPackageJson from '../../package.json';
import { Organization } from '../organization/organization.entity';
import { Filament } from '../filament/filament.entity';
import { FilamentBrand } from '../filament/brand.entity';
import { FilamentMaterial } from '../filament/filament-material.entity';
import { FilamentType } from '../filament/filament-type.entity';
import { FilamentOption } from '../filament/filament-option.entity';
import { BrandCatalog } from '../filament/brand-catalog.entity';
import { FilamentColorReference } from '../filament/filament-color-reference.entity';
import { StorageUnit } from '../filament/storage-unit.entity';
import { ConsumptionLog } from '../filament/consumption-log.entity';
import { Project } from '../projects/entities/project.entity';
import { ProjectItem } from '../projects/entities/project-item.entity';
import { ProjectExternalItem } from '../projects/entities/project-external-item.entity';
import { ProjectFile } from '../projects/entities/project-file.entity';
import { TigerMappingService } from '../tigertag/tiger-mapping.service';
import {
  DATA_PORTABILITY_SCOPES,
  DataPortabilityScope,
  ExportRequestDto,
  FieldDifference,
  ImportCommitRequestDto,
  ImportPreviewRequestDto,
  LEGACY_MOBILE_BACKUP_FORMAT,
  SERVER_EXPORT_FORMAT,
  SERVER_EXPORT_SCHEMA_VERSION,
  ServerExportPayload,
} from './data-portability.types';

const DEFAULT_SCOPES: DataPortabilityScope[] = [
  'referenceData',
  'inventory',
  'consumption',
  'projects',
  'organizationSettings',
];

const EXPECTED_FIELDS: Record<string, Record<string, string[]>> = {
  referenceData: {
    brands: ['id', 'name', 'logoUrl', 'isCustom', 'organizationId', 'createdAt'],
    materials: ['id', 'name', 'description', 'organizationId', 'createdAt'],
    types: ['id', 'name', 'description', 'organizationId', 'createdAt'],
    options: [
      'id',
      'name',
      'category',
      'description',
      'isCharacteristic',
      'organizationId',
      'createdAt',
    ],
    brandCatalog: [
      'id',
      'brandId',
      'materialId',
      'typeId',
      'organizationId',
      'density_gcm3',
      'nozzle_temp_min',
      'nozzle_temp_max',
      'bed_temp_min',
      'bed_temp_max',
      'isActive',
      'createdAt',
      'updatedAt',
    ],
    colorReferences: [
      'id',
      'brandId',
      'materialId',
      'typeId',
      'organizationId',
      'name',
      'primaryHex',
      'hexes',
      'source',
      'sourceExternalId',
      'finish',
      'pattern',
      'multiColorDirection',
      'translucent',
      'glow',
      'isActive',
      'createdAt',
      'updatedAt',
    ],
    tigerMappings: ['brands', 'materials', 'types'],
  },
  inventory: {
    filaments: [
      'id',
      'brandId',
      'materialId',
      'typeIds',
      'optionIds',
      'color',
      'colorHex',
      'colorName',
      'colors',
      'colorReferenceId',
      'weightInitial',
      'weightRemaining',
      'nfcTagId',
      'purchaseDate',
      'price',
      'vendor',
      'isRefill',
      'favorite',
      'spoolReference',
      'storageUnitId',
      'storageLevel',
      'storageSlot',
      'technical',
      'tigerTag',
      'lowStockThreshold',
      'lowStockThresholdType',
      'organizationId',
      'createdAt',
      'updatedAt',
      'deletedAt',
    ],
    storageUnits: [
      'id',
      'name',
      'location',
      'kind',
      'levels',
      'slotsPerLevel',
      'tagId',
      'favorite',
      'organizationId',
      'createdAt',
      'updatedAt',
    ],
  },
  consumption: {
    logs: [
      'id',
      'filamentId',
      'projectId',
      'amount',
      'type',
      'notes',
      'date',
      'externalJobId',
      'is_planned',
      'printTaskId',
      'printStatus',
    ],
  },
  projects: {
    projects: [
      'id',
      'name',
      'description',
      'status',
      'global_cost',
      'print_time_seconds',
      'labor_time_seconds',
      'machine_hourly_rate',
      'labor_hourly_rate',
      'misc_costs',
      'start_date',
      'end_date',
      'image_url',
      'target_selling_price',
      'printer_power_kw',
      'electricity_cost_kwh',
      'overhead_rates',
      'notes',
      'tags',
      'items',
      'externalItems',
      'files',
      'created_at',
      'updated_at',
    ],
  },
  organizationSettings: {
    organization: ['id', 'slug', 'name', 'logo', 'settings', 'createdAt', 'updatedAt'],
  },
};

@Injectable()
export class DataPortabilityService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    @InjectRepository(Filament)
    private readonly filamentRepository: Repository<Filament>,
    @InjectRepository(FilamentBrand)
    private readonly brandRepository: Repository<FilamentBrand>,
    @InjectRepository(FilamentMaterial)
    private readonly materialRepository: Repository<FilamentMaterial>,
    @InjectRepository(FilamentType)
    private readonly typeRepository: Repository<FilamentType>,
    @InjectRepository(FilamentOption)
    private readonly optionRepository: Repository<FilamentOption>,
    @InjectRepository(BrandCatalog)
    private readonly brandCatalogRepository: Repository<BrandCatalog>,
    @InjectRepository(FilamentColorReference)
    private readonly colorReferenceRepository: Repository<FilamentColorReference>,
    @InjectRepository(StorageUnit)
    private readonly storageUnitRepository: Repository<StorageUnit>,
    @InjectRepository(ConsumptionLog)
    private readonly consumptionLogRepository: Repository<ConsumptionLog>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    private readonly tigerMappingService: TigerMappingService,
  ) {}

  async exportOrganization(
    organizationId: number,
    request: ExportRequestDto = {},
  ): Promise<ServerExportPayload> {
    const scopes = this.normalizeScopes(request.scopes);
    const organization = await this.organizationRepository.findOne({
      where: { id: organizationId },
    });
    if (!organization) throw new BadRequestException('Organization not found');

    const data: Record<string, unknown> = {};
    const includeGlobalReferenceData = request.includeGlobalReferenceData ?? true;

    if (scopes.includes('referenceData')) {
      data.referenceData = await this.exportReferenceData(
        organizationId,
        includeGlobalReferenceData,
      );
    }
    if (scopes.includes('inventory')) {
      data.inventory = await this.exportInventory(organizationId);
    }
    if (scopes.includes('consumption')) {
      data.consumption = await this.exportConsumption(organizationId);
    }
    if (scopes.includes('projects')) {
      data.projects = await this.exportProjects(organizationId);
    }
    if (scopes.includes('organizationSettings')) {
      data.organizationSettings = {
        organization: this.pickOrganizationSettings(organization),
      };
    }

    return {
      manifest: {
        format: SERVER_EXPORT_FORMAT,
        schemaVersion: SERVER_EXPORT_SCHEMA_VERSION,
        exportId: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        exportedAt: new Date().toISOString(),
        source: {
          apiVersion: apiPackageJson.version,
          webVersion:
            this.config.get<string>('WEB_VERSION') ||
            this.config.get<string>('FRONTEND_VERSION') ||
            null,
          dbMigrationVersion: this.config.get<string>('DB_MIGRATION_VERSION') || null,
          organizationId,
        },
        selectedScopes: scopes,
      },
      data,
    };
  }

  inspectPayload(payload: unknown) {
    const parsed = this.unwrapPayload(payload);
    const format = this.detectFormat(parsed);
    const scopes = this.detectScopes(parsed, format);
    const fieldDifferences =
      format === SERVER_EXPORT_FORMAT
        ? this.diffServerExportFields(parsed, scopes)
        : [];

    return {
      format,
      supported: format === SERVER_EXPORT_FORMAT || format === LEGACY_MOBILE_BACKUP_FORMAT,
      schemaVersion:
        format === SERVER_EXPORT_FORMAT
          ? parsed.manifest?.schemaVersion ?? null
          : parsed.version ?? null,
      exportedAt:
        format === SERVER_EXPORT_FORMAT
          ? parsed.manifest?.exportedAt ?? null
          : parsed.exportedAt ?? null,
      source:
        format === SERVER_EXPORT_FORMAT ? parsed.manifest?.source ?? null : parsed.source ?? null,
      scopes,
      fieldDifferences,
      warnings: this.inspectWarnings(format, parsed, fieldDifferences),
    };
  }

  previewImport(request: ImportPreviewRequestDto) {
    const inspect = this.inspectPayload(request.payload);
    if (!inspect.supported) {
      throw new BadRequestException('Unsupported import format');
    }

    const requestedScopes = request.scopes?.length
      ? this.normalizeScopes(request.scopes)
      : inspect.scopes;
    const payload = this.unwrapPayload(request.payload);
    const data =
      inspect.format === SERVER_EXPORT_FORMAT
        ? payload.data || {}
        : payload.data || payload;

    const mode = request.mode || 'replace';
    const selectedFieldDifferences = inspect.fieldDifferences.filter((difference) =>
      requestedScopes.includes(difference.scope as DataPortabilityScope),
    );
    const unsafeReferenceReplace =
      mode === 'replace' &&
      requestedScopes.includes('referenceData') &&
      !requestedScopes.includes('inventory');
    const schemaVersionSupported =
      inspect.format !== SERVER_EXPORT_FORMAT ||
      this.isSupportedServerSchemaVersion(inspect.schemaVersion);

    return {
      mode,
      ...inspect,
      selectedScopes: requestedScopes,
      fieldDifferences: selectedFieldDifferences,
      warnings: [
        ...inspect.warnings,
        ...(unsafeReferenceReplace
          ? ['Replacing reference data requires inventory scope, otherwise existing filaments may keep references alive. Use merge or include inventory.']
          : []),
      ],
      summary: requestedScopes.map((scope) => ({
        scope,
        counts: this.countScope(data, scope),
      })),
      canCommit:
        schemaVersionSupported &&
        !unsafeReferenceReplace &&
        selectedFieldDifferences.every((difference) => difference.severity !== 'error'),
      commitEndpointReady: inspect.format === SERVER_EXPORT_FORMAT,
    };
  }

  async commitImport(organizationId: number, request: ImportCommitRequestDto) {
    const inspect = this.inspectPayload(request.payload);
    if (inspect.format !== SERVER_EXPORT_FORMAT) {
      throw new BadRequestException(
        'Only spooly.server-export imports can be committed for now',
      );
    }
    if (!inspect.supported) {
      throw new BadRequestException('Unsupported import format');
    }

    const preview = this.previewImport(request);
    if (!preview.canCommit) {
      throw new BadRequestException('Import preview has blocking field errors');
    }

    const payload = this.unwrapPayload(request.payload);
    const data = payload.data || {};
    const scopes = preview.selectedScopes;
    const mode = preview.mode;

    const result = await this.dataSource.transaction(async (manager) => {
      const stats: Record<string, number> = {
        brands: 0,
        materials: 0,
        types: 0,
        options: 0,
        brandCatalog: 0,
        colorReferences: 0,
        storageUnits: 0,
        filaments: 0,
        projects: 0,
        consumptionLogs: 0,
      };

      if (mode === 'replace') {
        await this.deleteSelectedScopes(manager, organizationId, scopes);
      }

      const maps = {
        brands: new Map<number, number>(),
        materials: new Map<number, number>(),
        types: new Map<number, number>(),
        options: new Map<number, number>(),
        colorReferences: new Map<number, number>(),
        storageUnits: new Map<number, number>(),
        filaments: new Map<number, number>(),
        projects: new Map<number, number>(),
      };

      if (scopes.includes('referenceData')) {
        await this.importReferenceData(
          manager,
          organizationId,
          data.referenceData || {},
          maps,
          stats,
        );
      }
      if (scopes.includes('inventory')) {
        await this.importInventory(
          manager,
          organizationId,
          data.inventory || {},
          maps,
          stats,
        );
      }
      if (scopes.includes('projects')) {
        await this.importProjects(
          manager,
          organizationId,
          data.projects || {},
          maps,
          stats,
          mode,
        );
      }
      if (scopes.includes('consumption')) {
        await this.importConsumption(
          manager,
          organizationId,
          data.consumption || {},
          maps,
          stats,
        );
      }
      if (scopes.includes('organizationSettings')) {
        await this.importOrganizationSettings(
          manager,
          organizationId,
          data.organizationSettings || {},
        );
      }

      return stats;
    });

    return {
      status: 'committed',
      mode,
      scopes,
      stats: result,
    };
  }

  private async exportReferenceData(
    organizationId: number,
    includeGlobal: boolean,
  ) {
    const where = includeGlobal
      ? [{ organizationId: IsNull() }, { organizationId }]
      : [{ organizationId }];
    const catalogWhere = includeGlobal
      ? [{ organizationId: IsNull() }, { organizationId }]
      : [{ organizationId }];

    const [
      brands,
      materials,
      types,
      options,
      brandCatalog,
      colorReferences,
      tigerMappings,
    ] = await Promise.all([
      this.brandRepository.find({ where, order: { name: 'ASC' } }),
      this.materialRepository.find({ where, order: { name: 'ASC' } }),
      this.typeRepository.find({ where, order: { name: 'ASC' } }),
      this.optionRepository.find({ where, order: { category: 'ASC', name: 'ASC' } }),
      this.brandCatalogRepository.find({
        where: catalogWhere,
        order: { id: 'ASC' },
      }),
      this.colorReferenceRepository.find({
        where: includeGlobal
          ? [
              { organizationId: IsNull(), isActive: true },
              { organizationId, isActive: true },
            ]
          : [{ organizationId, isActive: true }],
        order: { name: 'ASC' },
      }),
      this.tigerMappingService.getMappingsForSync(includeGlobal ? organizationId : null),
    ]);

    return { brands, materials, types, options, brandCatalog, colorReferences, tigerMappings };
  }

  private async exportInventory(organizationId: number) {
    const [filaments, storageUnits] = await Promise.all([
      this.filamentRepository.find({
        where: { organizationId },
        relations: ['types', 'options'],
        order: { id: 'ASC' },
        withDeleted: true,
      }),
      this.storageUnitRepository.find({
        where: { organizationId },
        order: { name: 'ASC' },
      }),
    ]);

    return {
      storageUnits,
      filaments: filaments.map((filament) => this.serializeFilament(filament)),
    };
  }

  private async exportConsumption(organizationId: number) {
    const logs = await this.consumptionLogRepository
      .createQueryBuilder('log')
      .innerJoin('log.filament', 'filament')
      .where('filament.organizationId = :organizationId', { organizationId })
      .orderBy('log.date', 'DESC')
      .getMany();

    return {
      logs: logs.map((log) => ({
        id: log.id,
        filamentId: log.filamentId,
        projectId: log.projectId,
        amount: log.amount,
        type: log.type,
        notes: log.notes,
        date: log.date,
        externalJobId: log.externalJobId,
        is_planned: log.is_planned,
        printTaskId: log.printTaskId,
        printStatus: log.printStatus,
      })),
    };
  }

  private async exportProjects(organizationId: number) {
    const projects = await this.projectRepository.find({
      where: { organization: { id: organizationId } },
      relations: ['items', 'externalItems', 'files', 'consumptionLogs'],
      order: { id: 'ASC' },
    });

    return {
      projects: projects.map((project) => ({
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        global_cost: project.global_cost,
        print_time_seconds: project.print_time_seconds,
        labor_time_seconds: project.labor_time_seconds,
        machine_hourly_rate: project.machine_hourly_rate,
        labor_hourly_rate: project.labor_hourly_rate,
        misc_costs: project.misc_costs,
        start_date: project.start_date,
        end_date: project.end_date,
        image_url: project.image_url,
        target_selling_price: project.target_selling_price,
        printer_power_kw: project.printer_power_kw,
        electricity_cost_kwh: project.electricity_cost_kwh,
        overhead_rates: project.overhead_rates,
        notes: project.notes,
        tags: project.tags,
        items: (project.items || []).map((item) => ({
          id: item.id,
          projectId: item.projectId,
          filamentId: item.filamentId,
          material: item.material,
          color: item.color,
          weight_required_g: item.weight_required_g,
          weight_used_g: item.weight_used_g,
        })),
        externalItems: (project.externalItems || []).map((item) => ({
          id: item.id,
          projectId: item.projectId,
          title: item.title,
          external_ref: item.external_ref,
          source: item.source,
          url: item.url,
          unit_price: item.unit_price,
          quantity: item.quantity,
          created_at: item.created_at,
          updated_at: item.updated_at,
        })),
        files: (project.files || []).map((file) => ({
          id: file.id,
          projectId: file.projectId,
          file_url: file.file_url,
          analysis_metadata: file.analysis_metadata,
          file_type: file.file_type,
          file_name: file.file_name,
          file_size: file.file_size,
          uploaded_at: file.uploaded_at,
        })),
        consumptionLogIds: (project.consumptionLogs || []).map((log) => log.id),
        created_at: project.created_at,
        updated_at: project.updated_at,
      })),
    };
  }

  private async deleteSelectedScopes(
    manager: any,
    organizationId: number,
    scopes: DataPortabilityScope[],
  ) {
    const filamentIds = await this.getOrganizationFilamentIds(manager, organizationId);
    const projectIds = await this.getOrganizationProjectIds(manager, organizationId);

    if (scopes.includes('consumption') && filamentIds.length) {
      await manager.delete(ConsumptionLog, { filamentId: In(filamentIds) });
    }
    if (scopes.includes('projects') && projectIds.length) {
      await manager.delete(Project, { id: In(projectIds) });
    }
    if (scopes.includes('inventory')) {
      if (filamentIds.length) {
        await manager.delete(Filament, { id: In(filamentIds) });
      }
      await manager.delete(StorageUnit, { organizationId });
    }
    if (scopes.includes('referenceData') && scopes.includes('inventory')) {
      await manager.delete(FilamentColorReference, { organizationId });
      await manager.delete(BrandCatalog, { organizationId });
      await manager.delete(FilamentOption, { organizationId });
      await manager.delete(FilamentType, { organizationId });
      await manager.delete(FilamentMaterial, { organizationId });
      await manager.delete(FilamentBrand, { organizationId });
    }
  }

  private async importReferenceData(
    manager: any,
    organizationId: number,
    referenceData: any,
    maps: any,
    stats: Record<string, number>,
  ) {
    for (const row of this.asArray(referenceData.brands)) {
      const saved = await this.upsertNamedReference(
        manager,
        FilamentBrand,
        organizationId,
        row,
        ['name', 'logoUrl', 'isCustom'],
      );
      this.mapId(maps.brands, row?.id, saved.id);
      stats.brands++;
    }
    for (const row of this.asArray(referenceData.materials)) {
      const saved = await this.upsertNamedReference(
        manager,
        FilamentMaterial,
        organizationId,
        row,
        ['name', 'description'],
      );
      this.mapId(maps.materials, row?.id, saved.id);
      stats.materials++;
    }
    for (const row of this.asArray(referenceData.types)) {
      const saved = await this.upsertNamedReference(
        manager,
        FilamentType,
        organizationId,
        row,
        ['name', 'description'],
      );
      this.mapId(maps.types, row?.id, saved.id);
      stats.types++;
    }
    for (const row of this.asArray(referenceData.options)) {
      const saved = await this.upsertOption(manager, organizationId, row);
      this.mapId(maps.options, row?.id, saved.id);
      stats.options++;
    }
    for (const row of this.asArray(referenceData.brandCatalog)) {
      const brandId = await this.resolveScopedReferenceId(
        manager,
        FilamentBrand,
        maps.brands,
        row?.brandId,
        organizationId,
      );
      const materialId = await this.resolveScopedReferenceId(
        manager,
        FilamentMaterial,
        maps.materials,
        row?.materialId,
        organizationId,
      );
      const typeId = await this.resolveScopedReferenceId(
        manager,
        FilamentType,
        maps.types,
        row?.typeId,
        organizationId,
      );
      if (!brandId || !materialId || !typeId) continue;
      await this.upsertBrandCatalog(manager, organizationId, row, {
        brandId,
        materialId,
        typeId,
      });
      stats.brandCatalog++;
    }
    for (const row of this.asArray(referenceData.colorReferences)) {
      const brandId = await this.resolveScopedReferenceId(
        manager,
        FilamentBrand,
        maps.brands,
        row?.brandId,
        organizationId,
      );
      if (!brandId || !row?.name || !row?.primaryHex) continue;
      const saved = await this.upsertColorReference(manager, organizationId, row, {
        brandId,
        materialId: await this.resolveScopedReferenceId(
          manager,
          FilamentMaterial,
          maps.materials,
          row?.materialId,
          organizationId,
        ),
        typeId: await this.resolveScopedReferenceId(
          manager,
          FilamentType,
          maps.types,
          row?.typeId,
          organizationId,
        ),
      });
      this.mapId(maps.colorReferences, row?.id, saved.id);
      stats.colorReferences++;
    }
  }

  private async importInventory(
    manager: any,
    organizationId: number,
    inventory: any,
    maps: any,
    stats: Record<string, number>,
  ) {
    for (const row of this.asArray(inventory.storageUnits)) {
      const repo = manager.getRepository(StorageUnit);
      let existing = row?.id
        ? await repo.findOne({ where: { id: row.id, organizationId } })
        : null;
      if (!existing && row?.tagId) {
        existing = await repo.findOne({ where: { tagId: row.tagId, organizationId } });
      }
      const saved = await repo.save({
        ...(existing ? { id: existing.id } : {}),
        name: row?.name || 'Storage',
        location: row?.location ?? null,
        kind: row?.kind || 'shelf',
        levels: Number(row?.levels) || 1,
        slotsPerLevel: Number(row?.slotsPerLevel) || 1,
        tagId: row?.tagId ?? null,
        favorite: !!row?.favorite,
        organizationId,
      });
      this.mapId(maps.storageUnits, row?.id, saved.id);
      stats.storageUnits++;
    }

    const filamentRepo = manager.getRepository(Filament);
    const typeRepo = manager.getRepository(FilamentType);
    const optionRepo = manager.getRepository(FilamentOption);
    for (const row of this.asArray(inventory.filaments)) {
      let existing = row?.id
        ? await filamentRepo.findOne({ where: { id: row.id, organizationId } })
        : null;
      if (!existing && row?.spoolReference) {
        existing = await filamentRepo.findOne({
          where: { spoolReference: row.spoolReference, organizationId },
        });
      }

      const brandId = await this.resolveScopedReferenceId(
        manager,
        FilamentBrand,
        maps.brands,
        row?.brandId,
        organizationId,
      );
      const materialId = await this.resolveScopedReferenceId(
        manager,
        FilamentMaterial,
        maps.materials,
        row?.materialId,
        organizationId,
      );
      if (!brandId || !materialId) continue;

      const typeIds = (
        await Promise.all(
          this.asArray(row?.typeIds).map((id) =>
            this.resolveScopedReferenceId(manager, FilamentType, maps.types, id, organizationId),
          ),
        )
      ).filter(Boolean);
      const optionIds = (
        await Promise.all(
          this.asArray(row?.optionIds).map((id) =>
            this.resolveScopedReferenceId(
              manager,
              FilamentOption,
              maps.options,
              id,
              organizationId,
            ),
          ),
        )
      ).filter(Boolean);
      const colorReferenceId = await this.resolveScopedReferenceId(
        manager,
        FilamentColorReference,
        maps.colorReferences,
        row?.colorReferenceId,
        organizationId,
      );
      const storageUnitId = await this.resolveOrganizationEntityId(
        manager,
        StorageUnit,
        maps.storageUnits,
        row?.storageUnitId,
        organizationId,
      );
      const weightInitial =
        row?.weightInitial === null || row?.weightInitial === undefined
          ? 1000
          : Number(row.weightInitial);

      const saved = await filamentRepo.save({
        ...(existing ? { id: existing.id } : {}),
        brandId,
        materialId,
        color: row?.color || row?.colorHex || '#000000',
        colorHex: row?.colorHex || row?.color || '#000000',
        colorName: row?.colorName ?? null,
        colors: row?.colors ?? null,
        colorReferenceId,
        weightInitial,
        weightRemaining:
          row?.weightRemaining === null || row?.weightRemaining === undefined
            ? weightInitial
            : Number(row.weightRemaining),
        nfcTagId: row?.nfcTagId ?? null,
        purchaseDate: row?.purchaseDate ? new Date(row.purchaseDate) : null,
        price: row?.price ?? null,
        vendor: row?.vendor ?? null,
        isRefill: !!row?.isRefill,
        favorite: !!row?.favorite,
        spoolReference: row?.spoolReference || `IMPORT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        storageUnitId,
        storageLevel: row?.storageLevel ?? null,
        storageSlot: row?.storageSlot ?? null,
        ...this.flattenTechnicalFields(row?.technical || {}),
        ...this.flattenTigerTagFields(row?.tigerTag || {}),
        lowStockThreshold: row?.lowStockThreshold ?? null,
        lowStockThresholdType: row?.lowStockThresholdType || 'GRAMS',
        organizationId,
        types: typeIds.length ? await typeRepo.findBy({ id: In(typeIds) }) : [],
        options: optionIds.length ? await optionRepo.findBy({ id: In(optionIds) }) : [],
      });
      this.mapId(maps.filaments, row?.id, saved.id);
      stats.filaments++;
    }
  }

  private async importProjects(
    manager: any,
    organizationId: number,
    projectsData: any,
    maps: any,
    stats: Record<string, number>,
    mode: 'replace' | 'merge',
  ) {
    const projectRepo = manager.getRepository(Project);
    const itemRepo = manager.getRepository(ProjectItem);
    const externalRepo = manager.getRepository(ProjectExternalItem);
    const fileRepo = manager.getRepository(ProjectFile);

    for (const row of this.asArray(projectsData.projects)) {
      let existing = row?.id
        ? await projectRepo.findOne({
            where: { id: row.id, organization: { id: organizationId } },
            relations: ['organization'],
          })
        : null;
      if (!existing && row?.name) {
        existing = await projectRepo.findOne({
          where: { name: row.name, organization: { id: organizationId } },
          relations: ['organization'],
        });
      }

      const saved = await projectRepo.save({
        ...(existing ? { id: existing.id } : {}),
        name: row?.name || 'Imported project',
        description: row?.description ?? null,
        status: row?.status || 'PLANNING',
        global_cost: row?.global_cost ?? null,
        print_time_seconds: row?.print_time_seconds ?? null,
        labor_time_seconds: row?.labor_time_seconds ?? 0,
        machine_hourly_rate: row?.machine_hourly_rate ?? 0,
        labor_hourly_rate: row?.labor_hourly_rate ?? 0,
        misc_costs: row?.misc_costs ?? 0,
        start_date: row?.start_date ? new Date(row.start_date) : null,
        end_date: row?.end_date ? new Date(row.end_date) : null,
        image_url: row?.image_url ?? null,
        target_selling_price: row?.target_selling_price ?? null,
        printer_power_kw: row?.printer_power_kw ?? null,
        electricity_cost_kwh: row?.electricity_cost_kwh ?? null,
        overhead_rates: row?.overhead_rates ?? null,
        notes: row?.notes ?? null,
        tags: row?.tags ?? null,
        organization: { id: organizationId },
      });

      if (mode === 'replace') {
        await itemRepo.delete({ projectId: saved.id });
        await externalRepo.delete({ projectId: saved.id });
        await fileRepo.delete({ projectId: saved.id });
      }

      for (const item of this.asArray(row?.items)) {
        const itemFilamentId = await this.resolveOrganizationEntityId(
          manager,
          Filament,
          maps.filaments,
          item?.filamentId,
          organizationId,
        );
        const existingItem =
          mode === 'merge' && item?.id
            ? await itemRepo.findOne({ where: { id: item.id, projectId: saved.id } })
            : null;
        await itemRepo.save({
          ...(existingItem ? { id: existingItem.id } : {}),
          projectId: saved.id,
          filamentId: itemFilamentId,
          material: item?.material ?? null,
          color: item?.color ?? null,
          weight_required_g: Number(item?.weight_required_g) || 0,
          weight_used_g: Number(item?.weight_used_g) || 0,
        });
      }
      for (const item of this.asArray(row?.externalItems)) {
        const existingExternal =
          mode === 'merge' && item?.id
            ? await externalRepo.findOne({ where: { id: item.id, projectId: saved.id } })
            : null;
        await externalRepo.save({
          ...(existingExternal ? { id: existingExternal.id } : {}),
          projectId: saved.id,
          title: item?.title || 'External item',
          external_ref: item?.external_ref ?? null,
          source: item?.source ?? null,
          url: item?.url ?? null,
          unit_price: Number(item?.unit_price) || 0,
          quantity: Number(item?.quantity) || 0,
        });
      }
      for (const file of this.asArray(row?.files)) {
        const existingFile =
          mode === 'merge' && file?.id
            ? await fileRepo.findOne({ where: { id: file.id, projectId: saved.id } })
            : null;
        await fileRepo.save({
          ...(existingFile ? { id: existingFile.id } : {}),
          projectId: saved.id,
          file_url: file?.file_url ?? null,
          analysis_metadata: file?.analysis_metadata ?? null,
          file_type: file?.file_type || 'OTHER',
          file_name: file?.file_name || 'imported-file',
          file_size: file?.file_size ?? null,
        });
      }

      this.mapId(maps.projects, row?.id, saved.id);
      stats.projects++;
    }
  }

  private async importConsumption(
    manager: any,
    organizationId: number,
    consumption: any,
    maps: any,
    stats: Record<string, number>,
  ) {
    const repo = manager.getRepository(ConsumptionLog);
    for (const row of this.asArray(consumption.logs)) {
      const filamentId = await this.resolveOrganizationEntityId(
        manager,
        Filament,
        maps.filaments,
        row?.filamentId,
        organizationId,
      );
      if (!filamentId) continue;
      const filament = await manager.getRepository(Filament).findOne({
        where: { id: filamentId, organizationId },
      });
      if (!filament) continue;
      const projectId = await this.resolveProjectId(
        manager,
        maps.projects,
        row?.projectId,
        organizationId,
      );

      let existing = row?.id
        ? await repo.findOne({
            where: { id: row.id, filament: { organizationId } },
            relations: ['filament'],
          })
        : null;
      if (existing && existing.filamentId !== filamentId) existing = null;

      await repo.save({
        ...(existing ? { id: existing.id } : {}),
        filamentId,
        projectId,
        amount: Number(row?.amount) || 0,
        type: row?.type || 'MANUAL',
        notes: row?.notes ?? null,
        date: row?.date ? new Date(row.date) : new Date(),
        externalJobId: row?.externalJobId ?? null,
        is_planned: !!row?.is_planned,
        printTaskId: row?.printTaskId ?? null,
        printStatus: row?.printStatus ?? null,
      });
      stats.consumptionLogs++;
    }
  }

  private async importOrganizationSettings(
    manager: any,
    organizationId: number,
    organizationSettings: any,
  ) {
    const settings = organizationSettings?.organization?.settings;
    if (!settings || typeof settings !== 'object') return;
    await manager.update(Organization, { id: organizationId }, { settings });
  }

  private serializeFilament(filament: Filament) {
    return {
      id: filament.id,
      brandId: filament.brandId,
      materialId: filament.materialId,
      typeIds: (filament.types || []).map((type) => type.id),
      optionIds: (filament.options || []).map((option) => option.id),
      color: filament.color,
      colorHex: filament.colorHex,
      colorName: filament.colorName,
      colors: filament.colors,
      colorReferenceId: filament.colorReferenceId,
      weightInitial: filament.weightInitial,
      weightRemaining: filament.weightRemaining,
      nfcTagId: filament.nfcTagId,
      purchaseDate: filament.purchaseDate,
      price: filament.price,
      vendor: filament.vendor,
      isRefill: filament.isRefill,
      favorite: filament.favorite,
      spoolReference: filament.spoolReference,
      storageUnitId: filament.storageUnitId,
      storageLevel: filament.storageLevel,
      storageSlot: filament.storageSlot,
      technical: {
        nozzleTempMin: filament.nozzleTempMin,
        nozzleTempMax: filament.nozzleTempMax,
        bedTempMin: filament.bedTempMin,
        bedTempMax: filament.bedTempMax,
        bedTemp: filament.bedTemp,
        chamberTempMin: filament.chamberTempMin,
        chamberTempMax: filament.chamberTempMax,
        dryTemp: filament.dryTemp,
        dryTime: filament.dryTime,
        printSpeedMin: filament.printSpeedMin,
        printSpeedMax: filament.printSpeedMax,
        retractionDistanceMm: filament.retractionDistanceMm,
        retractionSpeedMmS: filament.retractionSpeedMmS,
        retractionZHopMm: filament.retractionZHopMm,
        retractionNotes: filament.retractionNotes,
        conditionalTemperatureRules: filament.conditionalTemperatureRules,
        kFactor: filament.kFactor,
        maxVolumetricSpeedMm3S: filament.maxVolumetricSpeedMm3S,
        flowRatio: filament.flowRatio,
        densityGcm3: filament.densityGcm3,
        diameterMm: filament.diameterMm,
      },
      tigerTag: {
        tigerBrandId: filament.tigerBrandId,
        tigerMaterialId: filament.tigerMaterialId,
        tigerTypeId: filament.tigerTypeId,
        tigerTagVersion: filament.tigerTagVersion,
        productId: filament.productId,
        diameter: filament.diameter,
        aspectId1: filament.aspectId1,
        aspectId2: filament.aspectId2,
        unitId: filament.unitId,
        transmissionDistance: filament.transmissionDistance,
        timestamp: filament.timestamp,
        rawNfcData: filament.rawNfcData,
      },
      lowStockThreshold: filament.lowStockThreshold,
      lowStockThresholdType: filament.lowStockThresholdType,
      organizationId: filament.organizationId,
      createdAt: filament.createdAt,
      updatedAt: filament.updatedAt,
      deletedAt: filament.deletedAt,
    };
  }

  private async getOrganizationFilamentIds(manager: any, organizationId: number) {
    const rows = await manager
      .getRepository(Filament)
      .find({ where: { organizationId }, select: ['id'], withDeleted: true });
    return rows.map((row: Filament) => row.id);
  }

  private async getOrganizationProjectIds(manager: any, organizationId: number) {
    const rows = await manager.getRepository(Project).find({
      where: { organization: { id: organizationId } },
      select: ['id'],
    });
    return rows.map((row: Project) => row.id);
  }

  private async upsertNamedReference(
    manager: any,
    entity: any,
    organizationId: number,
    row: any,
    fields: string[],
  ) {
    const repo = manager.getRepository(entity);
    const targetOrgId = organizationId;
    let existing = row?.id
      ? await repo.findOne({ where: { id: row.id, organizationId: targetOrgId } })
      : null;
    if (!existing && row?.name) {
      existing = await repo.findOne({
        where: { name: row.name, organizationId: targetOrgId },
      });
    }
    const payload: Record<string, unknown> = {
      ...(existing ? { id: existing.id } : {}),
      organizationId: targetOrgId,
    };
    for (const field of fields) {
      if (row?.[field] !== undefined) payload[field] = row[field];
    }
    if (!payload.name) payload.name = 'Imported';
    return repo.save(payload);
  }

  private async upsertOption(manager: any, organizationId: number, row: any) {
    const repo = manager.getRepository(FilamentOption);
    const targetOrgId = organizationId;
    let existing = row?.id
      ? await repo.findOne({ where: { id: row.id, organizationId: targetOrgId } })
      : null;
    if (!existing && row?.name) {
      existing = await repo.findOne({
        where: {
          name: row.name,
          category: row.category || 'general',
          organizationId: targetOrgId,
        },
      });
    }
    return repo.save({
      ...(existing ? { id: existing.id } : {}),
      name: row?.name || 'Imported',
      category: row?.category || 'general',
      description: row?.description ?? null,
      isCharacteristic: !!row?.isCharacteristic,
      organizationId: targetOrgId,
    });
  }

  private async upsertBrandCatalog(
    manager: any,
    organizationId: number,
    row: any,
    refs: { brandId: number; materialId: number; typeId: number },
  ) {
    const repo = manager.getRepository(BrandCatalog);
    const targetOrgId = organizationId;
    let existing = row?.id
      ? await repo.findOne({ where: { id: row.id, organizationId: targetOrgId } })
      : null;
    if (!existing) {
      existing = await repo.findOne({
        where: { ...refs, organizationId: targetOrgId },
      });
    }
    return repo.save({
      ...(existing ? { id: existing.id } : {}),
      ...refs,
      organizationId: targetOrgId,
      density_gcm3: row?.density_gcm3 ?? null,
      nozzle_temp_min: row?.nozzle_temp_min ?? null,
      nozzle_temp_max: row?.nozzle_temp_max ?? null,
      bed_temp_min: row?.bed_temp_min ?? null,
      bed_temp_max: row?.bed_temp_max ?? null,
      isActive: row?.isActive !== undefined ? !!row.isActive : true,
    });
  }

  private async upsertColorReference(
    manager: any,
    organizationId: number,
    row: any,
    refs: { brandId: number; materialId: number | null; typeId: number | null },
  ) {
    const repo = manager.getRepository(FilamentColorReference);
    const targetOrgId = organizationId;
    let existing = row?.id
      ? await repo.findOne({ where: { id: row.id, organizationId: targetOrgId } })
      : null;
    if (!existing) {
      existing = await repo.findOne({
        where: { name: row.name, brandId: refs.brandId, organizationId: targetOrgId },
      });
    }
    return repo.save({
      ...(existing ? { id: existing.id } : {}),
      ...refs,
      organizationId: targetOrgId,
      name: row.name,
      primaryHex: row.primaryHex,
      hexes: row.hexes ?? null,
      source: row.source || 'manual',
      sourceExternalId: row.sourceExternalId ?? null,
      finish: row.finish ?? null,
      pattern: row.pattern ?? null,
      multiColorDirection: row.multiColorDirection ?? null,
      translucent: row.translucent ?? null,
      glow: row.glow ?? null,
      isActive: row.isActive !== undefined ? !!row.isActive : true,
    });
  }

  private flattenTechnicalFields(technical: any) {
    return {
      nozzleTempMin: technical.nozzleTempMin ?? null,
      nozzleTempMax: technical.nozzleTempMax ?? null,
      bedTempMin: technical.bedTempMin ?? null,
      bedTempMax: technical.bedTempMax ?? null,
      bedTemp: technical.bedTemp ?? null,
      chamberTempMin: technical.chamberTempMin ?? null,
      chamberTempMax: technical.chamberTempMax ?? null,
      dryTemp: technical.dryTemp ?? null,
      dryTime: technical.dryTime ?? null,
      printSpeedMin: technical.printSpeedMin ?? null,
      printSpeedMax: technical.printSpeedMax ?? null,
      retractionDistanceMm: technical.retractionDistanceMm ?? null,
      retractionSpeedMmS: technical.retractionSpeedMmS ?? null,
      retractionZHopMm: technical.retractionZHopMm ?? null,
      retractionNotes: technical.retractionNotes ?? null,
      conditionalTemperatureRules: technical.conditionalTemperatureRules ?? null,
      kFactor: technical.kFactor ?? null,
      maxVolumetricSpeedMm3S: technical.maxVolumetricSpeedMm3S ?? null,
      flowRatio: technical.flowRatio ?? null,
      densityGcm3: technical.densityGcm3 ?? null,
      diameterMm: technical.diameterMm ?? null,
    };
  }

  private flattenTigerTagFields(tigerTag: any) {
    return {
      tigerBrandId: tigerTag.tigerBrandId ?? null,
      tigerMaterialId: tigerTag.tigerMaterialId ?? null,
      tigerTypeId: tigerTag.tigerTypeId ?? null,
      tigerTagVersion: tigerTag.tigerTagVersion ?? null,
      productId: tigerTag.productId ?? null,
      diameter: tigerTag.diameter ?? null,
      aspectId1: tigerTag.aspectId1 ?? null,
      aspectId2: tigerTag.aspectId2 ?? null,
      unitId: tigerTag.unitId ?? null,
      transmissionDistance: tigerTag.transmissionDistance ?? null,
      timestamp: tigerTag.timestamp ?? null,
      rawNfcData: tigerTag.rawNfcData ?? null,
    };
  }

  private mapId(map: Map<number, number>, oldId: unknown, newId: number) {
    const parsed = Number(oldId);
    if (Number.isFinite(parsed)) map.set(parsed, newId);
  }

  private async resolveScopedReferenceId(
    manager: any,
    entity: any,
    map: Map<number, number>,
    value: unknown,
    organizationId: number,
  ): Promise<number | null> {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    const mapped = map.get(parsed);
    if (mapped) return mapped;

    const existing = await manager.getRepository(entity).findOne({
      where: [
        { id: parsed, organizationId: IsNull() },
        { id: parsed, organizationId },
      ],
      select: ['id'],
    });
    return existing?.id ?? null;
  }

  private async resolveOrganizationEntityId(
    manager: any,
    entity: any,
    map: Map<number, number>,
    value: unknown,
    organizationId: number,
  ): Promise<number | null> {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    const mapped = map.get(parsed);
    if (mapped) return mapped;

    const existing = await manager.getRepository(entity).findOne({
      where: { id: parsed, organizationId },
      select: ['id'],
    });
    return existing?.id ?? null;
  }

  private async resolveProjectId(
    manager: any,
    map: Map<number, number>,
    value: unknown,
    organizationId: number,
  ): Promise<number | null> {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    const mapped = map.get(parsed);
    if (mapped) return mapped;

    const existing = await manager.getRepository(Project).findOne({
      where: { id: parsed, organization: { id: organizationId } },
      relations: ['organization'],
    });
    return existing?.id ?? null;
  }

  private asArray(value: unknown): any[] {
    return Array.isArray(value) ? value : [];
  }

  private pickOrganizationSettings(organization: Organization) {
    return {
      id: organization.id,
      slug: organization.slug,
      name: organization.name,
      logo: organization.logo,
      settings: organization.settings,
      createdAt: organization.createdAt,
      updatedAt: organization.updatedAt,
    };
  }

  private unwrapPayload(payload: unknown): any {
    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException('Import payload must be a JSON object');
    }
    const wrapped = payload as { payload?: unknown };
    return wrapped.payload && typeof wrapped.payload === 'object'
      ? wrapped.payload
      : payload;
  }

  private detectFormat(payload: any) {
    if (payload?.manifest?.format === SERVER_EXPORT_FORMAT) return SERVER_EXPORT_FORMAT;
    if (payload?.format === LEGACY_MOBILE_BACKUP_FORMAT) return LEGACY_MOBILE_BACKUP_FORMAT;
    if (
      Array.isArray(payload?.filaments) ||
      Array.isArray(payload?.data?.filaments)
    ) {
      return LEGACY_MOBILE_BACKUP_FORMAT;
    }
    return 'unknown';
  }

  private detectScopes(payload: any, format: string): DataPortabilityScope[] {
    if (format === SERVER_EXPORT_FORMAT) {
      return this.normalizeScopes(payload?.manifest?.selectedScopes || Object.keys(payload?.data || {}));
    }
    if (format === LEGACY_MOBILE_BACKUP_FORMAT) {
      return ['referenceData', 'inventory', 'consumption'];
    }
    return [];
  }

  private isSupportedServerSchemaVersion(schemaVersion: unknown) {
    const parsed = Number(schemaVersion);
    return Number.isFinite(parsed) && parsed <= SERVER_EXPORT_SCHEMA_VERSION;
  }

  private diffServerExportFields(
    payload: any,
    scopes: DataPortabilityScope[],
  ): FieldDifference[] {
    const data = payload?.data || {};
    const differences: FieldDifference[] = [];

    for (const scope of scopes) {
      const expectedScope = EXPECTED_FIELDS[scope];
      const scopeData = data[scope];
      if (!expectedScope || !scopeData || typeof scopeData !== 'object') continue;

      for (const [entity, fields] of Object.entries(expectedScope)) {
        const rows = Array.isArray(scopeData[entity])
          ? scopeData[entity]
          : scopeData[entity]
            ? [scopeData[entity]]
            : [];
        for (const row of rows.slice(0, 25)) {
          if (!row || typeof row !== 'object') continue;
          const rowFields = Object.keys(row);
          for (const field of rowFields) {
            if (!fields.includes(field)) {
              differences.push({
                scope,
                entity,
                field,
                kind: 'unknown',
                severity: 'warning',
              });
            }
          }
          for (const field of fields) {
            if (!(field in row)) {
              differences.push({
                scope,
                entity,
                field,
                kind: 'missing',
                severity: this.isRequiredField(entity, field) ? 'error' : 'info',
              });
            }
          }
        }
      }
    }

    return this.uniqueDifferences(differences);
  }

  private inspectWarnings(
    format: string,
    payload: any,
    differences: FieldDifference[],
  ) {
    const warnings: string[] = [];
    if (format === LEGACY_MOBILE_BACKUP_FORMAT) {
      warnings.push(
        'Legacy mobile backup detected. Projects, project files, storage details, color references, and organization settings may be absent.',
      );
    }
    if (
      format === SERVER_EXPORT_FORMAT &&
      payload?.manifest?.schemaVersion !== SERVER_EXPORT_SCHEMA_VERSION
    ) {
      warnings.push(
        `Export schema version ${payload?.manifest?.schemaVersion ?? 'unknown'} will need migration to ${SERVER_EXPORT_SCHEMA_VERSION}.`,
      );
    }
    if (differences.some((difference) => difference.kind === 'unknown')) {
      warnings.push('Unknown fields were found and will be shown before commit.');
    }
    return warnings;
  }

  private countScope(data: any, scope: DataPortabilityScope) {
    const scopeData = data?.[scope] || data || {};
    if (scope === 'referenceData') {
      return {
        brands: this.count(scopeData.brands),
        materials: this.count(scopeData.materials),
        types: this.count(scopeData.types),
        options: this.count(scopeData.options),
        brandCatalog: this.count(scopeData.brandCatalog),
        colorReferences: this.count(scopeData.colorReferences),
      };
    }
    if (scope === 'inventory') {
      return {
        filaments: this.count(scopeData.filaments),
        storageUnits: this.count(scopeData.storageUnits),
      };
    }
    if (scope === 'consumption') {
      return { logs: this.count(scopeData.logs ?? data?.logs) };
    }
    if (scope === 'projects') return { projects: this.count(scopeData.projects) };
    if (scope === 'organizationSettings') {
      return { organization: scopeData.organization ? 1 : 0 };
    }
    return {};
  }

  private count(value: unknown) {
    return Array.isArray(value) ? value.length : 0;
  }

  private normalizeScopes(scopes?: unknown[]): DataPortabilityScope[] {
    if (!Array.isArray(scopes) || scopes.length === 0) return DEFAULT_SCOPES;
    const allowed = new Set(DATA_PORTABILITY_SCOPES);
    const normalized = scopes.filter((scope): scope is DataPortabilityScope =>
      allowed.has(scope as DataPortabilityScope),
    );
    return normalized.length ? normalized : DEFAULT_SCOPES;
  }

  private isRequiredField(entity: string, field: string) {
    return ['id', 'name'].includes(field) || (entity === 'filaments' && field === 'spoolReference');
  }

  private uniqueDifferences(differences: FieldDifference[]) {
    const seen = new Set<string>();
    return differences.filter((difference) => {
      const key = `${difference.scope}:${difference.entity}:${difference.field}:${difference.kind}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}
