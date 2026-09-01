import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { AiService } from './ai.service';
import { AskDto, GenerateDto, RewriteDto, SummarizeDto } from './dto/ai.dto';

/** AI endpoints are the expensive ones, so they carry a tighter throttle. */
@Throttle({ default: { limit: 30, ttl: 60_000 } })
@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post('summarize')
  summarize(@CurrentUser('id') userId: string, @Body() dto: SummarizeDto) {
    return this.ai.requestSummarize(userId, dto);
  }

  @Post('rewrite')
  rewrite(@CurrentUser('id') userId: string, @Body() dto: RewriteDto) {
    return this.ai.requestRewrite(userId, dto);
  }

  @Post('generate')
  generate(@CurrentUser('id') userId: string, @Body() dto: GenerateDto) {
    return this.ai.requestGenerate(userId, dto);
  }

  /** Non-streaming RAG answer — used by tests and non-browser clients. */
  @Post('ask')
  ask(@CurrentUser('id') userId: string, @Body() dto: AskDto) {
    return this.ai.answer(userId, dto);
  }

  /**
   * Server-sent events written by hand rather than via `@Sse()`: the decorator
   * only supports GET, and the question plus chat history belongs in a body.
   */
  @Post('ask/stream')
  async askStream(
    @CurrentUser('id') userId: string,
    @Body() dto: AskDto,
    @Res() res: Response,
  ): Promise<void> {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Render sits behind a proxy that would otherwise buffer the stream.
      'X-Accel-Buffering': 'no',
    });

    const send = (event: string, data: unknown) =>
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

    try {
      for await (const chunk of this.ai.answerStream(userId, dto)) {
        if (chunk.type === 'sources') send('sources', chunk.sources);
        else if (chunk.type === 'token') send('token', chunk.value);
        else send('done', { requestId: chunk.requestId });
      }
    } catch (error) {
      send('error', { message: error instanceof Error ? error.message : 'AI request failed' });
    } finally {
      res.end();
    }
  }

  @Get('history')
  history(@CurrentUser('id') userId: string, @Query() pagination: PaginationDto) {
    return this.ai.history(userId, pagination);
  }

  @Get('requests/:id')
  findOne(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.ai.findOne(userId, id);
  }
}
