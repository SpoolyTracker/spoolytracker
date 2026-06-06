import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKey } from './api-key.entity';
import { ApiKeysController } from './api-keys.controller';
import { ApiKeysService } from './api-keys.service';
import { ApiKeyGuard } from './api-key.guard';
import { UserOrganization } from '../organization/user-organization.entity';
import { OrganizationGuard } from '../common/organization.guard';

@Module({
  imports: [TypeOrmModule.forFeature([ApiKey, UserOrganization])],
  controllers: [ApiKeysController],
  providers: [ApiKeysService, ApiKeyGuard, OrganizationGuard],
  exports: [ApiKeysService, ApiKeyGuard],
})
export class ApiKeysModule {}
