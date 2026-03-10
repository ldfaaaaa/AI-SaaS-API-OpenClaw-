# OpenClaw 内容助手模块 - 部署指南

## 🚀 快速部署

### 1. 安装依赖

```bash
# 安装新增的依赖
npm install adm-zip
npm install --save-dev @types/adm-zip

# 或者直接安装所有依赖
npm install
```

### 2. 数据库迁移

```bash
# 生成Prisma客户端
npm run prisma:generate

# 执行数据库迁移
npm run prisma:migrate

# 或者直接推送schema（开发环境）
npm run prisma:push
```

### 3. 配置环境变量

确保 `.env` 文件包含以下配置：

```env
# 必需：豆包API配置
DOUBAO_API_KEY=your_api_key_here
DOUBAO_CHAT_MODEL=doubao-pro-32k

# 必需：OSS存储配置
OSS_ACCESS_KEY_ID=your_key
OSS_ACCESS_KEY_SECRET=your_secret
OSS_BUCKET=your_bucket
OSS_REGION=oss-cn-hangzhou

# 可选：声音克隆配置（仅配音功能需要）
VOICE_CLONE_API_TOKEN=your_token
VOICE_CLONE_APP_ID=your_app_id

# 必需：数据库和Redis
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
REDIS_HOST=localhost
REDIS_PORT=6379

# 必需：JWT密钥
JWT_SECRET=your-secret-key-change-this-in-production
```

### 4. 启动服务

```bash
# 开发环境
npm run dev

# 生产环境
npm run build
npm start
```

## 📊 数据库Schema变更

本模块新增了以下数据表：

1. **WorkflowExecution** - 工作流执行记录
2. **WorkflowStep** - 工作流步骤记录

并扩展了以下表：

1. **ContentPackage** - 添加了 `result_data` 和 `result_zip_url` 字段
2. **TaskType** - 添加了 `marketing_package` 和 `voiceover_script` 枚举值

## 🧪 测试API

### 方式1: 使用cURL

```bash
# 1. 登录获取token
TOKEN=$(curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' \
  | jq -r '.data.accessToken')

# 2. 生成营销内容包
curl -X POST http://localhost:3000/api/v1/content-assistant/marketing-package \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "imageUrls": ["https://example.com/room.jpg"],
    "projectDescription": {
      "style": "现代简约",
      "area": "120㎡",
      "budget": "20万"
    }
  }'

# 3. 查询工作流状态
WORKFLOW_ID="clxxxxxxxxxxxxxx"  # 替换为实际的workflowId
curl http://localhost:3000/api/v1/content-assistant/workflow/$WORKFLOW_ID \
  -H "Authorization: Bearer $TOKEN"
```

### 方式2: 使用Postman/Insomnia

导入以下集合：

```json
{
  "name": "OpenClaw Content Assistant",
  "requests": [
    {
      "name": "Generate Marketing Package",
      "method": "POST",
      "url": "{{baseUrl}}/api/v1/content-assistant/marketing-package",
      "headers": {
        "Authorization": "Bearer {{token}}"
      },
      "body": {
        "imageUrls": ["https://example.com/room.jpg"],
        "projectDescription": {
          "style": "现代简约",
          "area": "120㎡",
          "budget": "20万"
        }
      }
    }
  ]
}
```

## 🔍 验证部署

### 1. 检查服务健康状态

```bash
curl http://localhost:3000/health
```

期望输出：
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:00:00.000Z"
}
```

### 2. 检查数据库连接

```bash
npm run prisma:studio
```

打开 Prisma Studio，确认新表已创建。

### 3. 检查Redis连接

```bash
# 使用redis-cli测试
redis-cli ping
```

期望输出：`PONG`

### 4. 检查Worker运行状态

查看日志，应该看到：

```
🚀 Server is running!
📡 Listening on: http://0.0.0.0:3000
🏥 Health check: http://0.0.0.0:3000/health
🔔 WebSocket: ws://0.0.0.0:3000/ws/notifications?token=<accessToken>
🔐 Environment: development
```

## 🐛 常见问题

### Q1: Prisma生成客户端失败

```bash
# 清理并重新生成
rm -rf node_modules/.prisma
npm run prisma:generate
```

### Q2: TypeScript编译错误

```bash
# 检查类型错误
npx tsc --noEmit

# 常见错误：找不到voiceCloneService
# 解决：确保import路径正确
```

### Q3: Worker未处理任务

检查：
1. Redis是否正常运行
2. BullMQ连接配置是否正确
3. Generation Worker是否已启动

### Q4: ZIP打包失败

检查：
1. `adm-zip` 包是否已安装
2. OSS上传权限是否正确
3. 临时目录是否有写权限

## 📦 生产环境部署

### 使用Docker

```dockerfile
# Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build
RUN npm run prisma:generate

EXPOSE 3000

CMD ["npm", "start"]
```

```bash
# 构建镜像
docker build -t openclaw-api .

# 运行容器
docker run -d \
  -p 3000:3000 \
  --env-file .env \
  --name openclaw-api \
  openclaw-api
```

### 使用PM2

```bash
# 安装PM2
npm install -g pm2

# 启动应用
pm2 start npm --name "openclaw-api" -- start

# 查看日志
pm2 logs openclaw-api

# 设置开机自启
pm2 startup
pm2 save
```

### Nginx反向代理配置

```nginx
server {
    listen 80;
    server_name api.example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket支持
    location /ws {
        proxy_pass http://localhost:3000/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}
```

## 📈 监控和日志

### 日志配置

在 `src/index.ts` 中启用Fastify日志：

```typescript
const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    prettyPrint: process.env.NODE_ENV !== 'production'
  }
});
```

### 性能监控

建议使用：
- **Sentry** - 错误追踪
- **Prometheus** - 性能指标
- **Grafana** - 可视化监控

## 🔐 安全建议

1. **环境变量**：不要将 `.env` 提交到Git
2. **JWT密钥**：生产环境使用强随机密钥
3. **API限流**：添加rate limiting中间件
4. **HTTPS**：生产环境必须使用HTTPS
5. **CORS**：限制允许的origin

## 📚 更多资源

- [完整API文档](./CONTENT_ASSISTANT_README.md)
- [架构设计文档](./BACKEND_README.md)
- [Prisma文档](https://www.prisma.io/docs)
- [Fastify文档](https://www.fastify.io/docs)
- [BullMQ文档](https://docs.bullmq.io)

## 🤝 技术支持

遇到问题？
1. 查看日志文件
2. 检查GitHub Issues
3. 联系开发团队

---

**祝部署顺利！** 🎉
