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
import { AiAction } from './ai-action.entity';
import { AiActionExecutor } from './ai-action.executor';
import { AiActionPersistenceService } from './ai-action.service';
import { NotificationModule } from '../notification/notification.module';
import { UserNotificationPreference } from '../notification/user-notification-preference.entity';
import { AiMemory } from './ai-memory.entity';
import { AiMemoryService } from './ai-memory.service';
import { AiAlertState } from './ai-alert-state.entity';
import { AiAlertService } from './ai-alert.service';
import { AiAlertScheduler } from './ai-alert.scheduler';
import { AI_ALERT_SERVICE } from './ai-alert.tokens';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Organization,
      UserOrganization,
      FilamentBrand,
      FilamentMaterial,
      FilamentType,
      Filament,
      AiAction,
      AiMemory,
      AiAlertState,
      UserNotificationPreference,
    ]),
    FilamentModule,
    ProjectsModule,
    EmailModule,
    NotificationModule,
  ],
  providers: [
    AiAgentService,
    AiActionExecutor,
    AiActionPersistenceService,
    AiMemoryService,
    AiAlertService,
    AiAlertScheduler,
    { provide: AI_ALERT_SERVICE, useExisting: AiAlertService },
  ],
  controllers: [AiAgentController],
  exports: [AiAgentService, AiAlertService],
})
export class AiAgentModule {}
