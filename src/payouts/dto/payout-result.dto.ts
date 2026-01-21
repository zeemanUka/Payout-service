import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PayoutResultDto {
  @ApiProperty({ example: '3f8e0b61-8f9c-4a3b-8f79-8b2d0bb7a1f2' })
  payoutId!: string;

  @ApiProperty({ example: 'SUCCESS', enum: ['SUCCESS', 'FAILED', 'PENDING'] })
  status!: 'SUCCESS' | 'FAILED' | 'PENDING';

  @ApiPropertyOptional({ example: 'BANK_PERMANENT_FAILURE' })
  reason?: string;
}
