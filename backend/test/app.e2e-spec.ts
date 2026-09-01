import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FileStatus } from '@prisma/client';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth/auth.service';
import { AI_PROVIDER } from '../src/ai/interfaces/ai-provider.interface';
import { EMBEDDING_PROVIDER } from '../src/ai/interfaces/embedding-provider.interface';
import { StorageService } from '../src/files/storage.service';
import { PrismaService } from '../src/prisma/prisma.service';

const SAMPLE_TEXT = `# Quarterly plan

We will ship the vector index in March and migrate search to pgvector.

Owner: platform team. Deadline: end of Q1.`;

/**
 * One smoke test covering the whole spine:
 *   session -> document CRUD -> signed upload -> BullMQ worker -> AI summarize.
 *
 * Only the three outbound integrations are faked (object storage, LLM,
 * embeddings). Postgres and Redis are real — the point is to prove the queue,
 * the worker and the pgvector writes actually work together.
 */
describe('Knowledge Workspace (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let userId: string;

  const fakeAi = {
    name: 'fake',
    generateText: jest.fn().mockResolvedValue('generated'),
    summarize: jest.fn().mockResolvedValue({
      summary: 'Ship the vector index in March.',
      keyPoints: ['Migrate search to pgvector'],
      actionItems: ['Platform team owns delivery by end of Q1'],
    }),
    chat: jest.fn().mockResolvedValue('answer'),
    rewrite: jest.fn().mockResolvedValue('rewritten'),
    chatStream: jest.fn(),
  };

  const fakeEmbeddings = {
    name: 'fake',
    dimensions: 384,
    embed: async () => deterministicVector(),
    embedMany: async (texts: string[]) => texts.map(() => deterministicVector()),
  };

  const fakeStorage = {
    buildPath: (uid: string, filename: string) => `${uid}/${filename}`,
    createSignedUpload: jest
      .fn()
      .mockImplementation((path: string) => ({ path, signedUrl: 'https://example.test', token: 't' })),
    createSignedDownloadUrl: jest.fn().mockResolvedValue('https://example.test/download'),
    download: jest.fn().mockResolvedValue(Buffer.from(SAMPLE_TEXT, 'utf8')),
    remove: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AI_PROVIDER)
      .useValue(fakeAi)
      .overrideProvider(EMBEDDING_PROVIDER)
      .useValue(fakeEmbeddings)
      .overrideProvider(StorageService)
      .useValue(fakeStorage)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.truncateAll();

    const user = await prisma.user.create({
      data: { githubId: 'e2e-github-id', email: 'e2e@example.test', name: 'E2E' },
    });
    userId = user.id;

    // GitHub's redirect cannot be automated, so the session is minted through
    // the same AuthService the OAuth callback uses.
    accessToken = (await app.get(AuthService).issueTokens(user)).accessToken;
  });

  afterAll(async () => {
    await prisma?.truncateAll();
    await app?.close();
  });

  const auth = () => ({ Authorization: `Bearer ${accessToken}` });

  it('rejects unauthenticated requests', async () => {
    await request(app.getHttpServer()).get('/api/documents').expect(401);
  });

  it('returns the current user', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set(auth())
      .expect(200);

    expect(response.body).toMatchObject({ id: userId, email: 'e2e@example.test' });
  });

  it('creates a document and flattens its content for search', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/documents')
      .set(auth())
      .send({
        title: 'Roadmap',
        content: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Ship pgvector.' }] }],
        },
      })
      .expect(201);

    expect(response.body.plainText).toContain('Ship pgvector.');

    const found = await request(app.getHttpServer())
      .get(`/api/documents/${response.body.id}`)
      .set(auth())
      .expect(200);
    expect(found.body.title).toBe('Roadmap');
  });

  it('processes an uploaded file into an indexed document', async () => {
    const ticket = await request(app.getHttpServer())
      .post('/api/files/upload-url')
      .set(auth())
      .send({ filename: 'plan.md', type: 'text/markdown', size: SAMPLE_TEXT.length })
      .expect(201);

    expect(ticket.body.signedUrl).toBeDefined();

    // The browser would PUT to Supabase here; storage is faked, so go straight
    // to the confirmation that enqueues the processing job.
    await request(app.getHttpServer())
      .post(`/api/files/${ticket.body.fileId}/complete`)
      .set(auth())
      .expect(200);

    const file = await waitFor(
      () => prisma.file.findUniqueOrThrow({ where: { id: ticket.body.fileId } }),
      (f) => f.status === FileStatus.COMPLETED || f.status === FileStatus.FAILED,
    );

    expect(file.status).toBe(FileStatus.COMPLETED);
    expect(file.documentId).toBeTruthy();

    const chunks = await prisma.documentChunk.count({
      where: { documentId: file.documentId as string },
    });
    expect(chunks).toBeGreaterThan(0);

    // Semantic search reads the vectors back out of pgvector.
    const search = await request(app.getHttpServer())
      .get('/api/search?q=vector%20index&mode=semantic')
      .set(auth())
      .expect(200);
    expect(search.body.semantic.length).toBeGreaterThan(0);
  });

  it('runs a summarize job through the queue and stores the result', async () => {
    const document = await prisma.document.findFirstOrThrow({
      where: { userId, title: 'plan' },
    });

    const created = await request(app.getHttpServer())
      .post('/api/ai/summarize')
      .set(auth())
      .send({ documentId: document.id })
      .expect(201);

    expect(created.body.status).toBe('PENDING');

    const settled = await waitFor(
      () => prisma.aIRequest.findUniqueOrThrow({ where: { id: created.body.id } }),
      (r) => r.status === 'COMPLETED' || r.status === 'FAILED',
    );

    expect(settled.status).toBe('COMPLETED');
    expect(settled.output).toContain('vector index');

    const updated = await prisma.document.findUniqueOrThrow({ where: { id: document.id } });
    expect(updated.summary).toMatchObject({ keyPoints: ['Migrate search to pgvector'] });
  });
});

/** Deterministic unit vector so pgvector gets valid, comparable input. */
function deterministicVector(): number[] {
  const raw = Array.from({ length: 384 }, (_, i) => Math.sin(i + 1));
  const norm = Math.sqrt(raw.reduce((sum, value) => sum + value * value, 0));
  return raw.map((value) => value / norm);
}

async function waitFor<T>(
  read: () => Promise<T>,
  done: (value: T) => boolean,
  { timeoutMs = 60_000, intervalMs = 500 } = {},
): Promise<T> {
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    const value = await read();
    if (done(value)) return value;
    if (Date.now() > deadline) throw new Error('Timed out waiting for the job to settle');
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}
