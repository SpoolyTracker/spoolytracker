import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('AllExceptionsFilter');

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: (exception as Error).message, statusCode: status };

    const user = (request as any).user;
    const userId = user ? user.id || user.sub : 'anonymous';

    const logData = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      user: userId,
      stack: exception instanceof Error ? exception.stack : null,
      message: exception.message || exception,
    };

    // Use NestJS Logger (which will be Winston under the hood)
    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} ${status} - Error: ${JSON.stringify(logData.message)}`,
        exception instanceof Error ? exception.stack : null,
        'AllExceptionsFilter',
      );
    } else {
      // For 401, log more details including errorCode if available
      const detailedMessage = status === 401 && typeof message === 'object' 
        ? JSON.stringify(message) 
        : JSON.stringify(logData.message);

      this.logger.warn(
        `${request.method} ${request.url} ${status} - Warning: ${detailedMessage}`,
        'AllExceptionsFilter',
      );
    }

    response.status(status).json({
      ...((message as object) || {}),
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
