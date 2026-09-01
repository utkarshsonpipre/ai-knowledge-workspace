'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy, Loader2, PanelRightClose, Sparkles, Wand2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/misc';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAiJob } from '@/hooks/use-ai';
import type { DocumentSummary, RewriteMode } from '@/lib/types';
import { useUiStore } from '@/store/ui-store';
import { Chat } from './chat';

const REWRITE_MODES: RewriteMode[] = ['improve', 'professional', 'shorter', 'longer', 'simplify'];

export type AiPanelTab = 'summarize' | 'rewrite' | 'ask';

export function AiPanel({
  documentId,
  documentText,
  tab,
  onTabChange,
}: {
  documentId: string;
  documentText: string;
  tab: AiPanelTab;
  onTabChange: (tab: AiPanelTab) => void;
}) {
  const open = useUiStore((s) => s.aiPanelOpen);
  const toggle = useUiStore((s) => s.toggleAiPanel);
  const { summarize, rewrite, request, pending } = useAiJob();
  const [mode, setMode] = useState<RewriteMode>('improve');

  const summary =
    request?.type === 'SUMMARIZE' && request.status === 'COMPLETED'
      ? (request.result as DocumentSummary | null)
      : null;

  const rewritten =
    request?.type === 'REWRITE' && request.status === 'COMPLETED' ? request.output : null;

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 380, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 32 }}
          className="hidden shrink-0 flex-col overflow-hidden border-l bg-muted/20 lg:flex"
        >
          <div className="flex h-12 shrink-0 items-center justify-between border-b px-3">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="h-4 w-4" />
              AI Assistant
            </span>
            <Button variant="ghost" size="icon" onClick={toggle} aria-label="Close AI panel">
              <PanelRightClose className="h-4 w-4" />
            </Button>
          </div>

          <Tabs
            value={tab}
            onValueChange={(value) => onTabChange(value as AiPanelTab)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <TabsList className="mx-3 mt-3 grid shrink-0 grid-cols-3">
              <TabsTrigger value="summarize">Summarize</TabsTrigger>
              <TabsTrigger value="rewrite">Rewrite</TabsTrigger>
              <TabsTrigger value="ask">Ask</TabsTrigger>
            </TabsList>

            <TabsContent value="summarize" className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
              <Button
                className="w-full"
                disabled={pending}
                onClick={() => summarize.mutate({ documentId })}
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Summarize document
              </Button>

              {request?.status === 'FAILED' && (
                <p className="mt-3 text-sm text-destructive">{request.error}</p>
              )}

              {summary && (
                <div className="mt-4 space-y-4 text-sm">
                  <Section title="Summary">
                    <p className="leading-6 text-muted-foreground">{summary.summary}</p>
                  </Section>

                  {summary.keyPoints.length > 0 && (
                    <Section title="Key points">
                      <ul className="space-y-1.5">
                        {summary.keyPoints.map((point, index) => (
                          <li key={index} className="flex gap-2 text-muted-foreground">
                            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-foreground/40" />
                            {point}
                          </li>
                        ))}
                      </ul>
                    </Section>
                  )}

                  {summary.actionItems.length > 0 && (
                    <Section title="Action items">
                      <ul className="space-y-1.5">
                        {summary.actionItems.map((item, index) => (
                          <li key={index} className="flex gap-2 text-muted-foreground">
                            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </Section>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="rewrite" className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
              <div className="flex flex-wrap gap-1.5">
                {REWRITE_MODES.map((option) => (
                  <button key={option} type="button" onClick={() => setMode(option)}>
                    <Badge variant={mode === option ? 'default' : 'outline'} className="capitalize">
                      {option}
                    </Badge>
                  </button>
                ))}
              </div>

              <Button
                className="mt-3 w-full"
                disabled={pending || !documentText.trim()}
                onClick={() => rewrite.mutate({ content: documentText, mode, documentId })}
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                Rewrite ({mode})
              </Button>

              {rewritten && (
                <div className="mt-4 space-y-2">
                  <CopyButton text={rewritten} />
                  <p className="whitespace-pre-wrap rounded-md border bg-background p-3 text-sm leading-6">
                    {rewritten}
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="ask" className="mt-0 flex min-h-0 flex-1 flex-col">
              <Chat
                documentId={documentId}
                emptyHint="Ask about this document. Answers cite the passages they used."
              />
            </TabsContent>
          </Tabs>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h4>
      {children}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timeout = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timeout);
  }, [copied]);

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        void navigator.clipboard.writeText(text);
        setCopied(true);
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copied' : 'Copy'}
    </Button>
  );
}
