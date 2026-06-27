import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Address } from '../../addresses/entities/address.entity.js';
import { Log } from '../../logs/entities/log.entity.js';

export enum UserRole {
  BUYER = 'buyer',
  ARTIST = 'artist',
  ADMIN = 'admin',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.BUYER })
  role: UserRole;

  @Column({ length: 255 })
  firstname: string;

  @Column({ length: 255 })
  lastname: string;

  @Column({ length: 255, unique: true })
  email: string;

  @Column({ length: 255, select: false })
  password: string;

  @Column({ default: true })
  is_active: boolean;

  @Column({ nullable: true, type: 'varchar' })
  avatar_url?: string | null;

  @Column({ nullable: true, type: 'varchar', select: false })
  reset_password_token?: string | null;

  @Column({ nullable: true, type: 'timestamp' })
  reset_password_expires?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @OneToMany(() => Address, (address) => address.user)
  addresses: Address[];

  @OneToMany(() => Log, (log) => log.user)
  logs: Log[];
}
