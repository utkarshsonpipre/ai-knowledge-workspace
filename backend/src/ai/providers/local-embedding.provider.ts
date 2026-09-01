import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmbeddingProvider } from '../interfaces/embedding-provider.interface';

// transformers.js ships its pipeline lazily; typing it loosely here avoids
// pulling ONNX types into the app's public surface.
type FeatureExtractionPipeline = (
  texts: string[],
  options: { pooling: 'mean'; normalize: boolean },
) => Promise<{ tolist(): number[][] }>;

/**
 * Runs Xenova/all-MiniLM-L6-v2 in-process via transformers.js: 384 dims, no
 * API key, no per-token cost, no network hop. The model (~25MB) is downloaded
 * once on first use and cached on disk.
 *
 * Trade-off: first embed after a cold start pays the model load (~2-4s), which
 * is why embedding only ever happens inside a BullMQ worker.
 */
@Injectable()
export class LocalEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'xenova/all-MiniLM-L6-v2';
  readonly dimensions: number;

  private readonly logger = new Logger(LocalEmbeddingProvider.name);
  private readonly modelId: string;
  private pipelinePromise: Promise<FeatureExtractionPipeline> | null = null;

  constructor(config: ConfigService) {
    this.dimensions = config.get<number>('embedding.dimensions', 384);
    this.modelId = config.get<string>('embedding.localModel', 'Xenova/all-MiniLM-L6-v2');
  }

  async embed(text: string): Promise<number[]> {
    const [vector] = await this.embedMany([text]);
    return vector;
  }

  async embedMany(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const extract = await this.load();
    // Mean pooling + L2 normalisation makes cosine distance equal to a dot
    // product, which is what pgvector's vector_cosine_ops expects.
    const output = await extract(
      texts.map((t) => t.replace(/\s+/g, ' ').trim()),
      { pooling: 'mean', normalize: true },
    );
    return output.tolist();
  }

  /** Single-flight lazy load: concurrent jobs share one model instance. */
  private load(): Promise<FeatureExtractionPipeline> {
    if (!this.pipelinePromise) {
      this.logger.log(`Loading embedding model ${this.modelId} (first use downloads weights)`);
      this.pipelinePromise = import('@xenova/transformers').then(({ pipeline, env }) => {
        env.allowLocalModels = false;
        return pipeline('feature-extraction', this.modelId) as unknown as Promise<
          FeatureExtractionPipeline
        >;
      });
    }
    return this.pipelinePromise;
  }
}
