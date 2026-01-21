import 'dotenv/config';
import { DataSource } from 'typeorm';
import { WalletEntity } from '../payouts/entities/wallet.entity';
import { PayoutEntity } from '../payouts/entities/payout.entity';
import { PayoutRequestEntity } from '../payouts/entities/payout-request.entity';
import { WalletLedgerEntryEntity } from '../payouts/entities/wallet-ledger-entry.entity';
import { AuditEventEntity } from '../payouts/entities/audit-event.entity';

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT ?? '5432'),
  username: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  ssl: { rejectUnauthorized: false },
  entities: [WalletEntity, PayoutEntity, PayoutRequestEntity, WalletLedgerEntryEntity, AuditEventEntity],
  migrations: [__dirname + '/../migrations/*{.ts,.js}'],
  synchronize: false,
  logging: false
});

export default AppDataSource;