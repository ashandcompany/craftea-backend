import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Tracks processed Stripe webhook events for idempotency.
 * Stripe can deliver the same event multiple times — this table
 * ensures we process each event exactly once.
 */
@Entity('processed_webhook_events')
export class ProcessedWebhookEvent {
  /** Stripe event ID (evt_...) */
  @PrimaryColumn({ type: 'varchar', length: 255 })
  stripe_event_id: string;

  /** e.g. payment_intent.succeeded, charge.refunded, etc. */
  @Column({ length: 100 })
  event_type: string;

  @CreateDateColumn({ name: 'processed_at' })
  @Index()
  processed_at: Date;
}
