import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Query,
  Put,
  ForbiddenException,
  Req,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { FilamentService, TigerTagData } from './filament.service';
import { CreateFilamentDto } from './dto/create-filament.dto';
import { UpdateFilamentDto } from './dto/update-filament.dto';
import { Filament } from './filament.entity';
import { ConsumeGroupDto } from './dto/consume-group.dto';
import {
  CreateStorageUnitDto,
  PlaceFilamentDto,
  UpdateStorageUnitDto,
} from './dto/storage-unit.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrganizationGuard } from '../common/organization.guard';
import { OrganizationRoleGuard } from '../common/organization-role.guard';
import { OrganizationRoles } from '../common/organization-roles.decorator';
import { SpoolmanService } from './spoolman.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

const isPlatformAdmin = (user: any) =>
  user.isSuperAdmin ||
  ['super_admin', 'admin', 'moderator'].includes(user.systemRole);

@ApiTags('filaments')
@ApiBearerAuth()
@Controller('filaments')
@ApiHeader({ name: 'x-organization-id' })
@UseGuards(JwtAuthGuard, OrganizationGuard, OrganizationRoleGuard)
@OrganizationRoles('member')

// ... class declaration ...
export class FilamentController {
  constructor(
    private readonly filamentService: FilamentService,
    private readonly spoolmanService: SpoolmanService,
    @InjectQueue('spoolman-sync') private readonly spoolmanQueue: Queue,
  ) {}

  @Post('admin/catalog/sync-spoolman')
  async syncSpoolman(@Req() req: any) {
    if (!isPlatformAdmin(req.user))
      throw new ForbiddenException('Only Admins can sync SpoolmanDB');
    const job = await this.spoolmanQueue.add(
      'sync',
      { requestedBy: req.user?.userId || req.user?.sub || null },
      {
        removeOnComplete: { age: 60 * 60 * 24, count: 50 },
        removeOnFail: { age: 60 * 60 * 24, count: 50 },
      },
    );
    return { jobId: job.id, status: 'waiting' };
  }

  @Get('admin/catalog/sync-spoolman/job/:id')
  async getSpoolmanSyncJob(@Req() req: any, @Param('id') id: string) {
    if (!isPlatformAdmin(req.user))
      throw new ForbiddenException('Only Admins can sync SpoolmanDB');

    const job = await this.spoolmanQueue.getJob(id);
    if (!job) throw new BadRequestException('Job not found');

    const state = await job.getState();
    if (state === 'completed') {
      return {
        id: job.id,
        status: state,
        progress: job.progress,
        result: job.returnvalue,
      };
    }
    if (state === 'failed') {
      return {
        id: job.id,
        status: state,
        progress: job.progress,
        error: job.failedReason,
      };
    }
    return { id: job.id, status: state, progress: job.progress };
  }

  @Post('admin/catalog/analyze-spoolman')
  analyzeSpoolman(@Req() req: any) {
    if (!isPlatformAdmin(req.user))
      throw new ForbiddenException('Only Admins can sync SpoolmanDB');
    return this.spoolmanService.analyzeSpoolmanData();
  }

  @Post('admin/catalog/import-spoolman')
  importSpoolman(
    @Req() req: any,
    @Body()
    body: {
      brands: string[];
      materials: string[];
      importCombinations?: boolean;
      updates?: any[];
    },
  ) {
    if (!isPlatformAdmin(req.user))
      throw new ForbiddenException('Only Admins can sync SpoolmanDB');
    return this.spoolmanService.importSpoolmanData(body);
  }

  @Patch('admin/catalog/:id')
  async updateBrandCatalogEntry(
    @Req() req: any,
    @Param('id') id: number,
    @Body()
    body: {
      isActive?: boolean;
      density?: number;
      nozzle_min?: number;
      nozzle_max?: number;
      bed_min?: number;
      bed_max?: number;
      isLocked?: boolean;
      plannedWeight?: number;
      virtualWeightRemaining?: number;
    },
  ) {
    // Permission check: Global items require SuperAdmin, Custom items require Admin of that org
    // For simplicity here, sticking to basic check or letting Service handle logic?
    // Let's implement basic check here or in service.
    // Quick check:
    // const entry = await this.filamentService.getBrandCatalogEntry(id);
    // if (!entry) throw new NotFoundException();
    // if (!entry.organizationId && !req.user.isSuperAdmin) throw new ForbiddenException();
    // if (entry.organizationId && ... check org access ...)

    // For now, allow SuperAdmin or relevant Admin.
    return this.filamentService.updateBrandCatalogEntry(id, body);
  }

