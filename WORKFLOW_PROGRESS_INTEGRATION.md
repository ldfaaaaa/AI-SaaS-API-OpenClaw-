# WorkflowProgress 组件集成指南

本指南描述了如何将 WorkflowProgress React 组件集成到你的 AI-SaaS-API 项目中。

## 📁 已创建的文件

### 前端文件（在 `client/` 目录）

```
client/
├── components/
│   ├── WorkflowProgress.tsx          # 主组件
│   └── WorkflowProgress.module.css   # CSS 模块样式（可选）
├── hooks/
│   └── useWorkflowWebSocket.ts       # WebSocket 连接 Hook
├── examples/
│   └── WorkflowProgressExample.tsx   # 使用示例
├── package.json                      # 依赖配置
├── tsconfig.json                     # TypeScript 配置
└── README.md                         # 详细文档
```

### 后端文件（在 `src/` 目录）

```
src/
└── services/
    └── workflow-progress.notifier.ts  # 后端通知工具类
```

## 🚀 快速开始

### 1. 安装前端依赖

```bash
cd client
npm install
# 或
pnpm install
```

主要依赖：
- `framer-motion`: 动画效果库
- `react` 和 `react-dom`: React 框架（peer dependencies）

### 2. 在 React 应用中使用

```tsx
import { WorkflowProgress } from './client/components/WorkflowProgress';

function App() {
  return (
    <WorkflowProgress
      taskId="task-123456"
      userId="user-789"
      onComplete={(url) => {
        console.log('下载地址:', url);
      }}
    />
  );
}
```

### 3. 在后端集成工作流通知

在你的 `generation-task.processor.ts` 或其他任务处理文件中：

```typescript
import { WorkflowProgressNotifier } from './services/workflow-progress.notifier';

export async function processTask(job: Job) {
  const { taskId, userId } = job.data;

  // 1. 定义工作流步骤
  const steps = [
    { id: 'step1', name: '准备资源', description: '初始化环境' },
    { id: 'step2', name: '处理数据', description: '转换输入数据' },
    { id: 'step3', name: 'AI 生成', description: '生成内容' },
  ];

  // 2. 初始化工作流
  await WorkflowProgressNotifier.initializeWorkflow(userId, taskId, steps);

  try {
    // 3. 执行每个步骤
    for (const step of steps) {
      const startTime = await WorkflowProgressNotifier.startStep(
        userId,
        taskId,
        step.id
      );

      // 执行实际的业务逻辑
      await executeStepLogic(step);

      await WorkflowProgressNotifier.completeStep(
        userId,
        taskId,
        step.id,
        startTime
      );
    }

    // 4. 完成工作流
    await WorkflowProgressNotifier.completeWorkflow(
      userId,
      taskId,
      'https://example.com/download/result.zip'
    );
  } catch (error) {
    // 5. 处理失败
    await WorkflowProgressNotifier.failWorkflow(
      userId,
      taskId,
      error.message
    );
    throw error;
  }
}
```

## 📡 WebSocket 消息格式

### 客户端连接

WebSocket 端点：`ws://your-domain/ws/notifications?userId={userId}`

已在 `notification.gateway.ts` 中实现，无需修改。

### 服务端发送的消息类型

#### 1. 初始化工作流进度
```typescript
{
  event: 'workflow.progress',
  payload: {
    taskId: string,
    steps: WorkflowStep[]
  },
  timestamp: string
}
```

#### 2. 更新步骤状态
```typescript
{
  event: 'workflow.step.update',
  payload: {
    taskId: string,
    stepId: string,
    status: 'waiting' | 'running' | 'completed' | 'failed',
    startTime?: string,
    endTime?: string,
    duration?: number,
    error?: string
  },
  timestamp: string
}
```

#### 3. 工作流完成
```typescript
{
  event: 'workflow.completed',
  payload: {
    taskId: string,
    downloadUrl: string
  },
  timestamp: string
}
```

#### 4. 工作流失败
```typescript
{
  event: 'workflow.failed',
  payload: {
    taskId: string,
    error: string
  },
  timestamp: string
}
```

