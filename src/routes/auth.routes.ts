import type { FastifyInstance } from 'fastify';
import * as authController from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth';

export async function authRoutes(app: FastifyInstance) {
  // 注册
  app.post('/auth/register', authController.register);

  // 登录
  app.post('/auth/login', authController.login);

  // 刷新token
  app.post('/auth/refresh', authController.refreshToken);

  // 获取当前用户信息（需要认证）
  app.get(
    '/auth/me',
    {
      preHandler: [authenticate],
    },
    authController.getMe
  );
}
