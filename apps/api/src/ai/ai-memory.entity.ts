import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('ai_memories')
@Index(['organizationId', 'userId', 'type', 'createdAt'])
export class AiMemory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  organizationId: number;

  @Column()
  userId: number;

  @Column({ type: 'varchar', length: 32 })
  type: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  tags: string[];

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
