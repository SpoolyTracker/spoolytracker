import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FilamentService } from '../filament/filament.service';
import { PublicApiKeyGuard } from './public-api-key.guard';
import { PublicScopes } from './public-scopes.decorator';
import { PublicScopesGuard } from './public-scopes.guard';

@ApiTags('public-api')
@ApiBearerAuth()
@Controller('public-api/v1/analytics')
@UseGuards(PublicApiKeyGuard, PublicScopesGuard)
export class PublicAnalyticsController {
  constructor(private readonly filamentService: FilamentService) {}

  @Get('consumption')
  @PublicScopes('analytics:read')
  async consumption(@Req() req: any) {
    const history = await this.filamentService.getAllConsumptionHistory(
      req.publicApi.organizationId,
      false,
    );
    const { logs: _logs, ...analytics } = history;
    return { data: analytics };
  }

  @Get('stock')
  @PublicScopes('stock:read')
  async stock(@Req() req: any) {
    const filaments = await this.filamentService.findAll(
      req.publicApi.organizationId,
    );
    const totalInitial = filaments.reduce(
      (sum, filament) => sum + Number(filament.weightInitial || 0),
      0,
    );
    const totalRemaining = filaments.reduce(
      (sum, filament) => sum + Number(filament.weightRemaining || 0),
      0,
    );
    const lockedCount = filaments.filter((filament) => filament.isLocked).length;
    const lowStockCount = filaments.filter((filament) => {
      if (!filament.lowStockThreshold) return false;
      if (filament.lowStockThresholdType === 'PERCENTAGE') {
        return (
          filament.weightInitial > 0 &&
          (filament.weightRemaining / filament.weightInitial) * 100 <=
            filament.lowStockThreshold
        );
      }
      return filament.weightRemaining <= filament.lowStockThreshold;
    }).length;

    return {
      data: {
        spoolCount: filaments.length,
        lockedCount,
        lowStockCount,
        totalInitial,
        totalRemaining,
        totalConsumed: Math.max(0, totalInitial - totalRemaining),
      },
    };
  }
}