  @Post('admin/merge-reference-data')
  mergeReferenceData(
    @Req() req: any,
    @Body()
    body: {
      type: 'brand' | 'material' | 'type';
      sourceId: number;
      targetId: number;
    },
  ) {
    if (!req.user.isSuperAdmin)
      throw new ForbiddenException('Only SuperAdmin can merge reference data');
    return this.filamentService.mergeReferenceData(
      body.type,
      body.sourceId,
      body.targetId,
    );
  }

  @Post()
  create(
    @Req() req: any,
    @Body() createFilamentDto: CreateFilamentDto,
  ): Promise<Filament> {
    const user = req.user;
    const targetOrgId = createFilamentDto.organizationId;
    const contextOrgId = req.organizationId;

    // Default to context
    createFilamentDto.organizationId = contextOrgId;

    if (targetOrgId && Number(targetOrgId) !== Number(contextOrgId)) {
      // User wants to create in a different org than the current context
      let isAllowed = false;

      if (user.isSuperAdmin) {
        isAllowed = true;
      } else {
        const allowedOrgs = Array.isArray(user.userOrganisations)
          ? user.userOrganisations.map(String)
          : String(user.userOrganisations || '')
              .split(',')
              .map((o: string) => o.trim());

        if (allowedOrgs.includes(String(targetOrgId))) {
          isAllowed = true;
        }
      }

      if (isAllowed) {
        createFilamentDto.organizationId = targetOrgId;
      }
    }

    return this.filamentService.create(createFilamentDto, undefined, user);
  }

  @Get()
  findAll(@Req() req: any): Promise<Filament[]> {
    // Use the validated organizationId from the middleware
    const organizationId = req.organizationId;
    return this.filamentService.findAll(organizationId);
  }

  @Get('storage/units')
  getStorageUnits(@Req() req: any) {
    return this.filamentService.getStorageUnits(req.organizationId);
  }

  @Post('storage/units')
  createStorageUnit(@Req() req: any, @Body() body: CreateStorageUnitDto) {
    return this.filamentService.createStorageUnit(req.organizationId, body);
  }

  @Put('storage/units/:id')
  updateStorageUnit(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: UpdateStorageUnitDto,
  ) {
    return this.filamentService.updateStorageUnit(
      +id,
      req.organizationId,
      body,
    );
  }

  @Delete('storage/units/:id')
  deleteStorageUnit(@Req() req: any, @Param('id') id: string) {
    return this.filamentService.deleteStorageUnit(+id, req.organizationId);
  }

  @Put('storage/placements/:filamentId')
  placeFilament(
    @Req() req: any,
    @Param('filamentId') filamentId: string,
    @Body() body: PlaceFilamentDto,
  ) {
    return this.filamentService.placeFilament(
      +filamentId,
      req.organizationId,
      body,
    );
  }

  @Get('consumption/all')
  getAllConsumptionHistory(@Req() req: any) {
    // Use the validated organizationId from the middleware
    const organizationId = req.organizationId;
    const isSuperAdmin = req.user?.isSuperAdmin || false;

    if (!organizationId) {
      return Promise.resolve();
    }

    return this.filamentService.getAllConsumptionHistory(
      organizationId,
      isSuperAdmin,
    );
  }

