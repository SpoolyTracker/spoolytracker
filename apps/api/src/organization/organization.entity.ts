import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Filament } from '../filament/filament.entity';
import { Project } from '../projects/entities/project.entity';
import { UserOrganization } from './user-organization.entity';
import { Subscription } from '../stripe/subscription.entity';

@Entity()
export class Organization {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  slug: string; // acme-corp

  @Column()
  name: string; // Acme Corporation

  @Column({ type: 'text', nullable: true })
  logo: string | null;

  @Column({ default: 'free' })
  plan: 'free' | 'pro' | 'enterprise' | 'beta';

  @Column({ type: 'timestamp', nullable: true })
  manualPlanEndDate: Date | null;

  @Column({ type: 'varchar', nullable: true })
  stripeCustomerId: string | null;

  @Column({ type: 'varchar', nullable: true })
  stripeSubscriptionId: string | null;

  @Column({ type: 'timestamp', nullable: true })
  stripeSubscriptionEndDate: Date | null;

  @Column({ default: false })
  isStripeSubscriptionCanceled: boolean;

  @Column({ type: 'timestamp', nullable: true })
  trialEndsAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  settings: {
    maxFilaments?: number;
    maxUsers?: number;
    features?: string[];
    lowStockThreshold?: number;
    lowStockThresholdType?: 'GRAMS' | 'PERCENTAGE';
  };

  @OneToMany(() => Filament, (filament) => filament.organization)
  filaments: Filament[];

  @OneToMany(() => Project, (project) => project.organization)
  projects: Project[];

  @Column({ default: false })
  requiresQuotaSelection: boolean;

  @OneToMany(() => UserOrganization, (uo) => uo.organization)
  userOrganizations: UserOrganization[];

  @OneToMany(() => Subscription, (sub) => sub.organization)
  subscriptions: Subscription[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
