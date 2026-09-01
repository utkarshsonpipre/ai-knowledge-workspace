import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { DocumentsService } from './documents.service';
import { tiptapToPlainText } from './tiptap.util';

const TIPTAP_DOC = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Roadmap' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'Ship the vector index.' }] },
  ],
};

describe('DocumentsService', () => {
  let service: DocumentsService;
  let prisma: {
    document: {
      create: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let queue: { enqueueIndexing: jest.Mock };

  beforeEach(async () => {
    prisma = {
      document: {
        create: jest.fn().mockImplementation(({ data }) => ({ id: 'doc_1', ...data })),
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: 'doc_1' }),
        delete: jest.fn().mockResolvedValue({ id: 'doc_1' }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn().mockResolvedValue([[], 0]),
    };
    queue = { enqueueIndexing: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        DocumentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: QueueService, useValue: queue },
      ],
    }).compile();

    service = moduleRef.get(DocumentsService);
  });

  it('derives plainText from the editor JSON on create', async () => {
    await service.create('user_1', { content: TIPTAP_DOC });

    const data = prisma.document.create.mock.calls[0][0].data;
    expect(data.plainText).toContain('Roadmap');
    expect(data.plainText).toContain('Ship the vector index.');
    expect(data.plainText).toBe(tiptapToPlainText(TIPTAP_DOC));
  });

  it('falls back to "Untitled" for blank titles', async () => {
    await service.create('user_1', { title: '   ' });
    expect(prisma.document.create.mock.calls[0][0].data.title).toBe('Untitled');
  });

  it('re-indexes only when the body changed', async () => {
    prisma.document.findFirst.mockResolvedValue({ id: 'doc_1' });

    await service.update('user_1', 'doc_1', { title: 'Renamed' });
    expect(queue.enqueueIndexing).not.toHaveBeenCalled();

    await service.update('user_1', 'doc_1', { content: TIPTAP_DOC });
    expect(queue.enqueueIndexing).toHaveBeenCalledWith({ documentId: 'doc_1', userId: 'user_1' });
  });

  it('refuses to touch another user’s document', async () => {
    prisma.document.findFirst.mockResolvedValue(null);

    await expect(service.findOne('user_2', 'doc_1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove('user_2', 'doc_1')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.document.delete).not.toHaveBeenCalled();
  });
});
