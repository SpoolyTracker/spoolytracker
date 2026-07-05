import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrganizationGuard } from '../common/organization.guard';
import { OrganizationRoleGuard } from '../common/organization-role.guard';
import { OrganizationRoles } from '../common/organization-roles.decorator';
import { DataPortabilityService } from './data-portability.service';
import {
  ExportRequestDto,
  ImportInspectRequestDto,
  ImportPreviewRequestDto,
  ImportCommitRequestDto,
} from './data-portability.types';

@ApiTags('data-portability')
@ApiBearerAuth()
@ApiHeader({ name: 'x-organization-id' })
@Controller('data-portability')
@UseGuards(JwtAuthGuard, OrganizationGuard, OrganizationRoleGuard)
@OrganizationRoles('admin')
export class DataPortabilityController {
  constructor(private readonly dataPortabilityService: DataPortabilityService) {}

  @Post('export')
  export(@Req() req: any, @Body() body: ExportRequestDto = {}) {
    return this.dataPortabilityService.exportOrganization(req.organizationId, body);
  }

  @Post('import/inspect')
  inspect(@Body() body: ImportInspectRequestDto) {
    return this.dataPortabilityService.inspectPayload(body.payload ?? body);
  }

  @Post('import/preview')
  preview(@Body() body: ImportPreviewRequestDto) {
    return this.dataPortabilityService.previewImport(body);
  }

  @Post('import/commit')
  commit(@Req() req: any, @Body() body: ImportCommitRequestDto) {
    return this.dataPortabilityService.commitImport(req.organizationId, body);
  }
}
