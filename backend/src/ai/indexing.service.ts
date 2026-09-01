import { Inject, Injectable, Logger } from '@nestjs/common';
import { ChunkSource, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { chunkText } from './chunking.util';
import {
  EMBEDDING_PROVIDER,
  EmbeddingProvider,
} from './interfaces/embedding-provider.interface';

export interface RetrievedChunk {
  id: string;
  documentId: string;
  documentTitle: string;
  content: string;
  chunkIndex: number;
  similarity: number;
}

const EMBED_BATCH_SIZE = 32;

/**
 * Owns everything that touches the vector column. Prisma has no pgvector type,
 * so reads and writes go through parameterised raw SQL with an explicit
 * `::vector` cast — still no string interpolation, so no injection surface.
 */
@Injectable()
export class IndexingService {
  private readonly logger = new Logger(IndexingService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(EMBEDDING_PROVIDER) private readonly embeddings: EmbeddingProvider,
  ) {}

  /**
   * Full re-index of one document: chunk, embed, replace. Replacing wholesale
   * rather than diffing is deliberate — chunk boundaries shift when the text
   * changes, so incremental updates would leave orphaned overlaps.
   */
  async indexDocument(
    documentId: string,
    onProgress?: (percent: number) => void | Promise<void>,
  ): Promise<number> {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: { id: true, plainText: true, title: true, sourceFile: { select: { id: true } } },
    });

    if (!document) return 0;

    const chunks = chunkText(document.plainText);
    await this.prisma.documentChunk.deleteMany({ where: { documentId } });

    if (chunks.length === 0) return 0;

    const fileId = document.sourceFile?.id ?? null;
    const source = fileId ? ChunkSource.FILE : ChunkSource.DOCUMENT;
    let done = 0;

    for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
      const batch = chunks.slice(i, i + EMBED_BATCH_SIZE);
      const vectors = await this.embeddings.embedMany(batch.map((c) => c.content));

      await this.insertChunks(
        batch.map((chunk, n) => ({
          documentId,
          fileId,
          source,
          content: chunk.content,
          chunkIndex: chunk.index,
          tokenCount: chunk.tokenCount,
          embedding: vectors[n],
        })),
      );

      done += batch.length;
      await onProgress?.(Math.round((done / chunks.length) * 100));
    }

    this.logger.log(`Indexed ${chunks.length} chunks for document ${documentId}`);
    return chunks.length;
  }

  /** Cosine similarity over the user's own chunks only — tenancy enforced in SQL. */
  async searchSimilar(
    userId: string,
    query: string,
    topK = 6,
    documentId?: string,
  ): Promise<RetrievedChunk[]> {
    const vector = toVectorLiteral(await this.embeddings.embed(query));

    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        document_id: string;
        title: string;
        content: string;
        chunk_index: number;
        similarity: number;
      }>
    >`
      SELECT c.id,
             c.document_id,
             d.title,
             c.content,
             c.chunk_index,
             1 - (c.embedding <=> ${vector}::vector) AS similarity
      FROM document_chunks c
      JOIN documents d ON d.id = c.document_id
      WHERE d.user_id = ${userId}
        AND c.embedding IS NOT NULL
        ${documentId ? Prisma.sql`AND c.document_id = ${documentId}` : Prisma.empty}
      ORDER BY c.embedding <=> ${vector}::vector
      LIMIT ${topK}
    `;

    return rows.map((row) => ({
      id: row.id,
      documentId: row.document_id,
      documentTitle: row.title,
      content: row.content,
      chunkIndex: row.chunk_index,
      similarity: Number(row.similarity),
    }));
  }

  private async insertChunks(
    rows: Array<{
      documentId: string;
      fileId: string | null;
      source: ChunkSource;
      content: string;
      chunkIndex: number;
      tokenCount: number;
      embedding: number[];
    }>,
  ): Promise<void> {
    const values = rows.map(
      (row) => Prisma.sql`(
        ${randomUUID()},
        ${row.documentId},
        ${row.fileId},
        ${row.content},
        ${row.chunkIndex},
        ${toVectorLiteral(row.embedding)}::vector,
        ${row.source}::"ChunkSource",
        '{}'::jsonb,
        ${row.tokenCount},
        NOW()
      )`,
    );

    await this.prisma.$executeRaw`
      INSERT INTO document_chunks
        (id, document_id, file_id, content, chunk_index, embedding, source, metadata, token_count, created_at)
      VALUES ${Prisma.join(values)}
    `;
  }
}

/** pgvector accepts the `[1,2,3]` text form; the cast happens in SQL. */
export function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(',')}]`;
}
