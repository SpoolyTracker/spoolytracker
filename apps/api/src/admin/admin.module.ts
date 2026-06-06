import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminAuditService } from './admin-audit.service';
import { AdminAuditLog } from './admin-audit-log.entity';
import { User } from '../auth/user.entity';
import { Organization } from '../organization/organization.entity';
import { UserOrganization } from '../organization/user-organization.entity';
import { Subscription } from '../stripe/subscription.entity';
import { OrganizationModule } from '../organization/organization.module';
import { FilamentModule } from '../filament/filament.module';
import { AuthModule } from '../auth/auth.module';

import { GlobalSetting } from './global-setting.entity';
import { SystemSettingsController } from './system-settings.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Organization,
      UserOrganization,
      Subscription,
      AdminAuditLog,
      GlobalSetting,
    ]),
    OrganizationModule,
    FilamentModule,
    AuthModule,
  ],
  controllers: [AdminController, SystemSettingsController],
  providers: [AdminAuditService],
  exports: [AdminAuditService],
})
export class AdminModule {}
