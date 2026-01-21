import { InjectionToken } from '@nestjs/common';

export type BankTransferRequest = {
  payoutId: string;
  merchantId: string;
  amount: number;
  currency: 'NGN' | 'USD';
};

export type BankTransferResponse = {
  externalReference: string;
};

export class BankTimeoutError extends Error {
  constructor(message = 'Bank API timeout') {
    super(message);
    this.name = 'BankTimeoutError';
  }
}

export class BankTemporaryError extends Error {
  constructor(message = 'Bank API temporary failure') {
    super(message);
    this.name = 'BankTemporaryError';
  }
}

export class BankPermanentError extends Error {
  constructor(message = 'Bank API permanent failure') {
    super(message);
    this.name = 'BankPermanentError';
  }
}

export interface BankApi {
  transfer(req: BankTransferRequest): Promise<BankTransferResponse>;
}

export const BankApiToken: InjectionToken = 'BankApiToken';
