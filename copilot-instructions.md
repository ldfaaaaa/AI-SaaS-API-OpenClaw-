# AI设计可视化助手 - Copilot上下文

## 项目描述
这是一个面向室内设计师的AI SaaS工具，使用豆包API进行图像和视频生成。

## 技术栈
- 前端: Next.js 14 (App Router), TypeScript, TailwindCSS, ShadcnUI, Zustand
- 后端: Node.js, Fastify, Prisma ORM, PostgreSQL, Redis, BullMQ
- 外部API: 豆包图像API(ark.cn-beijing.volces.com), 火山引擎TTS声音复刻API
- 支付: 微信支付v3, 支付宝SDK
- 自动化: OpenClaw工作流

## 核心约定
- 所有API响应格式: { success: boolean, data: T, message: string }
- 错误处理统一使用 AppError class
- 数据库操作统一通过 Prisma Client
- 异步任务统一通过 BullMQ 队列处理
- 用户额度存储在Redis，Key格式: quota:{userId}:{date}:{type}

## 重要业务规则
- 会员每日额度: 图片20次, 视频10次, 每天0点重置
- 非会员按次付费: 图片5元, 视频10元
- 生成任务必须异步处理，前��通过WebSocket获取进度
