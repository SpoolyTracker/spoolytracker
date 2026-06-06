import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiAgentService } from './ai-agent.service';
import { AiAgentController } from './ai-agent.controller';
import { FilamentModule } from '../filament/filament.module';
import { ProjectsModule } from '../projects/projects.module';
import { Organization } from '../organization/organization.entity';
import { UserOrganization } from '../organization/user-organization.entity';
import { EmailModule } from '../email/email.module';
import { FilamentBrand } from '../filament/brand.entity';
import { FilamentMaterial } from '../filament/filament-material.entity';
import { FilamentType } from '../filament/filament-type.entity';
import { Filament } from '../filament/filament.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Organization,
      UserOrganization,
      FilamentBrand,
      FilamentMaterial,
      FilamentType,
      Filament,
    ]),
    FilamentModule,
    ProjectsModule,
    EmailModule,
  ],
  providers: [AiAgentService],
  controllers: [AiAgentController],
  exports: [AiAgentService],
})
export class AiAgentModule {}
