import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiError } from '../interfaces';

/** Centralized error handling — every failure leaves as the error envelope. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'Something went wrong';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      code = HttpStatus[status] ?? 'ERROR';
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const body = res as { message?: string | string[]; error?: string };
        message = Array.isArray(body.message)
          ? body.message[0]
          : (body.message ?? message);
        if (Array.isArray(body.message)) details = { messages: body.message };
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(exception.message, exception.stack);
    }

    const payload: ApiError = {
      success: false,
      error: { code, message, details },
    };
    response.status(status).json(payload);
  }
}
