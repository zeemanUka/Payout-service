import { ApiProperty } from '@nestjs/swagger';
import { PayoutResultDto } from './payout-result.dto';

export class PayoutResponseDto {
  @ApiProperty({ example: 'success', enum: ['success', 'error'] })
  status!: 'success' | 'error';

  @ApiProperty({ example: 'Payout processed' })
  message!: string;

  @ApiProperty({ type: PayoutResultDto })
  data!: PayoutResultDto;
}
