import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ArtistRequest } from './artist-request.entity.js';

@Entity('artist_request_messages')
export class ArtistRequestMessage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  request_id: number;

  @ManyToOne(() => ArtistRequest, (r) => r.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'request_id' })
  request: ArtistRequest;

  @Column({ type: 'varchar', length: 10 })
  sender_role: 'user' | 'admin';

  @Column()
  sender_id: number;

  @Column({ type: 'text' })
  content: string;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
