import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Shop } from '../../shops/entities/shop.entity.js';

@Entity('artist_profiles')
export class ArtistProfile {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  user_id: number;

  @Column({ type: 'text', nullable: true })
  bio: string;

  @Column({ length: 255, nullable: true })
  banner_url: string;

  @Column({ length: 255, nullable: true })
  logo_url: string;

  @Column({ type: 'text', nullable: true })
  social_links: string;

  @Column({ default: false })
  validated: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  stripe_account_id: string | null;

  @Column({ default: false })
  stripe_onboarded: boolean;

  @Column({ type: 'decimal', precision: 12, scale: 0, default: 0 })
  wallet_balance: number;

  @Column({ type: 'decimal', precision: 12, scale: 0, default: 0 })
  pending_balance: number;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @OneToMany(() => Shop, (shop) => shop.artist)
  shops: Shop[];
}
