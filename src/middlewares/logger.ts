import type { FastifyRequest, FastifyReply } from 'fastify';

export async function requestLogger(request: FastifyRequest, reply: FastifyReply) {
  const startTime = Date.now();

  // Log incoming request
  console.log({
    type: 'REQUEST',
    method: request.method,
    url: request.url,
    ip: request.ip,
    userAgent: request.headers['user-agent'],
    timestamp: new Date().toISOString(),
  });

  // Hook into response to log completion
  reply.raw.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log({
      type: 'RESPONSE',
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    });
  });
}
