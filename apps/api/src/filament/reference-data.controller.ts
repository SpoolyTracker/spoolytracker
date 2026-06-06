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
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SystemRoleGuard } from '../common/system-role.guard';
import { SystemRoles } from '../common/system-roles.decorator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { FilamentBrand } from './brand.entity';
import { FilamentMaterial } from './filament-material.entity';
import { FilamentType } from './filament-type.entity';
import { FilamentOption } from './filament-option.entity';
import { BrandCatalog } from './brand-catalog.entity';
import { FilamentColorReference } from './filament-color-reference.entity';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import {
  CreateBrandDto,
  CreateTypeDto,
  CreateOptionDto,
  CreateColorReferenceDto,
} from './dto/reference-data.dto';

const isPlatformAdmin = (user: any) =>
  user.isSuperAdmin ||
  ['super_admin', 'admin', 'moderator'].includes(user.systemRole);

const checkOrgAccess = (
  user: any,
  orgId: number | string | null | undefined,
) => {
  if (!orgId) return; // No org context = Global (handled by other checks) or Public
  if (user.isSuperAdmin) return;
  if (isPlatformAdmin(user)) return; // Platform admins can see everything

  const allowedOrgs = Array.isArray(user.userOrganisations)
    ? user.userOrganisations.map(String)
    : String(user.userOrganisations || '')
        .split(',')
        .map((o: string) => o.trim());

  if (!allowedOrgs.includes(String(orgId))) {
    throw new ForbiddenException(`Access to Organization ${orgId} denied`);
  }
};

@ApiTags('reference-data')
@ApiBearerAuth()
@Controller('reference-data')
@UseGuards(JwtAuthGuard, SystemRoleGuard)
export class ReferenceDataController {
  constructor(
    @InjectRepository(FilamentBrand)
    private brandRepository: Repository<FilamentBrand>,
    @InjectRepository(FilamentMaterial)
    private materialRepository: Repository<FilamentMaterial>,
    @InjectRepository(FilamentType)
    private typeRepository: Repository<FilamentType>,
    @InjectRepository(FilamentOption)
    private optionRepository: Repository<FilamentOption>,
    @InjectRepository(BrandCatalog)
    private brandCatalogRepository: Repository<BrandCatalog>,
    @InjectRepository(FilamentColorReference)
    private colorReferenceRepository: Repository<FilamentColorReference>,
  ) {}

  @Get('brands')
  @UseGuards(JwtAuthGuard)
  async getBrands(
    @Request() req: any,
    @Query('organizationId') organizationId?: string,
  ) {
    if (isPlatformAdmin(req.user)) {
      return this.brandRepository.find({
        order: { name: 'ASC' },
        relations: ['organization'],
      });
    }

    const orgId = organizationId || req.organizationId;

    // SECURITY CHECK
    checkOrgAccess(req.user, orgId);

    const whereConditions: any[] = [{ organizationId: IsNull() }];
    if (orgId) {
      whereConditions.push({ organizationId: orgId });
    }

    return this.brandRepository.find({
      where: whereConditions,
      order: { name: 'ASC' },
      relations: ['organization'],
    });
  }

  @Put('brands/:id/promote')
  @SystemRoles('admin', 'moderator')
  async promoteBrand(@Param('id') id: string) {
    await this.brandRepository.update(id, {
      organizationId: null,
      isCustom: false,
    });
    // Promote is safe as it's restricted to System Admins/Mods
    return this.brandRepository.findOneBy({ id: +id });
  }

  @Post('brands')
  @UseGuards(JwtAuthGuard)
  async createBrand(
    @Request() req: any,
    @Body() createBrandDto: CreateBrandDto,
    @Query('admin') admin?: string,
  ) {
    const isGlobal = admin === 'true' && isPlatformAdmin(req.user);
    const targetOrgId = createBrandDto.organizationId || req.organizationId;

    // SECURITY CHECK
    if (!isGlobal && targetOrgId) {
      checkOrgAccess(req.user, targetOrgId);
    }

    const brand = this.brandRepository.create({
      ...createBrandDto,
      isCustom: !isGlobal,
      organizationId: isGlobal ? null : targetOrgId,
    });
    try {
      return await this.brandRepository.save(brand);
    } catch (error) {
      if (error.code === '23505') {
        // Postgres unique violation
        throw new ConflictException('Brand with this name already exists');
      }
      throw new InternalServerErrorException();
    }
  }

