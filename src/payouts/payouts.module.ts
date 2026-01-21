import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PayoutsController } from './payouts.controller';
import { PayoutsService } from './payouts.service';
import { WalletEntity } from './entities/wallet.entity';
import { PayoutEntity } from './entities/payout.entity';
import { PayoutRequestEntity } from './entities/payout-request.entity';
import { WalletLedgerEntryEntity } from './entities/wallet-ledger-entry.entity';
import { AuditEventEntity } from './entities/audit-event.entity';
import { AuditService } from './audit/audit.service';
import { AuditPolicy } from './audit/audit-policy';
import { BankApiToken } from './bank/bank-api';
import { MockBankApi } from './bank/mock-bank-api';
import { RetryService } from './retry/retry.service';
import { ApiResponseService } from 'src/common/api-response.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WalletEntity,
      PayoutEntity,
      PayoutRequestEntity,
      WalletLedgerEntryEntity,
      AuditEventEntity
    ])
  ],
  controllers: [PayoutsController],
  providers: [
    PayoutsService,
    AuditPolicy,
    AuditService,
    RetryService,
    ApiResponseService,
    {
      provide: BankApiToken,
      useClass: MockBankApi
    }
  ]
})
export class PayoutsModule {}
