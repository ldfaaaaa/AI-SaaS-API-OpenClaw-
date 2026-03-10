import type { ConnectionOptions } from 'bullmq';

/**
 * BullMQ 连接配置（复用 Redis 环境变量）
 */
export const bullmqConnection: ConnectionOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  maxRetriesPerRequest: null,
};
