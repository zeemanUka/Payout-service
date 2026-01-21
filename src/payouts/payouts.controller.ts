import { Controller, Get, Param, Post, Body } from '@nestjs/common';
import { PayoutsService } from './payouts.service';
import { PayoutRequestDto } from './dto/payout-request.dto';

@Controller('payouts')
export class PayoutsController {
  constructor(private payouts: PayoutsService) {}

  @Post('process')
  async process(@Body() dto: PayoutRequestDto) {
    return this.payouts.processPayout({
      merchantId: dto.merchantId,
      amount: dto.amount,
      currency: dto.currency,
      idempotencyKey: dto.idempotencyKey
    });
  }

  @Get(':id')
  async get(@Param('id') payoutId: string) {
    return this.payouts.getPayout(payoutId);
  }
}
