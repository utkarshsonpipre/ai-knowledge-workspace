'use client';

import { Loader2, Send, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/misc';
import type { AskSource } from '@/lib/types';
import { streamAsk } from '@/services';
import { cn } from '@/lib/utils';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: AskSource[];
}

/**
 * Streams tokens over SSE so the first word appears in ~1s instead of waiting
 * for the whole completion. History is capped before it goes to the server —
 * the RAG context is what matters, not an unbounded transcript.
 */
export function Chat({
  documentId,
  emptyHint,
  className,
}: {
  documentId?: string;
  emptyHint?: string;
  className?: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Scroll the list itself rather than scrollIntoView(): that walks up the tree
  // and scrolls every scrollable ancestor, which dragged the whole page down on
  // mount and left the other tabs starting mid-scroll.
  useEffect(() => {
    const list = listRef.current;
    if (!list || messages.length === 0) return;
    list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' });
  }, [messages, streaming]);

  const send = async () => {
    const question = input.trim();
    if (!question || streaming) return;

    setInput('');
    setMessages((current) => [
      ...current,
      { role: 'user', content: question },
      { role: 'assistant', content: '' },
    ]);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    const history = messages.slice(-6).map(({ role, content }) => ({ role, content }));

    try {
      for await (const event of streamAsk({ question, documentId, history }, controller.signal)) {
        setMessages((current) => {
          const next = [...current];
          // The spread above is shallow, so the last message object is still
          // shared with the previous state. It must be copied before any field
          // is touched: React re-invokes this updater in StrictMode, and a
          // mutation would make the second run append the same token again.
          const last = { ...next[next.length - 1] };

          if (event.type === 'token') last.content += event.value;
          else if (event.type === 'sources') last.sources = event.sources;
          else if (event.type === 'error') last.content = `⚠️ ${event.message}`;

          next[next.length - 1] = last;
          return next;
        });
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        setMessages((current) => {
          const next = [...current];
          next[next.length - 1] = {
            ...next[next.length - 1],
            content: `⚠️ ${(error as Error).message}`,
          };
          return next;
        });
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <div ref={listRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="px-1 text-sm text-muted-foreground">
            {emptyHint ?? 'Ask anything about your documents.'}
          </p>
        )}

        {messages.map((message, index) => (
          <div key={index} className="space-y-2">
            <div
              className={cn(
                'rounded-lg px-3 py-2 text-sm',
                message.role === 'user'
                  ? 'ml-auto max-w-[85%] bg-primary text-primary-foreground'
                  : 'bg-muted',
              )}
            >
              {message.role === 'assistant' ? (
                message.content ? (
                  <div className="prose prose-sm prose-neutral max-w-none dark:prose-invert">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                  </div>
                ) : (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )
              ) : (
                message.content
              )}
            </div>

            {message.sources && message.sources.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {message.sources.map((source, i) => (
                  <Badge
                    key={`${source.documentId}-${source.chunkIndex}`}
                    variant="secondary"
                    title={source.excerpt}
                  >
                    [{i + 1}] {source.documentTitle} · {(source.similarity * 100).toFixed(0)}%
                  </Badge>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-end gap-2 border-t p-3">
        <Textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
          placeholder="Ask a question…"
          className="min-h-[44px] resize-none"
          rows={1}
        />
        {streaming ? (
          <Button size="icon" variant="outline" onClick={() => abortRef.current?.abort()}>
            <Square className="h-4 w-4" />
          </Button>
        ) : (
          <Button size="icon" onClick={() => void send()} disabled={!input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
