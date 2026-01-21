import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'wallets' })
@Index(['merchantId', 'currency'], { unique: true })
export class WalletEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'merchant_id', type: 'text' })
  merchantId!: string;

  @Column({ type: 'text' })
  currency!: 'NGN' | 'USD';

  @Column({ name: 'balance_available', type: 'numeric', precision: 20, scale: 2, default: 0 })
  balanceAvailable!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
