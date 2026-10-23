import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import {
  ConflictError,
  DomainError,
  NotFoundError,
} from './domain-error';

@Catch(DomainError)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(error: DomainError, host: ArgumentsHost) {
    const respuesta = host.switchToHttp().getResponse<Response>();

    let status = HttpStatus.BAD_REQUEST;
    if (error instanceof NotFoundError) status = HttpStatus.NOT_FOUND;
    else if (error instanceof ConflictError) status = HttpStatus.CONFLICT;

    respuesta.status(status).json({
      statusCode: status,
      error: error.name,
      message: error.message,
    });
  }
}
