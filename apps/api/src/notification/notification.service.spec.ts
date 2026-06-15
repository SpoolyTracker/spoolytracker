jest.mock('marked', () => ({ marked: jest.fn((value: string) => value) }));

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationService } from './notification.service';
import { Notification, NotificationType } from './notification.entity';
import { User } from '../auth/user.entity';
import { FcmService } from '../fcm/fcm.service';
import { EmailService } from '../email/email.service';

describe('NotificationService.isNotificationEnabled (AI_ALERT)', () => {
  let service: NotificationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: getRepositoryToken(Notification), useValue: {} },
        { provide: getRepositoryToken(User), useValue: {} },
        { provide: FcmService, useValue: {} },
        { provide: EmailService, useValue: {} },
      ],
    }).compile();
    service = module.get(NotificationService);
  });

  it('AI_ALERT autorise au niveau livraison (gating fin en amont)', () => {
    const withPref = (service as any).isNotificationEnabled(
      { notificationPreferences: { notifyOnAiRupture: false } },
      NotificationType.AI_ALERT,
    );
    const withoutPref = (service as any).isNotificationEnabled(
      {},
      NotificationType.AI_ALERT,
    );
    expect(withPref).toBe(true);
    expect(withoutPref).toBe(true);
  });
});
