import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type PayoutStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'NEEDS_RETRY';

@Entity({ name: 'payouts' })
export class PayoutEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'merchant_id', type: 'text' })
  merchantId!: string;

  @Column({ type: 'numeric', precision: 20, scale: 2 })
  amount!: string;

  @Column({ type: 'text' })
  currency!: 'NGN' | 'USD';

  @Column({ type: 'text' })
  status!: PayoutStatus;

  @Column({ name: 'failure_reason', type: 'text', nullable: true })
  failureReason!: string | null;

  @Column({ name: 'external_reference', type: 'text', nullable: true })
  externalReference!: string | null;

  @Column({ name: 'attempt_count', type: 'int', default: 0 })
  attemptCount!: number;

  @Index()
  @Column({ name: 'next_retry_at', type: 'timestamptz', nullable: true })
  nextRetryAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
