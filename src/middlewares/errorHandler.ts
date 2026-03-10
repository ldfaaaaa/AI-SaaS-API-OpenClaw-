import type { FastifyInstance, FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { AppError } from '../utils/errors';
import { errorResponse } from '../utils/response';

export async function errorHandler(
  error: FastifyError | AppError,
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Log error
  console.error('Error:', {
    message: error.message,
    stack: error.stack,
    path: request.url,
    method: request.method,
  });

  // Handle AppError
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send(errorResponse(error.message));
  }

  // Handle Fastify validation errors
  if (error.validation) {
    return reply.status(400).send(errorResponse('请求参数验证失败'));
  }

  // Handle generic errors
  const statusCode = error.statusCode || 500;
  const message =
    process.env.NODE_ENV === 'production' ? '服务器内部错误' : error.message;

  return reply.status(statusCode).send(errorResponse(message));
}

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler(errorHandler);
}
