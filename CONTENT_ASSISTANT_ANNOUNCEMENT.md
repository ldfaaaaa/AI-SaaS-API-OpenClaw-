# 🎉 OpenClaw 内容助手模块 - 新功能上线

## 📢 功能概述

OpenClaw内容助手是一个基于AI工作流自动化的内容生成系统，专为室内设计营销场景打造。

## 🚀 两大核心功能

### 1️⃣ 营销内容包生成器
输入效果图，一键生成：
- 📝 小红书标题（5个候选）
- 📄 图文正文（500字专业解说）
- 🏷️ 话题标签（10个热门标签）
- 💬 朋友圈文案（专业/轻松/吸引 三个版本）
- 📦 ZIP打包下载（图片+文案+标签）

### 2️⃣ 配音解说脚本生成器
输入效果图，智能生成：
- 🤖 AI图片分析（设计要素识别）
- 🎙️ 解说文案（300字口播脚本）
- 📋 字幕文件（SRT格式，带时间戳）
- 🔊 音频合成（可选，使用声音克隆TTS）
- 📦 ZIP打包下载（文案+字幕+音频）

## ⚡ 核心特性

### OpenClaw 工作流引擎
- ✅ 节点式任务编排
- 📊 实时进度追踪
- 🔔 WebSocket实时通知
- 🔄 断点续传支持

### 技术亮点
- 🧠 **豆包LLM驱动** - 强大的文本生成能力
- 🎨 **工作流可视化** - 前端展示执行进度
- 🌐 **异步处理** - 不阻塞用户请求
- 📱 **实时推送** - WebSocket进度通知

## 📚 快速开始

### 1. 安装
```bash
bash install-content-assistant.sh
```

### 2. 配置环境变量
```env
DOUBAO_API_KEY=your_api_key
DOUBAO_CHAT_MODEL=doubao-pro-32k
DATABASE_URL=postgresql://...
REDIS_HOST=localhost
```

### 3. 启动服务
```bash
npm run dev
```

### 4. 测试API
```bash
curl -X POST http://localhost:3000/api/v1/content-assistant/marketing-package \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "imageUrls": ["https://example.com/room.jpg"],
    "projectDescription": {
      "style": "现代简约",
      "area": "120㎡"
    }
  }'
```

## 📖 完整文档

- 📘 [使用文档](./CONTENT_ASSISTANT_README.md) - API接口、WebSocket、集成示例
- 🚀 [部署指南](./DEPLOYMENT_CONTENT_ASSISTANT.md) - 安装、配置、Docker部署
- 📊 [实现总结](./IMPLEMENTATION_SUMMARY_CONTENT_ASSISTANT.md) - 架构设计、数据流

## 🎯 API端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/content-assistant/marketing-package` | 生成营销内容包 |
| POST | `/api/v1/content-assistant/voiceover-script` | 生成配音解说脚本 |
| GET | `/api/v1/content-assistant/workflow/:id` | 查询工作流状态 |
| POST | `/api/v1/content-assistant/workflow/:id/cancel` | 取消工作流 |
| GET | `/api/v1/content-assistant/package/:id` | 获取内容包详情 |
| GET | `/api/v1/content-assistant/packages` | 获取内容包列表 |

## 🌐 WebSocket实时通知

连接地址: `ws://localhost:3000/ws/notifications?token=<accessToken>`

事件类型:
- `workflow.started` - 工作流开始
- `workflow.step.updated` - 步骤更新
- `workflow.progress` - 进度更新
- `workflow.completed` - 工作流完成
- `workflow.failed` - 工作流失败

## 📊 工作流示例

```
营销内容包工作流（5个节点）
┌───────────────────────┐
│ 1. generate_titles    │ ✓ 生成小红书标题
├───────────────────────┤
│ 2. generate_content   │ ✓ 生成图文正文
├───────────────────────┤
│ 3. generate_hashtags  │ ✓ 生成话题标签
├───────────────────────┤
│ 4. generate_moments   │ → 生成朋友圈文案
├───────────────────────┤
│ 5. package_results    │ ○ 打包ZIP下载
└───────────────────────┘
```

## 🔧 技术栈

- **后端框架**: Fastify + TypeScript
- **数据库**: PostgreSQL + Prisma ORM
- **消息队列**: BullMQ + Redis
- **AI服务**: 豆包LLM API
- **TTS服务**: 火山引擎声音克隆
- **存储**: 阿里云OSS
- **实时通信**: WebSocket

## 🎨 前端集成示例

```typescript
// React组件示例
const [progress, setProgress] = useState(0);
const [steps, setSteps] = useState([]);

// 创建任务
const response = await fetch('/api/v1/content-assistant/marketing-package', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({ imageUrls, projectDescription })
});

const { workflowId } = await response.json();

// 监听WebSocket进度
ws.onmessage = (event) => {
  const { event: eventType, payload } = JSON.parse(event.data);
  
  if (eventType === 'workflow.progress') {
    setProgress(payload.progress);
    setSteps(payload.steps);
  }
};
```

## 🐛 已知限制

1. **图片分析**: 目前未集成视觉模型，使用文本描述代替
2. **ZIP上传**: 当前返回本地路径，生产环境需上传到OSS
3. **字幕时间**: 使用简单估算，建议根据实际音频时长调整

## 🔄 后续计划

- [ ] 集成豆包Vision多模态模型
- [ ] 完善OSS文件上传
- [ ] 添加工作流重试机制
- [ ] 实现模板系统
- [ ] 支持批量处理
- [ ] 可视化工作流设计器

## 🤝 贡献

欢迎提交Issue和PR！

## 📄 许可证

MIT License

---

**立即体验 OpenClaw 内容助手，让AI助力您的营销创作！** 🚀
