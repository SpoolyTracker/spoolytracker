import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../auth/user.entity';

@Entity('user_notification_preferences')
export class UserNotificationPreference {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @OneToOne(() => User, (user) => user.notificationPreferences, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ default: true })
  notifyOnSystem: boolean;

  @Column({ default: true })
  notifyOnNewSpool: boolean;

  @Column({ default: true })
  notifyOnConsumption: boolean;

  @Column({ default: true })
  notifyOnLowStock: boolean;

  @Column({ default: true })
  notifyOnInvitation: boolean;

  @Column({ default: true })
  notifyOnAiRupture: boolean;

  @Column({ default: true })
  notifyOnAiAchat: boolean;

  @Column({ default: true })
  notifyOnAiProjet: boolean;
}
