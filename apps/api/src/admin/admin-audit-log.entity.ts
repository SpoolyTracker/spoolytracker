import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../auth/user.entity';

@Entity('admin_audit_log')
export class AdminAuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: 'varchar', length: 64 })
  action: string;

  @Index()
  @Column({ type: 'integer' })
  performedById: number;

  @Column({ type: 'varchar', length: 255 })
  performedByUsername: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'performedById' })
  performedBy: User;

  @Column({ type: 'varchar', length: 64, nullable: true })
  targetType: string | null;

  @Column({ type: 'integer', nullable: true })
  targetId: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  targetLabel: string | null;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ipAddress: string | null;

  @Index()
  @CreateDateColumn()
  createdAt: Date;
}
