import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Unique,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Organization } from '../organization/organization.entity';

@Entity({ name: 'filament_real_type' })
@Unique(['name', 'organizationId'])
export class FilamentType {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'integer', nullable: true })
  organizationId: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Organization, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;
}
