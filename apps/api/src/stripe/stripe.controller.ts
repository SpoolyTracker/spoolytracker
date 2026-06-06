import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Get,
  Param,
  Headers,
  Req,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StripeService } from './stripe.service';
import { OrganizationService } from '../organization/organization.service';
import { SubscriptionService } from './subscription.service';
import type { Request as ExpressRequest } from 'express';
import { isSelfHosted } from '../common/self-hosted';

@Controller('stripe')
export class StripeController {
  constructor(
    private readonly stripeService: StripeService,
    private readonly organizationService: OrganizationService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  private assertBillingEnabled() {
    if (isSelfHosted()) {
      throw new ForbiddenException('Billing is disabled in self-hosted mode');
    }
  }

  private async assertCanManageBilling(user: any, organizationId: number) {
    this.assertBillingEnabled();

    if (!Number.isFinite(organizationId) || organizationId <= 0) {
      throw new BadRequestException('Valid organizationId is required');
    }

    const isSystemBypass =
      user?.isSuperAdmin === true ||
      ['super_admin', 'admin', 'moderator'].includes(user?.systemRole || '');

    if (isSystemBypass) {
      return;
    }

    const role = await this.organizationService.getUserRole(
      organizationId,
      user.userId || user.id,
    );

    if (!role || !['owner', 'admin'].includes(role)) {
      throw new ForbiddenException(
        'Only organization owners and admins can manage billing',
      );
    }
  }

  @Post('create-checkout-session')
  @UseGuards(JwtAuthGuard)
  async createCheckoutSession(
    @Body()
    body: {
      organizationId: number;
      plan: 'pro' | 'enterprise';
      trialPeriodDays?: number;
    },
    @Request() req: any,
  ) {
    this.assertBillingEnabled();
    await this.assertCanManageBilling(req.user, Number(body.organizationId));

    return this.stripeService.createCheckoutSession(
      body.organizationId,
      body.plan,
      req.user.userId,
      req.user.email,
      body.trialPeriodDays,
    );
  }

  @Post('upgrade')
  @UseGuards(JwtAuthGuard)
  async upgradeSubscription(
    @Body() body: { organizationId: number; plan: 'pro' | 'enterprise' },
    @Request() req: any,
  ) {
    this.assertBillingEnabled();
    await this.assertCanManageBilling(req.user, Number(body.organizationId));

    return this.stripeService.upgradeSubscription(
      body.organizationId,
      body.plan,
    );
  }

  @Post('create-portal-session')
  @UseGuards(JwtAuthGuard)
  async createPortalSession(
    @Body() body: { organizationId: number },
    @Request() req: any,
  ) {
    this.assertBillingEnabled();
    await this.assertCanManageBilling(req.user, Number(body.organizationId));

    const org = await this.organizationService.findOne(body.organizationId);
    if (!org || !org.stripeCustomerId) {
      throw new BadRequestException(
        'Organization has no active Stripe customer',
      );
    }
    return this.stripeService.createBillingPortalSession(org.stripeCustomerId);
  }

  @Get('organizations/:id/subscriptions')
  @UseGuards(JwtAuthGuard)
  async getSubscriptions(@Param('id') id: string, @Request() req: any) {
    this.assertBillingEnabled();
    const organizationId = parseInt(id, 10);
    await this.assertCanManageBilling(req.user, organizationId);

    return this.subscriptionService.getSubscriptionsByOrganization(
      organizationId,
    );
  }

  @Post('webhook')
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() request: RawBodyRequest<ExpressRequest>,
  ) {
    this.assertBillingEnabled();
    if (!request.rawBody) {
      console.error(
        '⚠️ Webhook error: rawBody is missing! Make sure { rawBody: true } is set in main.ts',
      );
      throw new Error('Raw body is required for webhook verification');
    }
    return this.stripeService.handleWebhook(signature, request.rawBody);
  }
}
