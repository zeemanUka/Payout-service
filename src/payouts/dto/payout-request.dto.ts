import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsNumber, IsPositive, IsString } from 'class-validator';

export class PayoutRequestDto {
  @ApiProperty({ example: 'merchant_123', description: 'Merchant identifier' })
  @IsString()
  @IsNotEmpty()
  merchantId!: string;

  @ApiProperty({ example: 10000, description: 'Amount to pay out' })
  @IsNumber()
  @IsPositive()
  amount!: number;

  @ApiProperty({ example: 'NGN', enum: ['NGN', 'USD'], description: 'Currency code' })
  @IsString()
  @IsIn(['NGN', 'USD'])
  currency!: 'NGN' | 'USD';

  @ApiProperty({ example: 'idem_key_001', description: 'Idempotency key for safe retries' })
  @IsString()
  @IsNotEmpty()
  idempotencyKey!: string;
}
