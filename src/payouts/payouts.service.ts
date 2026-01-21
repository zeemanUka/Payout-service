import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { WalletEntity } from './entities/wallet.entity';
import { PayoutEntity } from './entities/payout.entity';
import { PayoutRequestEntity } from './entities/payout-request.entity';
import { WalletLedgerEntryEntity } from './entities/wallet-ledger-entry.entity';
import { AuditService } from './audit/audit.service';
import { AuditPolicy } from './audit/audit-policy';
import { BankApi, BankApiToken, BankPermanentError, BankTemporaryError, BankTimeoutError } from './bank/bank-api';

export type PayoutRequest = {
  merchantId: string;
  amount: number;
  currency: 'NGN' | 'USD';
  idempotencyKey: string;
};

export type PayoutResult = {
  payoutId: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  reason?: string;
};

@Injectable()
export class PayoutsService {
  constructor(
    private dataSource: DataSource,
    @InjectRepository(WalletEntity) private walletRepo: Repository<WalletEntity>,
    @InjectRepository(PayoutEntity) private payoutRepo: Repository<PayoutEntity>,
    @InjectRepository(PayoutRequestEntity) private payoutRequestRepo: Repository<PayoutRequestEntity>,
    @InjectRepository(WalletLedgerEntryEntity) private ledgerRepo: Repository<WalletLedgerEntryEntity>,
    private audit: AuditService,
    private auditPolicy: AuditPolicy,
    @Inject(BankApiToken) private bankApi: BankApi
  ) {}

  async getPayout(payoutId: string) {
    const payout = await this.payoutRepo.findOne({ where: { id: payoutId } });
    if (!payout) throw new NotFoundException('payout not found');

    if (payout.status === 'SUCCESS') return { payoutId, status: 'SUCCESS' };
    if (payout.status === 'FAILED') return { payoutId, status: 'FAILED', reason: payout.failureReason ?? undefined };
    return { payoutId, status: 'PENDING' };
  }

  private buildRequestHash(req: PayoutRequest): string {
    const s = `${req.merchantId}|${req.amount}|${req.currency}`;
    return crypto.createHash('sha256').update(s).digest('hex');
  }

  private toResult(payout: PayoutEntity): PayoutResult {
    if (payout.status === 'SUCCESS') return { payoutId: payout.id, status: 'SUCCESS' };
    if (payout.status === 'FAILED') return { payoutId: payout.id, status: 'FAILED', reason: payout.failureReason ?? undefined };
    return { payoutId: payout.id, status: 'PENDING' };
  }

  private computeNextRetry(attempt: number): Date {
    const baseMs = Number(process.env.RETRY_BASE_MS ?? '2000');
    const maxMs = Number(process.env.RETRY_MAX_MS ?? '60000');
    const delay = Math.min(maxMs, baseMs * Math.pow(2, Math.max(0, attempt - 1)));
    return new Date(Date.now() + delay);
  }

