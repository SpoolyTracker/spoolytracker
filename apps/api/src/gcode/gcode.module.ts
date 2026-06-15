import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { GcodeController } from './gcode.controller';
import { GcodeAnalyzerService } from './gcode-analyzer.service';
import { GcodeProcessor } from './gcode.processor';
import { UserOrganization } from '../organization/user-organization.entity';
import { Organization } from '../organization/organization.entity';
import { Filament } from '../filament/filament.entity';
import { FilamentMatchingService } from './filament-matching.service';
import { FilamentMappingMemory } from './filament-mapping-memory.entity';
import { FilamentMappingMemoryService } from './filament-mapping-memory.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserOrganization, Organization, Filament, FilamentMappingMemory]),
    BullModule.registerQueue({
      name: 'gcode',
    }),
  ],
  controllers: [GcodeController],
  providers: [GcodeAnalyzerService, GcodeProcessor, FilamentMatchingService, FilamentMappingMemoryService],
  exports: [GcodeAnalyzerService],
})
export class GcodeModule {}
