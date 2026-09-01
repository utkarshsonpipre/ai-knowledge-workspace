import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { IndexingService } from '../../ai/indexing.service';
import { EventsGateway } from '../../events/events.gateway';
import { QUEUE_INDEXING } from '../queue.constants';
import { IndexDocumentJob } from '../queue.types';

/** Re-embeds a document after an edit. Debounced by the producer's fixed jobId. */
@Processor(QUEUE_INDEXING, { concurrency: 2 })
export class IndexingProcessor extends WorkerHost {
  private readonly logger = new Logger(IndexingProcessor.name);

  constructor(
    private readonly indexing: IndexingService,
    private readonly events: EventsGateway,
  ) {
    super();
  }

  async process(job: Job<IndexDocumentJob>): Promise<number> {
    const { documentId, userId } = job.data;

    const chunks = await this.indexing.indexDocument(documentId, (percent) => {
      this.events.emitProgress(userId, {
        jobId: String(job.id),
        resourceId: documentId,
        resource: 'document',
        stage: 'embedding',
        percent,
      });
      return job.updateProgress(percent);
    });

    this.events.emitProgress(userId, {
      jobId: String(job.id),
      resourceId: documentId,
      resource: 'document',
      stage: 'completed',
      percent: 100,
      message: `${chunks} chunks indexed`,
    });

    this.logger.debug(`Re-indexed document ${documentId} (${chunks} chunks)`);
    return chunks;
  }
}
