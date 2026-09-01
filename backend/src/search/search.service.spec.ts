import { Test } from '@nestjs/testing';
import { IndexingService } from '../ai/indexing.service';
import { PrismaService } from '../prisma/prisma.service';
import { SearchService } from './search.service';

describe('SearchService', () => {
  let service: SearchService;
  let prisma: { $queryRaw: jest.Mock };
  let indexing: { searchSimilar: jest.Mock };

  beforeEach(async () => {
    prisma = { $queryRaw: jest.fn().mockResolvedValue([]) };
    indexing = { searchSimilar: jest.fn().mockResolvedValue([]) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: PrismaService, useValue: prisma },
        { provide: IndexingService, useValue: indexing },
      ],
    }).compile();

    service = moduleRef.get(SearchService);
  });

  it('short-circuits an empty query without hitting the database', async () => {
    expect(await service.keyword('user_1', '   ')).toEqual([]);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('maps raw FTS rows into hits', async () => {
    prisma.$queryRaw.mockResolvedValue([
      {
        id: 'doc_1',
        title: 'Vectors',
        icon: null,
        snippet: 'about <mark>vectors</mark>',
        rank: '0.42',
        updated_at: new Date('2025-01-01'),
      },
    ]);

    const [hit] = await service.keyword('user_1', 'vectors');
    expect(hit).toMatchObject({ id: 'doc_1', title: 'Vectors', rank: 0.42 });
  });

  it('truncates semantic excerpts and passes the user through', async () => {
    indexing.searchSimilar.mockResolvedValue([
      {
        id: 'chunk_1',
        documentId: 'doc_1',
        documentTitle: 'Vectors',
        content: 'x'.repeat(500),
        chunkIndex: 0,
        similarity: 0.9,
      },
    ]);

    const [hit] = await service.semantic('user_1', 'vectors');
    expect(indexing.searchSimilar).toHaveBeenCalledWith('user_1', 'vectors', 10);
    expect(hit.excerpt).toHaveLength(280);
  });

  it('still returns keyword hits when the embedding provider is down', async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    indexing.searchSimilar.mockRejectedValue(new Error('embeddings unavailable'));

    const result = await service.combined('user_1', 'vectors');
    expect(result.semantic).toEqual([]);
  });
});
