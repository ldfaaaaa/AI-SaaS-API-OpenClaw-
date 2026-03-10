import prisma from '../utils/prisma';
import { notificationGateway } from '../gateways/notification.gateway';
import { NotFoundError, InternalServerError } from '../utils/errors';

/**
 * 工作流步骤定义
 */
export interface WorkflowStepDefinition {
  name: string;
  order: number;
  execute: (input: unknown) => Promise<unknown>;
}

/**
 * 工作流服务 - 管理工作流执行和步骤追踪
 */
export class WorkflowService {
  /**
   * 创建工作流执行记录
   */
  async createWorkflowExecution(
    userId: string,
    contentPackageId: string,
    workflowType: string,
    totalSteps: number
  ): Promise<string> {
    const execution = await prisma.workflowExecution.create({
      data: {
        user_id: userId,
        content_package_id: contentPackageId,
        workflow_type: workflowType,
        workflow_status: 'queued',
        total_steps: totalSteps,
        completed_steps: 0,
      },
    });

    return execution.id;
  }

  /**
   * 初始化工作流步骤
   */
  async initializeSteps(workflowId: string, steps: Array<{ name: string; order: number }>): Promise<void> {
    await prisma.workflowStep.createMany({
      data: steps.map((step) => ({
        workflow_id: workflowId,
        step_name: step.name,
        step_order: step.order,
        step_status: 'pending',
      })),
    });
  }

  /**
   * 开始执行工作流
   */
  async startWorkflowExecution(workflowId: string): Promise<void> {
    await prisma.workflowExecution.update({
      where: { id: workflowId },
      data: {
        workflow_status: 'running',
        started_at: new Date(),
      },
    });

    const execution = await prisma.workflowExecution.findUnique({
      where: { id: workflowId },
    });

    if (execution) {
      await notificationGateway.notifyUser(execution.user_id, 'workflow.started', {
        workflowId,
        workflowType: execution.workflow_type,
      });
    }
  }

  /**
   * 执行工作流步骤
   */
  async executeStep(
    workflowId: string,
    stepName: string,
    executor: (input: unknown) => Promise<unknown>,
    input?: unknown
  ): Promise<unknown> {
    // 查找步骤
    const step = await prisma.workflowStep.findFirst({
      where: {
        workflow_id: workflowId,
        step_name: stepName,
      },
    });

    if (!step) {
      throw new NotFoundError(`工作流步骤不存在: ${stepName}`);
    }

    // 标记步骤为运行中
    await this.updateStepStatus(step.id, 'running', input);

    try {
      // 执行步骤逻辑
      const output = await executor(input);

      // 标记步骤为完成
      await this.updateStepStatus(step.id, 'completed', input, output);

      // 更新工作流进度
      await this.updateWorkflowProgress(workflowId, stepName);

      return output;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '步骤执行失败';
      
      // 标记步骤为失败
      await this.updateStepStatus(step.id, 'failed', input, null, errorMessage);

      // 标记工作流为失败
      await this.markWorkflowFailed(workflowId, errorMessage);

      throw error;
    }
  }

  /**
   * 更新步骤状态
   */
  private async updateStepStatus(
    stepId: string,
    status: string,
    input?: unknown,
    output?: unknown,
    errorMessage?: string
  ): Promise<void> {
    const updateData: {
      step_status: string;
      step_input?: unknown;
      step_output?: unknown;
      error_message?: string | null;
      started_at?: Date;
      completed_at?: Date;
    } = {
      step_status: status,
    };

    if (input !== undefined) {
      updateData.step_input = input;
    }

    if (status === 'running') {
      updateData.started_at = new Date();
    }

    if (status === 'completed' || status === 'failed') {
      updateData.completed_at = new Date();
      if (output !== undefined) {
        updateData.step_output = output;
      }
      if (errorMessage) {
        updateData.error_message = errorMessage;
      }
    }

    await prisma.workflowStep.update({
      where: { id: stepId },
      data: updateData,
    });

    // 发送步骤状态通知
    const step = await prisma.workflowStep.findUnique({
      where: { id: stepId },
      include: {
        workflow: true,
      },
    });

    if (step) {
      await notificationGateway.notifyUser(step.workflow.user_id, 'workflow.step.updated', {
        workflowId: step.workflow_id,
        stepName: step.step_name,
        stepStatus: status,
        stepOrder: step.step_order,
      });
    }
  }

