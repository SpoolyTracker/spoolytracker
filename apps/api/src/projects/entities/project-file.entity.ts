import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Project } from './project.entity';

export enum ProjectFileType {
  GCODE = 'GCODE',
  IMAGE = 'IMAGE',
  MODEL = 'MODEL',
  OTHER = 'OTHER',
}

@Entity()
export class ProjectFile {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Project, (project) => project.files, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: Project;

  @Column()
  projectId: number;

  @Column({ name: 'file_url', type: 'text', nullable: true })
  file_url: string | null;

  @Column({ name: 'analysis_metadata', type: 'jsonb', nullable: true })
  analysis_metadata: any;

  @Column({
    type: 'simple-enum',
    enum: ProjectFileType,
    default: ProjectFileType.OTHER,
  })
  file_type: ProjectFileType;

  @Column()
  file_name: string;

  @Column({ nullable: true })
  file_size: number;

  @CreateDateColumn()
  uploaded_at: Date;
}