## 🎨 样式定制

### 使用 Tailwind CSS（推荐）

组件默认使用 Tailwind CSS 类名。确保你的项目已配置 Tailwind：

```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init
```

在 `tailwind.config.js` 中添加：

```javascript
module.exports = {
  content: [
    './client/**/*.{js,jsx,ts,tsx}',
  ],
  // ... 其他配置
}
```

### 不使用 Tailwind

如果不使用 Tailwind，可以使用提供的 CSS 模块：

```tsx
import styles from './WorkflowProgress.module.css';
// 然后修改组件中的 className
```

或者编写自己的样式文件。

## 🔧 配置

### 环境变量

创建 `.env` 文件（前端项目）：

```env
# WebSocket 服务器地址
REACT_APP_WS_HOST=localhost:3000

# 或者在生产环境
REACT_APP_WS_HOST=api.your-domain.com
```

### TypeScript 配置

已提供 `client/tsconfig.json`，如果需要集成到现有项目，确保包含：

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "types": ["node"]
  }
}
```

## 📊 组件特性

### ✅ 已实现的功能

- ✅ 多步骤工作流显示
- ✅ 四种状态（waiting, running, completed, failed）
- ✅ WebSocket 实时更新
- ✅ 自动重连机制（最多 5 次，指数退避）
- ✅ Framer Motion 动画
  - 步骤卡片淡入/滑入
  - 运行中的旋转图标
  - 进度条滚动
  - 下载按钮出现动画
- ✅ 执行时间显示
- ✅ 耗时统计
- ✅ 错误信息展示
- ✅ 完成后下载按钮
- ✅ 连接状态指示器
- ✅ 响应式设计

### 🎯 使用场景

适用于以下场景：
- 内容生成任务进度追踪
- 声音克隆工作流
- 文件处理流程
- AI 模型推理管道
- 批量任务处理
- 任何多步骤异步任务

## 🔍 调试

### 查看 WebSocket 连接

在浏览器控制台：

```javascript
// WebSocket 连接日志会自动输出
// 检查是否收到消息
```

### 后端日志

在你的任务处理器中添加日志：

```typescript
console.log('发送工作流通知:', { userId, taskId, event });
```

### 常见问题

**Q: WebSocket 连接失败**
- 检查 `REACT_APP_WS_HOST` 环境变量
- 确认后端 WebSocket 服务已启动
- 检查防火墙和 CORS 设置

**Q: 没有收到更新**
- 确认 `taskId` 和 `userId` 正确
- 检查后端是否正确调用 `notificationGateway.notifyUser`
- 查看浏览器控制台和网络标签

**Q: 动画不流畅**
- 确保已安装 `framer-motion`
- 检查浏览器性能

## 📚 更多示例

查看 `client/examples/WorkflowProgressExample.tsx` 了解完整的使用示例。

查看 `src/services/workflow-progress.notifier.ts` 了解后端集成的完整示例。

## 🤝 集成到现有路由

在你的内容助手或声音克隆 API 中，创建任务时返回 `taskId`：

```typescript
// content-assistant.controller.ts
export async function generateContent(req: FastifyRequest, reply: FastifyReply) {
  const userId = req.user.id;
  const taskId = generateTaskId();
  
  // 添加任务到队列
  await generationQueue.add('generate', {
    taskId,
    userId,
    params: req.body,
  });
  
  // 返回任务 ID 给前端
  return reply.send({
    success: true,
    data: { taskId }
  });
}
```

前端使用返回的 `taskId`：

```tsx
const [taskId, setTaskId] = useState<string | null>(null);

async function startGeneration() {
  const response = await fetch('/api/content-assistant/generate', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  const { data } = await response.json();
  setTaskId(data.taskId);
}

return taskId ? (
  <WorkflowProgress taskId={taskId} userId={currentUser.id} />
) : null;
```

## 📄 许可证

MIT

---

如有问题，请查看详细文档 `client/README.md` 或检查示例代码。
