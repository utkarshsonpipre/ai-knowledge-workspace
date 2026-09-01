import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  JOB_INDEX_DOCUMENT,
  JOB_PROCESS_FILE,
  JOB_RUN_AI,
  QUEUE_AI,
  QUEUE_FILES,
  QUEUE_INDEXING,
} from './queue.constants';
import { IndexDocumentJob, ProcessFileJob, RunAiJob } from './queue.types';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue(QUEUE_FILES) private readonly filesQueue: Queue<ProcessFileJob>,
    @InjectQueue(QUEUE_AI) private readonly aiQueue: Queue<RunAiJob>,
    @InjectQueue(QUEUE_INDEXING) private readonly indexingQueue: Queue<IndexDocumentJob>,
  ) {}

  // BullMQ rejects ':' in custom job ids (it is the Redis key separator).
  async enqueueFileProcessing(data: ProcessFileJob): Promise<string> {
    const job = await this.filesQueue.add(JOB_PROCESS_FILE, data, { jobId: `file-${data.fileId}` });
    this.logger.log(`Queued file processing ${job.id}`);
    return job.id as string;
  }

  async enqueueAi(data: RunAiJob): Promise<string> {
    const job = await this.aiQueue.add(JOB_RUN_AI, data, { jobId: `ai-${data.aiRequestId}` });
    return job.id as string;
  }

  /**
   * Re-embedding on every keystroke-triggered autosave would burn the whole
   * budget, so indexing is debounced: a fixed jobId plus a delay means rapid
   * edits collapse into one run. `deduplication` keeps the newest payload.
   */
  async enqueueIndexing(data: IndexDocumentJob, delayMs = 15_000): Promise<void> {
    await this.indexingQueue.remove(`index-${data.documentId}`).catch(() => undefined);
    await this.indexingQueue.add(JOB_INDEX_DOCUMENT, data, {
      jobId: `index-${data.documentId}`,
      delay: delayMs,
    });
  }
}
