import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

type NestErrorBody = {
  statusCode?: number;
  message?: string | string[];
  error?: string;
};

const errorCodes: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'VALIDATION_ERROR',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'BUSINESS_RULE',
  [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_ERROR',
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<FastifyRequest>();
    const reply = ctx.getResponse<FastifyReply>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const response =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const body =
      typeof response === 'object' && response !== null
        ? (response as NestErrorBody)
        : undefined;
    const rawMessage =
      body?.message ??
      (typeof response === 'string' ? response : undefined) ??
      this.defaultMessage(status);
    const detalhes = Array.isArray(rawMessage) ? rawMessage : undefined;
    const mensagem = Array.isArray(rawMessage)
      ? (rawMessage[0] ?? this.defaultMessage(status))
      : rawMessage;

    if (status >= 500) {
      console.error('Erro nao tratado na API:', exception);
    }

    reply.status(status).send({
      erro: errorCodes[status] ?? 'HTTP_ERROR',
      mensagem,
      status,
      timestamp: new Date().toISOString(),
      path: request.url,
      ...(detalhes ? { detalhes } : {}),
    });
  }

  private defaultMessage(status: number) {
    if (status >= 500) return 'Erro interno.';
    return 'Nao foi possivel processar a requisicao.';
  }
}
