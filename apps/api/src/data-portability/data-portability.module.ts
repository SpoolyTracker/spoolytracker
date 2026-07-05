import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataPortabilityController } from './data-portability.controller';
import { DataPortabilityService } from './data-portability.service';
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
import { TigerTagModule } from '../tigertag/tigertag.module';
import { OrganizationGuard } from '../common/organization.guard';
import { OrganizationRoleGuard } from '../common/organization-role.guard';
import { UserOrganization } from '../organization/user-organization.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Organization,
      Filament,
      FilamentBrand,
      FilamentMaterial,
      FilamentType,
      FilamentOption,
      BrandCatalog,
      FilamentColorReference,
      StorageUnit,
      ConsumptionLog,
      Project,
      UserOrganization,
    ]),
    TigerTagModule,
  ],
  controllers: [DataPortabilityController],
  providers: [DataPortabilityService, OrganizationGuard, OrganizationRoleGuard],
  exports: [DataPortabilityService],
})
export class DataPortabilityModule {}
