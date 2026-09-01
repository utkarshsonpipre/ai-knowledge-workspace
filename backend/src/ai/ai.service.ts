import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AIRequest, AIRequestStatus, AIRequestType, Prisma } from '@prisma/client';
import { Paginated, PaginationDto } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { RunAiJob } from '../queue/queue.types';
import { AskDto, GenerateDto, RewriteDto, SummarizeDto } from './dto/ai.dto';
import { IndexingService, RetrievedChunk } from './indexing.service';
import {
  AI_PROVIDER,
  AIProvider,
  ChatMessage,
  RewriteMode,
  SummaryResult,
} from './interfaces/ai-provider.interface';
import { ragSystemPrompt } from './prompts';

export interface AskSource {
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  similarity: number;
  excerpt: string;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    private readonly indexing: IndexingService,
    @Inject(AI_PROVIDER) private readonly provider: AIProvider,
  ) {}

  // ---------------------------------------------------------------------------
  // Enqueue side — the HTTP request only ever writes a row and returns.
  // ---------------------------------------------------------------------------

  async requestSummarize(userId: string, dto: SummarizeDto): Promise<AIRequest> {
    const input = dto.content ?? (await this.documentText(userId, dto.documentId));
    return this.enqueue(userId, AIRequestType.SUMMARIZE, input, dto.documentId);
  }

  async requestRewrite(userId: string, dto: RewriteDto): Promise<AIRequest> {
    return this.enqueue(userId, AIRequestType.REWRITE, dto.content, dto.documentId, {
      mode: dto.mode,
    });
  }

  async requestGenerate(userId: string, dto: GenerateDto): Promise<AIRequest> {
    return this.enqueue(userId, AIRequestType.GENERATE, dto.prompt, dto.documentId);
  }

  private async enqueue(
    userId: string,
    type: AIRequestType,
    input: string,
    documentId?: string,
    options?: Record<string, unknown>,
  ): Promise<AIRequest> {
    const request = await this.prisma.aIRequest.create({
      data: { userId, type, input, documentId, status: AIRequestStatus.PENDING },
    });

    const jobId = await this.queue.enqueueAi({
      aiRequestId: request.id,
      userId,
      type,
      documentId,
      options,
    });

    return this.prisma.aIRequest.update({ where: { id: request.id }, data: { jobId } });
  }

  // ---------------------------------------------------------------------------
  // Execution side — runs inside a BullMQ worker, never in an HTTP handler.
  // ---------------------------------------------------------------------------

  async execute(job: RunAiJob, onProgress?: (percent: number) => Promise<void>): Promise<AIRequest> {
    const request = await this.prisma.aIRequest.update({
      where: { id: job.aiRequestId },
      data: { status: AIRequestStatus.PROCESSING },
    });

    try {
      await onProgress?.(20);
      const { output, result } = await this.run(request, job);
      await onProgress?.(90);

      const completed = await this.prisma.aIRequest.update({
        where: { id: request.id },
        data: {
          status: AIRequestStatus.COMPLETED,
          output,
          result: (result ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          completedAt: new Date(),
        },
      });

      // A summarize run is only useful if it sticks to the document.
      if (request.type === AIRequestType.SUMMARIZE && request.documentId && result) {
        await this.prisma.document.update({
          where: { id: request.documentId },
          data: { summary: result as Prisma.InputJsonValue },
        });
      }

      return completed;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`AI request ${request.id} failed: ${message}`);

      await this.prisma.aIRequest.update({
        where: { id: request.id },
        data: { status: AIRequestStatus.FAILED, error: message, completedAt: new Date() },
      });
      throw error;
    }
  }

  private async run(
    request: AIRequest,
    job: RunAiJob,
  ): Promise<{ output: string; result?: SummaryResult | Record<string, unknown> }> {
    switch (request.type) {
      case AIRequestType.SUMMARIZE: {
        const summary = await this.provider.summarize(request.input);
        return { output: summary.summary, result: summary };
      }
      case AIRequestType.REWRITE: {
        const mode = (job.options?.mode as RewriteMode) ?? 'improve';
        return { output: await this.provider.rewrite(request.input, mode), result: { mode } };
      }
      case AIRequestType.GENERATE:
        return { output: await this.provider.generateText(request.input) };
      case AIRequestType.CHAT: {
        const { answer, sources } = await this.answer(request.userId, {
          question: request.input,
          documentId: request.documentId ?? undefined,
          topK: (job.options?.topK as number) ?? 6,
        });
        return { output: answer, result: { sources } };
      }
    }
  }

  // ---------------------------------------------------------------------------
  // RAG
  // ---------------------------------------------------------------------------

  /** Retrieval + prompt assembly, shared by the streaming and queued chat paths. */
  private async buildRagMessages(
    userId: string,
    dto: Pick<AskDto, 'question' | 'documentId' | 'topK'> & { history?: ChatMessage[] },
  ): Promise<{ messages: ChatMessage[]; sources: AskSource[] }> {
    const chunks = await this.indexing.searchSimilar(
      userId,
      dto.question,
      dto.topK ?? 6,
      dto.documentId,
    );

    const context = chunks
      .map((chunk, i) => `[${i + 1}] (${chunk.documentTitle})\n${chunk.content}`)
      .join('\n\n');

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: ragSystemPrompt(context || 'No relevant documents were found.'),
      },
      ...(dto.history ?? []),
      { role: 'user', content: dto.question },
    ];

    return { messages, sources: chunks.map(toSource) };
  }

  async answer(
    userId: string,
    dto: Pick<AskDto, 'question' | 'documentId' | 'topK'>,
  ): Promise<{ answer: string; sources: AskSource[] }> {
    const { messages, sources } = await this.buildRagMessages(userId, dto);
    return { answer: await this.provider.chat(messages), sources };
  }

  /**
   * Streaming lives in the request cycle on purpose: an SSE answer *is* the
   * response, so queueing it would defeat the point. It stays safe because
   * retrieval is bounded, the provider call is timed out, and the AIRequest row
   * is still written for history.
   */
  async *answerStream(
    userId: string,
    dto: AskDto,
  ): AsyncGenerator<
    { type: 'sources'; sources: AskSource[] } | { type: 'token'; value: string } | {
      type: 'done';
      requestId: string;
    }
  > {
    const { messages, sources } = await this.buildRagMessages(userId, {
      ...dto,
      history: dto.history as ChatMessage[] | undefined,
    });

    const request = await this.prisma.aIRequest.create({
      data: {
        userId,
        type: AIRequestType.CHAT,
        input: dto.question,
        documentId: dto.documentId,
        status: AIRequestStatus.PROCESSING,
      },
    });

    yield { type: 'sources', sources };

    let answer = '';
    try {
      for await (const token of this.provider.chatStream(messages)) {
        answer += token;
        yield { type: 'token', value: token };
      }

      await this.prisma.aIRequest.update({
        where: { id: request.id },
        data: {
          status: AIRequestStatus.COMPLETED,
          output: answer,
          result: { sources } as unknown as Prisma.InputJsonValue,
          completedAt: new Date(),
        },
      });
    } catch (error) {
      await this.prisma.aIRequest.update({
        where: { id: request.id },
        data: {
          status: AIRequestStatus.FAILED,
          error: error instanceof Error ? error.message : String(error),
          completedAt: new Date(),
        },
      });
      throw error;
    }

    yield { type: 'done', requestId: request.id };
  }

  // ---------------------------------------------------------------------------
  // History
  // ---------------------------------------------------------------------------

  async history(userId: string, { skip, take }: PaginationDto): Promise<Paginated<AIRequest>> {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.aIRequest.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.aIRequest.count({ where: { userId } }),
    ]);
    return { items, total, skip, take };
  }

  async findOne(userId: string, id: string): Promise<AIRequest> {
    const request = await this.prisma.aIRequest.findFirst({ where: { id, userId } });
    if (!request) throw new NotFoundException('AI request not found');
    return request;
  }

  private async documentText(userId: string, documentId?: string): Promise<string> {
    if (!documentId) throw new NotFoundException('Provide either content or documentId');

    const document = await this.prisma.document.findFirst({
      where: { id: documentId, userId },
      select: { plainText: true },
    });
    if (!document) throw new NotFoundException('Document not found');
    return document.plainText;
  }
}

function toSource(chunk: RetrievedChunk): AskSource {
  return {
    documentId: chunk.documentId,
    documentTitle: chunk.documentTitle,
    chunkIndex: chunk.chunkIndex,
    similarity: chunk.similarity,
    excerpt: chunk.content.slice(0, 240),
  };
}
