import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ArtistRequestMessage } from './artist-request-message.entity.js';

export enum ArtistRequestStatus {
  PENDING = 'pending',
  INFO_REQUESTED = 'info_requested',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('artist_requests')
export class ArtistRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  user_id: number;

  @Column({
    type: 'enum',
    enum: ArtistRequestStatus,
    default: ArtistRequestStatus.PENDING,
  })
  status: ArtistRequestStatus;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @OneToMany(() => ArtistRequestMessage, (msg) => msg.request, {
    cascade: true,
  })
  messages: ArtistRequestMessage[];
}
