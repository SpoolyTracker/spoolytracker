import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FilamentService } from '../filament/filament.service';
import { PublicApiKeyGuard } from './public-api-key.guard';
import { PublicScopes } from './public-scopes.decorator';
import { PublicScopesGuard } from './public-scopes.guard';
import { toPublicFilament } from './public-api-presenters';

@ApiTags('public-api')
@ApiBearerAuth()
@Controller('public-api/v1/filaments')
@UseGuards(PublicApiKeyGuard, PublicScopesGuard)
export class PublicFilamentsController {
  constructor(private readonly filamentService: FilamentService) {}

  @Get()
  @PublicScopes('filaments:read')
  async findAll(@Req() req: any) {
    const filaments = await this.filamentService.findAll(
      req.publicApi.organizationId,
    );
    return { data: filaments.map(toPublicFilament) };
  }

  @Get(':id')
  @PublicScopes('filaments:read')
  async findOne(@Req() req: any, @Param('id') id: string) {
    const filament = await this.filamentService.findOne(
      Number(id),
      req.publicApi.organizationId,
    );
    return { data: toPublicFilament(filament) };
  }

  @Patch(':id/stock')
  @PublicScopes('stock:write')
  async updateStock(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { weightRemaining?: number },
  ) {
    const weightRemaining = Number(body.weightRemaining);
    if (!Number.isFinite(weightRemaining) || weightRemaining < 0) {
      throw new BadRequestException('weightRemaining must be a positive number');
    }

    const filament = await this.filamentService.updateWeight(
      Number(id),
      weightRemaining,
      req.publicApi.organizationId,
    );
    if (!filament) throw new BadRequestException('Filament not found');

    return { data: toPublicFilament(filament) };
  }
}
