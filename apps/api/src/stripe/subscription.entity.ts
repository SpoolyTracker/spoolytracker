import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Organization } from '../organization/organization.entity';

@Entity('subscriptions')
export class Subscription {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  stripeSubscriptionId: string; // Stripe Subscription ID (sub_...)

  @Column()
  stripeCustomerId: string;

  @Column()
  status: string; // active, canceled, past_due, trialing, etc.

  @Column()
  planId: string; // Stripe Price ID

  @Column({ type: 'timestamp' })
  currentPeriodStart: Date;

  @Column({ type: 'timestamp' })
  currentPeriodEnd: Date;

  @Column({ default: false })
  cancelAtPeriodEnd: boolean;

  @Column({ type: 'timestamp', nullable: true })
  canceledAt: Date | null;

  @ManyToOne(() => Organization, (organization) => organization.subscriptions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @Column()
  organizationId: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
