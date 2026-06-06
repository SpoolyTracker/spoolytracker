import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, In } from 'typeorm';
import { User } from '../auth/user.entity';
import { PushToken } from './entities/push-token.entity';
import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';

@Injectable()
export class FcmService {
  private readonly logger = new Logger(FcmService.name);
  private expo: Expo;

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(PushToken)
    private pushTokenRepository: Repository<PushToken>,
  ) {
    // Initialiser le client Expo Server SDK
    this.expo = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN }); // accessToken optionel
    this.logger.log('Expo Push API initialized.');
  }

  async registerToken(
    userId: number,
    token: string,
    deviceId?: string,
    deviceName?: string,
  ) {
    if (!userId || isNaN(userId)) {
      this.logger.warn(
        `Attempted to register FCM token for invalid userId: ${userId}`,
      );
      return { success: false, error: 'Invalid User ID' };
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      this.logger.warn(
        `Attempted to register FCM token for non-existent user ID: ${userId}`,
      );
      return { success: false, error: 'User not found' };
    }

    // Check that all your push tokens appear to be valid Expo push tokens
    if (!Expo.isExpoPushToken(token)) {
      this.logger.error(`Push token ${token} is not a valid Expo push token`);
      return { success: false, error: 'Invalid Token format' };
    }

    // Upsert token
    let pushToken = await this.pushTokenRepository.findOne({
      where: { token },
    });

    if (pushToken) {
      pushToken.userId = userId;
      if (deviceId) pushToken.deviceId = deviceId;
      if (deviceName) pushToken.deviceName = deviceName;
      pushToken.lastSeenAt = new Date();
      await this.pushTokenRepository.save(pushToken);
    } else {
      // If deviceId is provided, we might want to remove other tokens for the same device to keep it clean
      if (deviceId) {
        await this.pushTokenRepository.delete({ deviceId, userId });
      }

      pushToken = this.pushTokenRepository.create({
        token,
        userId,
        deviceId,
        deviceName,
        lastSeenAt: new Date(),
      });
      await this.pushTokenRepository.save(pushToken);
    }

    // Optional: Trigger a background cleanup for this user or generally
    this.cleanupStaleTokens(userId).catch((e) =>
      this.logger.error('Error in background stale token cleanup', e),
    );

    return { success: true };
  }

  private async cleanupStaleTokens(userId: number) {
    try {
      // Delete tokens older than 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const deleteResult = await this.pushTokenRepository.delete({
        lastSeenAt: LessThan(thirtyDaysAgo),
      });

      if (deleteResult.affected && deleteResult.affected > 0) {
        this.logger.log(
          `Cleaned up ${deleteResult.affected} stale FCM tokens (older than 30 days)`,
        );
      }

      // Also keep only top 5 most recent tokens per user as a safety measure
      const userTokens = await this.pushTokenRepository.find({
        where: { userId },
        order: { lastSeenAt: 'DESC' },
      });

      if (userTokens.length > 5) {
        const toDelete = userTokens.slice(5).map((t) => t.id);
        await this.pushTokenRepository.delete({ id: In(toDelete) });
        this.logger.log(
          `Cleaned up ${toDelete.length} extra FCM tokens for user ${userId} (exceeded limit of 5)`,
        );
      }
    } catch (e) {
      this.logger.error('Error cleaning up stale tokens', e);
    }
  }

  async broadcastToAll(
    title: string,
    body: string,
    data?: any,
    userIds?: number[],
  ) {
    let query = this.pushTokenRepository.createQueryBuilder('pt');

    if (userIds && userIds.length > 0) {
      query = query.where('pt.userId IN (:...userIds)', { userIds });
    }

    const tokens = await query.getMany();

    const allTokens: string[] = tokens.map((t) => t.token);

    // Deduplicate just in case
    const uniqueTokens = [...new Set(allTokens)];

    if (uniqueTokens.length === 0) {
      this.logger.log('No tokens found for broadcast.');
      return {
        success: true,
        message: 'No devices found to broadcast to',
        count: 0,
      };
    }

    this.logger.log(
      `Broadcasting push notification to ${uniqueTokens.length} devices.`,
    );
    await this.sendPushNotification(uniqueTokens, title, body, data);
    return {
      success: true,
      message: 'Broadcast initiated',
      count: uniqueTokens.length,
    };
  }

  async sendPushNotification(
    tokens: string[],
    title: string,
    body: string,
    data?: any,
  ) {
    if (!tokens || tokens.length === 0) return;

    const messages: ExpoPushMessage[] = [];

    for (const pushToken of tokens) {
      // Check that all your push tokens appear to be valid Expo push tokens
      if (!Expo.isExpoPushToken(pushToken)) {
        this.logger.warn(
          `Push token ${pushToken} is not a valid Expo push token. Skipping.`,
        );
        continue;
      }

      // Construct a message (see https://docs.expo.io/push-notifications/sending-notifications/)
      messages.push({
        to: pushToken,
        sound: 'default',
        title: title,
        body: body,
        data: data,
      });
    }

    // The Expo push notification service accepts batches of notifications
    const chunks = this.expo.chunkPushNotifications(messages);
    const tickets: ExpoPushTicket[] = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        this.logger.error('Error sending push notification chunk: ', error);
      }
    }

    // You can optionally check tickets for errors, or store them for later retrieval of Receipts
    this.processTickets(tickets, messages);
  }

  private async processTickets(
    tickets: ExpoPushTicket[],
    messages: ExpoPushMessage[],
  ) {
    const invalidTokens: string[] = [];

    tickets.forEach((ticket, idx) => {
      if (ticket.status === 'error') {
        this.logger.warn(`Ticket Error formatting Push : ${ticket.message}`);
        if (ticket.details && ticket.details.error === 'DeviceNotRegistered') {
          const tokenObj = messages[idx]?.to;
          if (typeof tokenObj === 'string') {
            invalidTokens.push(tokenObj);
          }
        }
      }
    });

    if (invalidTokens.length > 0) {
      this.logger.log(
        `Found ${invalidTokens.length} unregistered/invalid devices. Cleaning up DB...`,
      );
      await this.cleanupInvalidTokens(invalidTokens);
    }
  }

  async clearUserTokens(userId: number) {
    try {
      const result = await this.pushTokenRepository.delete({ userId });
      this.logger.log(
        `Manually cleared ${result.affected} tokens for user ${userId}`,
      );
      return { success: true, count: result.affected };
    } catch (e) {
      this.logger.error(`Error clearing tokens for user ${userId}`, e);
      throw e;
    }
  }

  private async cleanupInvalidTokens(invalidTokens: string[]) {
    try {
      const result = await this.pushTokenRepository.delete({
        token: In(invalidTokens),
      });
      if (result.affected && result.affected > 0) {
        this.logger.log(
          `Cleaned up ${result.affected} invalid FCM tokens from database.`,
        );
      }
    } catch (e) {
      this.logger.error('Error cleaning up invalid FCM tokens', e);
    }
  }
}
