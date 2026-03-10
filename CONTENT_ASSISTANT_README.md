# OpenClaw 内容助手模块 - 使用文档

## 📋 概述

OpenClaw内容助手模块是一个基于工作流自动化的AI内容生成系统，专为室内设计营销场景设计。采用OpenClaw工作流引擎，支持实时进度追踪和WebSocket通知。

## 🎯 核心功能

### 功能1：设计图 → 营销内容包生成

自动生成完整的营销内容包，包括：
- **小红书标题**：5个候选标题（15-25字，带emoji）
- **图文正文**：约500字的专业设计解说
- **话题标签**：10个热门标签
- **朋友圈文案**：3个版本（专业版/轻松版/吸引版）
- **打包下载**：ZIP文件（图片+文案TXT+标签）

### 功能2：效果图 → 配音解说脚本

自动生成短视频配音内容，包括：
- **AI图片分析**：识别设计要素和亮点
- **解说文案**：约300字的口播脚本
- **字幕列表**：SRT格式，带时间戳
- **音频合成**：使用声音克隆TTS生成MP3（可选）
- **打包下载**：ZIP文件（文案.txt + 字幕.srt + 音频.mp3）

## 🏗️ 架构设计

### 工作流引擎

基于OpenClaw工作流引擎，每个功能由多个节点组成：

```
营销内容包工作流（5个节点）:
1. generate_titles     → 生成小红书标题
2. generate_content    → 生成图文正文
3. generate_hashtags   → 生成话题标签
4. generate_moments    → 生成朋友圈文案
5. package_results     → 打包ZIP下载

配音解说工作流（3-4个节点）:
1. analyze_image       → AI分析图片内容
2. generate_script     → 生成解说文案
3. generate_subtitles  → 生成字幕列表
4. synthesize_audio    → 合成音频（可选）
```

### 数据模型

```typescript
// 内容包
ContentPackage {
  id: string
  package_type: 'marketing' | 'voiceover'
  result_data: JSON        // 生成的内容
  result_zip_url: string   // 下载链接
}

// 工作流执行
WorkflowExecution {
  id: string
  workflow_type: string
  workflow_status: 'queued' | 'running' | 'completed' | 'failed'
  total_steps: number
  completed_steps: number
  current_step: string
}

// 工作流步骤
WorkflowStep {
  step_name: string
  step_status: 'pending' | 'running' | 'completed' | 'failed'
  step_input: JSON
  step_output: JSON
}
```

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install adm-zip
npm install --save-dev @types/adm-zip
```

### 2. 配置环境变量

在 `.env` 文件中添加：

```env
# 豆包AI配置
DOUBAO_API_KEY=your_api_key_here
DOUBAO_CHAT_MODEL=doubao-pro-32k    # Chat LLM模型
DOUBAO_IMAGE_MODEL=doubao-xl        # 图像生成模型（可选）
DOUBAO_VIDEO_MODEL=doubao-video     # 视频生成模型（可选）

# 声音克隆配置（用于配音功能）
VOICE_CLONE_API_TOKEN=your_token
VOICE_CLONE_APP_ID=your_app_id

# OSS存储配置
OSS_ACCESS_KEY_ID=your_key
OSS_ACCESS_KEY_SECRET=your_secret
OSS_BUCKET=your_bucket
OSS_REGION=oss-cn-hangzhou
OSS_ENDPOINT=https://oss-cn-hangzhou.aliyuncs.com
```

### 3. 运行数据库迁移

```bash
npx prisma migrate dev --name add_openclaw_workflow
# 或者
npx prisma db push
```

### 4. 启动服务

```bash
npm run dev
```

## 📡 API接口文档

### 1. 生成营销内容包

**请求**:
```http
POST /api/v1/content-assistant/marketing-package
Authorization: Bearer <token>
Content-Type: application/json

{
  "imageUrls": [
    "https://example.com/image1.jpg",
    "https://example.com/image2.jpg"
  ],
  "projectDescription": {
    "style": "现代简约",
    "area": "120㎡",
    "budget": "20万",
    "otherInfo": "三室两厅，注重收纳"
  }
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "workflowId": "clxxxxxxxxxxxxxx",
    "contentPackageId": "clxxxxxxxxxxxxxx",
    "message": "营销内容包生成任务已创建，请通过工作流ID查询进度"
  },
  "message": "任务创建成功"
}
```

### 2. 生成配音解说脚本

**请求**:
```http
POST /api/v1/content-assistant/voiceover-script
Authorization: Bearer <token>
Content-Type: application/json