  @Get('sync/mobile-pull')
  getMobilePullSnapshot(@Req() req: any) {
    const organizationId = req.organizationId;
    if (!organizationId) {
      return Promise.resolve();
    }

    const includeAllReferenceData =
      req.user?.isSuperAdmin ||
      ['super_admin', 'admin', 'moderator'].includes(
        req.user?.systemRole || '',
      );

    return this.filamentService.getMobilePullSnapshot(
      organizationId,
      includeAllReferenceData,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any): Promise<Filament | null> {
    return this.filamentService.findOne(+id, req.organizationId);
  }

  @Get('by-tag/:tagId')
  findByTag(
    @Param('tagId') tagId: string,
    @Req() req: any,
  ): Promise<Filament | null> {
    return this.filamentService.findByTagId(tagId, req.organizationId);
  }

  @Post('options')
  createOption(
    @Body() body: { name: string; category: string; isCharacteristic: boolean },
    @Req() req: any,
  ) {
    const isSuperAdmin = req.user.isSuperAdmin;
    const hasOrgs =
      req.user.userOrganisations &&
      (Array.isArray(req.user.userOrganisations)
        ? req.user.userOrganisations.length > 0
        : String(req.user.userOrganisations).trim().length > 0);

    if (!isSuperAdmin && !hasOrgs) {
      throw new ForbiddenException(
        'Must belong to an organization to create options',
      );
    }

    return this.filamentService.createOption(
      body.name,
      body.category,
      body.isCharacteristic,
      false,
      req.organizationId,
    );
  }

  @Put('options/:id')
  updateOption(
    @Param('id') id: string,
    @Body() body: { name: string; category: string; isCharacteristic: boolean },
    @Req() req: any,
  ) {
    if (!req.user.isSuperAdmin) throw new ForbiddenException();
    return this.filamentService.updateOption(
      +id,
      body.name,
      body.category,
      body.isCharacteristic,
    );
  }

  @Post('sync-nfc')
  syncNfc(@Body() tagData: TigerTagData, @Req() req: any): Promise<Filament> {
    // We MUST have an organization context to sync NFC data (either find existing in org, or create new in org)
    if (!req.organizationId) {
      throw new Error('Organization context required for NFC sync');
    }
    return this.filamentService.syncFromNfc(tagData, req.organizationId);
  }

  @Put('bulk')
  bulkUpdate(
    @Req() req: any,
    @Body() body: { ids: number[]; data: UpdateFilamentDto },
  ) {
    return this.filamentService.bulkUpdate(
      body.ids,
      body.data,
      req.organizationId,
      req.user,
    );
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() updateFilamentDto: UpdateFilamentDto,
    @Req() req: any,
  ): Promise<Filament | null> {
    return this.filamentService.update(
      +id,
      updateFilamentDto,
      req.organizationId,
      req.user,
    );
  }

  @Put(':id/weight')
  updateWeight(
    @Param('id') id: string,
    @Body('weight') weight: number,
    @Req() req: any,
  ): Promise<Filament | null> {
    return this.filamentService.updateWeight(+id, weight, req.organizationId);
  }

  @Get('consumption/stats')
  getConsumptionStats(@Req() req: any) {
    if (!req.organizationId) {
      throw new Error('Organization context required');
    }
    return this.filamentService.getAllConsumptionHistory(
      req.organizationId,
      req.user?.isSuperAdmin,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any): Promise<void> {
    return this.filamentService.remove(+id, req.organizationId);
  }

  @Post(':id/consumption')
  logConsumption(
    @Param('id') id: string,
    @Body()
    body: {
      amount: number;
      type?: 'MANUAL' | 'PRINT' | 'FAIL';
      notes?: string;
      date?: string;
      externalJobId?: string;
      isPlanned?: boolean;
      is_planned?: boolean;
      printTaskId?: string;
      printStatus?: 'SUCCESS' | 'FAILED';
    },
    @Req() req: any,
  ) {
    const planned =
      body.is_planned !== undefined ? body.is_planned : body.isPlanned;
    return this.filamentService.logConsumption(
      +id,
      body.amount,
      body.type,
      body.notes,
      req.organizationId,
      body.date ? new Date(body.date) : undefined,
      body.externalJobId,
      req.user?.userId,
      req.user,
      planned,
      body.printTaskId,
      body.printStatus as any,
    );
  }

  @Get(':id/consumption')
  getConsumptionHistory(@Param('id') id: string, @Req() req: any) {
    return this.filamentService.getConsumptionHistory(+id, req.organizationId);
  }

  @Post(':id/clone')
  cloneFilament(@Param('id') id: string, @Req() req: any) {
    return this.filamentService.cloneFilament(
      +id,
      req.organizationId,
      req.user,
    );
  }

  @Put('consumption/:id')
  updateConsumption(
    @Param('id') id: string,
    @Body()
    body: {
      amount?: number;
      notes?: string;
      date?: string;
      type?: any;
      is_planned?: boolean;
      isPlanned?: boolean;
    },
    @Req() req: any,
  ) {
    const data = { ...body };
    if (data.isPlanned !== undefined && data.is_planned === undefined) {
      data.is_planned = data.isPlanned;
    }
    return this.filamentService.updateConsumptionLog(
      +id,
      data,
      req.organizationId,
    );
  }

  @Delete('consumption/:id')
  deleteConsumption(@Param('id') id: string, @Req() req: any) {
    return this.filamentService.deleteConsumptionLog(+id, req.organizationId);
  }

  @Post('project/:projectId/convert')
  convertProjectConsumption(
    @Param('projectId') projectId: string,
    @Req() req: any,
  ) {
    return this.filamentService.convertProjectPlannedConsumptions(
      +projectId,
      req.organizationId,
    );
  }

  @Post('consume-group')
  consumeGroup(@Req() req: any, @Body() consumeGroupDto: ConsumeGroupDto) {
    return this.filamentService.consumeFromGroup(
      consumeGroupDto,
      req.organizationId,
      req.user?.userId,
      req.user,
    );
  }
}
