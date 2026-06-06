import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PrintStatus } from '../filament/consumption-log.entity';
import { FilamentService } from '../filament/filament.service';
import { PublicApiKeyGuard } from './public-api-key.guard';
import { toPublicConsumptionLog } from './public-api-presenters';
import { PublicScopes } from './public-scopes.decorator';
import { PublicScopesGuard } from './public-scopes.guard';

@ApiTags('public-api')
@ApiBearerAuth()
@Controller('public-api/v1/consumption')
@UseGuards(PublicApiKeyGuard, PublicScopesGuard)
export class PublicConsumptionController {
  constructor(private readonly filamentService: FilamentService) {}

  @Get()
  @PublicScopes('consumption:read')
  async findAll(@Req() req: any) {
    const history = await this.filamentService.getAllConsumptionHistory(
      req.publicApi.organizationId,
      false,
    );
    return { data: (history.logs || []).map(toPublicConsumptionLog) };
  }

  @Post()
  @PublicScopes('consumption:write')
  async create(
    @Req() req: any,
    @Body()
    body: {
      filamentId?: number;
      amount?: number;
      type?: 'MANUAL' | 'PRINT' | 'FAIL';
      notes?: string;
      date?: string;
      externalJobId?: string;
      isPlanned?: boolean;
      printTaskId?: string;
      printStatus?: PrintStatus;
    },
  ) {
    const filamentId = Number(body.filamentId);
    const amount = Number(body.amount);
    if (!Number.isInteger(filamentId) || filamentId <= 0) {
      throw new BadRequestException('filamentId is required');
    }
    if (!Number.isFinite(amount)) {
      throw new BadRequestException('amount is required');
    }

    const date = body.date ? new Date(body.date) : undefined;
    if (date && Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date');
    }

    const log = await this.filamentService.logConsumption(
      filamentId,
      amount,
      body.type || 'MANUAL',
      body.notes,
      req.publicApi.organizationId,
      date,
      body.externalJobId,
      req.publicApi.userId,
      undefined,
      Boolean(body.isPlanned),
      body.printTaskId,
      body.printStatus,
    );

    return { data: toPublicConsumptionLog(log) };
  }
}
