import './instrument';

import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');
  app.use(cookieParser());
  // The API serves JSON to a separate origin, so CSP/COEP defaults only get in
  // the way; the useful parts are the transport and sniffing headers.
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

  app.enableCors({
    origin: config.get<string>('frontendUrl', 'http://localhost:3000'),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.get(PrismaService).enableShutdownHooks(app);
  app.enableShutdownHooks();

  const port = config.get<number>('port', 4000);
  await app.listen(port, '0.0.0.0');
  new Logger('Bootstrap').log(`API listening on http://localhost:${port}/api`);
}

void bootstrap();
