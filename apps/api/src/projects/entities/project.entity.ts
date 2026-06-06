import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from '../../auth/user.entity';
import { Organization } from '../../organization/organization.entity';
import { ProjectItem } from './project-item.entity';
import { ProjectFile } from './project-file.entity';
import { ConsumptionLog } from '../../filament/consumption-log.entity';

export enum ProjectStatus {
  PLANNING = 'PLANNING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  ARCHIVED = 'ARCHIVED',
}

@Entity()
export class Project {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'simple-enum',
    enum: ProjectStatus,
    default: ProjectStatus.PLANNING,
  })
  status: ProjectStatus;

  @Column('float', { nullable: true })
  global_cost: number; // This can be the cached total or manual override

  @Column('int', { nullable: true })
  print_time_seconds: number;

  @Column('int', { nullable: true, default: 0 })
  labor_time_seconds: number;

  @Column('decimal', {
    precision: 10,
    scale: 2,
    default: 0,
    transformer: { to: (value) => value, from: (value) => parseFloat(value) },
  })
  machine_hourly_rate: number;

  @Column('decimal', {
    precision: 10,
    scale: 2,
    default: 0,
    transformer: { to: (value) => value, from: (value) => parseFloat(value) },
  })
  labor_hourly_rate: number;

  @Column('decimal', {
    precision: 10,
    scale: 2,
    default: 0,
    transformer: { to: (value) => value, from: (value) => parseFloat(value) },
  })
  misc_costs: number;

  @Column({ type: 'timestamp', nullable: true })
  start_date: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  end_date: Date | null;

  @Column({ type: 'text', nullable: true })
  image_url: string;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  target_selling_price: number;

  @Column('decimal', {
    precision: 10,
    scale: 3,
    nullable: true,
    transformer: { to: (value) => value, from: (value) => parseFloat(value) },
  })
  printer_power_kw: number;

  @Column('decimal', {
    precision: 10,
    scale: 3,
    nullable: true,
    transformer: { to: (value) => value, from: (value) => parseFloat(value) },
  })
  electricity_cost_kwh: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column('simple-array', { nullable: true })
  tags: string[];

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'created_by' })
  created_by: User;

  @ManyToOne(() => Organization, (org) => org.projects, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @OneToMany(() => ProjectItem, (item) => item.project, { cascade: true })
  items: ProjectItem[];

  @OneToMany(() => ProjectFile, (file) => file.project, { cascade: true })
  files: ProjectFile[];

  @OneToMany(() => ConsumptionLog, (log) => log.project)
  consumptionLogs: ConsumptionLog[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
