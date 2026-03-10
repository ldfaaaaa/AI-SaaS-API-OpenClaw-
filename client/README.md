# WorkflowProgress React 组件

这是一个用于显示工作流执行进度的 React 组件，支持实时 WebSocket 更新和动画效果。

## 功能特性

- ✅ 显示多步骤工作流进度
- ✅ 四种步骤状态：waiting, running, completed, failed
- ✅ 实时 WebSocket 连接和更新
- ✅ Framer Motion 动画效果
- ✅ 自动重连机制
- ✅ 显示执行时间和耗时
- ✅ 完成后显示下载按钮
- ✅ 错误信息展示

## 安装依赖

```bash
npm install framer-motion
# 或
yarn add framer-motion
# 或
pnpm add framer-motion
```

如果使用 TypeScript，还需要:

```bash
npm install --save-dev @types/react @types/react-dom
```

## 基本使用

```tsx
import { WorkflowProgress } from './components/WorkflowProgress';

function App() {
  const handleComplete = (downloadUrl: string) => {
    console.log('工作流完成:', downloadUrl);
  };

  return (
    <WorkflowProgress
      taskId="task-123456"
      userId="user-789"
      onComplete={handleComplete}
    />
  );
}
```

## 组件属性

### WorkflowProgress Props

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| taskId | string | 是 | 任务 ID，用于过滤 WebSocket 消息 |
| userId | string | 是 | 用户 ID，用于建立 WebSocket 连接 |
| onComplete | (downloadUrl: string) => void | 否 | 工作流完成时的回调函数 |

### WorkflowStep 数据结构

```typescript
interface WorkflowStep {
  id: string;              // 步骤唯一标识
  name: string;            // 步骤名称
  description: string;     // 步骤描述
  status: StepStatus;      // 步骤状态
  startTime?: string;      // 开始时间 (ISO 8601 格式)
  endTime?: string;        // 结束时间 (ISO 8601 格式)
  duration?: number;       // 执行耗时（毫秒）
  error?: string;          // 错误信息（仅在失败时）
}

type StepStatus = 'waiting' | 'running' | 'completed' | 'failed';
```

## WebSocket 消息格式

### 1. 工作流进度更新

```json
{
  "event": "workflow.progress",
  "payload": {
    "taskId": "task-123456",
    "steps": [
      {
        "id": "step-1",
        "name": "准备资源",
        "description": "初始化工作环境和加载必要资源",
        "status": "completed",
        "startTime": "2026-03-08T10:00:00Z",
        "endTime": "2026-03-08T10:00:02Z",
        "duration": 2000
      },
      {
        "id": "step-2",
        "name": "数据处理",
        "description": "处理和转换输入数据",
        "status": "running",
        "startTime": "2026-03-08T10:00:02Z"
      }
    ]
  },
  "timestamp": "2026-03-08T10:00:02Z"
}
```

### 2. 单个步骤状态更新

```json
{
  "event": "workflow.step.update",
  "payload": {
    "taskId": "task-123456",
    "stepId": "step-2",
    "status": "completed",
    "endTime": "2026-03-08T10:00:05Z",
    "duration": 3000
  },
  "timestamp": "2026-03-08T10:00:05Z"
}
```

### 3. 工作流完成

```json
{
  "event": "workflow.completed",
  "payload": {
    "taskId": "task-123456",
    "downloadUrl": "https://example.com/download/result.zip"
  },
  "timestamp": "2026-03-08T10:00:15Z"
}
```

### 4. 工作流失败

```json
{
  "event": "workflow.failed",
  "payload": {
    "taskId": "task-123456",
    "error": "处理超时"
  },
  "timestamp": "2026-03-08T10:00:15Z"
}
```

## 后端集成示例

### 发送工作流进度更新

```typescript
// 在 generation-task.processor.ts 中
import { notificationGateway } from '../gateways/notification.gateway';

async function processTask(taskId: string, userId: string) {
  const steps = [
    {
      id: 'step-1',
      name: '准备资源',
      description: '初始化工作环境和加载必要资源',
      status: 'waiting' as const,
    },
    // ... 更多步骤
  ];

  // 发送初始进度
  await notificationGateway.notifyUser(userId, 'workflow.progress', {
    taskId,
    steps,
  });

  // 更新步骤状态
  for (const step of steps) {
    const startTime = new Date().toISOString();
    
    await notificationGateway.notifyUser(userId, 'workflow.step.update', {
      taskId,
      stepId: step.id,
      status: 'running',
      startTime,
    });

    try {
      // 执行步骤逻辑
      await executeStep(step);
      
      const endTime = new Date().toISOString();
      const duration = Date.parse(endTime) - Date.parse(startTime);

      await notificationGateway.notifyUser(userId, 'workflow.step.update', {
        taskId,
        stepId: step.id,
        status: 'completed',
        endTime,
        duration,
      });
    } catch (error) {
      await notificationGateway.notifyUser(userId, 'workflow.step.update', {
        taskId,
        stepId: step.id,
        status: 'failed',
        error: error.message,
        endTime: new Date().toISOString(),
      });
      
      throw error;
    }
  }

  // 工作流完成
  await notificationGateway.notifyUser(userId, 'workflow.completed', {
    taskId,
    downloadUrl: 'https://example.com/download/result.zip',
  });
}
```

## 样式定制

组件使用 Tailwind CSS 类名。如果不使用 Tailwind，可以:

1. 使用提供的 CSS 模块文件 `WorkflowProgress.module.css`
2. 或者自定义样式

### 使用 CSS 模块

```tsx
import styles from './WorkflowProgress.module.css';

// 将 className 改为使用 styles
<div className={styles.container}>
```

## 环境变量配置

在 `.env` 文件中配置 WebSocket 地址:

```env
REACT_APP_WS_HOST=localhost:3000
```

或在生产环境中使用完整的 WebSocket URL。

## 特性说明

### 自动重连

组件内置自动重连机制：
- 连接断开后自动尝试重连
- 采用指数退避策略（最大 10 秒）
- 最多尝试 5 次

### 动画效果

使用 Framer Motion 实现的动画：
- 步骤卡片淡入和滑入动画
- 运行中状态的旋转图标
- 进度条滚动动画
- 下载按钮出现动画

### 响应式设计

组件采用响应式设计，适配不同屏幕尺寸。

## 许可证

MIT
