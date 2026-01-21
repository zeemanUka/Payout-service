import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class AuditPolicy {
  private bannedKeys = new Set([
    'cardNumber', 'pan', 'cvv', 'cvc', 'pin',
    'accountNumber', 'routingNumber', 'iban',
    'password', 'secret', 'token', 'accessToken', 'refreshToken',
    'authorization', 'Authorization', 'headers'
  ]);

  private allowlist: Record<string, string[]> = {
    REQUEST_ACCEPTED: ['merchantId', 'amount', 'currency', 'idempotencyKeyHash'],
    IDEMPOTENT_REPLAY: ['merchantId', 'payoutId', 'status'],
    WALLET_DEBITED: ['merchantId', 'walletId', 'payoutId', 'amount', 'currency'],
    BANK_CALL_STARTED: ['payoutId'],
    BANK_CALL_SUCCEEDED: ['payoutId', 'externalReferenceHash'],
    BANK_CALL_TIMEOUT: ['payoutId'],
    BANK_CALL_TEMPORARY_FAILURE: ['payoutId', 'errorCode'],
    PAYOUT_FAILED_PERMANENT: ['payoutId', 'reasonCode'],
    PAYOUT_MARKED_RETRY: ['payoutId', 'attemptCount', 'nextRetryAt'],
    WALLET_CREDITED_COMPENSATION: ['merchantId', 'walletId', 'payoutId', 'amount', 'currency']
  };

  sha256(input: string): string {
    return crypto.createHash('sha256').update(input).digest('hex');
  }

  buildPayload(eventType: string, input: Record<string, any>): Record<string, any> {
    const allowed = this.allowlist[eventType] ?? [];
    const out: Record<string, any> = {};

    for (const key of allowed) {
      if (this.bannedKeys.has(key)) continue;
      const value = input[key];
      if (value === undefined) continue;
      out[key] = value;
    }

    return out;
  }
}
