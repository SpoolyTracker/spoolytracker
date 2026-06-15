// src/gcode/gcode.controller.ts
import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Request as Req,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from '../organization/organization.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrganizationGuard } from '../common/organization.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'node:path';
import { createReadStream } from 'node:fs';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { GcodeAnalyzerService, ToolId } from './gcode-analyzer.service';
import AdmZip = require('adm-zip');
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as crypto from 'node:crypto';
import { unlinkSync } from 'node:fs';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Delete, Get, Param } from '@nestjs/common';
import { PLAN_LIMITS } from '../common/constants';
import { FilamentMappingMemoryService } from './filament-mapping-memory.service';
import { hasPersistentIntelligence } from '../common/persistent-intelligence';

type SpoolSpec = {
  densityGcm3?: number; // fallback to defaultDensityGcm3
  diameterMm?: number; // (not used for grams because we compute from volume) kept for completeness/UI
};

const DEFAULT_DIAMETER_MM = 1.75;
const DEFAULT_DENSITY_GCM3 = 1.24;

@ApiTags('gcode')
@ApiBearerAuth()
@Controller('gcode')
@UseGuards(JwtAuthGuard, OrganizationGuard)
export class GcodeController {
  constructor(
    private readonly analyzer: GcodeAnalyzerService,
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    @InjectQueue('gcode') private readonly gcodeQueue: Queue,
    private readonly mappingMemory: FilamentMappingMemoryService,
  ) {}

  // ---------------------------------------------------------------------------
  // 0) JOBS STATUS
  // ---------------------------------------------------------------------------
  @Get('jobs')
  @ApiOperation({ summary: 'Get active gcode processing jobs' })
  async getJobs() {
    const jobs = await this.gcodeQueue.getJobs([
      'waiting',
      'active',
      'delayed',
    ]);
    return Promise.all(
      jobs.map(async (j) => ({
        id: j.id,
        name: j.name,
        progress: j.progress,
        status: await j.getState(),
        data: { originalName: j.data?.originalName },
      })),
    );
  }

  @Get('job/:id')
  @ApiOperation({ summary: 'Get job status by ID' })
  async getJobStatus(@Param('id') id: string) {
    const job = await this.gcodeQueue.getJob(id);
    if (!job) throw new BadRequestException('Job not found');
    const state = await job.getState();
    const progress = job.progress;

    if (state === 'completed') {
      return { id: job.id, status: state, progress, result: job.returnvalue };
    } else if (state === 'failed') {
      return { id: job.id, status: state, progress, error: job.failedReason };
    } else {
      return { id: job.id, status: state, progress };
    }
  }

