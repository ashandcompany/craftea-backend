import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  ManyToMany,
  JoinTable,
  JoinColumn,
} from 'typeorm';
import { Category } from '../../categories/entities/category.entity.js';
import { Tag } from '../../tags/entities/tag.entity.js';
import { ProductImage } from './product-image.entity.js';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  shop_id: number;

  @Column({ nullable: true })
  category_id: number;

  @Column({ length: 255, nullable: true })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  price: number;

  @Column({ default: 0 })
  stock: number;

  @Column({ default: true })
  is_active: boolean;

  @Column({ type: 'int', nullable: true })
  processing_time_min: number;

  @Column({ type: 'int', nullable: true })
  processing_time_max: number;

  @Column({ type: 'simple-enum', enum: ['days', 'weeks'], nullable: true })
  processing_time_unit: 'days' | 'weeks';

  /** Override livraison produit — null = utiliser les modes de la boutique */
  @Column({ type: 'int', nullable: true })
  delivery_time_min: number;

  @Column({ type: 'int', nullable: true })
  delivery_time_max: number;

  @Column({ type: 'simple-enum', enum: ['days', 'weeks'], nullable: true })
  delivery_time_unit: 'days' | 'weeks';

  /** Frais de livraison spécifiques au produit (override boutique). null = utiliser les frais boutique */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  shipping_fee: number | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @ManyToOne(() => Category, (cat) => cat.products, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @OneToMany(() => ProductImage, (img) => img.product, { cascade: true })
  images: ProductImage[];

  @ManyToMany(() => Tag, (tag) => tag.products, { cascade: true })
  @JoinTable({
    name: 'product_tags',
    joinColumn: { name: 'product_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'tag_id', referencedColumnName: 'id' },
  })
  tags: Tag[];
}
