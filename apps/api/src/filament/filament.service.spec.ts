jest.mock('marked', () => ({ marked: jest.fn((value: string) => value) }));

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FilamentService } from './filament.service';
import { Filament } from './filament.entity';
import { FilamentBrand } from './brand.entity';
import { FilamentMaterial } from './filament-material.entity';
import { FilamentType } from './filament-type.entity';
import { FilamentOption } from './filament-option.entity';
import { BrandCatalog } from './brand-catalog.entity';
import { FilamentColorReference } from './filament-color-reference.entity';
import { StorageUnit } from './storage-unit.entity';
import { ConsumptionLog } from './consumption-log.entity';
import { UserOrganization } from '../organization/user-organization.entity';
import { Organization } from '../organization/organization.entity';
import { NotificationService } from '../notification/notification.service';
import { TigerMappingService } from '../tigertag/tiger-mapping.service';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

describe('FilamentService', () => {
  let service: FilamentService;

  // Repositories Mock
  const mockRepository = () => ({
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(),
  });

  const mockNotificationService = {
    sendPush: jest.fn(),
    sendInApp: jest.fn(),
  };

  const mockTigerMappingService = {
    createBrandMapping: jest.fn(),
    createMaterialMapping: jest.fn(),
    createTypeMapping: jest.fn(),
    getMappingsForSync: jest.fn(),
  };

  let filamentRepo: any;
  let brandRepo: any;
  let materialRepo: any;
  let typeRepo: any;
  let optionRepo: any;
  let brandCatalogRepo: any;
  let colorReferenceRepo: any;
  let organizationRepo: any;
  let consumptionRepo: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilamentService,
        { provide: getRepositoryToken(Filament), useFactory: mockRepository },
        {
          provide: getRepositoryToken(FilamentBrand),
          useFactory: mockRepository,
        },
        {
          provide: getRepositoryToken(FilamentMaterial),
          useFactory: mockRepository,
        },
        {
          provide: getRepositoryToken(FilamentType),
          useFactory: mockRepository,
        },
        {
          provide: getRepositoryToken(FilamentOption),
          useFactory: mockRepository,
        },
        {
          provide: getRepositoryToken(BrandCatalog),
          useFactory: mockRepository,
        },
        {
          provide: getRepositoryToken(FilamentColorReference),
          useFactory: mockRepository,
        },
        {
          provide: getRepositoryToken(StorageUnit),
          useFactory: mockRepository,
        },
        {
          provide: getRepositoryToken(ConsumptionLog),
          useFactory: mockRepository,
        },
        {
          provide: getRepositoryToken(UserOrganization),
          useFactory: mockRepository,
        },
        {
          provide: getRepositoryToken(Organization),
          useFactory: mockRepository,
        },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: TigerMappingService, useValue: mockTigerMappingService },
      ],
    }).compile();

    service = module.get<FilamentService>(FilamentService);
    filamentRepo = module.get(getRepositoryToken(Filament));
    brandRepo = module.get(getRepositoryToken(FilamentBrand));
    materialRepo = module.get(getRepositoryToken(FilamentMaterial));
    typeRepo = module.get(getRepositoryToken(FilamentType));
    optionRepo = module.get(getRepositoryToken(FilamentOption));
    brandCatalogRepo = module.get(getRepositoryToken(BrandCatalog));
    colorReferenceRepo = module.get(getRepositoryToken(FilamentColorReference));
    organizationRepo = module.get(getRepositoryToken(Organization));
    consumptionRepo = module.get(getRepositoryToken(ConsumptionLog));

    // Setup internal notify stub to avoid complex type issues in logs
    jest.spyOn(service as any, 'notifyOtherMembers').mockResolvedValue(true);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkPlanLimits', () => {
    it('should allow system admins to bypass limits', async () => {
      const user = { systemRole: 'admin' };
      await expect(
        service.checkPlanLimits(1, user, 100),
      ).resolves.not.toThrow();
    });

    it('should throw NotFoundException if organization does not exist', async () => {
      organizationRepo.findOne.mockResolvedValue(null);
      await expect(service.checkPlanLimits(1, {}, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should block if requiresQuotaSelection is true', async () => {
      organizationRepo.findOne.mockResolvedValue({
        id: 1,
        plan: 'free',
        requiresQuotaSelection: true,
      });
      filamentRepo.count.mockResolvedValue(0);

      await expect(service.checkPlanLimits(1, {}, 1)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should block if plan limits are exceeded', async () => {
      // Free plan limits might be 5 or similar. Let's force it over
      // the expected constant (assuming PLAN_LIMITS free maxSpoolsPerOrg is say 10).
      // Rather than hardcode, we pass a huge count that breaks any finite limit.
      organizationRepo.findOne.mockResolvedValue({ id: 1, plan: 'free' });
      filamentRepo.count.mockResolvedValue(100);

      await expect(service.checkPlanLimits(1, {}, 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should allow if plan limits are respected', async () => {
      organizationRepo.findOne.mockResolvedValue({ id: 1, plan: 'enterprise' }); // Assuming enterprise = Infinity
      filamentRepo.count.mockResolvedValue(100);

      await expect(service.checkPlanLimits(1, {}, 1)).resolves.not.toThrow();
    });
  });

  describe('logConsumption', () => {
    it('should correctly deduct weight from filament and create a log', async () => {
      const filament = {
        id: 1,
        weightRemaining: 1000,
        weightInitial: 1000,
        virtualWeightRemaining: 1000,
        plannedWeight: 0,
        isLocked: false,
        organization: { id: 1 },
      };

      jest.spyOn(service, 'findOne').mockResolvedValue(filament as any);
      jest.spyOn(service, 'checkLowStock').mockResolvedValue(true as any); // mock checkLowStock side-effect

      consumptionRepo.save.mockImplementation((log: any) =>
        Promise.resolve({ ...log, id: 99 }),
      );
      filamentRepo.save.mockImplementation((f: any) => Promise.resolve(f));
      organizationRepo.findOne.mockResolvedValue({
        id: 1,
        plan: 'pro',
        requiresQuotaSelection: false,
      });

      const result = await service.logConsumption(
        1,
        200,
        'PRINT',
        'Test notes',
        1,
        new Date(),
        undefined,
        1,
        { systemRole: 'user' },
        false,
      );

      expect(result.amount).toBe(200);
      expect(result.type).toBe('PRINT');
      expect(filament.weightRemaining).toBe(800);
      expect(filament.virtualWeightRemaining).toBe(800);
      expect(filamentRepo.save).toHaveBeenCalledWith(filament);
      expect(consumptionRepo.save).toHaveBeenCalled();
      expect(service.checkLowStock).toHaveBeenCalledWith(filament);
    });

    it('should throw ForbiddenException if filament is locked', async () => {
      const filament = {
        id: 1,
        isLocked: true,
        organization: { id: 1 },
      };

      jest.spyOn(service, 'findOne').mockResolvedValue(filament as any);
      organizationRepo.findOne.mockResolvedValue({
        id: 1,
        plan: 'pro',
        requiresQuotaSelection: false,
      });

      await expect(
        service.logConsumption(
          1,
          200,
          'PRINT',
          '',
          1,
          new Date(),
          undefined,
          1,
          {},
          false,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if the organization requires quota selection', async () => {
      const filament = {
        id: 1,
        isLocked: false,
        organization: { id: 1 },
      };

      jest.spyOn(service, 'findOne').mockResolvedValue(filament as any);
      organizationRepo.findOne.mockResolvedValue({
        id: 1,
        plan: 'pro',
        requiresQuotaSelection: true,
      });

      await expect(
        service.logConsumption(
          1,
          200,
          'PRINT',
          '',
          1,
          new Date(),
          undefined,
          1,
          {},
          false,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getMobilePullSnapshot', () => {
    it('should return lightweight consumption logs keyed by remote filament id', async () => {
      const organizationId = 42;
      const queryBuilder = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          {
            id: 77,
            filamentId: 123,
            amount: 12.5,
            type: 'PRINT',
            notes: 'job',
            date: new Date('2026-01-01T10:00:00.000Z'),
            isPlanned: false,
            printTaskId: 'task-1',
            printStatus: 'SUCCESS',
          },
        ]),
      };

      organizationRepo.findOne.mockResolvedValue({
        id: organizationId,
        settings: { lowStockThreshold: 100 },
      });
      jest
        .spyOn(service, 'findAll')
        .mockResolvedValue([
          {
            id: 123,
            brand: { id: 10 },
            material: { id: 20 },
            types: [{ id: 30 }],
            colorReferenceId: 40,
            weightRemaining: 500,
          },
        ] as any);
      brandRepo.find.mockResolvedValue([]);
      materialRepo.find.mockResolvedValue([]);
      typeRepo.find.mockResolvedValue([]);
      optionRepo.find.mockResolvedValue([]);
      brandCatalogRepo.find.mockResolvedValue([]);
      colorReferenceRepo.find.mockResolvedValue([]);
      mockTigerMappingService.getMappingsForSync.mockResolvedValue({
        brands: [],
        materials: [],
        types: [],
      });
      consumptionRepo.createQueryBuilder.mockReturnValue(queryBuilder);

      const snapshot = await service.getMobilePullSnapshot(organizationId);

      expect(snapshot.filaments).toEqual([
        {
          id: 123,
          brand: { id: 10 },
          material: { id: 20 },
          types: [{ id: 30 }],
          colorReferenceId: 40,
          weightRemaining: 500,
        },
      ]);
      expect(brandCatalogRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.arrayContaining([
            { organizationId },
            expect.objectContaining({
              organizationId: expect.any(Object),
              brandId: expect.any(Object),
              materialId: expect.any(Object),
              typeId: expect.any(Object),
            }),
          ]),
        }),
      );
      expect(colorReferenceRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.arrayContaining([
            { organizationId, isActive: true },
            expect.objectContaining({
              id: expect.any(Object),
              isActive: true,
            }),
          ]),
        }),
      );
      expect(snapshot.consumptionLogs.logs).toEqual([
        {
          id: 77,
          amount: 12.5,
          type: 'PRINT',
          notes: 'job',
          date: new Date('2026-01-01T10:00:00.000Z'),
          is_planned: false,
          isPlanned: false,
          printTaskId: 'task-1',
          printStatus: 'SUCCESS',
          filament: { id: 123 },
        },
      ]);
      expect(queryBuilder.where).toHaveBeenCalledWith(
        'filament.organizationId = :organizationId',
        { organizationId },
      );
      expect(mockTigerMappingService.getMappingsForSync).toHaveBeenCalledWith(
        organizationId,
      );
    });
  });
});
