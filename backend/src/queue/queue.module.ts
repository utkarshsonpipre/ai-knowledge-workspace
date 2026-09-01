import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QUEUE_AI, QUEUE_FILES, QUEUE_INDEXING } from './queue.constants';
import { QueueService } from './queue.service';
import { redisOptionsFromUrl } from './redis.config';

/**
 * Producer side only. Workers live in WorkerModule so feature modules can
 * enqueue jobs without importing the processors that depend on them.
 */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: redisOptionsFromUrl(config.getOrThrow<string>('redis.url')),
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2_000 },
          removeOnComplete: { age: 3_600, count: 500 },
          removeOnFail: { age: 24 * 3_600 },
        },
      }),
    }),
    BullModule.registerQueue(
      { name: QUEUE_FILES },
      { name: QUEUE_AI },
      { name: QUEUE_INDEXING },
    ),
  ],
  providers: [QueueService],
  exports: [QueueService, BullModule],
})
export class QueueModule {}
