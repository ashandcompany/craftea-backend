import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ArtistProfile } from './artist-profile.entity.js';

@Entity('artist_verification_documents')
export class ArtistVerificationDocument {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  artist_profile_id: number;

  @ManyToOne(() => ArtistProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'artist_profile_id' })
  artist_profile: ArtistProfile;

  /** URL of the uploaded file (stored in MinIO) */
  @Column({ type: 'varchar', length: 512 })
  file_url: string;

  /** Label given by the artist to this specific file */
  @Column({ type: 'varchar', length: 255, nullable: true })
  name: string | null;

  /** Optional free-text global description (shared across all files of the submission) */
  @Column({ type: 'text', nullable: true })
  description: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
