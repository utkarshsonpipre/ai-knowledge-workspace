'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { DocumentDetail, DocumentListItem, Paginated } from '@/lib/types';
import { documentsService } from '@/services';

export const documentKeys = {
  all: ['documents'] as const,
  list: (q?: string) => ['documents', 'list', q ?? ''] as const,
  detail: (id: string) => ['documents', 'detail', id] as const,
  recent: ['documents', 'recent'] as const,
};

export function useDocuments(q?: string) {
  return useQuery({
    queryKey: documentKeys.list(q),
    queryFn: () => documentsService.list({ q, take: 100 }),
  });
}

export function useDocument(id: string) {
  return useQuery({
    queryKey: documentKeys.detail(id),
    queryFn: () => documentsService.get(id),
    enabled: Boolean(id),
  });
}

export function useCreateDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: documentsService.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: documentKeys.all }),
    onError: (error: Error) => toast.error(error.message),
  });
}

/**
 * Autosave path. Optimistic so the title in the sidebar updates the instant you
 * type, with a rollback snapshot if the write fails.
 */
export function useUpdateDocument(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: Parameters<typeof documentsService.update>[1]) =>
      documentsService.update(id, body),
    onMutate: async (body) => {
      await queryClient.cancelQueries({ queryKey: documentKeys.detail(id) });
      const previous = queryClient.getQueryData<DocumentDetail>(documentKeys.detail(id));

      if (previous) {
        queryClient.setQueryData<DocumentDetail>(documentKeys.detail(id), { ...previous, ...body });
      }
      return { previous };
    },
    onError: (error: Error, _body, context) => {
      if (context?.previous) queryClient.setQueryData(documentKeys.detail(id), context.previous);
      toast.error(`Save failed: ${error.message}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: documentKeys.list() });
      queryClient.invalidateQueries({ queryKey: documentKeys.recent });
    },
  });
}

export function useRenameDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      documentsService.rename(id, title),
    onSuccess: (doc) => {
      queryClient.setQueryData(documentKeys.detail(doc.id), doc);
      queryClient.invalidateQueries({ queryKey: documentKeys.all });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: documentsService.remove,
    onMutate: async (id: string) => {
      const key = documentKeys.list('');
      const previous = queryClient.getQueryData<Paginated<DocumentListItem>>(key);
      if (previous) {
        queryClient.setQueryData<Paginated<DocumentListItem>>(key, {
          ...previous,
          items: previous.items.filter((doc) => doc.id !== id),
          total: previous.total - 1,
        });
      }
      return { previous };
    },
    onError: (error: Error, _id, context) => {
      if (context?.previous) queryClient.setQueryData(documentKeys.list(''), context.previous);
      toast.error(error.message);
    },
    onSuccess: () => {
      toast.success('Document deleted');
      queryClient.invalidateQueries({ queryKey: documentKeys.all });
    },
  });
}
