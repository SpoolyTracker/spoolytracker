import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SystemRoleGuard } from '../common/system-role.guard';
import { SystemRoles } from '../common/system-roles.decorator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { TigerBrandMapping } from './tiger-brand-mapping.entity';
import { TigerMaterialMapping } from './tiger-material-mapping.entity';
import { TigerTypeMapping } from './tiger-type-mapping.entity';
import { TigerTagApiService } from './tigertag-api.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { TigerMappingService } from './tiger-mapping.service';

const isPlatformAdmin = (user: any) =>
  user.isSuperAdmin ||
  ['super_admin', 'admin', 'moderator'].includes(user.systemRole);

@ApiTags('tigertag')
@ApiBearerAuth()
@Controller('tigertag')
@UseGuards(JwtAuthGuard, SystemRoleGuard)
export class TigerTagController {
  constructor(
    @InjectRepository(TigerBrandMapping)
    private tigerBrandMappingRepository: Repository<TigerBrandMapping>,
    @InjectRepository(TigerMaterialMapping)
    private tigerMaterialMappingRepository: Repository<TigerMaterialMapping>,
    @InjectRepository(TigerTypeMapping)
    private tigerTypeMappingRepository: Repository<TigerTypeMapping>,
    private tigerTagApiService: TigerTagApiService,
    private tigerMappingService: TigerMappingService,
    @InjectQueue('tigertag-sync') private readonly tigerTagQueue: Queue,
  ) {}

  // ===== PREVIEW ENDPOINTS (Debug) =====

  @Get('preview/brands')
  @SystemRoles('admin', 'moderator')
  async previewBrands() {
    return this.tigerTagApiService.fetchBrands();
  }

  @Get('preview/materials')
  @SystemRoles('admin', 'moderator')
  async previewMaterials() {
    return this.tigerTagApiService.fetchMaterials();
  }

  @Get('preview/aspects')
  @SystemRoles('admin', 'moderator')
  async previewAspects() {
    return this.tigerTagApiService.fetchAspects();
  }

  // ===== SYNC ENDPOINTS (Admin only) =====

  @Post('sync/brands')
  @SystemRoles('admin', 'moderator')
  async syncBrands() {
    return this.enqueueSync('brands');
  }

  @Post('sync/materials')
  @SystemRoles('admin', 'moderator')
  async syncMaterials() {
    return this.enqueueSync('materials');
  }

  @Post('sync/aspects')
  @SystemRoles('admin', 'moderator')
  async syncAspects() {
    return this.enqueueSync('aspects');
  }

