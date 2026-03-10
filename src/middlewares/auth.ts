import type { FastifyRequest } from 'fastify';
import { UnauthorizedError } from '../utils/errors';

export async function authenticate(request: FastifyRequest): Promise<void> {
  try {
    await request.jwtVerify();
  } catch {
    throw new UnauthorizedError('无效的身份验证令牌');
  }
}

export function requireRole(...roles: string[]) {
  return async (request: FastifyRequest): Promise<void> => {
    const jwtUser = request.user as { role?: string } | undefined;

    if (!jwtUser?.role) {
      throw new UnauthorizedError('需要身份验证');
    }

    if (!roles.includes(jwtUser.role)) {
      throw new UnauthorizedError('权限不足');
    }
  };
}
