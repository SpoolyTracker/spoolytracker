import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Organization } from '../organization/organization.entity';
import { Filament } from './filament.entity';

export type StorageUnitKind = 'shelf' | 'cabinet' | 'display' | 'bin';

@Entity()
@Index(['organizationId', 'tagId'], { unique: true })
export class StorageUnit {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'varchar', nullable: true })
  location: string | null;

  @Column({ type: 'varchar', default: 'shelf' })
  kind: StorageUnitKind;

  @Column({ default: 4 })
  levels: number;

  @Column({ default: 6 })
  slotsPerLevel: number;

  @Column({ type: 'varchar', nullable: true })
  tagId: string | null;

  @Column({ default: false })
  favorite: boolean;

  @ManyToOne(() => Organization, (org) => org.filaments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @Column({ type: 'integer', nullable: true })
  organizationId: number | null;

  @OneToMany(() => Filament, (filament) => filament.storageUnit)
  filaments: Filament[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
