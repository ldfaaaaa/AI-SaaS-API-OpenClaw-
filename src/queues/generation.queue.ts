import { Queue } from 'bullmq';
import { bullmqConnection } from '../utils/bullmq';

export const GENERATION_TASK_QUEUE_NAME = 'generation-tasks';

export interface GenerationTaskJobData {
  taskId: string;
}

export const generationTaskQueue = new Queue<GenerationTaskJobData>(GENERATION_TASK_QUEUE_NAME, {
  connection: bullmqConnection,
  defaultJobOptions: {
    removeOnComplete: 1000,
    removeOnFail: 1000,
    attempts: 1,
  },
});

export async function enqueueGenerationTask(taskId: string): Promise<void> {
  await generationTaskQueue.add(
    'process-generation-task',
    { taskId },
    {
      jobId: `generation-task:${taskId}`,
    }
  );
}
