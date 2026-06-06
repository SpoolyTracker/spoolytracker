import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, IsNull } from 'typeorm';
import { Organization } from './organization.entity';
import { OrganizationService } from './organization.service';

@Injectable()
export class OrganizationScheduler {
  private readonly logger = new Logger(OrganizationScheduler.name);

  constructor(
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    private readonly organizationService: OrganizationService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleExpiredManualPlans() {
    this.logger.debug('Checking for expired manual plans...');

    const expiredOrgs = await this.organizationRepository.find({
      where: {
        manualPlanEndDate: LessThanOrEqual(new Date()),
      },
    });

    let downgradedCount = 0;
    if (expiredOrgs.length > 0) {
      for (const org of expiredOrgs) {
        // Skip if organization has a genuinely active Stripe subscription
        if (org.stripeSubscriptionId) {
          const isStripeExpired =
            org.stripeSubscriptionEndDate &&
            org.stripeSubscriptionEndDate <= new Date();
          if (!isStripeExpired) {
            continue; // Stripe subscription is still actively overriding
          }
        }

        if (org.plan !== 'free') {
          // updatePlan will handle broadcast and clearing manualPlanEndDate
          await this.organizationService.updatePlan(org.id, 'free');
          downgradedCount++;
          this.logger.log(
            `Downgraded organization ${org.id} (${org.name}) to free due to manual plan expiration.`,
          );
        } else {
          // Just clear the date if they are already free
          await this.organizationService.updatePlan(org.id, 'free');
        }
      }
      if (downgradedCount > 0) {
        this.logger.log(
          `Found and downgraded ${downgradedCount} organizations with expired manual plans.`,
        );
      }
    }
  }
}
