import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { AIRequestStatus } from '@prisma/client';
import { Job } from 'bullmq';
import { AiService } from '../../ai/ai.service';
import { EventsGateway } from '../../events/events.gateway';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUE_AI } from '../queue.constants';
import { RunAiJob } from '../queue.types';

@Processor(QUEUE_AI, { concurrency: 4 })
export class AiProcessor extends WorkerHost {
  private readonly logger = new Logger(AiProcessor.name);

  constructor(
    private readonly ai: AiService,
    private readonly events: EventsGateway,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<RunAiJob>): Promise<string> {
    const { aiRequestId, userId } = job.data;

    const emit = (stage: 'generating' | 'completed', percent: number, message?: string) => {
      this.events.emitProgress(userId, {
        jobId: String(job.id),
        resourceId: aiRequestId,
        resource: 'ai',
        stage,
        percent,
        message,
      });
      return job.updateProgress(percent);
    };

    await emit('generating', 10, 'Sending to model');
    const request = await this.ai.execute(job.data, (percent) => emit('generating', percent));
    await emit('completed', 100, 'Done');

    this.events.emitResourceUpdated(userId, 'ai', aiRequestId);
    return request.output ?? '';
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<RunAiJob>, error: Error): Promise<void> {
    this.logger.error(`AI job ${job.id} failed: ${error.message}`);
    if (job.attemptsMade < (job.opts.attempts ?? 1)) return;

    await this.prisma.aIRequest
      .update({
        where: { id: job.data.aiRequestId },
        data: {
          status: AIRequestStatus.FAILED,
          error: error.message.slice(0, 500),
          completedAt: new Date(),
        },
      })
      .catch(() => undefined);

    this.events.emitProgress(job.data.userId, {
      jobId: String(job.id),
      resourceId: job.data.aiRequestId,
      resource: 'ai',
      stage: 'failed',
      percent: 100,
      error: error.message,
    });
  }
}
