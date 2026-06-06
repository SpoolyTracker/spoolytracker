import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { FilamentBrand } from './brand.entity';
import { FilamentMaterial } from './filament-material.entity';
import { FilamentType } from './filament-type.entity';
import { Organization } from '../organization/organization.entity';

@Entity('filament_color_reference')
@Index(['brandId', 'materialId', 'typeId', 'organizationId'])
export class FilamentColorReference {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'brand_id' })
  brandId: number;

  @Column({ name: 'material_id', nullable: true })
  materialId: number | null;

  @Column({ name: 'type_id', nullable: true })
  typeId: number | null;

  @Column({ name: 'organization_id', nullable: true })
  organizationId: number | null;

  @Column()
  name: string;

  @Column({ name: 'primary_hex' })
  primaryHex: string;

  @Column('simple-array', { nullable: true })
  hexes: string[] | null;

  @Column({ default: 'manual' })
  source: 'manual' | 'spoolman';

  @Column({ name: 'source_external_id', type: 'varchar', nullable: true })
  sourceExternalId: string | null;

  @Column({ type: 'varchar', nullable: true })
  finish: string | null;

  @Column({ type: 'varchar', nullable: true })
  pattern: string | null;

  @Column({ type: 'varchar', nullable: true })
  multiColorDirection: string | null;

  @Column({ type: 'boolean', nullable: true })
  translucent: boolean | null;

  @Column({ type: 'boolean', nullable: true })
  glow: boolean | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => FilamentBrand, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'brand_id' })
  brand: FilamentBrand;

  @ManyToOne(() => FilamentMaterial, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'material_id' })
  material: FilamentMaterial | null;

  @ManyToOne(() => FilamentType, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'type_id' })
  type: FilamentType | null;

  @ManyToOne(() => Organization, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization | null;
}