  @Get('sync/job/:id')
  @SystemRoles('admin', 'moderator')
  async getSyncJob(@Param('id') id: string) {
    const job = await this.tigerTagQueue.getJob(id);
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

  private async enqueueSync(type: 'brands' | 'materials' | 'aspects') {
    const job = await this.tigerTagQueue.add(
      'sync',
      { type },
      {
        removeOnComplete: { age: 60 * 60 * 24, count: 50 },
        removeOnFail: { age: 60 * 60 * 24, count: 50 },
      },
    );

    return { jobId: job.id, status: 'waiting', type };
  }

  // ===== BRAND MAPPINGS =====

  @Get('mappings/brands')
  @UseGuards(JwtAuthGuard)
  async getBrandMappings(@Request() req: any, @Query('admin') admin?: string) {
    if (admin === 'true' && isPlatformAdmin(req.user)) {
      return this.tigerBrandMappingRepository.find({
        relations: ['brand', 'organization'],
        order: { tigerName: 'ASC' },
      });
    }

    const orgId = req.organizationId;
    const whereConditions: any[] = [{ organizationId: IsNull() }];
    if (orgId) {
      whereConditions.push({ organizationId: orgId });
    }

    return this.tigerBrandMappingRepository.find({
      where: whereConditions,
      relations: ['brand', 'organization'],
      order: { tigerName: 'ASC' },
    });
  }

  @Put('mappings/brands/:id')
  @UseGuards(JwtAuthGuard)
  async updateBrandMapping(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { brandId: number | null; organizationId?: number },
  ) {
    const mapping = await this.tigerBrandMappingRepository.findOneBy({
      id: +id,
    });
    if (!mapping) throw new NotFoundException('Mapping not found');

    const isGlobal = body.organizationId === null;
    if (isGlobal && !isPlatformAdmin(req.user)) {
      throw new ForbiddenException('Only admins can create global mappings');
    }

    await this.tigerBrandMappingRepository.update(id, {
      brandId: body.brandId,
      organizationId: isGlobal
        ? null
        : body.organizationId || req.organizationId,
    });

    return this.tigerBrandMappingRepository.findOne({
      where: { id: +id },
      relations: ['brand', 'organization'],
    });
  }

  @Delete('mappings/brands/:id')
  @SystemRoles('admin', 'moderator')
  async deleteBrandMapping(@Param('id') id: string) {
    await this.tigerBrandMappingRepository.delete(id);
    return { success: true };
  }

  // ===== MATERIAL MAPPINGS =====

  @Get('mappings/materials')
  @UseGuards(JwtAuthGuard)
  async getMaterialMappings(
    @Request() req: any,
    @Query('admin') admin?: string,
  ) {
    if (admin === 'true' && isPlatformAdmin(req.user)) {
      return this.tigerMaterialMappingRepository.find({
        relations: ['material', 'organization'],
        order: { tigerName: 'ASC' },
      });
    }

    const orgId = req.organizationId;
    const whereConditions: any[] = [{ organizationId: IsNull() }];
    if (orgId) {
      whereConditions.push({ organizationId: orgId });
    }

    return this.tigerMaterialMappingRepository.find({
      where: whereConditions,
      relations: ['material', 'organization'],
      order: { tigerName: 'ASC' },
    });
  }

  @Put('mappings/materials/:id')
  @UseGuards(JwtAuthGuard)
  async updateMaterialMapping(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { materialId: number | null; organizationId?: number },
  ) {
    const mapping = await this.tigerMaterialMappingRepository.findOneBy({
      id: +id,
    });
    if (!mapping) throw new NotFoundException('Mapping not found');

    const isGlobal = body.organizationId === null;
    if (isGlobal && !isPlatformAdmin(req.user)) {
      throw new ForbiddenException('Only admins can create global mappings');
    }

    await this.tigerMaterialMappingRepository.update(id, {
      materialId: body.materialId,
      organizationId: isGlobal
        ? null
        : body.organizationId || req.organizationId,
    });

    return this.tigerMaterialMappingRepository.findOne({
      where: { id: +id },
      relations: ['material', 'organization'],
    });
  }

  @Delete('mappings/materials/:id')
  @SystemRoles('admin', 'moderator')
  async deleteMaterialMapping(@Param('id') id: string) {
    await this.tigerMaterialMappingRepository.delete(id);
    return { success: true };
  }

  // ===== TYPE MAPPINGS =====

  @Get('mappings/types')
  @UseGuards(JwtAuthGuard)
  async getTypeMappings(@Request() req: any, @Query('admin') admin?: string) {
    if (admin === 'true' && isPlatformAdmin(req.user)) {
      return this.tigerTypeMappingRepository.find({
        relations: ['type', 'organization'],
        order: { tigerName: 'ASC' },
      });
    }

    const orgId = req.organizationId;
    const whereConditions: any[] = [{ organizationId: IsNull() }];
    if (orgId) {
      whereConditions.push({ organizationId: orgId });
    }

    return this.tigerTypeMappingRepository.find({
      where: whereConditions,
      relations: ['type', 'organization'],
      order: { tigerName: 'ASC' },
    });
  }

  @Put('mappings/types/:id')
  @UseGuards(JwtAuthGuard)
  async updateTypeMapping(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { typeId: number | null; organizationId?: number },
  ) {
    const mapping = await this.tigerTypeMappingRepository.findOneBy({
      id: +id,
    });
    if (!mapping) throw new NotFoundException('Mapping not found');

    const isGlobal = body.organizationId === null;
    if (isGlobal && !isPlatformAdmin(req.user)) {
      throw new ForbiddenException('Only admins can create global mappings');
    }

    await this.tigerTypeMappingRepository.update(id, {
      typeId: body.typeId,
      organizationId: isGlobal
        ? null
        : body.organizationId || req.organizationId,
    });

    return this.tigerTypeMappingRepository.findOne({
      where: { id: +id },
      relations: ['type', 'organization'],
    });
  }

  @Delete('mappings/types/:id')
  @SystemRoles('admin', 'moderator')
  async deleteTypeMapping(@Param('id') id: string) {
    await this.tigerTypeMappingRepository.delete(id);
    return { success: true };
  }

  // ===== MOBILE SYNC ENDPOINT =====

  @Get('sync/mappings')
  @UseGuards(JwtAuthGuard)
  async getMappingsForSync(@Request() req: any) {
    return this.tigerMappingService.getMappingsForSync(req.organizationId);
  }

  @Post('resolve-raw')
  @UseGuards(JwtAuthGuard)
  async resolveRawTags(
    @Body() body: { brandId?: number; materialId?: number; typeId?: number },
  ) {
    const result: any = {};

    if (body.brandId) {
      const mapping = await this.tigerBrandMappingRepository.findOne({
        where: { tigerId: body.brandId },
        relations: ['brand'],
      });
      if (mapping) {
        result.brand = {
          tigerName: mapping.tigerName,
          mappedId: mapping.brandId, // Spooly ID
          mappedName: mapping.brand?.name, // Spooly Name
        };
      }
    }

    if (body.materialId) {
      const mapping = await this.tigerMaterialMappingRepository.findOne({
        where: { tigerId: body.materialId },
        relations: ['material'],
      });
      if (mapping) {
        result.material = {
          tigerName: mapping.tigerName,
          mappedId: mapping.materialId,
          mappedName: mapping.material?.name,
        };
      }
    }

    if (body.typeId) {
      const mapping = await this.tigerTypeMappingRepository.findOne({
        where: { tigerId: body.typeId },
        relations: ['type'],
      });
      if (mapping) {
        result.type = {
          tigerName: mapping.tigerName,
          mappedId: mapping.typeId,
          mappedName: mapping.type?.name,
        };
      }
    }

    return result;
  }
}
