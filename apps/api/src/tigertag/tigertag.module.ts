import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { TigerBrandMapping } from './tiger-brand-mapping.entity';
import { TigerMaterialMapping } from './tiger-material-mapping.entity';
import { TigerTypeMapping } from './tiger-type-mapping.entity';
import { TigerTagController } from './tigertag.controller';
import { TigerTagApiService } from './tigertag-api.service';
import { TigerMappingService } from './tiger-mapping.service';
import { TigerTagProcessor } from './tigertag.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TigerBrandMapping,
      TigerMaterialMapping,
      TigerTypeMapping,
    ]),
    BullModule.registerQueue({
      name: 'tigertag-sync',
    }),
  ],
  controllers: [TigerTagController],
  providers: [TigerTagApiService, TigerMappingService, TigerTagProcessor],
  exports: [TigerTagApiService, TigerMappingService],
})
export class TigerTagModule {}
