'use client';

import { formatDistanceToNow } from 'date-fns';
import { ExternalLink, FileText, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge, Progress, Skeleton } from '@/components/ui/misc';
import { UploadDropzone } from '@/features/files/upload-dropzone';
import { useDeleteFile, useFiles, useUploadFile } from '@/hooks/use-files';
import { filesService } from '@/services';
import { formatBytes } from '@/lib/utils';
import { useUiStore } from '@/store/ui-store';

export default function FilesPage() {
  const { data, isLoading } = useFiles();
  const upload = useUploadFile();
  const remove = useDeleteFile();
  const jobs = useUiStore((s) => s.jobs);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Files</h2>
        <p className="text-sm text-muted-foreground">
          Uploads are parsed, chunked and embedded automatically — then they become searchable
          documents.
        </p>
      </div>

      <UploadDropzone
        disabled={upload.isPending}
        onFiles={(files) => files.forEach((file) => upload.mutate(file))}
      />

      {isLoading && <Skeleton className="h-32 w-full" />}

      <div className="space-y-2">
        {data?.items.map((file) => {
          const job = jobs[file.id];
          const active = file.status === 'PROCESSING' || file.status === 'PENDING';

          return (
            <Card key={file.id} className="space-y-2 p-3">
              <div className="flex items-center gap-3">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file.filename}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(file.size)} ·{' '}
                    {formatDistanceToNow(new Date(file.createdAt), { addSuffix: true })}
                  </p>
                </div>

                <Badge variant={statusVariant(file.status)}>{file.status.toLowerCase()}</Badge>

                {file.documentId && (
                  <Button variant="ghost" size="icon" asChild aria-label="Open document">
                    <Link href={`/documents/${file.documentId}`}>
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Download"
                  onClick={async () => {
                    const { url } = await filesService.downloadUrl(file.id);
                    window.open(url, '_blank', 'noopener');
                  }}
                >
                  <FileText className="h-4 w-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete file"
                  onClick={() => remove.mutate(file.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>

              {(active || job) && job?.stage !== 'completed' && (
                <div className="space-y-1">
                  <Progress value={job?.percent ?? 5} />
                  <p className="text-xs text-muted-foreground">
                    {job?.message ?? 'Queued'} {job ? `· ${job.percent}%` : ''}
                  </p>
                </div>
              )}

              {file.status === 'FAILED' && file.error && (
                <p className="text-xs text-destructive">{file.error}</p>
              )}
            </Card>
          );
        })}

        {data?.items.length === 0 && !isLoading && (
          <p className="py-8 text-center text-sm text-muted-foreground">No files uploaded yet.</p>
        )}
      </div>
    </div>
  );
}

function statusVariant(status: string) {
  if (status === 'COMPLETED') return 'success' as const;
  if (status === 'FAILED') return 'destructive' as const;
  return 'warning' as const;
}
