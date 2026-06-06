import {
  Controller,
  Post,
  Body,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Request,
} from '@nestjs/common';
import { EmailService } from '../email/email.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthService } from '../auth/auth.service';

@Controller('support')
@UseGuards(JwtAuthGuard)
export class SupportController {
  constructor(
    private readonly emailService: EmailService,
    private readonly authService: AuthService,
  ) {}

  @Post('ticket')
  @UseInterceptors(FileInterceptor('image'))
  async submitTicket(
    @Request() req: any,
    @Body() body: { type: 'bug' | 'feedback'; title?: string; message: string },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const ip =
      req.headers['x-forwarded-for'] ||
      req.socket?.remoteAddress ||
      req.ip ||
      'Unknown IP';

    const organizationId = req.headers['x-organization-id'] || 'Unknown';

    // req.user from JwtAuthGuard only has ID and username
    // We fetch the full user to have firstName, lastName, email for the support team
    const fullUser = await this.authService.findById(req.user.id);

    await this.emailService.sendSupportTicketEmail(
      { ...fullUser, organizationId },
      ip,
      body.type,
      body.message,
      body.title,
      file,
    );

    return { success: true };
  }
}
