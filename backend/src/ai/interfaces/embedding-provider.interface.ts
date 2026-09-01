/**
 * Deliberately separate from AIProvider: text generation and embeddings are
 * different capabilities from different vendors. Keeping them apart is what
 * lets the RAG pipeline use a local MiniLM model while chat runs on Grok.
 *
 * Every implementation must emit vectors of `dimensions` length — the pgvector
 * column is fixed at 384, so OpenAI is asked to truncate via its `dimensions`
 * parameter rather than the schema being rewritten per provider.
 */
export interface EmbeddingProvider {
  readonly name: string;
  readonly dimensions: number;

  embed(text: string): Promise<number[]>;
  /** Batched path — providers that support it should override the naive loop. */
  embedMany(texts: string[]): Promise<number[][]>;
}

export const EMBEDDING_PROVIDER = Symbol('EMBEDDING_PROVIDER');
