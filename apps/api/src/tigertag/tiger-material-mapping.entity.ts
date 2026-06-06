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
import { FilamentMaterial } from '../filament/filament-material.entity';
import { Organization } from '../organization/organization.entity';

@Entity('tiger_material_mappings')
@Index(['tigerId'], { unique: true })
export class TigerMaterialMapping {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'tiger_id', type: 'integer' })
  tigerId: number;

  @Column({ name: 'tiger_name', type: 'varchar', length: 255 })
  tigerName: string;

  @Column({ name: 'material_id', type: 'integer', nullable: true })
  materialId: number | null;

  @Column({ name: 'organization_id', type: 'integer', nullable: true })
  organizationId: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => FilamentMaterial, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'material_id' })
  material: FilamentMaterial;

  @ManyToOne(() => Organization, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;
}
