import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from './organization.entity';
import { UserOrganization } from './user-organization.entity';
import { Filament } from '../filament/filament.entity';
import { NotificationModule } from '../notification/notification.module';
import { OrganizationService } from './organization.service';
import { OrganizationController } from './organization.controller';
import { OrganizationScheduler } from './organization.scheduler';
import { User } from '../auth/user.entity';
import { OrganizationRoleGuard } from '../common/organization-role.guard';
import { OrganizationGuard } from '../common/organization.guard';

import { EmailModule } from '../email/email.module';
import { FilamentModule } from '../filament/filament.module';

import { Subscription } from '../stripe/subscription.entity';
import { Project } from '../projects/entities/project.entity';

import { GlobalSetting } from '../admin/global-setting.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Organization,
      UserOrganization,
      User,
      Filament,
      Subscription,
      Project,
      GlobalSetting,
    ]),
    NotificationModule,
    EmailModule,
    FilamentModule,
  ],
  providers: [
    OrganizationService,
    OrganizationRoleGuard,
    OrganizationGuard,
    OrganizationScheduler,
  ],
  controllers: [OrganizationController],
  exports: [OrganizationService],
})
export class OrganizationModule {}
