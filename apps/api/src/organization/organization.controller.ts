import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Delete,
  UseGuards,
  Request,
  ForbiddenException,
  BadRequestException,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrganizationGuard } from '../common/organization.guard';
import { OrganizationRoleGuard } from '../common/organization-role.guard';
import { OrganizationRoles } from '../common/organization-roles.decorator';
import { OrganizationService } from './organization.service';
import { CreateOrganizationDto, AddMemberDto } from './dto/organization.dto';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiBody,
  ApiConsumes,
  ApiOperation,
} from '@nestjs/swagger';

@Controller('organizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Post()
  async create(
    @Body() createOrgDto: CreateOrganizationDto,
    @Request() req: any,
  ) {
    return this.organizationService.create(createOrgDto.name, req.user.userId);
  }

  @Get()
  async findAll(@Request() req: any) {
    const overrideOrgId = req.headers['x-organization-id'];
    return this.organizationService.findByUser(
      req.user.userId,
      req.user,
      overrideOrgId ? +overrideOrgId : undefined,
    );
  }

  // Context-dependent endpoints requiring OrganizationGuard + RoleGuard

  @Get(':id')
  @UseGuards(OrganizationGuard, OrganizationRoleGuard)
  @OrganizationRoles('member')
  async findOne(@Param('id') id: string, @Request() req: any) {
    // Guard handles permission check
    return this.organizationService.getWithStats(+id);
  }

  @Get(':id/my-role')
  @UseGuards(OrganizationGuard)
  async getMyRole(@Param('id') id: string, @Request() req: any) {
    const role = await this.organizationService.getUserRole(
      +id,
      req.user.userId,
    );
    return { role };
  }

  @Get(':id/users')
  @UseGuards(OrganizationGuard, OrganizationRoleGuard)
  @OrganizationRoles('member')
  async getOrganizationUsers(@Param('id') id: string, @Request() req: any) {
    const userOrgs = await this.organizationService.getOrganizationUsers(+id);

    return userOrgs
      .filter((uo) => uo.user)
      .map((uo) => ({
        id: uo.user.id,
        username: uo.user.username,
        email: uo.user.email,
        firstName: uo.user.firstName,
        lastName: uo.user.lastName,
        role: uo.role,
        joinedAt: uo.joinedAt,
      }));
  }

  @Post(':id/members')
  @UseGuards(OrganizationGuard, OrganizationRoleGuard)
  @OrganizationRoles('admin')
  async addMember(
    @Param('id') id: string,
    @Request() req: any,
    @Body() addMemberDto: AddMemberDto,
  ) {
    const userAdd = await this.organizationService.addMember(
      +id,
      addMemberDto.email,
      addMemberDto.role,
      req.user,
    );
    if (!userAdd) {
      throw new BadRequestException('User not found');
    }
    return userAdd;
  }

  @Post(':id/settings')
  @UseGuards(OrganizationGuard, OrganizationRoleGuard)
  @OrganizationRoles('admin')
  async updateSettings(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: { settings: any },
  ) {
    return this.organizationService.updateSettings(+id, body.settings);
  }

  // Preference personnelle du membre: activer/couper les alertes IA pour CETTE org.
  @Post(':id/ai-alerts-preference')
  @UseGuards(OrganizationGuard, OrganizationRoleGuard)
  @OrganizationRoles('member')
  async setAiAlertsPreference(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: { enabled: boolean },
  ) {
    return this.organizationService.setAiAlertsPreference(
      +id,
      req.user.id,
      body.enabled !== false,
    );
  }

  @Post(':id/logo')
  @UseGuards(OrganizationGuard, OrganizationRoleGuard)
  @OrganizationRoles('admin')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './../web/public/uploads/logos',
        filename: (req, file, cb) => {
          const randomName = Array(32)
            .fill(null)
            .map(() => Math.round(Math.random() * 16).toString(16))
            .join('');
          return cb(null, `${randomName}${extname(file.originalname)}`);
        },
      }),
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async uploadLogo(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    if (!file) throw new BadRequestException('File is required');

    // Construct public URL (relative to web public root)
    // Since we save to apps/web/public/uploads/logos, the URL is /uploads/logos/filename
    const logoUrl = `/uploads/logos/${file.filename}`;

    // Update Organization entity
    await this.organizationService.updateLogo(+id, logoUrl);

    return { logo: logoUrl };
  }

  @Delete(':id/members/:userId')
  @UseGuards(OrganizationGuard, OrganizationRoleGuard)
  @OrganizationRoles('admin')
  async removeMember(
    @Param('id') id: string,
    @Request() req: any,
    @Param('userId') userId: string,
  ) {
    await this.organizationService.removeMember(+id, +userId);
    return { message: 'Member removed successfully' };
  }

  @Put(':id/members/:userId/role')
  @UseGuards(OrganizationGuard, OrganizationRoleGuard)
  @OrganizationRoles('admin')
  async updateMemberRole(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() body: { role: 'admin' | 'member' },
    @Request() req: any,
  ) {
    // Check if target user is owner? Handled by service but good to be aware
    // Admin cannot demote Owner (Service handles it)
    // Admin can promote Member to Admin
    // Admin can demote Admin to Member
    const updated = await this.organizationService.updateMemberRole(
      +id,
      +userId,
      body.role,
    );
    if (!updated) throw new BadRequestException('Member not found');
    return updated;
  }

  @Post(':id/invitation/accept')
  async acceptInvitation(@Param('id') id: string, @Request() req: any) {
    await this.organizationService.acceptInvitation(req.user.userId, +id);
    return { message: 'Invitation accepted' };
  }

  @Post(':id/invitation/decline')
  async declineInvitation(@Param('id') id: string, @Request() req: any) {
    await this.organizationService.declineInvitation(req.user.userId, +id);
    return { message: 'Invitation declined' };
  }

  @Delete(':id/logo')
  @ApiOperation({ summary: 'Remove organization logo' })
  @UseGuards(OrganizationGuard, OrganizationRoleGuard)
  @OrganizationRoles('admin')
  async removeLogo(@Param('id') id: string) {
    return this.organizationService.removeLogo(+id);
  }

  @Delete(':id')
  @UseGuards(OrganizationGuard, OrganizationRoleGuard)
  @OrganizationRoles('owner')
  async remove(@Param('id') id: string) {
    return this.organizationService.delete(+id);
  }
  @Post(':id/start-trial')
  @UseGuards(OrganizationGuard, OrganizationRoleGuard)
  @OrganizationRoles('admin')
  async startTrial(@Param('id') id: string) {
    return this.organizationService.startTrial(+id);
  }

  @Post(':id/resolve-quota')
  @UseGuards(OrganizationGuard, OrganizationRoleGuard)
  @OrganizationRoles('owner', 'admin')
  async resolveQuota(
    @Param('id') id: string,
    @Body() body: { selectedFilamentIds: number[] },
  ) {
    if (!body.selectedFilamentIds || !Array.isArray(body.selectedFilamentIds)) {
      throw new BadRequestException(
        'selectedFilamentIds must be an array of numbers',
      );
    }
    await this.organizationService.resolveQuota(+id, body.selectedFilamentIds);
    return { message: 'Quota issues resolved successfully' };
  }
}
