import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Project } from './project.entity';

@Entity()
export class ProjectExternalItem {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Project, (project) => project.externalItems, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'projectId' })
  project: Project;

  @Column()
  projectId: number;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text', nullable: true })
  external_ref: string | null;

  @Column({ type: 'text', nullable: true })
  source: string | null;

  @Column({ type: 'text', nullable: true })
  url: string | null;

  @Column('decimal', {
    precision: 10,
    scale: 2,
    default: 0,
    transformer: { to: (value) => value, from: (value) => parseFloat(value) },
  })
  unit_price: number;

  @Column('decimal', {
    precision: 10,
    scale: 3,
    default: 1,
    transformer: { to: (value) => value, from: (value) => parseFloat(value) },
  })
  quantity: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
