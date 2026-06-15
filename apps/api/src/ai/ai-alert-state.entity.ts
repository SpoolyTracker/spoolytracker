import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

@Entity('ai_alert_state')
@Unique('UQ_ai_alert_state_org_key', ['organizationId', 'alertKey'])
export class AiAlertState {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  organizationId: number;

  @Column()
  alertKey: string;

  @Column()
  severity: string;

  @UpdateDateColumn()
  lastSentAt: Date;
}
