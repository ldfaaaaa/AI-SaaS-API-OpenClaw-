# AI设计可视化助手 - 后端API

基于 Fastify + TypeScript + Prisma 构建的高性能后端API服务。

## 技术栈

- **框架**: Fastify 4.x
- **语言**: TypeScript
- **ORM**: Prisma
- **数据库**: PostgreSQL
- **缓存**: Redis
- **认证**: JWT (@fastify/jwt)
- **密码加密**: bcrypt
- **数据验证**: Zod

## 项目结构

```
src/
 │   └── voice-clone.controller.ts    # 声音克隆API控制器
├── controllers/       # 控制器层
│   └── auth.controller.ts
├── middlewares/       # 中间件
│   ├── auth.ts       # JWT认证中间件
│   ├── errorHandler.ts # 错误处理中间件
│   └── logger.ts     # 请求日志中间件
 │   └── voice-clone.routes.ts        # 声音克隆API路由
├── routes/           # 路由定义
│   └── auth.routes.ts
 │   └── voice-clone.schema.ts        # 声音克隆请求验证Schema
├── schemas/          # 数据验证模式
│   └── auth.schema.ts
 │   └── voice-clone.service.ts       # 声音克隆核心服务
├── services/         # 业务逻辑层
│   └── auth.service.ts
├── utils/            # 工具函数
│   ├── errors.ts     # 自定义错误类
│   ├── prisma.ts     # Prisma客户端
│   ├── redis.ts      # Redis客户端
│   └── response.ts   # 统一响应格式
└── index.ts          # 应用入口

prisma/
└── schema.prisma     # 数据库模型定义
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 到 `.env` 并修改配置：

```bash
cp .env.example .env
```

### 3. 初始化数据库

```bash
# 生成Prisma客户端
npm run prisma:generate

# 运行数据库迁移
npm run prisma:migrate

# 或者直接推送schema（开发环境）
npm run prisma:push
```

### 4. 启动开发服务器

```bash
npm run dev
```

服务器将在 `http://localhost:3000` 启动

### 5. 构建生产版本

```bash
npm run build
npm start
```

## API 文档

### 响应格式

所有API响应遵循统一格式：

```typescript
{
  success: boolean;   // 操作是否成功
  data?: any;         // 响应数据（成功时返回）
  message: string;    // 响应消息
}
```

 ### 声音克隆相关接口（火山引擎MegaTTS）

 完整文档请参考 [VOICE_CLONE_README.md](./VOICE_CLONE_README.md)

 **支持的接口：**
 - `POST /api/v1/voice-clone/:voiceProfileId/compliance-confirm` - 合规确认
 - `POST /api/v1/voice-clone/upload` - 上传训练音频
 - `GET /api/v1/voice-clone/:voiceProfileId/status` - 查询训练状态
 - `POST /api/v1/voice-clone/synthesize` - 合成语音
 - `GET /api/v1/voice-clone/profiles` - 获取用户档案列表
 - `DELETE /api/v1/voice-clone/:voiceProfileId` - 删除档案

 **环境变量配置：**
 ```env
 # 火山引擎声音克隆API
 VOICE_CLONE_API_TOKEN=your_token_here
 VOICE_CLONE_APP_ID=your_app_id_here
 ```

 **核心特性：**
 - 🎤 用户音色克隆和训练
 - 🔒 合规控制（确认"本人声音/合法使用"）
 - 📊 实时训练状态监控
 - 🎵 个性化语音合成
 - 📁 多档案管理（每用户最多一个活跃档案）
### 认证相关接口

#### 1. 用户注册

**POST** `/api/v1/auth/register`

请求体：
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

响应：
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "clxxx...",
      "email": "user@example.com",
      "role": "user",
      "balance": 0,
      "membership_type": "none",
      "membership_expires_at": null,
      "created_at": "2024-01-01T00:00:00.000Z"
    },
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc..."
  },
  "message": "注册成功"
}
```

#### 2. 用户登录

**POST** `/api/v1/auth/login`

请求体：
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

响应格式同注册接口

#### 3. 刷新Token

**POST** `/api/v1/auth/refresh`

请求体：
```json
{
  "refreshToken": "eyJhbGc..."
}
```

响应：
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGc..."
  },
  "message": "Token刷新成功"
}
```

#### 4. 获取当前用户信息

**GET** `/api/v1/auth/me`

请求头：
```
Authorization: Bearer <accessToken>
```

响应：
```json
{
  "success": true,
  "data": {
    "id": "clxxx...",
    "email": "user@example.com",
    "role": "user",
    "balance": 0,
    "membership_type": "none",
    "membership_expires_at": null,
    "created_at": "2024-01-01T00:00:00.000Z"
  },
  "message": "获取成功"
}
```

### 健康检查

**GET** `/health`

响应：
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 数据模型

### User 用户表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 用户ID（CUID） |
| email | String | 邮箱（唯一） |
| password_hash | String | 密码哈希 |
| role | Enum | 角色：user/admin |
| balance | Float | 账户余额 |
| membership_type | Enum | 会员类型：none/monthly/quarterly/yearly |
| membership_expires_at | DateTime? | 会员过期时间 |
| created_at | DateTime | 创建时间 |
| updated_at | DateTime | 更新时间 |

## 中间件

### 1. 错误处理中间件

统一处理所有错误，返回标准错误响应格式

### 2. 请求日志中间件

记录所有请求和响应信息

### 3. JWT认证中间件

验证JWT token，保护需要认证的路由

## 错误处理

项目使用自定义错误类：

- `BadRequestError` (400) - 请求参数错误
- `UnauthorizedError` (401) - 未授权
- `ForbiddenError` (403) - 禁止访问
- `NotFoundError` (404) - 资源不存在
- `ConflictError` (409) - 资源冲突
- `InternalServerError` (500) - 服务器内部错误

## 开发工具

```bash
# 查看Prisma Studio（数据库可视化界面）
npm run prisma:studio

# 代码检查
npm run lint

# 代码格式化
npm run format
```

## 生产环境部署建议

1. 修改 `.env` 中的 `JWT_SECRET` 为强密码
2. 设置 `NODE_ENV=production`
3. 配置正确的 `DATABASE_URL` 和 Redis 连接
4. 设置具体的 `CORS_ORIGIN` 而不是 `*`
5. 运行 `npm run prisma:migrate` 而不是 `prisma:push`
6. 使用进程管理器（如 PM2）运行应用

## License

MIT
