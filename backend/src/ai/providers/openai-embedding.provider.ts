import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { EmbeddingProvider } from '../interfaces/embedding-provider.interface';

/**
 * Paid alternative with better recall. text-embedding-3-small is natively 1536
 * dims; the `dimensions` parameter truncates it (Matryoshka) to the same 384 the
 * pgvector column uses, so providers stay swappable without a migration.
 */
@Injectable()
export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'openai/text-embedding-3-small';
  readonly dimensions: number;

  private readonly logger = new Logger(OpenAIEmbeddingProvider.name);
  private readonly client: OpenAI;

  constructor(config: ConfigService) {
    this.dimensions = config.get<number>('embedding.dimensions', 384);
    this.client = new OpenAI({
      apiKey: config.get<string>('embedding.openaiApiKey') || 'missing-key',
      maxRetries: 2,
    });
  }

  async embed(text: string): Promise<number[]> {
    const [vector] = await this.embedMany([text]);
    return vector;
  }

  async embedMany(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    try {
      const response = await this.client.embeddings.create({
        model: 'text-embedding-3-small',
        input: texts.map((t) => t.replace(/\s+/g, ' ').trim()),
        dimensions: this.dimensions,
      });
      // The API may return items out of order; index is authoritative.
      return response.data
        .sort((a, b) => a.index - b.index)
        .map((item) => item.embedding as number[]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Embedding request failed: ${message}`);
      throw new ServiceUnavailableException(`Embedding provider error: ${message}`);
    }
  }
}
