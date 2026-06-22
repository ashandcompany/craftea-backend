import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  OneToMany,
} from 'typeorm';
import { Message } from './message.entity.js';

@Entity('conversations')
@Unique(['buyer_id', 'artist_id'])
export class Conversation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  buyer_id: number;

  /** user_id (not artist_profile_id) de l'artisan */
  @Column()
  artist_id: number;

  @OneToMany(() => Message, (m) => m.conversation, { eager: false })
  messages: Message[];

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
