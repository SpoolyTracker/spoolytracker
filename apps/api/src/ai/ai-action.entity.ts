import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum AiActionType {
  CREATE_CONSUMPTION = 'create_consumption',
  UPDATE_STOCK_THRESHOLD = 'update_stock_threshold',
  CREATE_ALERT = 'create_alert',
  PREPARE_NOTIFICATION = 'prepare_notification',
  PROPOSE_SUPPLIER_ORDER = 'propose_supplier_order',
}

export enum AiActionStatus {
  PROPOSED = 'proposed',
  REJECTED = 'rejected',
  EXECUTED = 'executed',
  FAILED = 'failed',
}

@Entity('ai_actions')
@Index(['organizationId', 'userId', 'status', 'createdAt'])
export class AiAction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  organizationId: number;

  @Column()
  userId: number;

  @Column({ type: 'varchar', length: 64 })
  type: AiActionType;

  @Column({ type: 'varchar', length: 200 })
  label: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, any>;

  @Column({ type: 'varchar', length: 32, default: AiActionStatus.PROPOSED })
  status: AiActionStatus;

  @Column({ type: 'jsonb', nullable: true })
  result: Record<string, any> | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  failureReason: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
