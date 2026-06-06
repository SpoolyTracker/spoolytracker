import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { FilamentModule } from '../filament/filament.module';
import { Organization } from '../organization/organization.entity';
import { OrcaIntegrationController } from './orca.controller';

@Module({
  imports: [
    ApiKeysModule,
    FilamentModule,
    TypeOrmModule.forFeature([Organization]),
    BullModule.registerQueue({ name: 'gcode' }),
  ],
  controllers: [OrcaIntegrationController],
})
export class IntegrationsModule {}
