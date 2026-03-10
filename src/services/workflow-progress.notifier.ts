/**
 * 工作流进度通知集成示例
 * 
 * 此文件展示如何在 generation-task.processor.ts 中
 * 集成 WorkflowProgress 组件所需的 WebSocket 通知
 */

import type { Job } from 'bullmq';
import { notificationGateway } from '../gateways/notification.gateway';

export interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  status: 'waiting' | 'running' | 'completed' | 'failed';
  startTime?: string;
  endTime?: string;
  duration?: number;
  error?: string;
}

export class WorkflowProgressNotifier {
  /**
   * 初始化工作流进度
   */
  static async initializeWorkflow(
    userId: string,
    taskId: string,
    steps: Omit<WorkflowStep, 'status'>[]
  ): Promise<void> {
    const initialSteps: WorkflowStep[] = steps.map((step) => ({
      ...step,
      status: 'waiting' as const,
    }));

    await notificationGateway.notifyUser(userId, 'workflow.progress', {
      taskId,
      steps: initialSteps,
    });
  }

  /**
   * 更新步骤状态为运行中
   */
  static async startStep(
    userId: string,
    taskId: string,
    stepId: string
  ): Promise<string> {
    const startTime = new Date().toISOString();

    await notificationGateway.notifyUser(userId, 'workflow.step.update', {
      taskId,
      stepId,
      status: 'running',
      startTime,
    });

    return startTime;
  }

  /**
   * 更新步骤状态为完成
   */
  static async completeStep(
    userId: string,
    taskId: string,
    stepId: string,
    startTime: string
  ): Promise<void> {
    const endTime = new Date().toISOString();
    const duration = Date.parse(endTime) - Date.parse(startTime);

    await notificationGateway.notifyUser(userId, 'workflow.step.update', {
      taskId,
      stepId,
      status: 'completed',
      endTime,
      duration,
    });
  }

  /**
   * 更新步骤状态为失败
   */
  static async failStep(
    userId: string,
    taskId: string,
    stepId: string,
    error: string,
    startTime?: string
  ): Promise<void> {
    const endTime = new Date().toISOString();
    const duration = startTime
      ? Date.parse(endTime) - Date.parse(startTime)
      : undefined;

    await notificationGateway.notifyUser(userId, 'workflow.step.update', {
      taskId,
      stepId,
      status: 'failed',
      error,
      endTime,
      duration,
    });
  }

  /**
   * 通知工作流完成
   */
  static async completeWorkflow(
    userId: string,
    taskId: string,
    downloadUrl: string
  ): Promise<void> {
    await notificationGateway.notifyUser(userId, 'workflow.completed', {
      taskId,
      downloadUrl,
    });
  }

  /**
   * 通知工作流失败
   */
  static async failWorkflow(
    userId: string,
    taskId: string,
    error: string
  ): Promise<void> {
    await notificationGateway.notifyUser(userId, 'workflow.failed', {
      taskId,
      error,
    });
  }
}

/**
 * 在现有的 generation-task.processor.ts 中集成示例
 */
export async function processGenerationTaskWithProgress(job: Job): Promise<void> {
  const { taskId, userId, params } = job.data;

  // 定义工作流步骤
  const workflowSteps = [
    {
      id: 'prepare',
      name: '准备资源',
      description: '初始化工作环境和加载必要资源',
    },
    {
      id: 'process',
      name: '数据处理',
      description: '处理和转换输入数据',
    },
    {
      id: 'generate',
      name: 'AI 生成',
      description: '使用豆包模型生成内容',
    },
    {
      id: 'upload',
      name: '上传结果',
      description: '将生成结果上传到 OSS',
    },
    {
      id: 'package',
      name: '打包输出',
      description: '打包并准备下载链接',
    },
  ];

  try {
    // 1. 初始化工作流
    await WorkflowProgressNotifier.initializeWorkflow(
      userId,
      taskId,
      workflowSteps
    );

    // 2. 执行步骤 1: 准备资源
    let startTime = await WorkflowProgressNotifier.startStep(
      userId,
      taskId,
      'prepare'
    );
    await prepareResources(params);
    await WorkflowProgressNotifier.completeStep(
      userId,
      taskId,
      'prepare',
      startTime
    );

    // 3. 执行步骤 2: 数据处理
    startTime = await WorkflowProgressNotifier.startStep(
      userId,
      taskId,
      'process'
    );
    const processedData = await processData(params);
    await WorkflowProgressNotifier.completeStep(
      userId,
      taskId,
      'process',
      startTime
    );

    // 4. 执行步骤 3: AI 生成
    startTime = await WorkflowProgressNotifier.startStep(
      userId,
      taskId,
      'generate'
    );
    const generatedContent = await generateWithAI(processedData);
    await WorkflowProgressNotifier.completeStep(
      userId,
      taskId,
      'generate',
      startTime
    );

    // 5. 执行步骤 4: 上传结果
    startTime = await WorkflowProgressNotifier.startStep(
      userId,
      taskId,
      'upload'
    );
    const uploadUrl = await uploadToOSS(generatedContent);
    await WorkflowProgressNotifier.completeStep(
      userId,
      taskId,
      'upload',
      startTime
    );

    // 6. 执行步骤 5: 打包输出
    startTime = await WorkflowProgressNotifier.startStep(
      userId,
      taskId,
      'package'
    );
    const downloadUrl = await packageResults(uploadUrl);
    await WorkflowProgressNotifier.completeStep(
      userId,
      taskId,
      'package',
      startTime
    );

    // 7. 通知工作流完成
    await WorkflowProgressNotifier.completeWorkflow(
      userId,
      taskId,
      downloadUrl
    );
  } catch (error) {
    // 通知工作流失败
    await WorkflowProgressNotifier.failWorkflow(
      userId,
      taskId,
      error instanceof Error ? error.message : '未知错误'
    );
    throw error;
  }
}

// 模拟的辅助函数（实际实现应该在你的服务中）
async function prepareResources(params: any): Promise<void> {
  // 实现资源准备逻辑
  await new Promise((resolve) => setTimeout(resolve, 1000));
}

async function processData(params: any): Promise<any> {
  // 实现数据处理逻辑
  await new Promise((resolve) => setTimeout(resolve, 2000));
  return { processed: true };
}

async function generateWithAI(data: any): Promise<any> {
  // 调用豆包 API 生成内容
  await new Promise((resolve) => setTimeout(resolve, 5000));
  return { content: 'generated content' };
}

async function uploadToOSS(content: any): Promise<string> {
  // 上传到阿里云 OSS
  await new Promise((resolve) => setTimeout(resolve, 2000));
  return 'https://oss.example.com/file.zip';
}

async function packageResults(url: string): Promise<string> {
  // 打包结果
  await new Promise((resolve) => setTimeout(resolve, 1000));
  return url;
}
