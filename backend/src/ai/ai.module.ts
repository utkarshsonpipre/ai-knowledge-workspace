import { Module, Provider } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { IndexingService } from './indexing.service';
import { AI_PROVIDER } from './interfaces/ai-provider.interface';
import {
  EMBEDDING_PROVIDER,
  EmbeddingProvider,
} from './interfaces/embedding-provider.interface';
import { GrokProvider } from './providers/grok.provider';
import { LocalEmbeddingProvider } from './providers/local-embedding.provider';
import { OpenAIEmbeddingProvider } from './providers/openai-embedding.provider';

/**
 * The two swap points of the whole AI layer. Adding OpenAI/Claude/Gemini text
 * generation means writing one class and editing `useClass` below — nothing
 * else in the codebase references a concrete provider.
 */
const aiProvider: Provider = {
  provide: AI_PROVIDER,
  useClass: GrokProvider,
};

const embeddingProvider: Provider = {
  provide: EMBEDDING_PROVIDER,
  inject: [ConfigService],
  useFactory: (config: ConfigService): EmbeddingProvider =>
    config.get<string>('embedding.provider') === 'openai'
      ? new OpenAIEmbeddingProvider(config)
      : new LocalEmbeddingProvider(config),
};

@Module({
  imports: [ConfigModule],
  controllers: [AiController],
  providers: [AiService, IndexingService, aiProvider, embeddingProvider],
  exports: [AiService, IndexingService, AI_PROVIDER, EMBEDDING_PROVIDER],
})
export class AiModule {}
