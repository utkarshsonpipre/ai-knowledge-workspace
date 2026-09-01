'use client';

import { formatDistanceToNow } from 'date-fns';
import { MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/misc';
import {
  useCreateDocument,
  useDeleteDocument,
  useDocuments,
  useRenameDocument,
} from '@/hooks/use-documents';

export default function DocumentsPage() {
  const [query, setQuery] = useState('');
  const { data, isLoading } = useDocuments(query);
  const createDocument = useCreateDocument();
  const deleteDocument = useDeleteDocument();
  const renameDocument = useRenameDocument();
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);
  const router = useRouter();

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Documents</h2>
          <p className="text-sm text-muted-foreground">{data?.total ?? 0} in this workspace</p>
        </div>
        <Button
          onClick={() =>
            createDocument.mutate(
              { title: 'Untitled' },
              { onSuccess: (doc) => router.push(`/documents/${doc.id}`) },
            )
          }
          disabled={createDocument.isPending}
        >
          <Plus className="h-4 w-4" />
          New
        </Button>
      </div>

      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Filter by title…"
        className="max-w-sm"
      />

      {isLoading && <Skeleton className="h-40 w-full" />}

      <div className="space-y-2">
        {data?.items.map((doc) => (
          <Card key={doc.id} className="flex items-center gap-3 p-3">
            {renaming?.id === doc.id ? (
              <form
                className="flex flex-1 gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  renameDocument.mutate({ id: doc.id, title: renaming.title });
                  setRenaming(null);
                }}
              >
                <Input
                  autoFocus
                  value={renaming.title}
                  onChange={(event) => setRenaming({ id: doc.id, title: event.target.value })}
                  onBlur={() => setRenaming(null)}
                />
                <Button size="sm" type="submit">
                  Save
                </Button>
              </form>
            ) : (
              <Link href={`/documents/${doc.id}`} className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {doc.icon ? `${doc.icon} ` : ''}
                  {doc.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  Edited {formatDistanceToNow(new Date(doc.updatedAt), { addSuffix: true })}
                </p>
              </Link>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Document actions">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setRenaming({ id: doc.id, title: doc.title })}>
                  <Pencil className="h-4 w-4" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem destructive onSelect={() => deleteDocument.mutate(doc.id)}>
                  <Trash2 className="h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </Card>
        ))}

        {data?.items.length === 0 && !isLoading && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No documents match “{query}”.
          </p>
        )}
      </div>
    </div>
  );
}
