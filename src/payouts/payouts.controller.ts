import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags
} from '@nestjs/swagger';
import { PayoutsService } from './payouts.service';
import { PayoutRequestDto } from './dto/payout-request.dto';
import { ApiResponseService } from '../common/api-response.service';
import { PayoutResponseDto } from './dto/payout-response.dto';

@ApiTags('payouts')
@Controller('payouts')
export class PayoutsController {
  constructor(
    private payouts: PayoutsService,
    private responses: ApiResponseService
  ) {}

  @Post('process')
  @ApiOperation({ summary: 'Process a payout request' })
  @ApiOkResponse({ description: 'Common response envelope', type: PayoutResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid request or insufficient funds' })
  async process(@Body() dto: PayoutRequestDto) {
    const result = await this.payouts.processPayout({
      merchantId: dto.merchantId,
      amount: dto.amount,
      currency: dto.currency,
      idempotencyKey: dto.idempotencyKey
    });

    return this.responses.ok('Payout processed', result);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get payout status by payoutId' })
  @ApiParam({ name: 'id', example: '3f8e0b61-8f9c-4a3b-8f79-8b2d0bb7a1f2' })
  @ApiOkResponse({ description: 'Common response envelope', type: PayoutResponseDto })
  async get(@Param('id') payoutId: string) {
    const result = await this.payouts.getPayout(payoutId);
    return this.responses.ok('Payout status', result);
  }
}
