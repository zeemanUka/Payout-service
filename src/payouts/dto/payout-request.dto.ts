import { IsIn, IsNotEmpty, IsNumber, IsPositive, IsString } from 'class-validator';

export class PayoutRequestDto {
  @IsString()
  @IsNotEmpty()
  merchantId!: string;

  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsString()
  @IsIn(['NGN', 'USD'])
  currency!: 'NGN' | 'USD';

  @IsString()
  @IsNotEmpty()
  idempotencyKey!: string;
}
