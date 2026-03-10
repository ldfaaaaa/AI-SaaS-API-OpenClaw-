import { QueueEvents, Worker } from 'bullmq';
import { GENERATION_TASK_QUEUE_NAME, generationTaskQueue, type GenerationTaskJobData } from '../queues/generation.queue';
import { bullmqConnection } from '../utils/bullmq';
import { generationTaskProcessor } from '../services/generation-task.processor';

let worker: Worker<GenerationTaskJobData> | null = null;
let queueEvents: QueueEvents | null = null;

export function startGenerationWorker(): Worker<GenerationTaskJobData> {
  if (worker) {
    return worker;
  }

  worker = new Worker<GenerationTaskJobData>(
    GENERATION_TASK_QUEUE_NAME,
    async (job) => {
      await generationTaskProcessor.process(job.data.taskId);
    },
    {
      connection: bullmqConnection,
      concurrency: parseInt(process.env.GENERATION_WORKER_CONCURRENCY || '3', 10),
    }
  );

  worker.on('completed', (job) => {
    console.log(`[generation-worker] 任务完成: ${job.id}`);
  });

  worker.on('failed', (job, error) => {
    console.error(`[generation-worker] 任务失败: ${job?.id}`, error?.message);
  });

  queueEvents = new QueueEvents(GENERATION_TASK_QUEUE_NAME, {
    connection: bullmqConnection,
  });

  queueEvents.on('stalled', ({ jobId }) => {
    console.warn(`[generation-worker] 任务阻塞: ${jobId}`);
  });

  return worker;
}

export async function stopGenerationWorker(): Promise<void> {
  const pending: Promise<unknown>[] = [];

  if (worker) {
    pending.push(worker.close());
    worker = null;
  }

  if (queueEvents) {
    pending.push(queueEvents.close());
    queueEvents = null;
  }

  pending.push(generationTaskQueue.close());

  await Promise.allSettled(pending);
}
