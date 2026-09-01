export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface SummaryResult {
  summary: string;
  keyPoints: string[];
  actionItems: string[];
}

export type RewriteMode = 'improve' | 'professional' | 'shorter' | 'longer' | 'simplify';

/**
 * The only surface the rest of the app knows about. Swapping Grok for OpenAI /
 * Claude / Gemini means adding one class and changing one provider binding in
 * AiModule — no caller changes.
 *
 * Note what is NOT here: embeddings. Grok exposes no embeddings endpoint, so
 * forcing it into this interface would guarantee a runtime "not supported"
 * failure the day someone switches providers. See EmbeddingProvider.
 */
export interface AIProvider {
  readonly name: string;

  generateText(prompt: string): Promise<string>;
  summarize(content: string): Promise<SummaryResult>;
  chat(messages: ChatMessage[]): Promise<string>;
  rewrite(content: string, mode: RewriteMode): Promise<string>;

  /** Token-by-token chat for the assistant panel's SSE endpoint. */
  chatStream(messages: ChatMessage[]): AsyncIterable<string>;
}

export const AI_PROVIDER = Symbol('AI_PROVIDER');
