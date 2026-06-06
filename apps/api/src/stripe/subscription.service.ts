import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription } from './subscription.entity';
import { Organization } from '../organization/organization.entity';

@Injectable()
export class SubscriptionService {
  constructor(
    @InjectRepository(Subscription)
    private subscriptionRepository: Repository<Subscription>,
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
  ) {}

  async upsertSubscription(data: Partial<Subscription>): Promise<Subscription> {
    // Look for an existing record with the same Stripe Subscription ID
    const existing = await this.subscriptionRepository.findOne({
      where: {
        stripeSubscriptionId: data.stripeSubscriptionId,
        organizationId: data.organizationId,
      },
    });

    if (existing) {
      // Update existing record (for status changes, plan changes, date extensions)
      Object.assign(existing, data);
      return this.subscriptionRepository.save(existing);
    }

    // If this is a new active subscription, deactivate other active ones for this org
    if (data.status === 'active' && data.organizationId) {
      await this.subscriptionRepository.update(
        { organizationId: data.organizationId, status: 'active' },
        { status: 'superseded' },
      );
    }

    // Create new record
    const subscription = this.subscriptionRepository.create(data);
    return this.subscriptionRepository.save(subscription);
  }

  async getSubscriptionsByOrganization(
    organizationId: number,
  ): Promise<Subscription[]> {
    // Repair logic: if organization is Free, history shouldn't have "active" items
    const org = await this.organizationRepository.findOne({
      where: { id: organizationId },
    });
    if (org && org.plan === 'free') {
      await this.subscriptionRepository.update(
        { organizationId, status: 'active' },
        { status: 'canceled', canceledAt: new Date() },
      );
    }

    return this.subscriptionRepository.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
  }
}
