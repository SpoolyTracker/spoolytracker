import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrganizationGuard } from '../common/organization.guard';
import { PUBLIC_API_SCOPES } from './api-key-scopes';
import { ApiKeysService } from './api-keys.service';

@ApiTags('api-keys')
@ApiBearerAuth()
@ApiHeader({ name: 'x-organization-id' })
@Controller('api-keys')
@UseGuards(JwtAuthGuard, OrganizationGuard)
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Get()
  list(@Req() req: any) {
    return this.apiKeysService.list(req.user, req.organizationId);
  }

  @Get('scopes')
  scopes() {
    return { data: PUBLIC_API_SCOPES };
  }

  @Post()
  async create(
    @Req() req: any,
    @Body() body: { name?: string; scopes?: string[]; expiresAt?: string },
  ) {
    const { key, record } = await this.apiKeysService.create(
      req.user,
      req.organizationId,
      body.name || 'Public API token',
      body.scopes,
      body.expiresAt,
    );
    return {
      key,
      apiKey: this.apiKeysService.toPublicKey(record),
    };
  }

  @Delete(':id')
  revoke(
    @Req() req: any,
    @Param('id') id: string,
    @Query('hard') hard?: string,
  ) {
    if (hard === 'true') {
      return this.apiKeysService.delete(
        req.user,
        req.organizationId,
        Number(id),
      );
    }
    return this.apiKeysService.revoke(req.user, req.organizationId, Number(id));
  }
}
