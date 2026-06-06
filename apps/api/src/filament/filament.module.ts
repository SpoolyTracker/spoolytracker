import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { FilamentService } from './filament.service';
import { FilamentController } from './filament.controller';
import { SpoolmanProcessor } from './spoolman.processor';
import { Filament } from './filament.entity';
import { TigerTagService } from './tigertag.service';
import { FilamentBrand } from './brand.entity';
import { FilamentType } from './filament-type.entity';
import { FilamentOption } from './filament-option.entity';
import { ReferenceDataController } from './reference-data.controller';
import { ConsumptionLog } from './consumption-log.entity';
import { NotificationModule } from '../notification/notification.module';
import { UserOrganization } from '../organization/user-organization.entity';
import { OrganizationRoleGuard } from '../common/organization-role.guard';
import { OrganizationGuard } from '../common/organization.guard';

import { FilamentMaterial } from './filament-material.entity';

import { Organization } from '../organization/organization.entity';

import { BrandCatalog } from './brand-catalog.entity';
import { FilamentColorReference } from './filament-color-reference.entity';
import { StorageUnit } from './storage-unit.entity';
import { TigerTagModule } from '../tigertag/tigertag.module';
import { SpoolmanService } from './spoolman.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Filament,
      FilamentBrand,
      FilamentMaterial,
      FilamentType,
      FilamentOption,
      ConsumptionLog,
      UserOrganization,
      Organization,
      BrandCatalog,
      FilamentColorReference,
      StorageUnit,
    ]),
    BullModule.registerQueue({
      name: 'spoolman-sync',
    }),
    NotificationModule,
    TigerTagModule,
  ],
  providers: [
    FilamentService,
    TigerTagService,
    OrganizationRoleGuard,
    OrganizationGuard,
    SpoolmanService,
    SpoolmanProcessor,
  ],
  controllers: [FilamentController, ReferenceDataController],
  exports: [TigerTagService, FilamentService, SpoolmanService],
})
export class FilamentModule {}
