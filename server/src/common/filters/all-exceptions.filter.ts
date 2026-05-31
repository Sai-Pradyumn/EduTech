import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Request, Response } from 'express';
import { ApiError } from '../interfaces';
import { OpsService } from '../../modules/ops/ops.service';
import { RequestWithId } from '../middleware/request-id.middleware';

/**
 * Centralized error handling (Phase 10 · M7). Every failure leaves as the error envelope
 * with a stable `errorId` + `requestId` for support/tracing. Server (5xx) errors are
 * persisted to the Ops error feed and logged structurally; stacks never reach the client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly ops: OpsService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & RequestWithId>();

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'Something went wrong';
    let details: unknown;
    let stack: string | undefined;

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
      stack = exception.stack;
    }

    const errorId = randomUUID();
    const requestId = request?.requestId;
    const route = request?.originalUrl ?? request?.url;
    const userId = (request as { user?: { id?: string } })?.user?.id;

    // Persist + structurally log server errors only (client 4xx are expected).
    if (status >= 500) {
      this.logger.error(
        JSON.stringify({
          errorId,
          requestId,
          route,
          method: request?.method,
          status,
          userId,
          message,
        }),
        stack,
      );
      void this.ops.recordError({
        errorId,
        requestId,
        status,
        code,
        message,
        route,
        method: request?.method,
        userId,
        stack,
      });
    }

    const payload: ApiError = {
      success: false,
      error: {
        code,
        message,
        details: { ...(details as object), errorId, requestId },
      },
    };
    response.status(status).json(payload);
  }
}
