import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { UserOrganization } from '../organization/user-organization.entity';
import { Project } from '../projects/entities/project.entity';
import { UserNotificationPreference } from '../notification/user-notification-preference.entity';
import { PushToken } from '../fcm/entities/push-token.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  username: string;

  @Column({ nullable: true })
  displayName: string;

  @Exclude()
  @Column({ nullable: true })
  password: string;

  @Column({ type: 'varchar', unique: true, nullable: true })
  googleId: string | null;

  @Column({ type: 'varchar', unique: true, nullable: true })
  appleId: string | null;

  @Column({ nullable: true })
  firstName: string;

  @Column({ nullable: true })
  lastName: string;

  @Column({ nullable: true })
  email: string;

  @Column({ default: false })
  isActive: boolean;

  @Column({
    type: 'enum',
    enum: ['super_admin', 'admin', 'moderator', 'user'],
    default: 'user',
  })
  systemRole: 'super_admin' | 'admin' | 'moderator' | 'user';

  @Column({ default: false })
  isSuperAdmin: boolean; // Kept for backward compatibility, sync with systemRole='super_admin'

  @Column({ default: false })
  isEmailVerified: boolean;

  @Column({ default: false })
  introSeen: boolean;

  @Exclude()
  @Column({ nullable: true })
  verificationToken: string;

  @Exclude()
  @Column({ type: 'varchar', nullable: true })
  resetPasswordToken: string | null;

  @Column({ type: 'timestamp', nullable: true })
  resetPasswordExpires: Date | null;

  @OneToMany(() => UserOrganization, (userOrg) => userOrg.user)
  userOrganizations: UserOrganization[];

  @Column({ nullable: true })
  lastLoginAt: Date;

  @Column({ type: 'int', default: 0 })
  failedLoginAttempts: number;

  @Column({ type: 'timestamp', nullable: true })
  loginLockedUntil: Date | null;

  @Column({ type: 'int', nullable: true })
  activeOrganizationId: number | null;

  @OneToMany(() => PushToken, (token) => token.user)
  pushTokens: PushToken[];

  @OneToOne(
    () => UserNotificationPreference,
    (prefs: UserNotificationPreference) => prefs.user,
    { cascade: true },
  )
  notificationPreferences: UserNotificationPreference;

  @Column({ nullable: true })
  stripeCustomerId: string;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => Project, (project) => project.created_by)
  projects: Project[];
}
