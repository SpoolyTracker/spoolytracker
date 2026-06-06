import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Organization } from '../organization/organization.entity';

@Entity()
export class FilamentOption {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  category: string; // 'finish', 'effect', 'special'

  @Column({ nullable: true })
  description: string;

  @Column({ default: false })
  isCharacteristic: boolean;

  @Column({ type: 'int', nullable: true })
  organizationId: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Organization, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;
}
