import {
  Controller,
  Get,
  Post,
  Body,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  Request,
  UnauthorizedException,
  Param,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrganizationGuard } from '../common/organization.guard';
import { AiAgentService } from './ai-agent.service';
import { AiActionPersistenceService } from './ai-action.service';
import { AiActionStatus } from './ai-action.entity';
import { AiMemoryService } from './ai-memory.service';

@ApiTags('ai')
@ApiBearerAuth()
@ApiHeader({ name: 'x-organization-id' })
@Controller('ai')
@UseGuards(JwtAuthGuard, OrganizationGuard)
export class AiAgentController {
  constructor(
    private readonly aiAgentService: AiAgentService,
    private readonly aiActionService: AiActionPersistenceService,
    private readonly aiMemoryService: AiMemoryService,
  ) {}

  @Get('status')
  async aiStatus(@Request() req: any) {
    const enabled = await this.aiAgentService.isPersistentIntelligenceEnabled(req.organizationId, req.user);
    const engine = await this.aiAgentService.checkEngineStatus(
      { organizationId: req.organizationId, userId: req.user.userId || req.user.sub, isSuperAdmin: req.user.isSuperAdmin, systemRole: req.user.systemRole },
      req.headers.authorization,
    );
    return { tier: enabled ? 'pro' : 'free', persistentIntelligence: enabled, engine };
  }

  @Post('ask')
  async askQuestion(@Request() req: any, @Body() body: { question: string }) {
    if (!body.question) {
      throw new Error('Question is required');
    }

    const ip =
      req.headers['x-forwarded-for'] ||
      req.socket?.remoteAddress ||
      req.ip ||
      'Unknown IP';

    const organizationId = req.organizationId;
    if (!organizationId) {
      throw new UnauthorizedException('Organization not specified');
    }
    // Attach organizationId to user context so the service can use it
    req.user.organizationId = organizationId;
    return this.aiAgentService.processQuestion(
      body.question,
      req.user,
      ip,
      req.headers.authorization,
    );
  }

  @Get('context')
  async getAiContext(@Request() req: any) {
    const organizationId = req.organizationId;
    if (!organizationId) {
      throw new UnauthorizedException('Organization not specified');
    }
    req.user.organizationId = organizationId;
    return this.aiAgentService.getApplicationContext(req.user);
  }

  @Post('rack-ocr')
  @UseInterceptors(FileInterceptor('image'))
  async analyzeRackPhoto(
    @Request() req: any,
    @UploadedFile() image: Express.Multer.File,
  ) {
    if (!image) {
      throw new Error('Image is required');
    }
    const organizationId = req.organizationId;
    if (!organizationId) {
      throw new UnauthorizedException('Organization not specified');
    }
    req.user.organizationId = organizationId;
    return this.aiAgentService.analyzeRackPhoto(image, organizationId);
  }

  @Get('actions')
  async listActions(@Request() req: any, @Query('status') status?: AiActionStatus) {
    const user = { organizationId: req.organizationId, userId: req.user.userId || req.user.sub };
    return this.aiActionService.list(user, status);
  }

  @Post('actions/:id/approve')
  async approveAction(@Request() req: any, @Param('id') id: string) {
    const user = { ...req.user, organizationId: req.organizationId, userId: req.user.userId || req.user.sub };
    return this.aiActionService.approve(id, user);
  }

  @Post('actions/:id/reject')
  async rejectAction(@Request() req: any, @Param('id') id: string) {
    const user = { organizationId: req.organizationId, userId: req.user.userId || req.user.sub };
    return this.aiActionService.reject(id, user);
  }

  @Get('memories')
  async listMemories(@Request() req: any) {
    const enabled = await this.aiAgentService.isPersistentIntelligenceEnabled(req.organizationId, req.user);
    if (!enabled) return [];
    return this.aiMemoryService.list({
      organizationId: req.organizationId,
      userId: Number(req.user.userId || req.user.sub),
    });
  }

  @Post('memories/:id/delete')
  async deleteMemory(@Request() req: any, @Param('id') id: string) {
    const enabled = await this.aiAgentService.isPersistentIntelligenceEnabled(req.organizationId, req.user);
    if (!enabled) return { deleted: false };
    await this.aiMemoryService.delete(id, {
      organizationId: req.organizationId,
      userId: Number(req.user.userId || req.user.sub),
    });
    return { deleted: true };
  }
}
