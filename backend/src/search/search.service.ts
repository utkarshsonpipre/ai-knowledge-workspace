import { Injectable } from '@nestjs/common';
import { IndexingService } from '../ai/indexing.service';
import { PrismaService } from '../prisma/prisma.service';

export interface KeywordHit {
  id: string;
  title: string;
  icon: string | null;
  snippet: string;
  rank: number;
  updatedAt: Date;
}

export interface SemanticHit {
  documentId: string;
  documentTitle: string;
  excerpt: string;
  similarity: number;
  chunkIndex: number;
}

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly indexing: IndexingService,
  ) {}

  /**
   * Postgres FTS against the generated `search_vector` column (title weighted
   * A, body B). `websearch_to_tsquery` accepts human syntax — quoted phrases,
   * OR, leading `-` — and, unlike to_tsquery, never throws on odd input.
   */
  async keyword(userId: string, query: string, limit = 20): Promise<KeywordHit[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        title: string;
        icon: string | null;
        snippet: string;
        rank: number;
        updated_at: Date;
      }>
    >`
      SELECT d.id,
             d.title,
             d.icon,
             ts_headline(
               'english',
               d.plain_text,
               websearch_to_tsquery('english', ${trimmed}),
               'MaxFragments=2, MinWords=8, MaxWords=24, StartSel=<mark>, StopSel=</mark>'
             ) AS snippet,
             ts_rank(d.search_vector, websearch_to_tsquery('english', ${trimmed})) AS rank,
             d.updated_at
      FROM documents d
      WHERE d.user_id = ${userId}
        AND d.is_archived = false
        AND d.search_vector @@ websearch_to_tsquery('english', ${trimmed})
      ORDER BY rank DESC, d.updated_at DESC
      LIMIT ${limit}
    `;

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      icon: row.icon,
      snippet: row.snippet,
      rank: Number(row.rank),
      updatedAt: row.updated_at,
    }));
  }

  /** Cosine similarity over DocumentChunk.embedding (pgvector, HNSW index). */
  async semantic(userId: string, query: string, limit = 10): Promise<SemanticHit[]> {
    const chunks = await this.indexing.searchSimilar(userId, query, limit);
    return chunks.map((chunk) => ({
      documentId: chunk.documentId,
      documentTitle: chunk.documentTitle,
      excerpt: chunk.content.slice(0, 280),
      similarity: chunk.similarity,
      chunkIndex: chunk.chunkIndex,
    }));
  }

  /**
   * Both indexes answer different questions — exact terms vs. meaning — so the
   * UI shows them side by side rather than fusing scores from incomparable scales.
   */
  async combined(userId: string, query: string) {
    const [keyword, semantic] = await Promise.all([
      this.keyword(userId, query),
      this.semantic(userId, query).catch(() => [] as SemanticHit[]),
    ]);
    return { query, keyword, semantic };
  }
}
