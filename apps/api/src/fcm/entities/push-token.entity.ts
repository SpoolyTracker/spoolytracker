import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { User } from '../../auth/user.entity';

@Entity()
export class PushToken {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column()
  token: string;

  @Column({ nullable: true })
  deviceId: string;

  @Column({ nullable: true })
  deviceName: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  lastSeenAt: Date;

  @ManyToOne(() => User, (user) => user.pushTokens, { onDelete: 'CASCADE' })
  user: User;

  @Column()
  userId: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
