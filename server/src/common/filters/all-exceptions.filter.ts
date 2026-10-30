import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { API_GLOBAL_PREFIX } from '../constants/api.constants';

interface ErrorBody {
  success: false;
  message: string;
  timestamp: string;
  path: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = this.resolveStatus(exception);
    const message = this.resolveMessage(exception);

    const serverErrorStatus: number = HttpStatus.INTERNAL_SERVER_ERROR;

    if (status >= serverErrorStatus) {
      const details =
        exception instanceof Error
          ? `${exception.name}: ${exception.message}\n${exception.stack ?? ''}`
          : String(exception);
      const isProfilePhotoUpload =
        request.method === 'PUT' &&
        request.path === `/${API_GLOBAL_PREFIX}/profiles/me/photo`;
      this.logger.error(
        isProfilePhotoUpload
          ? `${request.method} ${request.url}\n${details}`
          : `${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ErrorBody = {
      success: false,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(status).json(body);
  }

  private resolveStatus(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }

    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private resolveMessage(exception: unknown): string {
    if (!(exception instanceof HttpException)) {
      return 'Internal server error';
    }

    const body: unknown = exception.getResponse();

    if (typeof body === 'string') {
      return body;
    }

    if (this.isMessageBody(body)) {
      return Array.isArray(body.message)
        ? body.message.join(', ')
        : body.message;
    }

    return exception.message;
  }

  private isMessageBody(body: unknown): body is { message: string | string[] } {
    if (typeof body !== 'object' || body === null || !('message' in body)) {
      return false;
    }

    const message = body.message;

    if (typeof message === 'string') {
      return true;
    }

    return (
      Array.isArray(message) &&
      message.every((item) => typeof item === 'string')
    );
  }
}
