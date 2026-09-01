import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as Sentry from '@sentry/node';
import { Request, Response } from 'express';

/**
 * Single exit point for errors: maps Prisma errors to sane HTTP codes, reports
 * 5xx to Sentry, and never leaks internals to the client in production.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, message, details } = this.normalize(exception);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}: ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
      Sentry.captureException(exception);
    }

    response.status(status).json({
      statusCode: status,
      message,
      ...(details ? { details } : {}),
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private normalize(exception: unknown): {
    status: number;
    message: string;
    details?: unknown;
  } {
    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      if (typeof res === 'object' && res !== null && 'message' in res) {
        const body = res as { message: string | string[] };
        return {
          status: exception.getStatus(),
          message: Array.isArray(body.message) ? body.message[0] : body.message,
          details: Array.isArray(body.message) ? body.message : undefined,
        };
      }
      return { status: exception.getStatus(), message: exception.message };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002':
          return { status: HttpStatus.CONFLICT, message: 'Resource already exists' };
        case 'P2025':
          return { status: HttpStatus.NOT_FOUND, message: 'Resource not found' };
        case 'P2003':
          return { status: HttpStatus.BAD_REQUEST, message: 'Related resource does not exist' };
        default:
          break;
      }
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message:
        process.env.NODE_ENV === 'production'
          ? 'Internal server error'
          : ((exception as Error)?.message ?? 'Internal server error'),
    };
  }
}
