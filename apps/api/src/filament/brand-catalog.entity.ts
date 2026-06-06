import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { FilamentBrand } from './brand.entity';
import { FilamentMaterial } from './filament-material.entity';
import { FilamentType } from './filament-type.entity';
import { Organization } from '../organization/organization.entity';

@Entity('brand_catalog')
export class BrandCatalog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'brand_id' })
  brandId: number;

  @Column({ name: 'material_id' })
  materialId: number;

  @Column({ name: 'type_id' })
  typeId: number;

  @Column({ name: 'organization_id', nullable: true })
  organizationId: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => FilamentBrand)
  @JoinColumn({ name: 'brand_id' })
  brand: FilamentBrand;

  @ManyToOne(() => FilamentMaterial)
  @JoinColumn({ name: 'material_id' })
  material: FilamentMaterial;

  @ManyToOne(() => FilamentType)
  @JoinColumn({ name: 'type_id' })
  type: FilamentType;

  @ManyToOne(() => Organization, { nullable: true })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  // Technical Specs (from SpoolmanDB)
  @Column('float', { nullable: true })
  density_gcm3: number; // Density in g/cm3

  @Column({ nullable: true })
  nozzle_temp_min: number;

  @Column({ nullable: true })
  nozzle_temp_max: number;

  @Column({ nullable: true })
  bed_temp_min: number;

  @Column({ nullable: true })
  bed_temp_max: number;

  @Column({ default: true })
  isActive: boolean;
}
