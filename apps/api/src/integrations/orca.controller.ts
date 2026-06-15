import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { diskStorage } from 'multer';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import * as crypto from 'node:crypto';
import * as path from 'node:path';
import { ApiKeyGuard } from '../api-keys/api-key.guard';
import { Organization } from '../organization/organization.entity';
import { PLAN_LIMITS } from '../common/constants';
import { FilamentService } from '../filament/filament.service';

const DEFAULT_DIAMETER_MM = 1.75;
const DEFAULT_DENSITY_GCM3 = 1.24;

@Controller('integrations/orca')
@UseGuards(ApiKeyGuard)
export class OrcaIntegrationController {
  constructor(
    @InjectQueue('gcode') private readonly gcodeQueue: Queue,
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    private readonly filamentService: FilamentService,
  ) {}

  @Post('gcode/inspect')
  @UseInterceptors(fileInterceptorConfig())
  async inspect(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Body('maxToolId') maxToolId?: string,
    @Body('defaultDiameterMm') defaultDiameterMm?: string,
    @Body('defaultDensityGcm3') defaultDensityGcm3?: string,
  ) {
    if (!file) throw new BadRequestException('File is required');

    const orgId = req.organizationId;
    const org = await this.organizationRepository.findOne({
      where: { id: orgId },
    });
    const plan = org?.plan || 'free';
    const maxMb = PLAN_LIMITS[plan]?.maxFileUploadSizeMb || 10;
    if (file.size > maxMb * 1024 * 1024) {
      throw new BadRequestException(
        `File size limit for your plan (${plan}) is ${maxMb}MB`,
      );
    }

    const job = await this.gcodeQueue.add(
      'inspect',
      {
        filePath: file.path,
        originalName: file.originalname,
        maxTool: numOrThrow(maxToolId, 'maxToolId', 15),
        d: numOrThrow(
          defaultDiameterMm,
          'defaultDiameterMm',
          DEFAULT_DIAMETER_MM,
        ),
        rho: numOrThrow(
          defaultDensityGcm3,
          'defaultDensityGcm3',
          DEFAULT_DENSITY_GCM3,
        ),
        organizationId: orgId,
      },
      { priority: plan === 'enterprise' || plan === 'pro' || plan === 'beta' ? 1 : 10 },
    );

    return { jobId: job.id, status: 'waiting' };
  }

  @Get('gcode/job/:id')
  async getJobStatus(@Req() req: any, @Param('id') id: string) {
    const job = await this.gcodeQueue.getJob(id);
    if (!job || Number(job.data?.organizationId) !== Number(req.organizationId)) {
      throw new BadRequestException('Job not found');
    }

    const state = await job.getState();
    if (state === 'completed') {
      return { id: job.id, status: state, progress: job.progress, result: job.returnvalue };
    }
    if (state === 'failed') {
      return { id: job.id, status: state, progress: job.progress, error: job.failedReason };
    }
    return { id: job.id, status: state, progress: job.progress };
  }

  @Post('consumption')
  consume(
    @Req() req: any,
    @Body()
    body: {
      filamentId: number;
      amount: number;
      externalJobId?: string;
      notes?: string;
      isPlanned?: boolean;
      printStatus?: 'SUCCESS' | 'FAILED';
    },
  ) {
    if (!body.filamentId || !Number.isFinite(Number(body.amount))) {
      throw new BadRequestException('filamentId and amount are required');
    }

    return this.filamentService.logConsumption(
      Number(body.filamentId),
      Number(body.amount),
      'PRINT',
      body.notes || 'OrcaSlicer integration',
      req.organizationId,
      new Date(),
      body.externalJobId,
      req.user?.userId,
      req.user,
      Boolean(body.isPlanned),
      undefined,
      body.printStatus as any,
    );
  }
}

function fileInterceptorConfig() {
  return FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads/gcode',
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase();
        const finalExt =
          ext === '.gcode' || ext === '.gc' || ext === '.3mf' ? ext : '.gcode';
        cb(null, `${crypto.randomBytes(16).toString('hex')}${finalExt}`);
      },
    }),
    limits: { fileSize: 200 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const name = (file.originalname || '').toLowerCase();
      const ok = name.match(/\.(gcode|gc|3mf)$/i) || !name.includes('.');
      cb(
        ok ? null : new BadRequestException('File must be .gcode, .gc or .3mf'),
        !!ok,
      );
    },
  });
}

function numOrThrow(
  value: unknown,
  fieldName: string,
  defaultValue: number,
): number {
  if (value === undefined || value === null || value === '') return defaultValue;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new BadRequestException(`Invalid ${fieldName}`);
  }
  return n;
}
