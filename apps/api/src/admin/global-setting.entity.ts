import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('global_settings')
export class GlobalSetting {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  key: string;

  @Column({ type: 'text' })
  value: string;

  @Column({ nullable: true })
  description: string;

  @UpdateDateColumn()
  updatedAt: Date;
}
