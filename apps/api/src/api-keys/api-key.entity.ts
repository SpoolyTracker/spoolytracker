import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../auth/user.entity';
import { Organization } from '../organization/organization.entity';

@Entity('api_keys')
export class ApiKey {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ unique: true })
  prefix: string;

  @Column({ unique: true })
  keyHash: string;

  @Column({ default: 'orca' })
  scope: string;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  scopes: string[];

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @Column()
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  organizationId: number;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @Column({ type: 'timestamp', nullable: true })
  lastUsedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  revokedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
