import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  ManyToMany,
  JoinTable,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  JoinColumn,
} from 'typeorm';
import { Organization } from '../organization/organization.entity';
import { FilamentBrand } from './brand.entity';
import { FilamentMaterial } from './filament-material.entity';
import { FilamentType } from './filament-type.entity';
import { FilamentOption } from './filament-option.entity';
import { ConsumptionLog } from './consumption-log.entity';
import { FilamentColorReference } from './filament-color-reference.entity';
import { StorageUnit } from './storage-unit.entity';

@Entity()
export class Filament {
  @PrimaryGeneratedColumn()
  id: number;

  // Relations for brand and type
  @ManyToOne(() => FilamentBrand, { eager: true })
  @JoinColumn({ name: 'brandId' })
  brand: FilamentBrand | null;

  @Column({ nullable: true })
  brandId: number;

  @ManyToOne(() => FilamentMaterial, { eager: true })
  @JoinColumn({ name: 'materialId' })
  material: FilamentMaterial | null;

  @Column({ nullable: true })
  materialId: number;

  @ManyToMany(() => FilamentType, { eager: true })
  @JoinTable({
    name: 'filament_types', // Junction table name
    joinColumn: { name: 'filamentId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'typeId', referencedColumnName: 'id' },
  })
  types: FilamentType[];

  // Old Many-to-many relation for options (Legacy/Other options)
  @ManyToMany(() => FilamentOption, { eager: true })
  @JoinTable({
    name: 'filament_options',
    joinColumn: { name: 'filamentId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'optionId', referencedColumnName: 'id' },
  })
  options: FilamentOption[];

  @Column({ name: 'isLocked', default: false })
  isLocked: boolean;

  @Column('float', { name: 'planned_weight', default: 0 })
  plannedWeight: number;

  @Column('float', { name: 'virtual_weight_remaining', nullable: true })
  virtualWeightRemaining: number;

  // Direct Mapping IDs for easier sync
  @Column({ name: 'tigerBrandId', nullable: true })
  tigerBrandId: number;

  @Column({ name: 'tigerMaterialId', nullable: true })
  tigerMaterialId: number;

  @Column({ name: 'tigerTypeId', nullable: true })
  tigerTypeId: number;

  @Column()
  color: string;

  @Column({ nullable: true })
  colorHex: string;

  @Column({ nullable: true })
  colorName: string;

  @Column('simple-array', { nullable: true })
  colors: string[];

  @Column({ nullable: true })
  colorReferenceId: number;

  @ManyToOne(() => FilamentColorReference, { nullable: true })
  @JoinColumn({ name: 'colorReferenceId' })
  colorReference: FilamentColorReference | null;

  @Column('float')
  weightInitial: number;

  @Column('float')
  weightRemaining: number;

  @Column({ nullable: true })
  nfcTagId: string;

  // TigerTag fields
  @Column({ nullable: true })
  tigerTagVersion: number;

  @Column({ nullable: true })
  productId: number;

  @Column({ nullable: true })
  diameter: number;

  @Column({ nullable: true })
  aspectId1: number;

  @Column({ nullable: true })
  aspectId2: number;

  @Column({ nullable: true })
  unitId: number;

  @Column({ nullable: true })
  transmissionDistance: number;

  @Column({ nullable: true, type: 'bigint' })
  timestamp: number;

  @Column({ nullable: true, type: 'text' })
  rawNfcData: string;

  // Inventory Fields
  @Column({ nullable: true })
  purchaseDate: Date;

  @Column({ nullable: true, type: 'float' })
  price: number;

  @Column({ nullable: true })
  vendor: string;

  @Column({ default: false })
  isRefill: boolean;

  @Column({ default: false })
  favorite: boolean;

  @Column({ nullable: true })
  spoolReference: string;

  @ManyToOne(() => StorageUnit, (storageUnit) => storageUnit.filaments, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'storageUnitId' })
  storageUnit: StorageUnit | null;

  @Column({ type: 'integer', nullable: true })
  storageUnitId: number | null;

  @Column({ type: 'integer', nullable: true })
  storageLevel: number | null;

  @Column({ type: 'integer', nullable: true })
  storageSlot: number | null;

  // Technical Specs
  @Column({ nullable: true })
  nozzleTempMin: number;

  @Column({ nullable: true })
  nozzleTempMax: number;

  @Column({ nullable: true })
  bedTempMin: number;

  @Column({ nullable: true })
  bedTempMax: number;

  @Column({ nullable: true })
  bedTemp: number;

  @Column({ nullable: true })
  chamberTempMin: number;

  @Column({ nullable: true })
  chamberTempMax: number;

  @Column({ nullable: true })
  dryTemp: number;

  @Column({ nullable: true })
  dryTime: number;

  @Column({ nullable: true })
  printSpeedMin: number;

  @Column({ nullable: true })
  printSpeedMax: number;

  @Column('float', { nullable: true })
  retractionDistanceMm: number;

  @Column('float', { nullable: true })
  retractionSpeedMmS: number;

  @Column('float', { nullable: true })
  retractionZHopMm: number;

  @Column({ nullable: true, type: 'text' })
  retractionNotes: string;

  @Column({ type: 'simple-json', nullable: true })
  conditionalTemperatureRules: Array<{
    speedMinMmS?: number | null;
    speedMaxMmS?: number | null;
    nozzleTempMin?: number | null;
    nozzleTempMax?: number | null;
    notes?: string | null;
  }>;

  @Column('float', { nullable: true })
  kFactor: number;

  @Column('float', { nullable: true, default: 1.24 })
  densityGcm3: number;

  @Column('float', { nullable: true, default: 1.75 })
  diameterMm: number;

  @Column('float', { nullable: true })
  lowStockThreshold: number;

  @Column({ type: 'varchar', default: 'GRAMS' })
  lowStockThresholdType: 'GRAMS' | 'PERCENTAGE';

  // Multi-tenancy
  @ManyToOne(() => Organization, (org) => org.filaments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @Column({ nullable: true })
  organizationId: number;

  @OneToMany(() => ConsumptionLog, (log) => log.filament)
  consumptionLogs: ConsumptionLog[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deletedAt' })
  deletedAt: Date;
}
