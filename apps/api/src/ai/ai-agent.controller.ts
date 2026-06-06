import {
  Controller,
  Get,
  Post,
  Body,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  Request,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrganizationGuard } from '../common/organization.guard';
import { AiAgentService } from './ai-agent.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from '../organization/organization.entity';

@ApiTags('ai')
@ApiBearerAuth()
@ApiHeader({ name: 'x-organization-id' })
@Controller('ai')
@UseGuards(JwtAuthGuard, OrganizationGuard)
export class AiAgentController {
  constructor(
    private readonly aiAgentService: AiAgentService,
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
  ) {}

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

    // Check if user's organization has access to AI features
    const organizationId = req.organizationId;
    if (!organizationId) {
      throw new UnauthorizedException('Organization not specified');
    }
    const org = await this.organizationRepository.findOne({
      where: { id: organizationId },
    });
    const now = new Date();
    const isEligible =
      req.user.isSuperAdmin ||
      (org &&
        (org.plan === 'pro' ||
          org.plan === 'enterprise' ||
          org.plan === 'beta' ||
          (org.trialEndsAt && new Date(org.trialEndsAt) > now)));

    if (!isEligible) {
      return {
        intent: 'restricted',
        answer:
          "🌟 **L'Assistant IA est une fonctionnalité Pro.**\n\nPassez à l'abonnement Pro ou démarrez votre essai de 15 jours pour débloquer l'Assistant IA, les prévisions intelligentes de rupture de stock, et bien plus encore !",
      };
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
}
