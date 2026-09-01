'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import type { AIRequest } from '@/lib/types';
import { aiService } from '@/services';

export const aiKeys = {
  history: ['ai', 'history'] as const,
  request: (id: string) => ['ai', 'request', id] as const,
};

export function useAiHistory() {
  return useQuery({ queryKey: aiKeys.history, queryFn: () => aiService.history() });
}

/**
 * Summarize/rewrite/generate return immediately with a PENDING row (the work
 * happens in a worker), so the UI follows the row until it settles. Polling
 * rather than relying only on the socket keeps this correct across reconnects.
 */
export function useAiRequest(id: string | null) {
  return useQuery({
    queryKey: aiKeys.request(id ?? ''),
    queryFn: () => aiService.request(id as string),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'PENDING' || status === 'PROCESSING' ? 1_500 : false;
    },
  });
}

/** Fires an async AI job and tracks the resulting request id in one hook. */
export function useAiJob() {
  const [requestId, setRequestId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { data: request, isFetching } = useAiRequest(requestId);

  const start = (promise: Promise<AIRequest>) =>
    promise
      .then((created) => {
        setRequestId(created.id);
        queryClient.invalidateQueries({ queryKey: aiKeys.history });
        return created;
      })
      .catch((error: Error) => {
        toast.error(error.message);
        throw error;
      });

  const summarize = useMutation({
    mutationFn: (body: Parameters<typeof aiService.summarize>[0]) => start(aiService.summarize(body)),
  });
  const rewrite = useMutation({
    mutationFn: (body: Parameters<typeof aiService.rewrite>[0]) => start(aiService.rewrite(body)),
  });
  const generate = useMutation({
    mutationFn: (body: Parameters<typeof aiService.generate>[0]) => start(aiService.generate(body)),
  });

  const pending =
    summarize.isPending ||
    rewrite.isPending ||
    generate.isPending ||
    request?.status === 'PENDING' ||
    request?.status === 'PROCESSING' ||
    (Boolean(requestId) && !request && isFetching);

  return {
    summarize,
    rewrite,
    generate,
    request,
    pending,
    reset: () => setRequestId(null),
  };
}
