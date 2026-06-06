import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Project } from './project.entity';
import { Filament } from '../../filament/filament.entity';

@Entity()
export class ProjectItem {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Project, (project) => project.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: Project;

  @Column()
  projectId: number;

  @ManyToOne(() => Filament, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'filamentId' })
  filament: Filament;

  @Column({ nullable: true })
  filamentId: number;

  @Column({ type: 'text', nullable: true })
  material: string;

  @Column({ type: 'text', nullable: true })
  color: string;

  @Column('float', { default: 0 })
  weight_required_g: number;

  @Column('float', { default: 0 })
  weight_used_g: number;
}