  async processPayout(request: PayoutRequest): Promise<PayoutResult> {
    if (!request.merchantId?.trim()) throw new BadRequestException('merchantId is required');
    if (!request.idempotencyKey?.trim()) throw new BadRequestException('idempotencyKey is required');
    if (!Number.isFinite(request.amount) || request.amount <= 0) throw new BadRequestException('amount must be > 0');
    if (request.currency !== 'NGN' && request.currency !== 'USD') throw new BadRequestException('invalid currency');

    const reqHash = this.buildRequestHash(request);
    const correlationId = request.idempotencyKey;

    const phase1 = await this.dataSource.transaction(async (manager) => {
      const prRepo = manager.getRepository(PayoutRequestEntity);
      const walletRepo = manager.getRepository(WalletEntity);
      const payoutRepo = manager.getRepository(PayoutEntity);
      const ledgerRepo = manager.getRepository(WalletLedgerEntryEntity);

      let payoutRequest = await prRepo.findOne({
        where: { merchantId: request.merchantId, idempotencyKey: request.idempotencyKey }
      });

      if (!payoutRequest) {
        payoutRequest = prRepo.create({
          merchantId: request.merchantId,
          idempotencyKey: request.idempotencyKey,
          requestHash: reqHash,
          payoutId: null,
          status: 'CREATED'
        });
        payoutRequest = await prRepo.save(payoutRequest);
      } else {
        if (payoutRequest.requestHash !== reqHash) {
          throw new BadRequestException('idempotency key reuse with different parameters');
        }
        if (payoutRequest.payoutId) {
          const existing = await payoutRepo.findOne({ where: { id: payoutRequest.payoutId } });
          if (!existing) throw new Error('Invariant violation: payout missing for existing idempotency record');

          await this.audit.writeEvent({
            entityType: 'PAYOUT',
            entityId: existing.id,
            eventType: 'IDEMPOTENT_REPLAY',
            payload: { merchantId: request.merchantId, payoutId: existing.id, status: existing.status },
            actor: 'SYSTEM'
          });

          return { payoutId: existing.id, walletId: null, payoutRequestId: payoutRequest.id, replay: true };
        }
      }

      const idempotencyKeyHash = this.auditPolicy.sha256(request.idempotencyKey);

      await this.audit.writeEvent({
        entityType: 'PAYOUT_REQUEST',
        entityId: payoutRequest.id,
        eventType: 'REQUEST_ACCEPTED',
        payload: { merchantId: request.merchantId, amount: request.amount, currency: request.currency, idempotencyKeyHash },
        actor: 'SYSTEM'
      });

      // Lock wallet row with FOR UPDATE
      let wallet = await walletRepo
        .createQueryBuilder('w')
        .setLock('pessimistic_write')
        .where('w.merchant_id = :merchantId', { merchantId: request.merchantId })
        .andWhere('w.currency = :currency', { currency: request.currency })
        .getOne();

      if (!wallet) {
        wallet = walletRepo.create({
          merchantId: request.merchantId,
          currency: request.currency,
          balanceAvailable: '0'
        });
        wallet = await walletRepo.save(wallet);

        wallet = await walletRepo
          .createQueryBuilder('w')
          .setLock('pessimistic_write')
          .where('w.id = :id', { id: wallet.id })
          .getOneOrFail();
      }

      const before = Number(wallet.balanceAvailable);
      if (before < request.amount) {
        throw new BadRequestException('insufficient funds');
      }
      const after = before - request.amount;

      const payout = payoutRepo.create({
        merchantId: request.merchantId,
        amount: request.amount.toFixed(2),
        currency: request.currency,
        status: 'PENDING',
        failureReason: null,
        externalReference: null,
        attemptCount: 0,
        nextRetryAt: null
      });
      const savedPayout = await payoutRepo.save(payout);

      payoutRequest.payoutId = savedPayout.id;
      payoutRequest.status = 'IN_PROGRESS';
      await prRepo.save(payoutRequest);

      wallet.balanceAvailable = after.toFixed(2);
      await walletRepo.save(wallet);

      const ledger = ledgerRepo.create({
        walletId: wallet.id,
        payoutId: savedPayout.id,
        entryType: 'DEBIT',
        amount: request.amount.toFixed(2),
        currency: request.currency,
        balanceBefore: before.toFixed(2),
        balanceAfter: after.toFixed(2),
        correlationId
      });
      await ledgerRepo.save(ledger);

      await this.audit.writeEvent({
        entityType: 'WALLET',
        entityId: wallet.id,
        eventType: 'WALLET_DEBITED',
        payload: {
          merchantId: request.merchantId,
          walletId: wallet.id,
          payoutId: savedPayout.id,
          amount: request.amount,
          currency: request.currency
        },
        actor: 'SYSTEM'
      });

      return { payoutId: savedPayout.id, walletId: wallet.id, payoutRequestId: payoutRequest.id, replay: false };
    });

    if (phase1.replay) {
      const payout = await this.payoutRepo.findOne({ where: { id: phase1.payoutId } });
      if (!payout) throw new Error('Invariant violation: payout not found after replay');
      return this.toResult(payout);
    }

    await this.audit.writeEvent({
      entityType: 'PAYOUT',
      entityId: phase1.payoutId,
      eventType: 'BANK_CALL_STARTED',
      payload: { payoutId: phase1.payoutId },
      actor: 'SYSTEM'
    });

    try {
      const bankRes = await this.bankApi.transfer({
        payoutId: phase1.payoutId,
        merchantId: request.merchantId,
        amount: request.amount,
        currency: request.currency
      });

      await this.dataSource.transaction(async (manager) => {
        const payoutRepo = manager.getRepository(PayoutEntity);
        const prRepo = manager.getRepository(PayoutRequestEntity);

        const payout = await payoutRepo.findOneOrFail({ where: { id: phase1.payoutId } });
        payout.status = 'SUCCESS';
        payout.externalReference = bankRes.externalReference;
        payout.failureReason = null;
        await payoutRepo.save(payout);

        const pr = await prRepo.findOneOrFail({ where: { id: phase1.payoutRequestId } });
        pr.status = 'COMPLETED';
        await prRepo.save(pr);

        await this.audit.writeEvent({
          entityType: 'PAYOUT',
          entityId: phase1.payoutId,
          eventType: 'BANK_CALL_SUCCEEDED',
          payload: { payoutId: phase1.payoutId, externalReferenceHash: this.auditPolicy.sha256(bankRes.externalReference) },
          actor: 'SYSTEM'
        });
      });

      return { payoutId: phase1.payoutId, status: 'SUCCESS' };
    } catch (err: any) {
      if (err instanceof BankTimeoutError || err instanceof BankTemporaryError) {
        const nextRetryAt = this.computeNextRetry(1);

        await this.dataSource.transaction(async (manager) => {
          const payoutRepo = manager.getRepository(PayoutEntity);

          const payout = await payoutRepo.findOneOrFail({ where: { id: phase1.payoutId } });
          payout.status = 'NEEDS_RETRY';
          payout.attemptCount = 1;
          payout.nextRetryAt = nextRetryAt;
          payout.failureReason = err instanceof BankTimeoutError ? 'BANK_TIMEOUT' : 'BANK_TEMPORARY_FAILURE';
          await payoutRepo.save(payout);

          await this.audit.writeEvent({
            entityType: 'PAYOUT',
            entityId: phase1.payoutId,
            eventType: err instanceof BankTimeoutError ? 'BANK_CALL_TIMEOUT' : 'BANK_CALL_TEMPORARY_FAILURE',
            payload: { payoutId: phase1.payoutId, errorCode: err instanceof BankTimeoutError ? 'TIMEOUT' : 'TEMPORARY' },
            actor: 'SYSTEM'
          });

          await this.audit.writeEvent({
            entityType: 'PAYOUT',
            entityId: phase1.payoutId,
            eventType: 'PAYOUT_MARKED_RETRY',
            payload: { payoutId: phase1.payoutId, attemptCount: 1, nextRetryAt: nextRetryAt.toISOString() },
            actor: 'SYSTEM'
          });
        });

        return { payoutId: phase1.payoutId, status: 'PENDING' };
      }

      const reason = err instanceof BankPermanentError ? err.message : 'UNKNOWN_BANK_FAILURE';

      await this.dataSource.transaction(async (manager) => {
        const payoutRepo = manager.getRepository(PayoutEntity);
        const prRepo = manager.getRepository(PayoutRequestEntity);
        const walletRepo = manager.getRepository(WalletEntity);
        const ledgerRepo = manager.getRepository(WalletLedgerEntryEntity);

        const payout = await payoutRepo.findOneOrFail({ where: { id: phase1.payoutId } });
        payout.status = 'FAILED';
        payout.failureReason = reason;
        payout.nextRetryAt = null;
        await payoutRepo.save(payout);

        const pr = await prRepo.findOneOrFail({ where: { id: phase1.payoutRequestId } });
        pr.status = 'FAILED_FINAL';
        await prRepo.save(pr);

        const wallet = await walletRepo
          .createQueryBuilder('w')
          .setLock('pessimistic_write')
          .where('w.id = :id', { id: phase1.walletId })
          .getOneOrFail();

        const before = Number(wallet.balanceAvailable);
        const after = before + request.amount;

        wallet.balanceAvailable = after.toFixed(2);
        await walletRepo.save(wallet);

        const ledger = ledgerRepo.create({
          walletId: wallet.id,
          payoutId: payout.id,
          entryType: 'CREDIT',
          amount: request.amount.toFixed(2),
          currency: request.currency,
          balanceBefore: before.toFixed(2),
          balanceAfter: after.toFixed(2),
          correlationId
        });
        await ledgerRepo.save(ledger);

        await this.audit.writeEvent({
          entityType: 'PAYOUT',
          entityId: phase1.payoutId,
          eventType: 'PAYOUT_FAILED_PERMANENT',
          payload: { payoutId: phase1.payoutId, reasonCode: 'BANK_PERMANENT_FAILURE' },
          actor: 'SYSTEM'
        });

        await this.audit.writeEvent({
          entityType: 'WALLET',
          entityId: wallet.id,
          eventType: 'WALLET_CREDITED_COMPENSATION',
          payload: {
            merchantId: request.merchantId,
            walletId: wallet.id,
            payoutId: payout.id,
            amount: request.amount,
            currency: request.currency
          },
          actor: 'SYSTEM'
        });
      });

      return { payoutId: phase1.payoutId, status: 'FAILED', reason };
    }
  }
}
