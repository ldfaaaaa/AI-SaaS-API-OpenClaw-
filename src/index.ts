import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import dotenv from 'dotenv';
import { registerErrorHandler } from './middlewares/errorHandler';
import { requestLogger } from './middlewares/logger';
import { authRoutes } from './routes/auth.routes';
import { voiceCloneRoutes } from './routes/voice-clone.routes';
import { contentAssistantRoutes } from './routes/content-assistant.routes';
import { paymentRoutes } from './routes/payment.routes';
import prisma from './utils/prisma';
import redis from './utils/redis';
import { notificationGateway } from './gateways/notification.gateway';
import { startGenerationWorker, stopGenerationWorker } from './workers/generation.worker';

// 加载环境变量
dotenv.config();

// 创建Fastify实例
const app = Fastify({
  logger: false, // 使用自定义logger
  ajv: {
    customOptions: {
      removeAdditional: 'all',
      coerceTypes: true,
      useDefaults: true,
    },
  },
});

// 注册JWT插件
app.register(jwt, {
  secret: process.env.JWT_SECRET || 'your-secret-key-change-this-in-production',
});

// 注册CORS
app.register(cors, {
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
});

// 注册全局钩子 - 请求日志
app.addHook('onRequest', requestLogger);

// 健康检查路由
app.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// 注册路由
app.register(authRoutes, { prefix: '/api/v1' });
app.register(voiceCloneRoutes);
app.register(contentAssistantRoutes);
app.register(paymentRoutes);

// 注册错误处理
registerErrorHandler(app);

// 初始化WebSocket通知网关
notificationGateway.init(app);

// 启动任务Worker
startGenerationWorker();

// 优雅关闭
const signals = ['SIGINT', 'SIGTERM'];
signals.forEach((signal) => {
  process.on(signal, async () => {
    console.log(`Received ${signal}, closing gracefully...`);

    await app.close();
    await stopGenerationWorker();
    await notificationGateway.close();
    await prisma.$disconnect();
    await redis.quit();

    process.exit(0);
  });
});

// 启动服务器
async function start() {
  try {
    const port = parseInt(process.env.PORT || '3000', 10);
    const host = process.env.HOST || '0.0.0.0';

    await app.listen({ port, host });

    console.log(`
🚀 Server is running!
📡 Listening on: http://${host}:${port}
🏥 Health check: http://${host}:${port}/health
🔔 WebSocket: ws://${host}:${port}/ws/notifications?token=<accessToken>
🔐 Environment: ${process.env.NODE_ENV || 'development'}
    `);
  } catch (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
}

start();
