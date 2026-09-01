import { Test } from '@nestjs/testing';
import { AIRequestStatus, AIRequestType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { RunAiJob } from '../queue/queue.types';
import { AiService } from './ai.service';
import { chunkText } from './chunking.util';
import { IndexingService } from './indexing.service';
import { AI_PROVIDER, AIProvider } from './interfaces/ai-provider.interface';
import { parseSummary } from './providers/grok.provider';

describe('chunkText', () => {
  it('returns nothing for empty input', () => {
    expect(chunkText('   \n\n ')).toEqual([]);
  });

  it('keeps short text as a single chunk', () => {
    const chunks = chunkText('One short paragraph.');
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe('One short paragraph.');
  });

  it('splits long text and overlaps neighbouring chunks', () => {
    const paragraph = `${'lorem ipsum dolor sit amet. '.repeat(30)}`;
    const text = Array.from({ length: 6 }, () => paragraph).join('\n\n');

    const chunks = chunkText(text, { maxChars: 500, overlapChars: 100 });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.content.length <= 700)).toBe(true);
    expect(chunks.map((c) => c.index)).toEqual(chunks.map((_, i) => i));
    // The tail of chunk N must reappear at the head of chunk N+1 (leading
    // whitespace is trimmed off when the chunk is flushed).
    expect(chunks[1].content.startsWith(chunks[0].content.slice(-100).trimStart())).toBe(true);
  });

  it('hard-splits a single sentence longer than the window', () => {
    const chunks = chunkText('x'.repeat(2_500), { maxChars: 500, overlapChars: 0 });
    expect(chunks.length).toBeGreaterThanOrEqual(5);
  });
});

describe('parseSummary', () => {
  it('parses well-formed JSON', () => {
    const result = parseSummary('{"summary":"S","keyPoints":["a"],"actionItems":[]}');
    expect(result).toEqual({ summary: 'S', keyPoints: ['a'], actionItems: [] });
  });

  it('recovers from markdown fences', () => {
    const result = parseSummary('```json\n{"summary":"S","keyPoints":[],"actionItems":[]}\n```');
    expect(result.summary).toBe('S');
  });

  it('degrades to a plain summary instead of throwing', () => {
    const result = parseSummary('not json at all');
    expect(result).toEqual({ summary: 'not json at all', keyPoints: [], actionItems: [] });
  });
});

describe('AiService.execute', () => {
  let service: AiService;
  let prisma: {
    aIRequest: { create: jest.Mock; update: jest.Mock };
    document: { update: jest.Mock; findFirst: jest.Mock };
  };
  let provider: jest.Mocked<Pick<AIProvider, 'summarize' | 'rewrite' | 'generateText' | 'chat'>>;

  const job: RunAiJob = {
    aiRequestId: 'req_1',
    userId: 'user_1',
    type: AIRequestType.SUMMARIZE,
    documentId: 'doc_1',
  };

  beforeEach(async () => {
    prisma = {
      aIRequest: {
        create: jest.fn(),
        update: jest.fn().mockImplementation(({ where, data }) => ({
          id: where.id,
          type: AIRequestType.SUMMARIZE,
          userId: 'user_1',
          documentId: 'doc_1',
          input: 'Some document text',
          ...data,
        })),
      },
      document: { update: jest.fn(), findFirst: jest.fn() },
    };

    provider = {
      summarize: jest
        .fn()
        .mockResolvedValue({ summary: 'S', keyPoints: ['k'], actionItems: ['a'] }),
      rewrite: jest.fn(),
      generateText: jest.fn(),
      chat: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: PrismaService, useValue: prisma },
        { provide: QueueService, useValue: { enqueueAi: jest.fn() } },
        { provide: IndexingService, useValue: { searchSimilar: jest.fn().mockResolvedValue([]) } },
        { provide: AI_PROVIDER, useValue: provider },
      ],
    }).compile();

    service = moduleRef.get(AiService);
  });

  it('completes a summarize job and writes the summary back to the document', async () => {
    await service.execute(job);

    expect(provider.summarize).toHaveBeenCalledWith('Some document text');

    const completion = prisma.aIRequest.update.mock.calls.at(-1)![0];
    expect(completion.data.status).toBe(AIRequestStatus.COMPLETED);
    expect(completion.data.output).toBe('S');

    expect(prisma.document.update).toHaveBeenCalledWith({
      where: { id: 'doc_1' },
      data: { summary: { summary: 'S', keyPoints: ['k'], actionItems: ['a'] } },
    });
  });

  it('marks the request FAILED and rethrows when the provider errors', async () => {
    provider.summarize.mockRejectedValue(new Error('provider down'));

    await expect(service.execute(job)).rejects.toThrow('provider down');

    const failure = prisma.aIRequest.update.mock.calls.at(-1)![0];
    expect(failure.data.status).toBe(AIRequestStatus.FAILED);
    expect(failure.data.error).toBe('provider down');
    expect(prisma.document.update).not.toHaveBeenCalled();
  });
});
