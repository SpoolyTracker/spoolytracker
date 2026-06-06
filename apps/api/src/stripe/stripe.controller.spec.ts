import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

jest.mock('marked', () => ({
  marked: jest.fn((value: string) => value),
  __esModule: true,
}));

jest.mock('expo-server-sdk', () => ({
  Expo: jest.fn().mockImplementation(() => ({})),
  __esModule: true,
}));

import { OrganizationService } from '../organization/organization.service';
import { StripeController } from './stripe.controller';
import { StripeService } from './stripe.service';
import { SubscriptionService } from './subscription.service';

const mockStripeService = {
  createCheckoutSession: jest.fn(),
  upgradeSubscription: jest.fn(),
  createBillingPortalSession: jest.fn(),
  handleWebhook: jest.fn(),
};

const mockOrganizationService = {
  findOne: jest.fn(),
  getUserRole: jest.fn(),
};

const mockSubscriptionService = {
  getSubscriptionsByOrganization: jest.fn(),
};

describe('StripeController', () => {
  let controller: StripeController;
  const originalSelfHosted = process.env.SELF_HOSTED;

  beforeEach(async () => {
    delete process.env.SELF_HOSTED;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StripeController],
      providers: [
        { provide: StripeService, useValue: mockStripeService },
        { provide: OrganizationService, useValue: mockOrganizationService },
        { provide: SubscriptionService, useValue: mockSubscriptionService },
      ],
    }).compile();

    controller = module.get<StripeController>(StripeController);
    jest.clearAllMocks();
  });

  afterAll(() => {
    if (originalSelfHosted === undefined) {
      delete process.env.SELF_HOSTED;
    } else {
      process.env.SELF_HOSTED = originalSelfHosted;
    }
  });

  describe('billing access', () => {
    it('allows organization admins to create a checkout session', async () => {
      mockOrganizationService.getUserRole.mockResolvedValue('admin');
      mockStripeService.createCheckoutSession.mockResolvedValue({
        url: 'https://checkout.stripe.test/session',
      });

      const result = await controller.createCheckoutSession(
        { organizationId: 10, plan: 'pro' },
        { user: { userId: 1, email: 'admin@test.com' } },
      );

      expect(mockOrganizationService.getUserRole).toHaveBeenCalledWith(10, 1);
      expect(mockStripeService.createCheckoutSession).toHaveBeenCalledWith(
        10,
        'pro',
        1,
        'admin@test.com',
        undefined,
      );
      expect(result).toEqual({ url: 'https://checkout.stripe.test/session' });
    });

    it('blocks organization members from managing billing', async () => {
      mockOrganizationService.getUserRole.mockResolvedValue('member');

      await expect(
        controller.upgradeSubscription(
          { organizationId: 10, plan: 'enterprise' },
          { user: { userId: 2 } },
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(mockStripeService.upgradeSubscription).not.toHaveBeenCalled();
    });

    it('blocks users who do not belong to the organization', async () => {
      mockOrganizationService.getUserRole.mockResolvedValue(null);

      await expect(
        controller.createPortalSession(
          { organizationId: 10 },
          { user: { userId: 3 } },
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(mockOrganizationService.findOne).not.toHaveBeenCalled();
      expect(mockStripeService.createBillingPortalSession).not.toHaveBeenCalled();
    });

    it('allows system admins without organization membership', async () => {
      mockSubscriptionService.getSubscriptionsByOrganization.mockResolvedValue([
        { id: 1 },
      ]);

      const result = await controller.getSubscriptions('10', {
        user: { userId: 99, systemRole: 'super_admin' },
      });

      expect(mockOrganizationService.getUserRole).not.toHaveBeenCalled();
      expect(result).toEqual([{ id: 1 }]);
    });

    it('rejects invalid organization ids', async () => {
      await expect(
        controller.getSubscriptions('not-a-number', {
          user: { userId: 1 },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('disables billing endpoints in self-hosted mode', async () => {
      process.env.SELF_HOSTED = 'true';

      await expect(
        controller.createCheckoutSession(
          { organizationId: 10, plan: 'pro' },
          { user: { userId: 1, email: 'admin@test.com' } },
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(mockStripeService.createCheckoutSession).not.toHaveBeenCalled();
    });
  });
});
