import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type ApiStatus = 'success' | 'error';

export class ApiResponseDto<T> {
  @ApiProperty({ example: 'success', enum: ['success', 'error'] })
  status!: ApiStatus;

  @ApiProperty({ example: 'Request completed' })
  message!: string;

  @ApiPropertyOptional({ description: 'Response payload' })
  data?: T;
}