  @Put('brands/:id')
  @SystemRoles('admin', 'moderator')
  async updateBrand(
    @Param('id') id: string,
    @Body() updateDto: CreateBrandDto,
  ) {
    // System roles only
    await this.brandRepository.update(id, updateDto);
    return this.brandRepository.findOneBy({ id: +id });
  }

  @Delete('brands/:id')
  @UseGuards(JwtAuthGuard)
  async deleteBrand(@Request() req: any, @Param('id') id: string) {
    const brand = await this.brandRepository.findOneBy({ id: +id });
    if (!brand) throw new NotFoundException('Brand not found');

    const userOrgs = req.user.userOrganisations
      ? req.user.userOrganisations.split(',').map(Number)
      : [];
    const canDelete =
      isPlatformAdmin(req.user) ||
      (brand.organizationId && userOrgs.includes(brand.organizationId));

    if (!canDelete) {
      throw new ForbiddenException(
        'You do not have permission to delete this brand',
      );
    }

    try {
      await this.brandRepository.delete(id);
      return { success: true };
    } catch (error) {
      if (error.code === '23503') {
        throw new ConflictException('Cannot delete: This brand is in use');
      }
      throw new InternalServerErrorException();
    }
  }

  @Get('materials')
  @UseGuards(JwtAuthGuard)
  async getMaterials(
    @Request() req: any,
    @Query('organizationId') organizationId?: string,
  ) {
    if (isPlatformAdmin(req.user)) {
      return this.materialRepository.find({
        order: { name: 'ASC' },
        relations: ['organization'],
      });
    }

    const orgId = organizationId || req.organizationId;

    // SECURITY CHECK
    checkOrgAccess(req.user, orgId);

    const whereConditions: any[] = [{ organizationId: IsNull() }];
    if (orgId) {
      whereConditions.push({ organizationId: Number(orgId) });
    }

    return this.materialRepository.find({
      where: whereConditions,
      order: { name: 'ASC' },
      relations: ['organization'],
    });
  }

  @Post('materials')
  @UseGuards(JwtAuthGuard)
  async createMaterial(
    @Request() req: any,
    @Body() createTypeDto: CreateTypeDto,
    @Query('admin') admin?: string,
  ) {
    const isGlobal = admin === 'true' && isPlatformAdmin(req.user);
    const targetOrgId = createTypeDto.organizationId || req.organizationId;

    // SECURITY CHECK
    if (!isGlobal && targetOrgId) {
      checkOrgAccess(req.user, targetOrgId);
    }

    const material = this.materialRepository.create({
      ...createTypeDto,
      description: createTypeDto.description || 'Custom material',
      organizationId: isGlobal ? null : targetOrgId,
    });
    try {
      return await this.materialRepository.save(material);
    } catch (error) {
      if (error.code === '23505') {
        throw new ConflictException('Material with this name already exists');
      }
      throw new InternalServerErrorException();
    }
  }

  @Put('materials/:id/promote')
  @SystemRoles('admin', 'moderator')
  async promoteMaterial(@Param('id') id: string) {
    await this.materialRepository.update(id, { organizationId: null });
    return this.materialRepository.findOneBy({ id: +id });
  }

  @Put('materials/:id')
  @SystemRoles('admin', 'moderator')
  async updateMaterial(
    @Param('id') id: string,
    @Body() updateDto: CreateTypeDto,
  ) {
    await this.materialRepository.update(id, updateDto);
    return this.materialRepository.findOneBy({ id: +id });
  }

