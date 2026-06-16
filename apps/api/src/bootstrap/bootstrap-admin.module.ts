import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../auth/user.entity';
import { OrganizationModule } from '../organization/organization.module';
import { BootstrapAdminService } from './bootstrap-admin.service';

@Module({
  imports: [TypeOrmModule.forFeature([User]), OrganizationModule],
  providers: [BootstrapAdminService],
})
export class BootstrapAdminModule {}
