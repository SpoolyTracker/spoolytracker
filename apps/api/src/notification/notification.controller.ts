import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  UseGuards,
  Request,
  Body,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SuperAdminGuard } from '../auth/super-admin.guard';

import { NotificationService } from './notification.service';
import { Observable } from 'rxjs';
import { map, filter } from 'rxjs/operators';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Sse('stream')
  stream(@Request() req: any): Observable<MessageEvent> {
    return this.notificationService.getNotificationStream().pipe(
      filter((event) => event.userId === req.user.userId),
      map((event) => ({
        data: event.notification,
      })),
    );
  }

  @Get()
  async findAll(@Request() req: any) {
    const notifications = await this.notificationService.findAll(
      req.user.userId,
    );
    const unreadCount = await this.notificationService.getUnreadCount(
      req.user.userId,
    );
    return { notifications, unreadCount };
  }

  @Put(':id/read')
  async markAsRead(@Param('id') id: string, @Request() req: any) {
    await this.notificationService.markAsRead(+id, req.user.userId);
    return { success: true };
  }

  @Put('read-all')
  async markAllAsRead(@Request() req: any) {
    await this.notificationService.markAllAsRead(req.user.userId);
    return { success: true };
  }

  @Post('broadcast')
  @UseGuards(SuperAdminGuard)
  async broadcastMessage(
    @Request() req: any,
    @Body()
    body: {
      title: string;
      message: string;
      data?: any;
      userIds?: number[];
      targetPlan?: string;
      channels?: ('internal' | 'push')[];
    },
  ) {
    if (!body.title || !body.message) {
      return { success: false, message: 'Title and message are required' };
    }
    return this.notificationService.broadcastToAll(
      body.title,
      body.message,
      body.data,
      body.userIds,
      body.targetPlan,
      body.channels,
    );
  }
}