  // ---------------------------------------------------------------------------
  // 1) INSPECT
  // ---------------------------------------------------------------------------
  @Post('inspect')
  @ApiOperation({
    summary:
      'Upload G-code and get used tools + per-tool metrics. Response includes slicer report if present.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        maxToolId: { type: 'string', example: '15' },
        defaultDiameterMm: { type: 'string', example: '1.75' },
        defaultDensityGcm3: { type: 'string', example: '1.24' },
      },
    },
  })
  @UseInterceptors(fileInterceptorConfig())
  async inspect(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Body('maxToolId') maxToolId?: string,
    @Body('defaultDiameterMm') defaultDiameterMm?: string,
    @Body('defaultDensityGcm3') defaultDensityGcm3?: string,
  ) {
    // Enforce Plan Limits
    const orgId = req.organizationId;
    const org = await this.organizationRepository.findOne({
      where: { id: orgId },
    });
    const plan = org?.plan || 'free';
    const limits = PLAN_LIMITS[plan];
    const maxMb = limits?.maxFileUploadSizeMb || 10;
    if (file.size > maxMb * 1024 * 1024) {
      throw new BadRequestException(
        `File size limit for your plan (${plan}) is ${maxMb}MB`,
      );
    }

    const maxTool = numOrThrow(maxToolId, 'maxToolId', 15);
    const d = numOrThrow(
      defaultDiameterMm,
      'defaultDiameterMm',
      DEFAULT_DIAMETER_MM,
    );
    const rho = numOrThrow(
      defaultDensityGcm3,
      'defaultDensityGcm3',
      DEFAULT_DENSITY_GCM3,
    );

    const jobPriority =
      plan === 'enterprise' || plan === 'pro' || plan === 'beta' ? 1 : 10;

    const canLearn = hasPersistentIntelligence(plan, req.user);

    const job = await this.gcodeQueue.add(
      'inspect',
      {
        filePath: file.path,
        originalName: file.originalname,
        maxTool,
        d,
        rho,
        organizationId: orgId,
        canLearn,
      },
      { priority: jobPriority },
    );

    return { jobId: job.id, status: 'waiting' };
  }

  // ---------------------------------------------------------------------------
  // 2) COMPUTE
  // ---------------------------------------------------------------------------
  @Post('compute')
  @ApiOperation({
    summary:
      'Upload G-code + optional mapping/specs -> grams per spool/tool. Includes slicer report if present.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
        toolToSpool: {
          type: 'string',
          description: 'Optional JSON: {"T0":"bobinePLA","T1":"bobinePETG"}',
        },
        spools: {
          type: 'string',
          description:
            'Optional JSON: {"bobinePLA":{"densityGcm3":1.24},"bobinePETG":{"densityGcm3":1.27}}',
        },
        maxToolId: { type: 'string', example: '15' },
        defaultDiameterMm: { type: 'string', example: '1.75' },
        defaultDensityGcm3: { type: 'string', example: '1.24' },
      },
    },
  })
  @UseInterceptors(fileInterceptorConfig())
  async compute(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Body('toolToSpool') toolToSpoolRaw?: string,
    @Body('plateMappings') plateMappingsRaw?: string,
    @Body('spools') spoolsRaw?: string,
    @Body('maxToolId') maxToolId?: string,
    @Body('defaultDiameterMm') defaultDiameterMm?: string,
    @Body('defaultDensityGcm3') defaultDensityGcm3?: string,
  ) {
    // Enforce Plan Limits
    const orgId = req.organizationId;
    const org = await this.organizationRepository.findOne({
      where: { id: orgId },
    });
    const plan = org?.plan || 'free';
    const limits = PLAN_LIMITS[plan];
    const maxMb = limits?.maxFileUploadSizeMb || 10;
    if (file.size > maxMb * 1024 * 1024) {
      throw new BadRequestException(
        `File size limit for your plan (${plan}) is ${maxMb}MB`,
      );
    }

    const maxTool = numOrThrow(maxToolId, 'maxToolId', 15);
    const d = numOrThrow(
      defaultDiameterMm,
      'defaultDiameterMm',
      DEFAULT_DIAMETER_MM,
    );
    const rhoDefault = numOrThrow(
      defaultDensityGcm3,
      'defaultDensityGcm3',
      DEFAULT_DENSITY_GCM3,
    );

    const toolToSpool = tryParseJson<Record<string, string>>(toolToSpoolRaw); // optional global
    const plateMappings =
      tryParseJson<Record<string, Record<string, string>>>(plateMappingsRaw); // optional per plate
    const spools = tryParseJson<Record<string, SpoolSpec>>(spoolsRaw); // optional

    const jobPriority =
      plan === 'enterprise' || plan === 'pro' || plan === 'beta' ? 1 : 10;

    const job = await this.gcodeQueue.add(
      'compute',
      {
        filePath: file.path,
        originalName: file.originalname,
        maxTool,
        d,
        rhoDefault,
        toolToSpool,
        plateMappings,
        spools,
        organizationId: orgId,
      },
      { priority: jobPriority },
    );

    return { jobId: job.id, status: 'waiting' };
  }

  @Post('mappings/confirm')
  async confirmMappings(@Req() req: any, @Body('mappings') mappings: any[]) {
    const org = await this.organizationRepository.findOne({
      where: { id: req.organizationId },
    });
    const plan = org?.plan || 'free';
    if (!hasPersistentIntelligence(plan, req.user)) {
      return { recorded: 0, persistentIntelligence: false };
    }
    const result = await this.mappingMemory.recordConfirmations(
      req.organizationId,
      mappings || [],
    );
    return { ...result, persistentIntelligence: true };
  }

  @Get('mappings')
  async listMappings(@Req() req: any) {
    const org = await this.organizationRepository.findOne({
      where: { id: req.organizationId },
    });
    const plan = org?.plan || 'free';
    if (!hasPersistentIntelligence(plan, req.user)) return [];
    return this.mappingMemory.listForOrg(req.organizationId);
  }

  @Delete('mappings/:id')
  async deleteMapping(@Req() req: any, @Param('id') id: string) {
    const org = await this.organizationRepository.findOne({
      where: { id: req.organizationId },
    });
    const plan = org?.plan || 'free';
    if (!hasPersistentIntelligence(plan, req.user)) {
      return { deleted: false };
    }
    await this.mappingMemory.deleteForOrg(id, req.organizationId);
    return { deleted: true };
  }
}

// ----------------- helpers -----------------

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
      // Relaxed check: Allow gcode, gc, 3mf OR any file coming from the bridge that might have no extension
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
  if (value === undefined || value === null || value === '')
    return defaultValue;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0)
    throw new BadRequestException(`Invalid ${fieldName}`);
  return n;
}

function tryParseJson<T>(raw?: string): T | undefined {
  if (typeof raw !== 'string') return undefined;
  const s = raw.trim();
  if (!s) return undefined;
  try {
    return JSON.parse(s) as T;
  } catch {
    throw new BadRequestException('Invalid JSON payload');
  }
}

function hasAnySlicerValue(s: any): boolean {
  return (
    s?.filamentUsedMm !== undefined ||
    s?.filamentUsedM !== undefined ||
    s?.filamentUsedCm3 !== undefined ||
    s?.filamentUsedG !== undefined
  );
}

function round2(n: number): number {
  return Number(n.toFixed(2));
}
function round3(n: number): number {
  return Number(n.toFixed(3));
}