{
  "imageUrl": "https://example.com/room.jpg",
  "styleDescription": "现代轻奢风格客厅设计",
  "voiceProfileId": "clxxxxxxxxxxxxxx"  // 可选
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "workflowId": "clxxxxxxxxxxxxxx",
    "contentPackageId": "clxxxxxxxxxxxxxx",
    "message": "配音解说脚本生成任务已创建，请通过工作流ID查询进度"
  },
  "message": "任务创建成功"
}
```

### 3. 查询工作流状态

**请求**:
```http
GET /api/v1/content-assistant/workflow/{workflowId}
Authorization: Bearer <token>
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "clxxxxxxxxxxxxxx",
    "workflowType": "marketing_package",
    "status": "running",
    "totalSteps": 5,
    "completedSteps": 3,
    "currentStep": "generate_moments",
    "progress": 60,
    "errorMessage": null,
    "startedAt": "2024-01-15T10:00:00.000Z",
    "completedAt": null,
    "steps": [
      {
        "name": "generate_titles",
        "order": 1,
        "status": "completed",
        "startedAt": "2024-01-15T10:00:00.000Z",
        "completedAt": "2024-01-15T10:00:15.000Z"
      },
      {
        "name": "generate_content",
        "order": 2,
        "status": "completed",
        "startedAt": "2024-01-15T10:00:15.000Z",
        "completedAt": "2024-01-15T10:00:35.000Z"
      },
      {
        "name": "generate_hashtags",
        "order": 3,
        "status": "completed",
        "startedAt": "2024-01-15T10:00:35.000Z",
        "completedAt": "2024-01-15T10:00:45.000Z"
      },
      {
        "name": "generate_moments",
        "order": 4,
        "status": "running",
        "startedAt": "2024-01-15T10:00:45.000Z"
      },
      {
        "name": "package_results",
        "order": 5,
        "status": "pending"
      }
    ],
    "contentPackage": {
      "id": "clxxxxxxxxxxxxxx",
      "packageName": "营销内容包_2024-01-15",
      "packageType": "marketing",
      "resultZipUrl": null
    }
  }
}
```

### 4. 获取内容包详情

**请求**:
```http
GET /api/v1/content-assistant/package/{packageId}
Authorization: Bearer <token>
```

**响应**（工作流完成后）:
```json
{
  "success": true,
  "data": {
    "id": "clxxxxxxxxxxxxxx",
    "packageName": "营销内容包_2024-01-15",
    "packageType": "marketing",
    "description": "风格：现代简约，面积：120㎡，预算：20万",
    "assets": {
      "imageUrls": ["https://example.com/image1.jpg"]
    },
    "resultData": {
      "titles": [
        "🏠120㎡现代简约之家｜20万打造梦想空间",
        "✨三室两厅的收纳秘籍｜告别杂乱拥抱整洁",
        "..."
      ],
      "content": "这套120㎡的三室两厅...",
      "hashtags": ["#现代简约", "#三室两厅", "..."],
      "moments": {
        "professional": "...",
        "casual": "...",
        "attractive": "..."
      }
    },
    "resultZipUrl": "https://oss.example.com/package.zip",
    "workflow": { /* 工作流信息 */ },
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T10:02:00.000Z"
  }
}
```

### 5. 获取内容包列表

**请求**:
```http
GET /api/v1/content-assistant/packages?page=1&limit=20&packageType=all
Authorization: Bearer <token>
```

**响应**:
```json
{
  "success": true,
  "data": {
    "packages": [
      {
        "id": "clxxxxxxxxxxxxxx",
        "packageName": "营销内容包_2024-01-15",
        "packageType": "marketing",
        "description": "...",
        "resultZipUrl": "https://oss.example.com/package.zip",
        "workflow": { /* 最新工作流 */ },
        "createdAt": "2024-01-15T10:00:00.000Z",
        "updatedAt": "2024-01-15T10:02:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5,
      "totalPages": 1
    }
  }
}
```

### 6. 取消工作流

**请求**:
```http
POST /api/v1/content-assistant/workflow/{workflowId}/cancel
Authorization: Bearer <token>
```

**响应**:
```json
{
  "success": true,
  "message": "工作流已取消"
}
```

## 🔔 WebSocket实时通知

连接WebSocket以接收工作流进度通知：

```javascript
const ws = new WebSocket('ws://localhost:3000/ws/notifications?token=<accessToken>');

ws.onmessage = (event) => {
  const notification = JSON.parse(event.data);
  
  switch (notification.event) {
    case 'workflow.started':
      console.log('工作流已开始', notification.payload);
      break;
      
    case 'workflow.step.updated':
      console.log('步骤更新', notification.payload);
      // { workflowId, stepName, stepStatus, stepOrder }
      break;
      
    case 'workflow.progress':
      console.log('进度更新', notification.payload);
      // { workflowId, completedSteps, totalSteps, progress, isCompleted }
      break;
      
    case 'workflow.completed':
      console.log('工作流完成', notification.payload);
      break;
      
    case 'workflow.failed':
      console.log('工作流失败', notification.payload);
      break;
      
    case 'workflow.cancelled':
      console.log('工作流已取消', notification.payload);
      break;
  }
};
```

## 📦 ZIP包内容结构

### 营销内容包

```
marketing_package.zip
├── 营销文案.txt
│   ├── 小红书标题候选（5个）
│   ├── 图文正文
│   └── 朋友圈文案（3个版本）
├── 话题标签.txt
│   └── 10个标签
├── 图片_1.jpg
├── 图片_2.jpg
└── ...
```

### 配音解说包

```
voiceover_package.zip
├── 解说文案.txt
├── 字幕.srt
└── 解说音频.mp3（可选）
```

## 🎨 前端集成示例

### React组件示例

```tsx
import { useState, useEffect } from 'react';

function MarketingPackageGenerator() {
  const [workflowId, setWorkflowId] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [steps, setSteps] = useState([]);

  // 创建营销内容包
  const handleGenerate = async () => {
    const response = await fetch('/api/v1/content-assistant/marketing-package', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        imageUrls: ['https://example.com/image.jpg'],
        projectDescription: {
          style: '现代简约',
          area: '120㎡',
          budget: '20万'
        }
      })
    });

    const data = await response.json();
    setWorkflowId(data.data.workflowId);
    
    // 开始轮询状态
    pollWorkflowStatus(data.data.workflowId);
  };

  // 轮询工作流状态
  const pollWorkflowStatus = async (id: string) => {
    const interval = setInterval(async () => {
      const response = await fetch(`/api/v1/content-assistant/workflow/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      setProgress(data.data.progress);
      setCurrentStep(data.data.currentStep);
      setSteps(data.data.steps);

      if (data.data.status === 'completed' || data.data.status === 'failed') {
        clearInterval(interval);
        
        if (data.data.status === 'completed') {
          // 下载ZIP
          const zipUrl = data.data.contentPackage.resultZipUrl;
          window.open(zipUrl, '_blank');
        }
      }
    }, 2000);
  };

  return (
    <div>
      <button onClick={handleGenerate}>生成营销内容包</button>
      
      {workflowId && (
        <div className="workflow-progress">
          <h3>工作流进度: {progress}%</h3>
          <div className="progress-bar">
            <div style={{ width: `${progress}%` }} className="progress-fill"></div>
          </div>
          
          <ul className="steps-list">
            {steps.map((step) => (
              <li key={step.name} className={`step-${step.status}`}>
                <span className="step-name">{step.name}</span>
                <span className="step-status">{step.status}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

## ⚙️ 高级配置

### 自定义LLM提示词

修改 `src/services/content-assistant.service.ts` 中的提示词模板：

```typescript
private async generateTitles(projectDesc: string): Promise<string[]> {
  const prompt = `作为一名专业的室内设计营销专家...`;  // 自定义
  // ...
}
```

### 调整字幕时间戳算法

```typescript
private async generateSubtitles(script: string): Promise<SubtitleEntry[]> {
  // 修改每字时长（默认0.3秒）
  const duration = Math.max(2, text.length * 0.3);  // 自定义
  // ...
}
```

## 🐛 故障排查

### 问题1: 工作流一直处于queued状态

**原因**: Worker未启动或队列连接失败

**解决**:
1. 检查Redis连接是否正常
2. 确认BullMQ Worker已启动
3. 查看日志: `console.log` in `generation.worker.ts`

### 问题2: LLM生成内容格式不正确

**原因**: LLM输出格式不稳定

**解决**:
1. 调整提示词，增加格式要求
2. 添加输出验证和重试机制
3. 使用温度参数（temperature）控制稳定性

### 问题3: ZIP下载链接403错误

**原因**: OSS签名过期或权限不足

**解决**:
1. 检查OSS Bucket权限设置
2. 设置更长的签名有效期
3. 使用CDN加速域名

## 📚 相关文档

- [Prisma Schema文档](./prisma/schema.prisma)
- [豆包API文档](https://www.volcengine.com/docs/82379)
- [声音克隆API文档](./VOICE_CLONE_README.md)
- [后端架构文档](./BACKEND_README.md)

## 🤝 贡献指南

欢迎提交Issue和Pull Request！

## 📄 许可证

MIT License
