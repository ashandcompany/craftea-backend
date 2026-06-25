import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum WalletTransactionType {
  CREDIT = 'credit',
  DEBIT = 'debit',
}

export enum WalletTransactionStatus {
  AVAILABLE = 'available',
  PENDING = 'pending',
  PAID = 'paid',
}

@Entity('wallet_transactions')
@Index('uq_wallet_credit_artist_order', ['artist_id', 'order_id', 'type'], {
  unique: true,
})
export class WalletTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  artist_id: number;

  @Column({ nullable: true })
  order_id?: number;

  @Column({ type: 'int' })
  amount_cents: number;

  @Column({ type: 'enum', enum: WalletTransactionType })
  type: WalletTransactionType;

  @Column({ type: 'enum', enum: WalletTransactionStatus })
  status: WalletTransactionStatus;

  @Column()
  description: string;

  @Column({ nullable: true })
  stripe_transfer_id?: string;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
