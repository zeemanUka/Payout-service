import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus
} from '@nestjs/common';
import { Response } from 'express';

type Envelope = {
  status: 'error';
  message: string;
  data: null;
};

function extractMessageFromHttpException(exception: HttpException): string {
  const res = exception.getResponse();

  if (typeof res === 'string') return res;

  if (typeof res === 'object' && res !== null) {
    const anyRes = res as any;

    const msg = anyRes.message;
    if (typeof msg === 'string') return msg;

    if (Array.isArray(msg) && msg.length > 0) {
      return msg.join(', ');
    }
  }

  return exception.message || 'Request failed';
}

@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      message = extractMessageFromHttpException(exception);
    } else if (exception instanceof Error) {
      message = exception.message || message;
    }

    const body: Envelope = {
      status: 'error',
      message,
      data: null
    };

    return response.status(statusCode).json(body);
  }
}