  @Delete('materials/:id')
  @UseGuards(JwtAuthGuard)
  async deleteMaterial(@Request() req: any, @Param('id') id: string) {
    const material = await this.materialRepository.findOneBy({ id: +id });
    if (!material) throw new NotFoundException('Material not found');

    const userOrgs = req.user.userOrganisations
      ? req.user.userOrganisations.split(',').map(Number)
      : [];
    const canDelete =
      isPlatformAdmin(req.user) ||
      (material.organizationId && userOrgs.includes(material.organizationId));

    if (!canDelete) {
      throw new ForbiddenException(
        'You do not have permission to delete this material',
      );
    }

    try {
      await this.materialRepository.delete(id);
      return { success: true };
    } catch (error) {
      if (error.code === '23503') {
        throw new ConflictException('Cannot delete: This material is in use');
      }
      throw new InternalServerErrorException();
    }
  }

  @Get('types')
  @UseGuards(JwtAuthGuard)
  async getTypes(
    @Request() req: any,
    @Query('organizationId') organizationId?: string,
  ) {
    if (isPlatformAdmin(req.user)) {
      return this.typeRepository.find({
        order: { name: 'ASC' },
        relations: ['organization'],
      });
    }

    const orgId = organizationId || req.organizationId;

    // SECURITY CHECK
    checkOrgAccess(req.user, orgId);

    const whereConditions: any[] = [{ organizationId: IsNull() }];
    if (orgId) {
      whereConditions.push({ organizationId: Number(orgId) });
    }

    return this.typeRepository.find({
      where: whereConditions,
      order: { name: 'ASC' },
      relations: ['organization'],
    });
  }

  @Post('types')
  @UseGuards(JwtAuthGuard)
  async createType(
    @Request() req: any,
    @Body() createTypeDto: CreateTypeDto,
    @Query('admin') admin?: string,
  ) {
    const isGlobal = admin === 'true' && isPlatformAdmin(req.user);
    const targetOrgId = createTypeDto.organizationId || req.organizationId;

    // SECURITY CHECK
    if (!isGlobal && targetOrgId) {
      checkOrgAccess(req.user, targetOrgId);
    }

    const type = this.typeRepository.create({
      ...createTypeDto,
      description: createTypeDto.description || 'Custom type',
      organizationId: isGlobal ? null : targetOrgId,
    });
    try {
      return await this.typeRepository.save(type);
    } catch (error) {
      if (error.code === '23505') {
        throw new ConflictException('Type with this name already exists');
      }
      throw new InternalServerErrorException();
    }
  }

  @Put('types/:id/promote')
  @SystemRoles('admin', 'moderator')
  async promoteType(@Param('id') id: string) {
    await this.typeRepository.update(id, { organizationId: null });
    return this.typeRepository.findOneBy({ id: +id });
  }

  @Put('types/:id')
  @SystemRoles('admin', 'moderator')
  async updateType(@Param('id') id: string, @Body() updateDto: CreateTypeDto) {
    await this.typeRepository.update(id, updateDto);
    return this.typeRepository.findOneBy({ id: +id });
  }

  @Delete('types/:id')
  @UseGuards(JwtAuthGuard)
  async deleteType(@Request() req: any, @Param('id') id: string) {
    const type = await this.typeRepository.findOneBy({ id: +id });
    if (!type) throw new NotFoundException('Type not found');

    const userOrgs = req.user.userOrganisations
      ? req.user.userOrganisations.split(',').map(Number)
      : [];
    const canDelete =
      isPlatformAdmin(req.user) ||
      (type.organizationId && userOrgs.includes(type.organizationId));

    if (!canDelete) {
      throw new ForbiddenException(
        'You do not have permission to delete this type',
      );
    }

    try {
      await this.typeRepository.delete(id);
      return { success: true };
    } catch (error) {
      if (error.code === '23503') {
        throw new ConflictException('Cannot delete: This type is in use');
      }
      throw new InternalServerErrorException();
    }
  }

