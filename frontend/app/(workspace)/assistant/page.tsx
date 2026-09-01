'use client';

import { formatDistanceToNow } from 'date-fns';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/misc';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Chat } from '@/features/ai/chat';
import { useAiHistory, useAiJob } from '@/hooks/use-ai';

export default function AssistantPage() {
  return (
    <div className="mx-auto flex h-full max-w-4xl flex-col p-6">
      <div className="mb-4">
        <h2 className="text-2xl font-semibold tracking-tight">AI Assistant</h2>
        <p className="text-sm text-muted-foreground">
          Chat grounded in your whole workspace, or generate something new.
        </p>
      </div>

      <Tabs defaultValue="chat" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="w-fit">
          <TabsTrigger value="chat">Chat</TabsTrigger>
          <TabsTrigger value="generate">Generate</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="flex min-h-0 flex-1 flex-col">
          <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <Chat emptyHint="Ask about anything you have written or uploaded." />
          </Card>
        </TabsContent>

        <TabsContent value="generate" className="min-h-0 flex-1 overflow-y-auto">
          <GeneratePanel />
        </TabsContent>

        <TabsContent value="history" className="min-h-0 flex-1 overflow-y-auto">
          <HistoryPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function GeneratePanel() {
  const [prompt, setPrompt] = useState('');
  const { generate, request, pending } = useAiJob();

  return (
    // Output sits above the composer so the prompt box and Generate button stay
    // put: growing results push the page down instead of shifting the controls.
    <div className="flex flex-col gap-4">
      {request?.status === 'FAILED' && <p className="text-sm text-destructive">{request.error}</p>}

      {request?.status === 'COMPLETED' && request.output && (
        <Card>
          <CardContent className="prose prose-sm prose-neutral max-w-none whitespace-pre-wrap pt-6 dark:prose-invert">
            {request.output}
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        <Textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          rows={4}
          placeholder="e.g. Write a project proposal for a customer feedback pipeline"
        />
        <Button
          disabled={pending || !prompt.trim()}
          onClick={() => {
            // Snapshot before clearing — the mutation reads this value, not state.
            const submitted = prompt.trim();
            if (!submitted) return;
            generate.mutate({ prompt: submitted });
            setPrompt('');
          }}
        >
          {pending ? 'Generating…' : 'Generate'}
        </Button>
      </div>
    </div>
  );
}

function HistoryPanel() {
  const { data } = useAiHistory();

  return (
    <div className="space-y-2">
      {data?.items.map((item) => (
        <Card key={item.id}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 py-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Badge variant="outline" className="capitalize">
                {item.type.toLowerCase()}
              </Badge>
              <span className="text-muted-foreground">
                {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
              </span>
            </CardTitle>
            <Badge
              variant={
                item.status === 'COMPLETED'
                  ? 'success'
                  : item.status === 'FAILED'
                    ? 'destructive'
                    : 'warning'
              }
            >
              {item.status.toLowerCase()}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-1 pb-4 text-sm">
            <p className="line-clamp-2 text-muted-foreground">{item.input}</p>
            {item.output && <p className="line-clamp-3">{item.output}</p>}
          </CardContent>
        </Card>
      ))}
      {data?.items.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">No AI requests yet.</p>
      )}
    </div>
  );
}
