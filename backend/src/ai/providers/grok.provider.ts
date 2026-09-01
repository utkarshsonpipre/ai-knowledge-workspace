import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  AIProvider,
  ChatMessage,
  RewriteMode,
  SummaryResult,
} from '../interfaces/ai-provider.interface';
import {
  GENERATE_SYSTEM_PROMPT,
  rewritePrompt,
  SUMMARY_SYSTEM_PROMPT,
} from '../prompts';

/**
 * xAI's API is OpenAI-wire-compatible, so the official `openai` SDK is reused
 * with a different baseURL instead of hand-rolling an HTTP client — retries,
 * streaming and timeouts come for free.
 */
@Injectable()
export class GrokProvider implements AIProvider {
  readonly name = 'grok';
  private readonly logger = new Logger(GrokProvider.name);
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(config: ConfigService) {
    this.client = new OpenAI({
      apiKey: config.get<string>('ai.grokApiKey') || 'missing-key',
      baseURL: config.get<string>('ai.grokBaseUrl', 'https://api.x.ai/v1'),
      maxRetries: 2,
      timeout: 120_000,
    });
    this.model = config.get<string>('ai.grokModel', 'grok-4-fast');
  }

  async generateText(prompt: string): Promise<string> {
    return this.complete([
      { role: 'system', content: GENERATE_SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ]);
  }

  async summarize(content: string): Promise<SummaryResult> {
    const raw = await this.complete(
      [
        { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
        { role: 'user', content: truncate(content) },
      ],
      { json: true },
    );

    return parseSummary(raw);
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    return this.complete(messages);
  }

  async rewrite(content: string, mode: RewriteMode): Promise<string> {
    return this.complete([{ role: 'user', content: rewritePrompt(truncate(content), mode) }]);
  }

  async *chatStream(messages: ChatMessage[]): AsyncIterable<string> {
    try {
      const stream = await this.client.chat.completions.create({
        model: this.model,
        messages,
        stream: true,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) yield delta;
      }
    } catch (error) {
      throw this.wrap(error);
    }
  }

  private async complete(
    messages: ChatMessage[],
    opts: { json?: boolean } = {},
  ): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages,
        ...(opts.json ? { response_format: { type: 'json_object' as const } } : {}),
      });

      return response.choices[0]?.message?.content?.trim() ?? '';
    } catch (error) {
      throw this.wrap(error);
    }
  }

  private wrap(error: unknown): Error {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.error(`Grok request failed: ${message}`);
    return new ServiceUnavailableException(`AI provider error: ${message}`);
  }
}

/**
 * Guards the context window without a tokenizer dependency: ~4 chars/token is
 * close enough for a safety margin, and truncation beats a hard 400.
 */
function truncate(text: string, maxChars = 100_000): string {
  return text.length <= maxChars ? text : `${text.slice(0, maxChars)}\n\n[truncated]`;
}

/** Models occasionally wrap JSON in fences despite json mode; recover instead of failing the job. */
export function parseSummary(raw: string): SummaryResult {
  const cleaned = raw
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as Partial<SummaryResult>;
    return {
      summary: typeof parsed.summary === 'string' ? parsed.summary : cleaned,
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints.map(String) : [],
      actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems.map(String) : [],
    };
  } catch {
    return { summary: cleaned, keyPoints: [], actionItems: [] };
  }
}
