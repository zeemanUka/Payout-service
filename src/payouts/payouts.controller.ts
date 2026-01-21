import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { PayoutsService } from './payouts.service';
import { PayoutRequestDto } from './dto/payout-request.dto';

class PayoutResultDto {
  payoutId!: string;
  status!: 'SUCCESS' | 'FAILED' | 'PENDING';
  reason?: string;
}

@ApiTags('payouts')
@Controller('payouts')
export class PayoutsController {
  constructor(private payouts: PayoutsService) {}

  @Post('process')
  @ApiOperation({ summary: 'Process a payout request' })
  @ApiOkResponse({
    description: 'Payout accepted and processed, or returned as idempotent replay',
    type: PayoutResultDto
  })
  @ApiBadRequestResponse({
    description: 'Invalid request, insufficient funds, or idempotency key reuse with different parameters'
  })
  async process(@Body() dto: PayoutRequestDto) {
    return this.payouts.processPayout({
      merchantId: dto.merchantId,
      amount: dto.amount,
      currency: dto.currency,
      idempotencyKey: dto.idempotencyKey
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get payout status by payoutId' })
  @ApiParam({ name: 'id', example: '3f8e0b61-8f9c-4a3b-8f79-8b2d0bb7a1f2' })
  @ApiOkResponse({ description: 'Current payout status', type: PayoutResultDto })
  async get(@Param('id') payoutId: string) {
    return this.payouts.getPayout(payoutId);
  }
}
