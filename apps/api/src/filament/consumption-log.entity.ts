import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Filament } from './filament.entity';
import { Project } from '../projects/entities/project.entity';

export enum ConsumptionType {
  MANUAL = 'MANUAL',
  PRINT = 'PRINT',
  FAIL = 'FAIL', // Legacy
}

export enum PrintStatus {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

@Entity()
export class ConsumptionLog {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Filament, (filament) => filament.consumptionLogs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'filamentId' })
  filament: Filament;

  @Column()
  filamentId: number;

  @Column('float')
  amount: number; // Amount consumed (or added if negative, though usually positive for consumption)

  @Column({
    type: 'enum',
    enum: ConsumptionType,
    default: ConsumptionType.MANUAL,
  })
  type: ConsumptionType;

  @Column({ nullable: true })
  notes: string;

  @CreateDateColumn()
  date: Date;

  @ManyToOne(() => Project, (project) => project.consumptionLogs, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'projectId' })
  project: Project;

  @Column({ nullable: true })
  projectId: number;

  @Column({ nullable: true })
  externalJobId: string;

  @Column({ default: false })
  is_planned: boolean;

  @Column({ nullable: true })
  printTaskId: string;

  @Column({
    type: 'enum',
    enum: PrintStatus,
    nullable: true,
  })
  printStatus: PrintStatus;

  @Column('float', { nullable: true })
  plannedPrintAmount: number | null;

  @Column('float', { nullable: true })
  failureProgressPercent: number | null;
}
