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

@Entity('brand')
@Unique(['name', 'organizationId'])
export class FilamentBrand {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  logoUrl: string;

  @Column({ default: false })
  isCustom: boolean;

  @Column({ type: 'integer', nullable: true })
  organizationId: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Organization, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;
}
