import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { FilesModule } from '../files/files.module';
import { AiProcessor } from './workers/ai.processor';
import { FileProcessor } from './workers/file.processor';
import { IndexingProcessor } from './workers/indexing.processor';

/**
 * Consumer side, kept apart from QueueModule so feature modules can enqueue
 * jobs without importing the processors that depend on them (which would be a
 * module cycle).
 *
 * Workers run in the same process as the API here. Splitting them onto a
 * separate Render service later means booting this module alone — the queue is
 * already the only coupling.
 */
@Module({
  imports: [AiModule, FilesModule],
  providers: [FileProcessor, IndexingProcessor, AiProcessor],
})
export class WorkerModule {}