  @Get('options')
  @UseGuards(JwtAuthGuard)
  async getOptions(
    @Request() req: any,
    @Query('organizationId') organizationId?: string,
  ) {
    if (isPlatformAdmin(req.user)) {
      const options = await this.optionRepository.find({
        order: { category: 'ASC', name: 'ASC' },
        relations: ['organization'],
      });
      // Group by category logic is duplicated, maybe extract? Or just copy-paste for speed as logic is simple.
      const grouped = options.reduce(
        (acc, option) => {
          if (!acc[option.category]) {
            acc[option.category] = [];
          }
          acc[option.category].push(option);
          return acc;
        },
        {} as Record<string, FilamentOption[]>,
      );
      return grouped;
    }

    const orgId = organizationId || req.organizationId;

    // SECURITY CHECK
    checkOrgAccess(req.user, orgId);

    const whereConditions: any[] = [{ organizationId: IsNull() }];
    if (orgId) {
      whereConditions.push({ organizationId: Number(orgId) });
    }

    const options = await this.optionRepository.find({
      where: whereConditions,
      order: { category: 'ASC', name: 'ASC' },
      relations: ['organization'],
    });

    // Group by category
    const grouped = options.reduce(
      (acc, option) => {
        if (!acc[option.category]) {
          acc[option.category] = [];
        }
        acc[option.category].push(option);
        return acc;
      },
      {} as Record<string, FilamentOption[]>,
    );

    return grouped;
  }

  @Put('options/:id/promote')
  @SystemRoles('admin', 'moderator')
  async promoteOption(@Param('id') id: string) {
    await this.optionRepository.update(id, { organizationId: null });
    return this.optionRepository.findOneBy({ id: +id });
  }

  @Post('options')
  @UseGuards(JwtAuthGuard)
  async createOption(
    @Request() req: any,
    @Body() createOptionDto: CreateOptionDto,
    @Query('admin') admin?: string,
  ) {
    const isGlobal = admin === 'true' && isPlatformAdmin(req.user);
    const targetOrgId = createOptionDto.organizationId || req.organizationId;

    // SECURITY CHECK
    if (!isGlobal && targetOrgId) {
      checkOrgAccess(req.user, targetOrgId);
    }

    const option = this.optionRepository.create({
      ...createOptionDto,
      category: createOptionDto.category || 'custom',
      description: createOptionDto.description || 'Custom option',
      organizationId: isGlobal ? null : targetOrgId,
    });
    try {
      return await this.optionRepository.save(option);
    } catch (error) {
      if (error.code === '23505') {
        throw new ConflictException('Option with this name already exists');
      }
      throw new InternalServerErrorException();
    }
  }

  @Put('options/:id')
  @SystemRoles('admin', 'moderator')
  async updateOption(
    @Param('id') id: string,
    @Body() updateDto: CreateOptionDto,
  ) {
    await this.optionRepository.update(id, updateDto);
    return this.optionRepository.findOneBy({ id: +id });
  }

  @Delete('options/:id')
  @UseGuards(JwtAuthGuard)
  async deleteOption(@Request() req: any, @Param('id') id: string) {
    const option = await this.optionRepository.findOneBy({ id: +id });
    if (!option) throw new NotFoundException('Option not found');

    const userOrgs = req.user.userOrganisations
      ? req.user.userOrganisations.split(',').map(Number)
      : [];
    const canDelete =
      isPlatformAdmin(req.user) ||
      (option.organizationId && userOrgs.includes(option.organizationId));

    if (!canDelete) {
      throw new ForbiddenException(
        'You do not have permission to delete this option',
      );
    }

    try {
      await this.optionRepository.delete(id);
      return { success: true };
    } catch (error) {
      if (error.code === '23503') {
        throw new ConflictException('Cannot delete: This option is in use');
      }
      throw new InternalServerErrorException();
    }
  }

  // --- Color References ---

