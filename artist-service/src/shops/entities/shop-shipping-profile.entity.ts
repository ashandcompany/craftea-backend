import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { Shop } from './shop.entity.js';

export enum ShippingZone {
  FRANCE = 'france',
  EUROPE = 'europe',
  WORLD = 'world',
}

@Entity('shop_shipping_profiles')
@Unique(['shop_id', 'zone'])
export class ShopShippingProfile {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  shop_id: number;

  @Column({ type: 'enum', enum: ShippingZone })
  zone: ShippingZone;

  /** Frais de base pour le premier article */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  base_fee: number;

  /** Frais par article supplémentaire de la même boutique */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  additional_item_fee: number;

  /** Seuil de gratuité des frais de port (null = jamais gratuit) */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  free_shipping_threshold: number | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @ManyToOne(() => Shop, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shop_id' })
  shop: Shop;
}
