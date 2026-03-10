import React from 'react';
import { WorkflowProgress } from '../components/WorkflowProgress';

/**
 * WorkflowProgress 组件使用示例
 */
export const WorkflowProgressExample: React.FC = () => {
  const handleComplete = (downloadUrl: string) => {
    console.log('工作流完成，下载地址:', downloadUrl);
    // 可以在这里添加其他逻辑，如显示通知、更新状态等
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <WorkflowProgress
        taskId="task-123456"
        userId="user-789"
        onComplete={handleComplete}
      />
    </div>
  );
};

/**
 * 模拟后端发送的 WebSocket 消息示例
 * 
 * 1. 初始化工作流进度:
 * {
 *   "event": "workflow.progress",
 *   "payload": {
 *     "taskId": "task-123456",
 *     "steps": [
 *       {
 *         "id": "step-1",
 *         "name": "准备资源",
 *         "description": "初始化工作环境和加载必要资源",
 *         "status": "completed",
 *         "startTime": "2026-03-08T10:00:00Z",
 *         "endTime": "2026-03-08T10:00:02Z",
 *         "duration": 2000
 *       },
 *       {
 *         "id": "step-2",
 *         "name": "数据处理",
 *         "description": "处理和转换输入数据",
 *         "status": "running",
 *         "startTime": "2026-03-08T10:00:02Z"
 *       },
 *       {
 *         "id": "step-3",
 *         "name": "AI 生成",
 *         "description": "使用 AI 模型生成内容",
 *         "status": "waiting"
 *       },
 *       {
 *         "id": "step-4",
 *         "name": "结果打包",
 *         "description": "打包并上传生成结果",
 *         "status": "waiting"
 *       }
 *     ]
 *   },
 *   "timestamp": "2026-03-08T10:00:02Z"
 * }
 * 
 * 2. 更新单个步骤状态:
 * {
 *   "event": "workflow.step.update",
 *   "payload": {
 *     "taskId": "task-123456",
 *     "stepId": "step-2",
 *     "status": "completed",
 *     "endTime": "2026-03-08T10:00:05Z",
 *     "duration": 3000
 *   },
 *   "timestamp": "2026-03-08T10:00:05Z"
 * }
 * 
 * 3. 工作流完成:
 * {
 *   "event": "workflow.completed",
 *   "payload": {
 *     "taskId": "task-123456",
 *     "downloadUrl": "https://example.com/download/result.zip"
 *   },
 *   "timestamp": "2026-03-08T10:00:15Z"
 * }
 * 
 * 4. 工作流失败:
 * {
 *   "event": "workflow.failed",
 *   "payload": {
 *     "taskId": "task-123456",
 *     "error": "处理超时"
 *   },
 *   "timestamp": "2026-03-08T10:00:15Z"
 * }
 * 
 * 5. 步骤失败:
 * {
 *   "event": "workflow.step.update",
 *   "payload": {
 *     "taskId": "task-123456",
 *     "stepId": "step-3",
 *     "status": "failed",
 *     "error": "AI 模型调用失败: 超时",
 *     "endTime": "2026-03-08T10:00:10Z",
 *     "duration": 5000
 *   },
 *   "timestamp": "2026-03-08T10:00:10Z"
 * }
 */

export default WorkflowProgressExample;
