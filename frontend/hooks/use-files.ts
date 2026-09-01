'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { filesService } from '@/services';

export const fileKeys = { all: ['files'] as const };

export function useFiles() {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: fileKeys.all,
    queryFn: filesService.list,
    // Belt-and-braces alongside socket events: if the worker finishes while the
    // socket is reconnecting, the list still catches up.
    refetchInterval: (query) =>
      query.state.data?.items.some((f) => f.status === 'PENDING' || f.status === 'PROCESSING')
        ? 4_000
        : false,
  });
}

/**
 * Three-step upload: reserve -> direct-to-storage PUT -> confirm. Bytes never
 * touch the API server, so a 20MB PDF costs it two tiny JSON round trips.
 */
export function useUploadFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      if (!supabase) throw new Error('Supabase storage is not configured');

      // Browsers report an empty `type` for .md and occasionally .docx. The
      // bucket restricts MIME types, and storage-js uploads a File as FormData
      // — so Supabase reads the blob's own type and the `contentType` option is
      // ignored. Re-wrapping is the only way to make the header correct;
      // without it an .md upload fails with
      // "mime type application/octet-stream is not supported".
      const contentType = file.type || guessMimeType(file.name);
      const body = file.type ? file : new File([file], file.name, { type: contentType });

      const ticket = await filesService.createUploadTicket({
        filename: file.name,
        type: contentType,
        size: file.size,
      });

      const { error } = await supabase.storage
        .from(process.env.NEXT_PUBLIC_SUPABASE_BUCKET ?? 'knowledge-files')
        .uploadToSignedUrl(ticket.path, ticket.token, body);

      if (error) throw new Error(error.message);

      return filesService.complete(ticket.fileId);
    },
    onSuccess: (file) => {
      toast.success(`${file.filename} uploaded — processing started`);
      queryClient.invalidateQueries({ queryKey: fileKeys.all });
    },
    onError: (error: Error) => toast.error(`Upload failed: ${error.message}`),
  });
}

export function useDeleteFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: filesService.remove,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: fileKeys.all }),
    onError: (error: Error) => toast.error(error.message),
  });
}

/** Browsers leave `type` empty for .md on some platforms. */
function guessMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'md' || ext === 'markdown') return 'text/markdown';
  if (ext === 'txt') return 'text/plain';
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'docx')
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  return 'application/octet-stream';
}
