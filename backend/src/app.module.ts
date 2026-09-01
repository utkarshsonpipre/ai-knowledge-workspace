import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { configuration } from './config/configuration';
import { validateEnv } from './config/env.validation';
import { DocumentsModule } from './documents/documents.module';
import { EventsModule } from './events/events.module';
import { FilesModule } from './files/files.module';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';
import { WorkerModule } from './queue/worker.module';
import { SearchModule } from './search/search.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
      envFilePath: ['.env', '../.env'],
      cache: true,
    }),
    // Baseline limit for every route; AI and auth routes tighten it locally.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),

    PrismaModule,
    QueueModule,
    EventsModule,

    AuthModule,
    UsersModule,
    DocumentsModule,
    FilesModule,
    AiModule,
    SearchModule,

    WorkerModule,
  ],
  controllers: [HealthController],
  providers: [
    // Auth is default-on: a route is protected unless it opts out with @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
