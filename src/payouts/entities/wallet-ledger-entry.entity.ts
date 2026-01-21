import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type LedgerEntryType = 'DEBIT' | 'CREDIT';

@Entity({ name: 'wallet_ledger_entries' })
export class WalletLedgerEntryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'wallet_id', type: 'uuid' })
  walletId!: string;

  @Index()
  @Column({ name: 'payout_id', type: 'uuid', nullable: true })
  payoutId!: string | null;

  @Column({ name: 'entry_type', type: 'text' })
  entryType!: LedgerEntryType;

  @Column({ type: 'numeric', precision: 20, scale: 2 })
  amount!: string;

  @Column({ type: 'text' })
  currency!: 'NGN' | 'USD';

  @Column({ name: 'balance_before', type: 'numeric', precision: 20, scale: 2 })
  balanceBefore!: string;

  @Column({ name: 'balance_after', type: 'numeric', precision: 20, scale: 2 })
  balanceAfter!: string;

  @Column({ name: 'correlation_id', type: 'text' })
  correlationId!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
