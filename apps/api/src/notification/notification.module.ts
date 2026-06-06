import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { Notification } from './notification.entity';
import { FcmModule } from '../fcm/fcm.module';
import { User } from '../auth/user.entity';
import { UserNotificationPreference } from './user-notification-preference.entity';
import { UserOrganization } from '../organization/user-organization.entity';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      User,
      UserNotificationPreference,
      UserOrganization,
    ]),
    FcmModule,
    EmailModule,
  ],
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