  @Get('colors')
  @UseGuards(JwtAuthGuard)
  async getColorReferences(
    @Request() req: any,
    @Query('organizationId') organizationId?: string,
    @Query('brandId') brandId?: string,
    @Query('materialId') materialId?: string,
    @Query('typeId') typeId?: string,
  ) {
    const query = this.colorReferenceRepository
      .createQueryBuilder('color')
      .leftJoinAndSelect('color.brand', 'brand')
      .leftJoinAndSelect('color.material', 'material')
      .leftJoinAndSelect('color.type', 'type')
      .leftJoinAndSelect('color.organization', 'organization')
      .where('color.isActive = :isActive', { isActive: true });

    if (!isPlatformAdmin(req.user)) {
      const orgId = organizationId || req.organizationId;
      checkOrgAccess(req.user, orgId);

      if (orgId) {
        query.andWhere(
          '(color.organizationId IS NULL OR color.organizationId = :orgId)',
          { orgId: Number(orgId) },
        );
      } else {
        query.andWhere('color.organizationId IS NULL');
      }
    }

    if (brandId) {
      query.andWhere('color.brandId = :brandId', { brandId: Number(brandId) });
    }
    if (materialId) {
      query.andWhere(
        '(color.materialId IS NULL OR color.materialId = :materialId)',
        { materialId: Number(materialId) },
      );
    }
    if (typeId) {
      query.andWhere('(color.typeId IS NULL OR color.typeId = :typeId)', {
        typeId: Number(typeId),
      });
    }

    return query
      .orderBy('brand.name', 'ASC')
      .addOrderBy('material.name', 'ASC')
      .addOrderBy('type.name', 'ASC')
      .addOrderBy('color.name', 'ASC')
      .getMany();
  }

  @Post('colors')
  @UseGuards(JwtAuthGuard)
  async createColorReference(
    @Request() req: any,
    @Body() createColorDto: CreateColorReferenceDto,
    @Query('admin') admin?: string,
    @Query('organizationId') organizationId?: string,
  ) {
    const isGlobal = admin === 'true' && isPlatformAdmin(req.user);
    const orgId = isGlobal
      ? null
      : createColorDto.organizationId || organizationId || req.organizationId;

    if (!isGlobal && orgId) {
      checkOrgAccess(req.user, orgId);
    }

    const existing = await this.findExistingColorReference(
      createColorDto.brandId,
      createColorDto.materialId ?? null,
      createColorDto.typeId ?? null,
      orgId ? Number(orgId) : null,
      createColorDto.name,
    );

    if (existing) {
      throw new ConflictException('This color reference already exists');
    }

    const hexes = this.normalizeHexes(
      createColorDto.hexes?.length
        ? createColorDto.hexes
        : [createColorDto.primaryHex],
    );

    const entry = this.colorReferenceRepository.create({
      ...createColorDto,
      primaryHex: hexes[0],
      hexes,
      materialId: createColorDto.materialId ?? null,
      typeId: createColorDto.typeId ?? null,
      organizationId: orgId ? Number(orgId) : null,
      source: createColorDto.source || 'manual',
      sourceExternalId: createColorDto.sourceExternalId ?? null,
      finish: createColorDto.finish ?? null,
      pattern: createColorDto.pattern ?? null,
      multiColorDirection: createColorDto.multiColorDirection ?? null,
      translucent: createColorDto.translucent ?? null,
      glow: createColorDto.glow ?? null,
      isActive: createColorDto.isActive ?? true,
    });

    return this.colorReferenceRepository.save(entry);
  }

