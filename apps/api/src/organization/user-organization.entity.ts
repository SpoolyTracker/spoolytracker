import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../auth/user.entity';
import { Organization } from './organization.entity';

@Entity('user_organizations')
export class UserOrganization {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column()
  organizationId: number;

  @Column({ default: true })
  hasConfirmed: boolean;

  @Column({
    type: 'enum',
    enum: ['owner', 'admin', 'member'],
    default: 'member',
  })
  role: 'owner' | 'admin' | 'member';

  @ManyToOne(() => User, (user) => user.userOrganizations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  joinedAt: Date;
}
