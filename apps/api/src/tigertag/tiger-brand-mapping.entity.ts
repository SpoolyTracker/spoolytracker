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
import { FilamentBrand } from '../filament/brand.entity';
import { Organization } from '../organization/organization.entity';

@Entity('tiger_brand_mappings')
@Index(['tigerId'], { unique: true })
export class TigerBrandMapping {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'tiger_id', type: 'integer' })
  tigerId: number;

  @Column({ name: 'tiger_name', type: 'varchar', length: 255 })
  tigerName: string;

  @Column({ name: 'brand_id', type: 'integer', nullable: true })
  brandId: number | null;

  @Column({ name: 'organization_id', type: 'integer', nullable: true })
  organizationId: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => FilamentBrand, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'brand_id' })
  brand: FilamentBrand;

  @ManyToOne(() => Organization, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;
}