  @Put('colors/:id')
  @UseGuards(JwtAuthGuard)
  async updateColorReference(
    @Request() req: any,
    @Param('id') id: string,
    @Body() updateDto: Partial<CreateColorReferenceDto>,
  ) {
    const entry = await this.colorReferenceRepository.findOne({
      where: { id: +id },
    });
    if (!entry) throw new NotFoundException('Color reference not found');

    if (!entry.organizationId && !isPlatformAdmin(req.user)) {
      throw new ForbiddenException('Only admins can update global references');
    }
    if (entry.organizationId) {
      checkOrgAccess(req.user, entry.organizationId);
    }

    const nextBrandId = updateDto.brandId ?? entry.brandId;
    const nextMaterialId =
      updateDto.materialId === undefined ? entry.materialId : updateDto.materialId;
    const nextTypeId =
      updateDto.typeId === undefined ? entry.typeId : updateDto.typeId;
    const nextName = updateDto.name ?? entry.name;

    if (
      nextBrandId !== entry.brandId ||
      nextMaterialId !== entry.materialId ||
      nextTypeId !== entry.typeId ||
      nextName.toLowerCase() !== entry.name.toLowerCase()
    ) {
      const existing = await this.findExistingColorReference(
        nextBrandId,
        nextMaterialId ?? null,
        nextTypeId ?? null,
        entry.organizationId,
        nextName,
      );
      if (existing && existing.id !== entry.id) {
        throw new ConflictException('This color reference already exists');
      }
    }

    if (updateDto.brandId !== undefined) entry.brandId = updateDto.brandId;
    if (updateDto.materialId !== undefined)
      entry.materialId = updateDto.materialId;
    if (updateDto.typeId !== undefined) entry.typeId = updateDto.typeId;
    if (updateDto.name !== undefined) entry.name = updateDto.name;
    if (updateDto.source !== undefined) entry.source = updateDto.source;
    if (updateDto.sourceExternalId !== undefined)
      entry.sourceExternalId = updateDto.sourceExternalId;
    if (updateDto.finish !== undefined) entry.finish = updateDto.finish;
    if (updateDto.pattern !== undefined) entry.pattern = updateDto.pattern;
    if (updateDto.multiColorDirection !== undefined)
      entry.multiColorDirection = updateDto.multiColorDirection;
    if (updateDto.translucent !== undefined)
      entry.translucent = updateDto.translucent;
    if (updateDto.glow !== undefined) entry.glow = updateDto.glow;
    if (updateDto.isActive !== undefined) entry.isActive = updateDto.isActive;
    if (updateDto.primaryHex !== undefined || updateDto.hexes !== undefined) {
      const hexes = this.normalizeHexes(
        updateDto.hexes?.length
          ? updateDto.hexes
          : [updateDto.primaryHex || entry.primaryHex],
      );
      entry.primaryHex = hexes[0];
      entry.hexes = hexes;
    }

    return this.colorReferenceRepository.save(entry);
  }

  @Put('colors/:id/promote')
  @SystemRoles('admin', 'moderator')
  async promoteColorReference(@Param('id') id: string) {
    await this.colorReferenceRepository.update(id, { organizationId: null });
    return this.colorReferenceRepository.findOne({
      where: { id: +id },
      relations: ['brand', 'material', 'type', 'organization'],
    });
  }

  @Delete('colors/:id')
  @UseGuards(JwtAuthGuard)
  async deleteColorReference(@Request() req: any, @Param('id') id: string) {
    const entry = await this.colorReferenceRepository.findOneBy({ id: +id });
    if (!entry) throw new NotFoundException('Color reference not found');

    if (!entry.organizationId && !isPlatformAdmin(req.user)) {
      throw new ForbiddenException('Only admins can delete global references');
    }
    if (entry.organizationId) {
      checkOrgAccess(req.user, entry.organizationId);
    }

    await this.colorReferenceRepository.delete(id);
    return { success: true };
  }

  // --- Brand Catalog ---

  @Get('brand-catalog')
  @UseGuards(JwtAuthGuard)
  async getBrandCatalog(
    @Request() req: any,
    @Query('organizationId') organizationId?: string,
    @Query('brandId') brandId?: string,
    @Query('materialId') materialId?: string,
    @Query('typeId') typeId?: string,
  ) {
    const whereConditions: any[] = [];
    const applyFilters = (condition: any) => {
      if (brandId) condition.brandId = Number(brandId);
      if (materialId) condition.materialId = Number(materialId);
      if (typeId) condition.typeId = Number(typeId);
      return condition;
    };

    if (isPlatformAdmin(req.user)) {
      return this.brandCatalogRepository.find({
        where: brandId || materialId || typeId ? applyFilters({}) : undefined,
        relations: ['brand', 'material', 'type', 'organization'],
        order: { brand: { name: 'ASC' } },
      });
    }

    const orgId = organizationId || req.organizationId;

    // SECURITY CHECK
    checkOrgAccess(req.user, orgId);

    whereConditions.push(applyFilters({ organizationId: IsNull() }));
    if (orgId) {
      whereConditions.push(applyFilters({ organizationId: Number(orgId) }));
    }

    return this.brandCatalogRepository.find({
      where: whereConditions,
      relations: ['brand', 'material', 'type', 'organization'], // Added organization here too for consistency
      order: { brand: { name: 'ASC' } },
    });
  }

