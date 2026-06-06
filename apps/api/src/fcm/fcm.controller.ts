import { Controller, Post, Body, Req, UseGuards, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { FcmService } from './fcm.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SuperAdminGuard } from '../auth/super-admin.guard';
import { OrganizationGuard } from '../common/organization.guard';

@ApiTags('fcm')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('fcm')
export class FcmController {
  constructor(private readonly fcmService: FcmService) {}

  @Post('token')
  async registerToken(
    @Req() req: any,
    @Body('token') token: string,
    @Body('deviceId') deviceId?: string,
    @Body('deviceName') deviceName?: string,
  ) {
    if (!token) {
      return { success: false, message: 'Token is required' };
    }
    return this.fcmService.registerToken(
      req.user.userId,
      token,
      deviceId,
      deviceName,
    );
  }

  @Post('clear-tokens/:userId')
  @UseGuards(SuperAdminGuard)
  async clearUserTokens(@Param('userId') userId: string) {
    return this.fcmService.clearUserTokens(+userId);
  }
}
