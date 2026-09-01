import { api, API_URL } from '@/lib/api';
import type {
  AIRequest,
  AskSource,
  DashboardStats,
  DocumentDetail,
  DocumentListItem,
  Paginated,
  RewriteMode,
  SearchResults,
  StoredFile,
  User,
} from '@/lib/types';
import { useAuthStore } from '@/store/auth-store';

export const usersService = {
  me: () => api.get<User>('/users/me'),
  dashboard: () => api.get<DashboardStats>('/users/me/dashboard'),
  update: (body: { name?: string; preferences?: Record<string, unknown> }) =>
    api.patch<User>('/users/me', body),
};

export const documentsService = {
  list: (params: { skip?: number; take?: number; q?: string } = {}) =>
    api.get<Paginated<DocumentListItem>>(`/documents?${new URLSearchParams(
      Object.entries(params).reduce<Record<string, string>>((acc, [k, v]) => {
        if (v !== undefined && v !== '') acc[k] = String(v);
        return acc;
      }, {}),
    )}`),
  recent: () => api.get<DocumentListItem[]>('/documents/recent'),
  get: (id: string) => api.get<DocumentDetail>(`/documents/${id}`),
  create: (body: { title?: string; content?: Record<string, unknown> }) =>
    api.post<DocumentDetail>('/documents', body),
  update: (id: string, body: Partial<Pick<DocumentDetail, 'title' | 'content' | 'icon'>> & { isArchived?: boolean }) =>
    api.patch<DocumentDetail>(`/documents/${id}`, body),
  rename: (id: string, title: string) => api.patch<DocumentDetail>(`/documents/${id}/rename`, { title }),
  remove: (id: string) => api.delete<void>(`/documents/${id}`),
};

export const filesService = {
  list: () => api.get<Paginated<StoredFile>>('/files?take=50'),
  createUploadTicket: (body: { filename: string; type: string; size: number }) =>
    api.post<{ fileId: string; path: string; signedUrl: string; token: string }>(
      '/files/upload-url',
      body,
    ),
  complete: (id: string) => api.post<StoredFile>(`/files/${id}/complete`),
  downloadUrl: (id: string) => api.get<{ url: string }>(`/files/${id}/download-url`),
  remove: (id: string) => api.delete<void>(`/files/${id}`),
};

export const aiService = {
  summarize: (body: { documentId?: string; content?: string }) =>
    api.post<AIRequest>('/ai/summarize', body),
  rewrite: (body: { content: string; mode: RewriteMode; documentId?: string }) =>
    api.post<AIRequest>('/ai/rewrite', body),
  generate: (body: { prompt: string; documentId?: string }) =>
    api.post<AIRequest>('/ai/generate', body),
  ask: (body: { question: string; documentId?: string; topK?: number }) =>
    api.post<{ answer: string; sources: AskSource[] }>('/ai/ask', body),
  history: (take = 30) => api.get<Paginated<AIRequest>>(`/ai/history?take=${take}`),
  request: (id: string) => api.get<AIRequest>(`/ai/requests/${id}`),
};

export const searchService = {
  run: (q: string, mode: 'keyword' | 'semantic' | 'all' = 'all') =>
    api.get<SearchResults>(`/search?q=${encodeURIComponent(q)}&mode=${mode}`),
};

export type StreamEvent =
  | { type: 'sources'; sources: AskSource[] }
  | { type: 'token'; value: string }
  | { type: 'done'; requestId: string }
  | { type: 'error'; message: string };

/**
 * SSE over POST, so `EventSource` (GET-only) is out. The body reader below is
 * a minimal `text/event-stream` parser — events are separated by a blank line.
 */
export async function* streamAsk(
  body: { question: string; documentId?: string; history?: Array<{ role: string; content: string }> },
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const response = await fetch(`${API_URL}/ai/ask/stream`, {
    method: 'POST',
    credentials: 'include',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${useAuthStore.getState().accessToken ?? ''}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok || !response.body) {
    yield { type: 'error', message: `Request failed (${response.status})` };
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? '';

    for (const frame of frames) {
      const event = frame.match(/^event: (.+)$/m)?.[1];
      const data = frame.match(/^data: (.*)$/m)?.[1];
      if (!event || data === undefined) continue;

      const parsed: unknown = JSON.parse(data);
      if (event === 'sources') yield { type: 'sources', sources: parsed as AskSource[] };
      else if (event === 'token') yield { type: 'token', value: parsed as string };
      else if (event === 'done') yield { type: 'done', requestId: (parsed as { requestId: string }).requestId };
      else if (event === 'error') yield { type: 'error', message: (parsed as { message: string }).message };
    }
  }
}
