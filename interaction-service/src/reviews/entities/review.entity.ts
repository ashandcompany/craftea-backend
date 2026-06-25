import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Unique,
  OneToMany,
} from 'typeorm';
import { ReviewImage } from './review-image.entity.js';

@Entity('reviews')
@Unique(['user_id', 'product_id'])
export class Review {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  user_id: number;

  @Column()
  product_id: number;

  @Column({ type: 'int' })
  rating: number;

  @Column({ type: 'text', nullable: true })
  comment: string;

  @OneToMany(() => ReviewImage, (img) => img.review, {
    eager: true,
    cascade: true,
  })
  images: ReviewImage[];

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