  @Post('brand-catalog')
  @UseGuards(JwtAuthGuard)
  async createBrandCatalogEntry(
    @Request() req: any,
    @Body()
    body: {
      brandId: number;
      materialId: number;
      typeId: number;
      organizationId?: number;
    },
    @Query('admin') admin?: string,
  ) {
    const isGlobal = admin === 'true' && isPlatformAdmin(req.user);

    // Check if exists
    const orgId = isGlobal ? null : body.organizationId || req.organizationId;

    // SECURITY CHECK
    if (!isGlobal && orgId) {
      checkOrgAccess(req.user, orgId);
    }

    const existing = await this.brandCatalogRepository.findOne({
      where: {
        brandId: body.brandId,
        materialId: body.materialId,
        typeId: body.typeId,
        organizationId: orgId ? Number(orgId) : IsNull(),
      },
    });

    if (existing) {
      throw new ConflictException(
        'This combination already exists in the catalog',
      );
    }

    const entry = this.brandCatalogRepository.create({
      brandId: body.brandId,
      materialId: body.materialId,
      typeId: body.typeId,
      organizationId: orgId,
    });

    return await this.brandCatalogRepository.save(entry);
  }

  @Put('brand-catalog/:id/promote')
  @UseGuards(JwtAuthGuard)
  async promoteBrandCatalogEntry(@Request() req: any, @Param('id') id: string) {
    if (!isPlatformAdmin(req.user))
      throw new ForbiddenException('Only admins can promote entries');

    await this.brandCatalogRepository.update(id, { organizationId: null });
    return this.brandCatalogRepository.findOne({
      where: { id: +id },
      relations: ['brand', 'material', 'type', 'organization'],
    });
  }

  @Delete('brand-catalog/:id')
  @UseGuards(JwtAuthGuard)
  async deleteBrandCatalogEntry(@Request() req: any, @Param('id') id: string) {
    const entry = await this.brandCatalogRepository.findOneBy({ id: +id });
    if (!entry) throw new NotFoundException('Entry not found');

    const userOrgs = req.user.userOrganisations
      ? req.user.userOrganisations.split(',').map(Number)
      : [];
    const canDelete =
      isPlatformAdmin(req.user) ||
      (entry.organizationId && userOrgs.includes(entry.organizationId));

    if (!canDelete) {
      throw new ForbiddenException(
        'You do not have permission to delete this entry',
      );
    }

    await this.brandCatalogRepository.delete(id);
    return { success: true };
  }

  private normalizeHexes(hexes: string[]) {
    return hexes
      .map((hex) => hex.trim())
      .filter(Boolean)
      .map((hex) => (hex.startsWith('#') ? hex : `#${hex}`))
      .map((hex) => hex.toUpperCase());
  }

  private findExistingColorReference(
    brandId: number,
    materialId: number | null,
    typeId: number | null,
    organizationId: number | null,
    name: string,
  ) {
    const query = this.colorReferenceRepository
      .createQueryBuilder('color')
      .where('color.brandId = :brandId', { brandId })
      .andWhere('LOWER(color.name) = LOWER(:name)', { name });

    if (materialId) {
      query.andWhere('color.materialId = :materialId', { materialId });
    } else {
      query.andWhere('color.materialId IS NULL');
    }

    if (typeId) {
      query.andWhere('color.typeId = :typeId', { typeId });
    } else {
      query.andWhere('color.typeId IS NULL');
    }

    if (organizationId) {
      query.andWhere('color.organizationId = :organizationId', {
        organizationId,
      });
    } else {
      query.andWhere('color.organizationId IS NULL');
    }

    return query.getOne();
  }
}
