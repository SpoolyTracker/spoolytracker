import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StripeService } from './stripe.service';
import { StripeController } from './stripe.controller';
import { OrganizationModule } from '../organization/organization.module';
import { Subscription } from './subscription.entity';
import { SubscriptionService } from './subscription.service';

import { Organization } from '../organization/organization.entity';

@Module({
  imports: [
    OrganizationModule,
    TypeOrmModule.forFeature([Subscription, Organization]),
  ],
  providers: [StripeService, SubscriptionService],
  controllers: [StripeController],
  exports: [StripeService, SubscriptionService],
})
export class StripeModule {}
