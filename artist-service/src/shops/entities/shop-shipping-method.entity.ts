import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Shop } from './shop.entity.js';

export enum DeliveryTimeUnit {
  DAYS = 'days',
  WEEKS = 'weeks',
}

@Entity('shop_shipping_methods')
export class ShopShippingMethod {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  shop_id: number;

  /** Nom du mode de livraison (ex : "Lettre suivie", "Colissimo", "Mondial Relay") */
  @Column({ length: 255 })
  name: string;

  /** Zones desservies — stockées en simple-array ("france,europe,world") */
  @Column('simple-array')
  zones: string[];

  /** Délai min estimé */
  @Column({ type: 'int', nullable: true })
  delivery_time_min: number | null;

  /** Délai max estimé */
  @Column({ type: 'int', nullable: true })
  delivery_time_max: number | null;

  /** Unité du délai (jours / semaines) */
  @Column({ type: 'enum', enum: DeliveryTimeUnit, default: DeliveryTimeUnit.DAYS })
  delivery_time_unit: DeliveryTimeUnit;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @ManyToOne(() => Shop, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shop_id' })
  shop: Shop;
}
