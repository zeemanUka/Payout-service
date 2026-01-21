import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type PayoutRequestStatus = 'CREATED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED_FINAL';

@Entity({ name: 'payout_requests' })
@Index(['merchantId', 'idempotencyKey'], { unique: true })
export class PayoutRequestEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'merchant_id', type: 'text' })
  merchantId!: string;

  @Column({ name: 'idempotency_key', type: 'text' })
  idempotencyKey!: string;

  @Column({ name: 'request_hash', type: 'text' })
  requestHash!: string;

  @Column({ name: 'payout_id', type: 'uuid', nullable: true })
  payoutId!: string | null;

  @Column({ type: 'text' })
  status!: PayoutRequestStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
