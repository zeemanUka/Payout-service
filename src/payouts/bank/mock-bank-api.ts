import { Injectable } from '@nestjs/common';
import { BankApi, BankTemporaryError, BankTimeoutError, BankTransferRequest, BankTransferResponse } from './bank-api';

@Injectable()
export class MockBankApi implements BankApi {
  async transfer(req: BankTransferRequest): Promise<BankTransferResponse> {
    // Change behavior to test retries and failures.
    // throw new BankTimeoutError('timeout');
    // throw new BankTemporaryError('temporary');

    return { externalReference: `bankref_${req.payoutId}` };
  }
}
