import { Injectable, Logger } from '@nestjs/common';
import { Subject } from 'rxjs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType } from './notification.entity';
import { User } from '../auth/user.entity';
import { FcmService } from '../fcm/fcm.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private fcmService: FcmService,
    private emailService: EmailService,
  ) {}

  // Subject for Server-Sent Events (SSE)
  private notificationStream = new Subject<{
    userId: number;
    notification: Notification;
  }>();

  getNotificationStream() {
    return this.notificationStream.asObservable();
  }

  private isNotificationEnabled(user: User, type: NotificationType): boolean {
    // If no preference is set, default to true
    if (!user.notificationPreferences) return true;

    switch (type) {
      case NotificationType.SYSTEM:
        return user.notificationPreferences.notifyOnSystem;
      case NotificationType.NEW_SPOOL:
        return user.notificationPreferences.notifyOnNewSpool;
      case NotificationType.CONSUMPTION:
        return user.notificationPreferences.notifyOnConsumption;
      case NotificationType.LOW_STOCK:
        return user.notificationPreferences.notifyOnLowStock;
      case NotificationType.INVITATION:
        return user.notificationPreferences.notifyOnInvitation;
      default:
        return true;
    }
  }

  async create(
    userId: number,
    type: NotificationType,
    title: string,
    message: string,
    data?: any,
  ): Promise<Notification | null> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['notificationPreferences', 'pushTokens'],
    });
    if (!user || !this.isNotificationEnabled(user, type)) {
      return null; // User opted out of this specific notification type
    }

    const notification = this.notificationRepository.create({
      userId,
      type,
      title,
      message,
      data,
    });
    const saved = await this.notificationRepository.save(notification);

    // Emit real-time SSE event to connected Web clients
    this.notificationStream.next({ userId, notification: saved });

    // Fire-and-forget push notification
    if (user.pushTokens && user.pushTokens.length > 0) {
      const tokenStrings = user.pushTokens.map((t) => t.token);
      this.fcmService
        .sendPushNotification(tokenStrings, title, message, data)
        .catch((err) => {
          this.logger.error('Failed to send push notification', err);
        });
    }

    return saved;
  }

  async findAll(userId: number): Promise<Notification[]> {
    return this.notificationRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 50, // Limit to last 50 notifications
    });
  }

  async getUnreadCount(userId: number): Promise<number> {
    return this.notificationRepository.count({
      where: { userId, isRead: false },
    });
  }

  async markAsRead(id: number, userId: number): Promise<void> {
    await this.notificationRepository.update({ id, userId }, { isRead: true });
  }

  async markAllAsRead(userId: number): Promise<void> {
    await this.notificationRepository.update(
      { userId, isRead: false },
      { isRead: true },
    );
  }

  async broadcastToAll(
    title: string,
    message: string,
    data?: any,
    userIds?: number[],
    targetPlan?: string,
    channels?: ('internal' | 'push' | 'email')[],
  ) {
    const activeChannels =
      channels && channels.length > 0 ? channels : ['internal', 'push'];

    let query = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect(
        'user.notificationPreferences',
        'notificationPreferences',
      );

    if (userIds && userIds.length > 0) {
      query = query.where('user.id IN (:...userIds)', { userIds });
    }

    if (targetPlan) {
      query = query
        .innerJoin('user.userOrganizations', 'userOrg')
        .innerJoin('userOrg.organization', 'org')
        .andWhere('org.plan = :targetPlan', { targetPlan });
    }

    const potentialUsers = await query.getMany();

    // De-duplicate users by email to avoid sending multiple notifications to the same person
    const seenEmails = new Set<string>();
    const targetUsers = potentialUsers.filter((user) => {
      if (!this.isNotificationEnabled(user, NotificationType.SYSTEM))
        return false;
      if (!user.email) return true; // Keep for push if no email, but shouldn't happen much
      if (seenEmails.has(user.email)) return false;
      seenEmails.add(user.email);
      return true;
    });

    if (targetUsers.length === 0) {
      return {
        success: true,
        message: 'No active users found or all users opted out',
        count: 0,
      };
    }

    // Internal notifications: create DB entries + emit SSE events for the Web UI
    if (activeChannels.includes('internal')) {
      const notificationsToSave = targetUsers.map((user) =>
        this.notificationRepository.create({
          userId: user.id,
          type: NotificationType.SYSTEM,
          title,
          message,
          data,
        }),
      );
      const savedNotifs =
        await this.notificationRepository.save(notificationsToSave);

      // Emit SSE events to online users
      savedNotifs.forEach((notif) => {
        this.notificationStream.next({
          userId: notif.userId,
          notification: notif,
        });
      });
    }

    // Push mobile: delegate to FCMService
    if (activeChannels.includes('push')) {
      await this.fcmService.broadcastToAll(
        title,
        message,
        data,
        targetUsers.map((u) => u.id),
      );
    }

    // Email (SMTP): iterate through users and send via EmailService
    if (activeChannels.includes('email')) {
      for (const user of targetUsers) {
        if (user.email) {
          this.emailService
            .sendBroadcastEmail(user.email, title, message)
            .catch((err) => {
              this.logger.error(
                `Failed to send broadcast email to ${user.email}`,
                err,
              );
            });
        }
      }
    }

    const channelLabel = activeChannels.join(' + ');
    return {
      success: true,
      message: `Broadcast initiated successfully via ${channelLabel}`,
      count: targetUsers.length,
    };
  }
}
