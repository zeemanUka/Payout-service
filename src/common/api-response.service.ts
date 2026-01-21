import { Injectable } from '@nestjs/common';
import { ApiResponseDto } from './api-response';

@Injectable()
export class ApiResponseService {
  ok<T>(message: string, data: T): ApiResponseDto<T> {
    return { status: 'success', message, data };
  }

  error(message: string): ApiResponseDto<null> {
    return { status: 'error', message, data: null };
  }
}
