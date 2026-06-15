import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity('filament_mapping_memory')
@Index(['organizationId', 'signatureHash'])
@Unique(['organizationId', 'signatureHash', 'filamentId'])
export class FilamentMappingMemory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  organizationId: number;

  @Column({ type: 'varchar', length: 120, nullable: true })
  sourceMaterial: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  sourceColor: string | null;

  @Column({ type: 'varchar', length: 9, nullable: true })
  sourceColorHex: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  sourceBrand: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  sourcePresetName: string | null;

  @Column({ type: 'varchar', length: 64 })
  signatureHash: string;

  @Column()
  filamentId: number;

  @Column({ type: 'integer', default: 1 })
  usageCount: number;

  @Column({ type: 'timestamp', default: () => 'now()' })
  lastUsedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
