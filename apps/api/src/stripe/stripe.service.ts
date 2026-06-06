import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { OrganizationService } from '../organization/organization.service';
import { SubscriptionService } from './subscription.service';

@Injectable()
export class StripeService {
  private stripe: Stripe;

  constructor(
    private configService: ConfigService,
    private organizationService: OrganizationService,
    private subscriptionService: SubscriptionService,
  ) {
    const stripeKey = this.configService.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      console.warn(
        '⚠️  STRIPE_SECRET_KEY not set. Stripe features will be disabled.',
      );
    }
    this.stripe = new Stripe(stripeKey || 'sk_test_dummy', {
      apiVersion: '2025-11-17.clover',
    });
  }

  async createCheckoutSession(
    organizationId: number,
    plan: 'pro' | 'enterprise',
    userId?: number,
    userEmail?: string,
    trialPeriodDays?: number,
  ) {
    const org = await this.organizationService.findOne(organizationId);
    if (!org) {
      console.warn(
        `⚠️ Organization ${organizationId} not found during session creation.`,
      );
      return;
    }

    if (org.stripeSubscriptionId) {
      try {
        const subscription = await this.stripe.subscriptions.retrieve(
          org.stripeSubscriptionId,
        );
        const currentAppUrl =
          this.configService.get('DASHBOARD_URL') ||
          this.configService.get('APP_URL') ||
          this.configService.get('FRONTEND_URL');
        const subAppUrl = subscription.metadata?.appUrl;
        const subCustomerId =
          typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer.id;

        // CRITICAL: Ensure this subscription belongs to THIS customer and THIS environment
        const isOurSubscription =
          subCustomerId === org.stripeCustomerId &&
          (!subAppUrl || subAppUrl === currentAppUrl);

        if (
          subscription &&
          subscription.status !== 'canceled' &&
          isOurSubscription
        ) {
          const session = await this.stripe.billingPortal.sessions.create({
            customer: org.stripeCustomerId!,
            return_url: `${currentAppUrl}/settings`,
          });
          return { url: session.url };
        } else {
          // Subscription is canceled OR belongs to another customer/env
          console.log(
            `🧹 Cleaning up stale/foreign subscription ${org.stripeSubscriptionId} for org ${organizationId}.`,
          );
          await this.organizationService.processDowngrade(organizationId);
        }
      } catch (error: any) {
        // Broaden the check for the "No such subscription" error
        const isNotFound =
          error.code === 'resource_missing' ||
          (error.message &&
            error.message.toLowerCase().includes('no such subscription')) ||
          error.statusCode === 404;

        if (isNotFound) {
          console.warn(
            `⚠️ Subscription ${org.stripeSubscriptionId} not found in Stripe. Cleaning up org ${organizationId}.`,
          );
          await this.organizationService.processDowngrade(organizationId);
          // Continue to create a new session
        } else {
          console.error(
            `❌ Unexpected Stripe error during retrieve for org ${organizationId}:`,
            error,
          );
          throw error;
        }
      }
    }

    const priceId =
      plan === 'pro'
        ? this.configService.get('STRIPE_PRO_PRICE_ID')
        : this.configService.get('STRIPE_ENTERPRISE_PRICE_ID');

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      subscription_data: {
        metadata: {
          organizationId: organizationId.toString(),
          userId: userId?.toString() || '',
          userEmail: userEmail || '',
          appUrl:
            this.configService.get('DASHBOARD_URL') ||
            this.configService.get('APP_URL') ||
            this.configService.get('FRONTEND_URL') ||
            '',
          plan,
        },
        trial_period_days:
          trialPeriodDays ??
          (parseInt(
            this.configService.get('STRIPE_TRIAL_PERIOD_DAYS', '0'),
            10,
          ) ||
            undefined),
      },
      success_url: `${this.configService.get('DASHBOARD_URL') || this.configService.get('APP_URL') || this.configService.get('FRONTEND_URL')}/settings?success=true`,
      cancel_url: `${this.configService.get('DASHBOARD_URL') || this.configService.get('APP_URL') || this.configService.get('FRONTEND_URL')}/settings?canceled=true`,
      metadata: {
        organizationId: organizationId.toString(),
        userId: userId?.toString() || '',
        userEmail: userEmail || '',
        appUrl:
          this.configService.get('APP_URL') ||
          this.configService.get('FRONTEND_URL') ||
          '',
        plan,
      },
    } as any);

    return { url: session.url };
  }

  async createBillingPortalSession(customerId: string) {
    const currentAppUrl =
      this.configService.get('APP_URL') ||
      this.configService.get('FRONTEND_URL');
    const session = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${currentAppUrl}/settings`,
    });

    return { url: session.url };
  }

  async upgradeSubscription(
    organizationId: number,
    plan: 'pro' | 'enterprise',
  ) {
    const org = await this.organizationService.findOne(organizationId);
    if (!org || !org.stripeSubscriptionId || !org.stripeCustomerId) {
      throw new Error('Organization has no active subscription to upgrade');
    }

    const priceId =
      plan === 'pro'
        ? this.configService.get('STRIPE_PRO_PRICE_ID')
        : this.configService.get('STRIPE_ENTERPRISE_PRICE_ID');

    let subscription;
    const currentSubId = org.stripeSubscriptionId;
    const currentAppUrl =
      this.configService.get('DASHBOARD_URL') ||
      this.configService.get('FRONTEND_URL');

    try {
      subscription = await this.stripe.subscriptions.retrieve(currentSubId);
      const subAppUrl = subscription.metadata?.appUrl;
      const subCustomerId =
        typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer.id;

      // Verify its our subscription and it belongs to this customer
      if (
        subCustomerId !== org.stripeCustomerId ||
        (subAppUrl && subAppUrl !== currentAppUrl)
      ) {
        console.warn(
          `⚠️ Found foreign/misaligned subscription ${currentSubId} (Env: ${subAppUrl}). Cleaning up.`,
        );
        await this.organizationService.processDowngrade(organizationId);
        return this.createCheckoutSession(organizationId, plan);
      }
    } catch (error: any) {
      const isNotFound =
        error.code === 'resource_missing' ||
        (error.message &&
          error.message.toLowerCase().includes('no such subscription')) ||
        error.statusCode === 404;

      if (isNotFound) {
        console.warn(
          `⚠️ Found stale subscription ID ${currentSubId} during upgrade. Redirecting to fresh checkout.`,
        );
        await this.organizationService.processDowngrade(organizationId);
        // Redirect to a new checkout session. We don't have the userId here, but the session creation handles it.
        return this.createCheckoutSession(organizationId, plan);
      }
      throw error;
    }

    const currentPriceId = subscription.items.data[0].price.id;
    const subItemId = subscription.items.data[0].id;

    // Plan hierarchy for comparison
    const planLevels = { free: 0, pro: 1, enterprise: 2 };
    const currentPlan = this.getPlanFromPriceId(currentPriceId);
    const targetPlan = plan;

    const isUpgrade = planLevels[targetPlan] > planLevels[currentPlan];

    if (isUpgrade) {
      // Use confirmation flow for immediate upgrades (pre-selected and confirmed in Stripe)
      const session = await this.stripe.billingPortal.sessions.create({
        customer: org.stripeCustomerId,
        return_url: `${this.configService.get('DASHBOARD_URL') || this.configService.get('FRONTEND_URL')}/settings?success=true`,
        flow_data: {
          type: 'subscription_update_confirm',
          subscription_update_confirm: {
            subscription: org.stripeSubscriptionId,
            items: [
              {
                id: subItemId,
                price: priceId,
                quantity: 1,
              },
            ],
          },
        },
      });
      return { url: session.url };
    } else {
      // Use standard update flow for downgrades.
      // This redirects to the plan selection page where the user can choose 'Pro'.
      // Because of the 'Downgrade at end of period' setting in Stripe Dashboard,
      // Stripe will automatically schedule the change for the end of the billing cycle
      // and keep the current plan active until then.
      const session = await this.stripe.billingPortal.sessions.create({
        customer: org.stripeCustomerId,
        return_url: `${this.configService.get('DASHBOARD_URL') || this.configService.get('FRONTEND_URL')}/settings?success=true`,
        flow_data: {
          type: 'subscription_update',
          subscription_update: {
            subscription: org.stripeSubscriptionId,
          },
        },
      });
      return { url: session.url };
    }
  }

  private getPlanFromPriceId(priceId: string): 'pro' | 'enterprise' | 'free' {
    const proId = this.configService.get('STRIPE_PRO_PRICE_ID');
    const enterpriseId = this.configService.get('STRIPE_ENTERPRISE_PRICE_ID');

    console.log(`🔍 Mapping priceId: ${priceId}`);
    console.log(`🔍 Pro ID from config: ${proId}`);
    console.log(`🔍 Enterprise ID from config: ${enterpriseId}`);

    if (priceId && priceId === proId) return 'pro';
    if (priceId && priceId === enterpriseId) return 'enterprise';

    console.warn(
      `⚠️ Unrecognized priceId: ${priceId}. Falling back to 'free' mapping, but check your .env!`,
    );
    return 'free';
  }

  async handleWebhook(signature: string, payload: Buffer) {
    const webhookSecret = this.configService.get('STRIPE_WEBHOOK_SECRET');

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret,
      );
    } catch (err) {
      throw new Error(`Webhook signature verification failed: ${err.message}`);
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object);
        break;
    }

    return { received: true };
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    if (!session.metadata) {
      console.warn('⚠️  No metadata in checkout session');
      return;
    }

    const currentAppUrl =
      this.configService.get('DASHBOARD_URL') ||
      this.configService.get('FRONTEND_URL');
    const sessionAppUrl = session.metadata.appUrl;

    if (sessionAppUrl && sessionAppUrl !== currentAppUrl) {
      console.log(
        `ℹ️ Ignoring checkout session for different environment: ${sessionAppUrl}`,
      );
      return;
    }

    const organizationId = parseInt(session.metadata.organizationId);
    const plan = session.metadata.plan as 'pro' | 'enterprise';

    const org = await this.organizationService.findOne(organizationId);
    if (!org) {
      console.warn(
        `⚠️ Organization ${organizationId} not found during checkout.completed. Skipping.`,
      );
      return;
    }

    const customerId =
      typeof session.customer === 'string'
        ? session.customer
        : session.customer?.id;
    const subscriptionId =
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id;

    // Update organization with Stripe customer ID and subscription
    await this.organizationService.updatePlan(organizationId, plan);

    if (customerId && subscriptionId) {
      await this.organizationService.updateStripeData(
        organizationId,
        customerId,
        subscriptionId,
      );
    }

    const userId = session.metadata.userId;
    const userEmail = session.metadata.userEmail;
    console.log(
      `✅ Subscription activated for organization ${organizationId} (User: ${userEmail || userId || 'unknown'}): ${plan} with sub ${subscriptionId}`,
    );
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    const currentAppUrl =
      this.configService.get('DASHBOARD_URL') ||
      this.configService.get('FRONTEND_URL');
    const subAppUrl = subscription.metadata?.appUrl;

    if (subAppUrl && subAppUrl !== currentAppUrl) {
      console.log(
        `ℹ️ Ignoring subscription update for different environment: ${subAppUrl}`,
      );
      return;
    }

    const userId = subscription.metadata?.userId;
    const userEmail = subscription.metadata?.userEmail;
    console.log(
      `📝 Subscription updated: ${subscription.id} (User: ${userEmail || userId || 'unknown'})`,
    );

    let orgId: number | null = null;
    const orgIdStr = subscription.metadata?.organizationId;

    if (orgIdStr) {
      orgId = parseInt(orgIdStr, 10);
    } else {
      const customerId =
        typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer.id;
      const orgBySub =
        await this.organizationService.findByStripeSubscriptionId(
          subscription.id,
        );
      const org =
        orgBySub ||
        (await this.organizationService.findByStripeCustomerId(customerId));
      if (org) orgId = org.id;
    }

    if (!orgId) {
      console.warn(
        `⚠️ Could not find organization for subscription ${subscription.id}`,
      );
      return;
    }

    try {
      const planId = subscription.items.data[0]?.price.id || '';
      const plan = this.getPlanFromPriceId(planId);
      console.log(`📝 Detected plan: ${plan} for planId: ${planId}`);

      // Update organization plan if it changed
      const currentOrg = await this.organizationService.getWithStats(orgId);
      if (!currentOrg) {
        console.warn(
          `⚠️ Organization ${orgId} not found during sub update. Skipping.`,
        );
        return;
      }
      console.log(`🏢 Current org plan: ${currentOrg?.plan}`);

      const planLevels: Record<string, number> = {
        free: 0,
        pro: 1,
        beta: 1,
        enterprise: 2,
      };
      const currentLevel = planLevels[currentOrg?.plan || 'free'];
      const newLevel = planLevels[plan];

      if (newLevel > currentLevel) {
        // Upgrade: immediate
        await this.organizationService.updatePlan(
          orgId,
          plan as 'pro' | 'enterprise',
        );
        await this.organizationService.updateSubscriptionStatus(
          orgId,
          false,
          null,
        );
        console.log(
          `🚀 Upgrade applied immediately for organization ${orgId} to ${plan}`,
        );
      } else if (
        newLevel < currentLevel &&
        (subscription.cancel_at_period_end || subscription.cancel_at) &&
        plan !== 'free'
      ) {
        // Downgrade: explicitly scheduled for later
        const periodEnd =
          (subscription as any).current_period_end ||
          subscription.items?.data?.[0]?.current_period_end ||
          subscription.cancel_at ||
          subscription.created;
        const endDate = new Date(periodEnd * 1000);
        await this.organizationService.updateSubscriptionStatus(
          orgId,
          true,
          endDate,
        );
        console.log(
          `⏳ Downgrade scheduled for organization ${orgId}. Staying on ${currentOrg?.plan || 'unknown'} until ${endDate}`,
        );
      } else if (subscription.status === 'active') {
        // Immediate change (or same level update, or manual override)
        if (currentOrg?.plan !== plan && plan !== 'free') {
          await this.organizationService.updatePlan(orgId, plan);
          console.log(
            `🔄 Plan updated (Immediate/Manual) for organization ${orgId} to ${plan}`,
          );
        }
        await this.organizationService.updateSubscriptionStatus(
          orgId,
          false,
          null,
        );
      }

      await this.subscriptionService.upsertSubscription({
        stripeSubscriptionId: subscription.id,
        stripeCustomerId:
          typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer.id,
        status: subscription.status,
        planId: planId,
        currentPeriodStart: new Date(
          ((subscription as any).current_period_start ||
            subscription.items?.data?.[0]?.current_period_start ||
            subscription.created) * 1000,
        ),
        currentPeriodEnd: new Date(
          ((subscription as any).current_period_end ||
            subscription.items?.data?.[0]?.current_period_end ||
            subscription.cancel_at ||
            subscription.created) * 1000,
        ),
        cancelAtPeriodEnd:
          subscription.cancel_at_period_end || !!subscription.cancel_at,
        canceledAt: subscription.canceled_at
          ? new Date(subscription.canceled_at * 1000)
          : null,
        organizationId: orgId,
      });

      if (
        subscription.status === 'canceled' ||
        subscription.status === 'unpaid'
      ) {
        await this.organizationService.processDowngrade(orgId);
      } else if (subscription.cancel_at_period_end || subscription.cancel_at) {
        const periodEnd =
          (subscription as any).current_period_end ||
          subscription.items?.data?.[0]?.current_period_end ||
          subscription.cancel_at ||
          subscription.created;
        const endDate = new Date(periodEnd * 1000);
        await this.organizationService.updateSubscriptionStatus(
          orgId,
          true,
          endDate,
        );
        console.log(
          `⚠️ Subscription set to cancel at ${endDate} for org ${orgId}`,
        );
      }
    } catch (error) {
      console.error(
        `❌ Error processing subscription update for org ${orgId}:`,
        error,
      );
      throw error; // Re-throw to send 500 to Stripe for retry if it's a transient DB issue, but at least we see the log
    }
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    const currentAppUrl =
      this.configService.get('DASHBOARD_URL') ||
      this.configService.get('FRONTEND_URL');
    const subAppUrl = subscription.metadata?.appUrl;

    if (subAppUrl && subAppUrl !== currentAppUrl) {
      console.log(
        `ℹ️ Ignoring subscription deletion for different environment: ${subAppUrl}`,
      );
      return;
    }

    const userId = subscription.metadata?.userId;
    const userEmail = subscription.metadata?.userEmail;
    console.log(
      `❌ Subscription canceled: ${subscription.id} (User: ${userEmail || userId || 'unknown'})`,
    );

    let orgId: number | null = null;
    const orgIdStr = subscription.metadata?.organizationId;

    if (orgIdStr) {
      orgId = parseInt(orgIdStr, 10);
    } else {
      const customerId =
        typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer.id;
      const orgBySub =
        await this.organizationService.findByStripeSubscriptionId(
          subscription.id,
        );
      const org =
        orgBySub ||
        (await this.organizationService.findByStripeCustomerId(customerId));
      if (org) orgId = org.id;
    }

    if (orgId) {
      const planId = subscription.items.data[0]?.price.id || '';
      await this.subscriptionService.upsertSubscription({
        stripeSubscriptionId: subscription.id,
        stripeCustomerId:
          typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer.id,
        status: subscription.status,
        planId: planId,
        currentPeriodStart: new Date(
          ((subscription as any).current_period_start ||
            subscription.items?.data?.[0]?.current_period_start ||
            subscription.created) * 1000,
        ),
        currentPeriodEnd: new Date(
          ((subscription as any).current_period_end ||
            subscription.items?.data?.[0]?.current_period_end ||
            subscription.cancel_at ||
            subscription.created) * 1000,
        ),
        cancelAtPeriodEnd:
          subscription.cancel_at_period_end || !!subscription.cancel_at,
        canceledAt: subscription.canceled_at
          ? new Date(subscription.canceled_at * 1000)
          : null,
        organizationId: orgId,
      });

      await this.organizationService.processDowngrade(orgId);
      console.log(
        `🔽 Organization ${orgId} downgraded to Free with quota check.`,
      );
    }
  }
}
