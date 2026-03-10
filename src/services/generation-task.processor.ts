import type { GenerationTask } from '@prisma/client';
import prisma from '../utils/prisma';
import { doubaoService } from './doubao.service';
import { ossService } from './oss.service';
import { notificationGateway } from '../gateways/notification.gateway';
import { BadRequestError, NotFoundError } from '../utils/errors';

const VIDEO_POLL_INTERVAL_MS = 5000;
const VIDEO_MAX_WAIT_MS = 10 * 60 * 1000;

type TaskParameters = Record<string, unknown>;

export class GenerationTaskProcessor {
  async process(taskId: string): Promise<void> {
    const task = await prisma.generationTask.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundError(`任务不存在: ${taskId}`);
    }

    if (task.task_status === 'completed') {
      return;
    }

    await prisma.generationTask.update({
      where: { id: task.id },
      data: {
        task_status: 'processing',
        started_at: task.started_at || new Date(),
        error_message: null,
      },
    });

    try {
      if (task.task_type === 'image') {
        await this.processImageTask(task);
        return;
      }

      if (task.task_type === 'video') {
        await this.processVideoTask(task);
        return;
      }

      throw new BadRequestError(`不支持的任务类型: ${task.task_type}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '任务处理失败';
      await this.markFailedAndRefund(task, message);
      throw error;
    }
  }

  private async processImageTask(task: GenerationTask): Promise<void> {
    const parameters = this.asRecord(task.parameters);
    const model = this.readString(parameters.model) || process.env.DOUBAO_IMAGE_MODEL;

    if (!model) {
      throw new BadRequestError('缺少图片生成模型参数: parameters.model 或 DOUBAO_IMAGE_MODEL');
    }

    const imageResult = await doubaoService.generateImage({
      model,
      prompt: task.prompt,
      n: this.readNumber(parameters.n),
      size: this.readString(parameters.size),
      quality: this.readString(parameters.quality),
      image: this.readString(parameters.image),
      response_format: 'url',
    });

    const sourceUrl = imageResult.data[0]?.url;
    if (!sourceUrl) {
      throw new BadRequestError('豆包未返回图片URL');
    }

    const resultUrl = await ossService.uploadFromUrl(sourceUrl, `generation/image/${task.user_id}/${task.id}`);

    await prisma.generationTask.update({
      where: { id: task.id },
      data: {
        task_status: 'completed',
        progress: 100,
        result_url: resultUrl,
        completed_at: new Date(),
      },
    });

    await notificationGateway.notifyUser(task.user_id, 'generation.completed', {
      taskId: task.id,
      taskType: task.task_type,
      resultUrl,
    });
  }

  private async processVideoTask(task: GenerationTask): Promise<void> {
    const parameters = this.asRecord(task.parameters);
    const model = this.readString(parameters.model) || process.env.DOUBAO_VIDEO_MODEL;

    if (!model) {
      throw new BadRequestError('缺少视频生成模型参数: parameters.model 或 DOUBAO_VIDEO_MODEL');
    }

    const createResult = await doubaoService.generateVideo({
      model,
      prompt: task.prompt,
      image: this.readString(parameters.image),
      duration: this.readNumber(parameters.duration),
      aspect_ratio: this.readString(parameters.aspect_ratio),
    });

    await prisma.generationTask.update({
      where: { id: task.id },
      data: {
        douyin_task_id: createResult.task_id,
        progress: 10,
      },
    });

    const startTime = Date.now();

    while (Date.now() - startTime < VIDEO_MAX_WAIT_MS) {
      await this.delay(VIDEO_POLL_INTERVAL_MS);

      const status = await doubaoService.getTaskStatus(createResult.task_id);

      if (status.status === 'failed') {
        throw new BadRequestError(status.error?.message || '视频生成失败');
      }

      if (status.status === 'completed') {
        const videoSourceUrl = status.result?.video_url;
        if (!videoSourceUrl) {
          throw new BadRequestError('视频任务已完成但未返回视频URL');
        }

        const resultUrl = await ossService.uploadFromUrl(
          videoSourceUrl,
          `generation/video/${task.user_id}/${task.id}`
        );

        const thumbnailSourceUrl = status.result?.thumbnail_url;
        const thumbnailUrl = thumbnailSourceUrl
          ? await ossService.uploadFromUrl(
              thumbnailSourceUrl,
              `generation/video/${task.user_id}/${task.id}/thumbnail`
            )
          : null;

        await prisma.generationTask.update({
          where: { id: task.id },
          data: {
            task_status: 'completed',
            progress: 100,
            result_url: resultUrl,
            thumbnail_url: thumbnailUrl,
            duration_seconds: status.result?.duration || null,
            completed_at: new Date(),
          },
        });

        await notificationGateway.notifyUser(task.user_id, 'generation.completed', {
          taskId: task.id,
          taskType: task.task_type,
          resultUrl,
          thumbnailUrl,
        });

        return;
      }

      await prisma.generationTask.update({
        where: { id: task.id },
        data: {
          progress: Math.min(status.progress || 15, 99),
        },
      });
    }

    throw new BadRequestError('视频任务等待超时（超过10分钟）');
  }

  private async markFailedAndRefund(task: GenerationTask, errorMessage: string): Promise<void> {
    const latestTask = await prisma.generationTask.findUnique({
      where: { id: task.id },
      select: {
        id: true,
        user_id: true,
        task_status: true,
        cost_amount: true,
      },
    });

    if (!latestTask || latestTask.task_status === 'failed') {
      return;
    }

    const refundAmount = latestTask.cost_amount && latestTask.cost_amount > 0 ? latestTask.cost_amount : 0;

    await prisma.$transaction(async (tx) => {
      await tx.generationTask.update({
        where: { id: latestTask.id },
        data: {
          task_status: 'failed',
          error_message: errorMessage,
          completed_at: new Date(),
        },
      });

      if (refundAmount > 0) {
        await tx.user.update({
          where: { id: latestTask.user_id },
          data: {
            balance: {
              increment: refundAmount,
            },
          },
        });
      }
    });

    await notificationGateway.notifyUser(latestTask.user_id, 'generation.failed', {
      taskId: latestTask.id,
      errorMessage,
      refundedAmount: refundAmount,
    });
  }

  private asRecord(data: unknown): TaskParameters {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return {};
    }

    return data as TaskParameters;
  }

  private readString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value : undefined;
  }

  private readNumber(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    return undefined;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const generationTaskProcessor = new GenerationTaskProcessor();
