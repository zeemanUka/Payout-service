import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { PayoutEntity } from '../entities/payout.entity';
import { AuditService } from '../audit/audit.service';
import { AuditPolicy } from '../audit/audit-policy';
import { BankApi, BankApiToken, BankPermanentError, BankTemporaryError, BankTimeoutError } from '../bank/bank-api';

@Injectable()
export class RetryService {
  private logger = new Logger(RetryService.name);

  constructor(
    private dataSource: DataSource,
    private audit: AuditService,
    private policy: AuditPolicy,
    @Inject(BankApiToken) private bankApi: BankApi
  ) {}

  private computeNextRetry(attempt: number): Date {
    const baseMs = Number(process.env.RETRY_BASE_MS ?? '2000');
    const maxMs = Number(process.env.RETRY_MAX_MS ?? '60000');
    const delay = Math.min(maxMs, baseMs * Math.pow(2, Math.max(0, attempt - 1)));
    return new Date(Date.now() + delay);
  }

  // Runs every 10 seconds in dev.
  @Cron('*/10 * * * * *')
  async run(): Promise<void> {
    const maxAttempts = Number(process.env.MAX_RETRY_ATTEMPTS ?? '5');

    await this.dataSource.transaction(async (manager) => {
      const payoutRepo = manager.getRepository(PayoutEntity);

      // Claim a few rows. SKIP LOCKED helps reduce double processing with multiple workers.
      const due = await payoutRepo
        .createQueryBuilder('p')
        .setLock('pessimistic_write')
        .where('p.status = :status', { status: 'NEEDS_RETRY' })
        .andWhere('p.next_retry_at IS NOT NULL')
        .andWhere('p.next_retry_at <= now()')
        .orderBy('p.next_retry_at', 'ASC')
        .limit(10)
        .getMany();

      for (const p of due) {
        try {
          const attemptNext = p.attemptCount + 1;
          if (attemptNext > maxAttempts) {
            p.status = 'FAILED';
            p.failureReason = 'MAX_RETRY_EXCEEDED';
            p.nextRetryAt = null;
            await payoutRepo.save(p);

            await this.audit.writeEvent({
              entityType: 'PAYOUT',
              entityId: p.id,
              eventType: 'PAYOUT_FAILED_PERMANENT',
              payload: { payoutId: p.id, reasonCode: 'MAX_RETRY_EXCEEDED' },
              actor: 'SYSTEM'
            });
            continue;
          }

          // Call bank outside DB lock window in production.
          const bankRes = await this.bankApi.transfer({
            payoutId: p.id,
            merchantId: p.merchantId,
            amount: Number(p.amount),
            currency: p.currency
          });

          p.status = 'SUCCESS';
          p.externalReference = bankRes.externalReference;
          p.failureReason = null;
          p.nextRetryAt = null;
          await payoutRepo.save(p);

          await this.audit.writeEvent({
            entityType: 'PAYOUT',
            entityId: p.id,
            eventType: 'BANK_CALL_SUCCEEDED',
            payload: { payoutId: p.id, externalReferenceHash: this.policy.sha256(bankRes.externalReference) },
            actor: 'SYSTEM'
          });
        } catch (err: any) {
          if (err instanceof BankTimeoutError || err instanceof BankTemporaryError) {
            p.attemptCount = p.attemptCount + 1;
            p.status = 'NEEDS_RETRY';
            p.nextRetryAt = this.computeNextRetry(p.attemptCount);
            p.failureReason = err instanceof BankTimeoutError ? 'BANK_TIMEOUT' : 'BANK_TEMPORARY_FAILURE';
            await payoutRepo.save(p);

            await this.audit.writeEvent({
              entityType: 'PAYOUT',
              entityId: p.id,
              eventType: 'PAYOUT_MARKED_RETRY',
              payload: { payoutId: p.id, attemptCount: p.attemptCount, nextRetryAt: p.nextRetryAt.toISOString() },
              actor: 'SYSTEM'
            });
          } else {
            const reason = err instanceof BankPermanentError ? err.message : 'UNKNOWN_BANK_FAILURE';
            p.status = 'FAILED';
            p.failureReason = reason;
            p.nextRetryAt = null;
            await payoutRepo.save(p);

            await this.audit.writeEvent({
              entityType: 'PAYOUT',
              entityId: p.id,
              eventType: 'PAYOUT_FAILED_PERMANENT',
              payload: { payoutId: p.id, reasonCode: 'BANK_PERMANENT_FAILURE' },
              actor: 'SYSTEM'
            });
          }
        }
      }
    });
  }
}
