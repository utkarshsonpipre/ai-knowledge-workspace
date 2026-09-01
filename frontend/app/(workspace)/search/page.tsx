'use client';

import { formatDistanceToNow } from 'date-fns';
import { Loader2, Search as SearchIcon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/misc';
import { useSearch } from '@/hooks/use-dashboard';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const { data, isFetching } = useSearch(query);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Search</h2>
        <p className="text-sm text-muted-foreground">
          Keyword matching runs on Postgres full-text search; meaning-based matching runs on pgvector
          embeddings.
        </p>
      </div>

      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search everything…"
          className="h-11 pl-9"
        />
        {isFetching && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Keyword
          </h3>
          {data?.keyword.map((hit) => (
            <Card key={hit.id} className="p-3">
              <Link href={`/documents/${hit.id}`} className="block space-y-1">
                <p className="truncate text-sm font-medium">
                  {hit.icon ? `${hit.icon} ` : ''}
                  {hit.title}
                </p>
                {/* ts_headline returns <mark> tags around the matched terms. */}
                <p
                  className="line-clamp-2 text-xs text-muted-foreground"
                  dangerouslySetInnerHTML={{ __html: hit.snippet }}
                />
                <p className="text-[11px] text-muted-foreground">
                  {formatDistanceToNow(new Date(hit.updatedAt), { addSuffix: true })}
                </p>
              </Link>
            </Card>
          ))}
          {data && data.keyword.length === 0 && (
            <p className="text-sm text-muted-foreground">No exact matches.</p>
          )}
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Semantic
          </h3>
          {data?.semantic.map((hit) => (
            <Card key={`${hit.documentId}-${hit.chunkIndex}`} className="p-3">
              <Link href={`/documents/${hit.documentId}`} className="block space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">{hit.documentTitle}</p>
                  <Badge variant="secondary">{(hit.similarity * 100).toFixed(0)}%</Badge>
                </div>
                <p className="line-clamp-3 text-xs text-muted-foreground">{hit.excerpt}</p>
              </Link>
            </Card>
          ))}
          {data && data.semantic.length === 0 && (
            <p className="text-sm text-muted-foreground">No related passages.</p>
          )}
        </section>
      </div>
    </div>
  );
}
