import { Module } from '@nestjs/common';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { FilamentModule } from '../filament/filament.module';
import { PublicAnalyticsController } from './public-analytics.controller';
import { PublicApiKeyGuard } from './public-api-key.guard';
import { PublicConsumptionController } from './public-consumption.controller';
import { PublicFilamentsController } from './public-filaments.controller';
import { PublicScopesGuard } from './public-scopes.guard';

@Module({
  imports: [ApiKeysModule, FilamentModule],
  controllers: [
    PublicFilamentsController,
    PublicConsumptionController,
    PublicAnalyticsController,
  ],
  providers: [PublicApiKeyGuard, PublicScopesGuard],
})
export class PublicApiModule {}
