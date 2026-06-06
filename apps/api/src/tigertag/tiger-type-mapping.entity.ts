import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { FilamentType } from '../filament/filament-type.entity';
import { Organization } from '../organization/organization.entity';

@Entity('tiger_type_mappings')
@Index(['tigerId'], { unique: true })
export class TigerTypeMapping {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'tiger_id', type: 'integer' })
  tigerId: number;

  @Column({ name: 'tiger_name', type: 'varchar', length: 255 })
  tigerName: string;

  @Column({ name: 'type_id', type: 'integer', nullable: true })
  typeId: number | null;

  @Column({ name: 'organization_id', type: 'integer', nullable: true })
  organizationId: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => FilamentType, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'type_id' })
  type: FilamentType;

  @ManyToOne(() => Organization, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;
}
