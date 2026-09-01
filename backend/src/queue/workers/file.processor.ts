import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { FileStatus } from '@prisma/client';
import { Job } from 'bullmq';
import { IndexingService } from '../../ai/indexing.service';
import { plainTextToTiptap } from '../../documents/tiptap.util';
import { EventsGateway } from '../../events/events.gateway';
import { StorageService } from '../../files/storage.service';
import { TextExtractorService } from '../../files/text-extractor.service';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUE_FILES } from '../queue.constants';
import { JobStage, ProcessFileJob } from '../queue.types';

/**
 * upload -> extract -> document -> chunk -> embed, entirely outside the HTTP
 * cycle. Concurrency is low on purpose: PDF parsing and local embedding are
 * CPU-bound, and Render's free tier has one core to share.
 */
@Processor(QUEUE_FILES, { concurrency: 2 })
export class FileProcessor extends WorkerHost {
  private readonly logger = new Logger(FileProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly extractor: TextExtractorService,
    private readonly indexing: IndexingService,
    private readonly events: EventsGateway,
  ) {
    super();
  }

  async process(job: Job<ProcessFileJob>): Promise<{ documentId: string; chunks: number }> {
    const { fileId, userId } = job.data;

    const emit = (stage: JobStage, percent: number, message?: string) => {
      this.events.emitProgress(userId, {
        jobId: String(job.id),
        resourceId: fileId,
        resource: 'file',
        stage,
        percent,
        message,
      });
      return job.updateProgress(percent);
    };

    const file = await this.prisma.file.findUniqueOrThrow({ where: { id: fileId } });

    await this.prisma.file.update({
      where: { id: fileId },
      data: { status: FileStatus.PROCESSING, error: null },
    });
    await emit('extracting', 10, 'Downloading file');

    const buffer = await this.storage.download(file.storagePath);
    const text = await this.extractor.extract(buffer, file.type, file.filename);
    await emit('extracting', 35, 'Text extracted');

    // The extracted text becomes a real Document so uploads are editable,
    // searchable and chattable through exactly the same code paths as notes.
    const documentId = await this.upsertDocument(file.documentId, {
      userId,
      title: file.filename.replace(/\.[^.]+$/, ''),
      text,
    });

    await this.prisma.file.update({ where: { id: fileId }, data: { documentId } });
    await emit('chunking', 50, 'Splitting into chunks');

    const chunks = await this.indexing.indexDocument(documentId, (percent) =>
      emit('embedding', 50 + Math.round(percent * 0.45), 'Generating embeddings'),
    );

    await this.prisma.file.update({
      where: { id: fileId },
      data: { status: FileStatus.COMPLETED, processedAt: new Date() },
    });

    await emit('completed', 100, `Indexed ${chunks} chunks`);
    this.events.emitResourceUpdated(userId, 'file', fileId);

    return { documentId, chunks };
  }

  private async upsertDocument(
    existingId: string | null,
    data: { userId: string; title: string; text: string },
  ): Promise<string> {
    const content = plainTextToTiptap(data.text) as unknown as object;

    if (existingId) {
      await this.prisma.document.update({
        where: { id: existingId },
        data: { content, plainText: data.text, title: data.title },
      });
      return existingId;
    }

    const created = await this.prisma.document.create({
      data: { userId: data.userId, title: data.title, content, plainText: data.text },
      select: { id: true },
    });
    return created.id;
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<ProcessFileJob>, error: Error): Promise<void> {
    this.logger.error(`File job ${job.id} failed: ${error.message}`);

    // Only mark the row failed once BullMQ has exhausted its retries.
    if (job.attemptsMade < (job.opts.attempts ?? 1)) return;

    await this.prisma.file
      .update({
        where: { id: job.data.fileId },
        data: { status: FileStatus.FAILED, error: error.message.slice(0, 500) },
      })
      .catch(() => undefined);

    this.events.emitProgress(job.data.userId, {
      jobId: String(job.id),
      resourceId: job.data.fileId,
      resource: 'file',
      stage: 'failed',
      percent: 100,
      error: error.message,
    });
  }
}