  /**
   * 更新工作流进度
   */
  private async updateWorkflowProgress(workflowId: string, currentStepName: string): Promise<void> {
    const execution = await prisma.workflowExecution.findUnique({
      where: { id: workflowId },
      include: {
        steps: {
          where: { step_status: 'completed' },
        },
      },
    });

    if (!execution) {
      throw new NotFoundError(`工作流不存在: ${workflowId}`);
    }

    const completedSteps = execution.steps.length;
    const isCompleted = completedSteps === execution.total_steps;

    await prisma.workflowExecution.update({
      where: { id: workflowId },
      data: {
        completed_steps: completedSteps,
        current_step: isCompleted ? null : currentStepName,
        workflow_status: isCompleted ? 'completed' : 'running',
        completed_at: isCompleted ? new Date() : null,
      },
    });

    // 发送进度通知
    await notificationGateway.notifyUser(execution.user_id, 'workflow.progress', {
      workflowId,
      completedSteps,
      totalSteps: execution.total_steps,
      progress: Math.round((completedSteps / execution.total_steps) * 100),
      isCompleted,
    });

    // 如果完成，发送完成通知
    if (isCompleted) {
      await notificationGateway.notifyUser(execution.user_id, 'workflow.completed', {
        workflowId,
        workflowType: execution.workflow_type,
      });
    }
  }

  /**
   * 标记工作流失败
   */
  async markWorkflowFailed(workflowId: string, errorMessage: string): Promise<void> {
    const execution = await prisma.workflowExecution.findUnique({
      where: { id: workflowId },
    });

    if (!execution) {
      return;
    }

    await prisma.workflowExecution.update({
      where: { id: workflowId },
      data: {
        workflow_status: 'failed',
        error_message: errorMessage,
        completed_at: new Date(),
      },
    });

    await notificationGateway.notifyUser(execution.user_id, 'workflow.failed', {
      workflowId,
      workflowType: execution.workflow_type,
      errorMessage,
    });
  }

  /**
   * 获取工作流执行状态
   */
  async getWorkflowStatus(workflowId: string) {
    const execution = await prisma.workflowExecution.findUnique({
      where: { id: workflowId },
      include: {
        steps: {
          orderBy: { step_order: 'asc' },
        },
        content_package: {
          select: {
            id: true,
            package_name: true,
            package_type: true,
            result_zip_url: true,
          },
        },
      },
    });

    if (!execution) {
      throw new NotFoundError(`工作流不存在: ${workflowId}`);
    }

    return {
      id: execution.id,
      workflowType: execution.workflow_type,
      status: execution.workflow_status,
      totalSteps: execution.total_steps,
      completedSteps: execution.completed_steps,
      currentStep: execution.current_step,
      progress: Math.round((execution.completed_steps / execution.total_steps) * 100),
      errorMessage: execution.error_message,
      startedAt: execution.started_at,
      completedAt: execution.completed_at,
      steps: execution.steps.map((step) => ({
        name: step.step_name,
        order: step.step_order,
        status: step.step_status,
        startedAt: step.started_at,
        completedAt: step.completed_at,
        errorMessage: step.error_message,
      })),
      contentPackage: execution.content_package,
    };
  }

  /**
   * 取消工作流执行
   */
  async cancelWorkflow(workflowId: string): Promise<void> {
    const execution = await prisma.workflowExecution.findUnique({
      where: { id: workflowId },
    });

    if (!execution) {
      throw new NotFoundError(`工作流不存在: ${workflowId}`);
    }

    if (execution.workflow_status === 'completed' || execution.workflow_status === 'failed') {
      throw new InternalServerError('无法取消已完成或已失败的工作流');
    }

    await prisma.workflowExecution.update({
      where: { id: workflowId },
      data: {
        workflow_status: 'failed',
        error_message: '用户取消',
        completed_at: new Date(),
      },
    });

    // 取消所有未完成的步骤
    await prisma.workflowStep.updateMany({
      where: {
        workflow_id: workflowId,
        step_status: { in: ['pending', 'running'] },
      },
      data: {
        step_status: 'cancelled',
        error_message: '用户取消',
      },
    });

    await notificationGateway.notifyUser(execution.user_id, 'workflow.cancelled', {
      workflowId,
      workflowType: execution.workflow_type,
    });
  }
}

// 导出单例
export const workflowService = new WorkflowService();
