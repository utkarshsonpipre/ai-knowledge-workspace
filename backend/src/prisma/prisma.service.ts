import { INestApplication, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Connected to Postgres');
  }

  /** Used by the e2e smoke test to reset state between runs. */
  async truncateAll(): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('truncateAll is not allowed in production');
    }
    await this.$executeRawUnsafe(
      'TRUNCATE TABLE "ai_requests", "document_chunks", "files", "documents", "refresh_tokens", "users" RESTART IDENTITY CASCADE',
    );
  }

  enableShutdownHooks(app: INestApplication): void {
    process.on('beforeExit', () => {
      void app.close();
    });
  }
}
