import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum PaymentStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  user_id: number;

  @Column({ nullable: true })
  order_id: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'int', default: 0 })
  amount_cents: number;

  @Column({ type: 'int', default: 0 })
  platform_fee_cents: number;

  @Column({ type: 'int', default: 0 })
  artist_amount_cents: number;

  @Column({ nullable: true })
  artist_stripe_account_id?: string;

  @Column({ length: 3, default: 'EUR' })
  currency: string;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @Column({ unique: true })
  idempotency_key: string;

  @Column({ nullable: true })
  stripe_payment_intent_id?: string;

  @Column({ nullable: true, type: 'text' })
  stripe_client_secret?: string;

  @Column({ nullable: true, type: 'text' })
  stripe_receipt_url?: string;

  @Column({ nullable: true, type: 'text' })
  error_detail?: string;

  @Column({ default: false })
  wallet_credited: boolean;

  @Column({ nullable: true, type: 'timestamptz' })
  wallet_credited_at?: Date;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
