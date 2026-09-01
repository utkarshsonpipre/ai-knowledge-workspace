'use client';

import { Command } from 'cmdk';
import {
  FileText,
  FolderOpen,
  LayoutDashboard,
  Plus,
  Search,
  Settings,
  Sparkles,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useCreateDocument, useDocuments } from '@/hooks/use-documents';
import { useSearch } from '@/hooks/use-dashboard';
import { useUiStore } from '@/store/ui-store';

const PAGES = [
  { label: 'Workspace', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Documents', href: '/documents', icon: FileText },
  { label: 'AI Assistant', href: '/assistant', icon: Sparkles },
  { label: 'Search', href: '/search', icon: Search },
  { label: 'Files', href: '/files', icon: FolderOpen },
  { label: 'Settings', href: '/settings', icon: Settings },
];

/**
 * Built on cmdk (already a shadcn dependency) rather than a bespoke overlay —
 * it brings filtering, keyboard loop and a11y roles for free.
 */
export function CommandPalette() {
  const open = useUiStore((s) => s.commandPaletteOpen);
  const setOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const [query, setQuery] = useState('');
  const router = useRouter();

  const { data: documents } = useDocuments();
  // Semantic hits only once the query is meaningful — the hook guards on length.
  const { data: search } = useSearch(query, 'semantic');
  const createDocument = useCreateDocument();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen(!open);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, setOpen]);

  const go = (href: string) => {
    setOpen(false);
    setQuery('');
    router.push(href);
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command palette"
      className="fixed left-1/2 top-[20%] z-50 w-full max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border bg-popover shadow-2xl"
      overlayClassName="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
      contentClassName=""
    >
      <div className="flex items-center gap-2 border-b px-4">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Command.Input
          value={query}
          onValueChange={setQuery}
          placeholder="Search documents or jump to a page…"
          className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      <Command.List className="max-h-80 overflow-y-auto p-2">
        <Command.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">
          Nothing found.
        </Command.Empty>

        <Command.Group heading="Actions" className="px-1 text-xs text-muted-foreground">
          <Item
            onSelect={() =>
              createDocument.mutate(
                { title: 'Untitled' },
                { onSuccess: (doc) => go(`/documents/${doc.id}`) },
              )
            }
          >
            <Plus className="h-4 w-4" />
            New document
          </Item>
        </Command.Group>

        <Command.Group heading="Pages" className="px-1 text-xs text-muted-foreground">
          {PAGES.map(({ label, href, icon: Icon }) => (
            <Item key={href} onSelect={() => go(href)}>
              <Icon className="h-4 w-4" />
              {label}
            </Item>
          ))}
        </Command.Group>

        {documents && documents.items.length > 0 && (
          <Command.Group heading="Documents" className="px-1 text-xs text-muted-foreground">
            {documents.items.slice(0, 8).map((doc) => (
              <Item key={doc.id} onSelect={() => go(`/documents/${doc.id}`)}>
                <FileText className="h-4 w-4" />
                {doc.title}
              </Item>
            ))}
          </Command.Group>
        )}

        {search && search.semantic.length > 0 && (
          <Command.Group heading="Related content" className="px-1 text-xs text-muted-foreground">
            {search.semantic.slice(0, 5).map((hit) => (
              <Item
                key={`${hit.documentId}-${hit.chunkIndex}`}
                onSelect={() => go(`/documents/${hit.documentId}`)}
              >
                <Sparkles className="h-4 w-4 shrink-0" />
                <span className="truncate">
                  <span className="font-medium">{hit.documentTitle}</span>
                  <span className="text-muted-foreground"> — {hit.excerpt.slice(0, 60)}…</span>
                </span>
              </Item>
            ))}
          </Command.Group>
        )}
      </Command.List>
    </Command.Dialog>
  );
}

function Item({ children, onSelect }: { children: React.ReactNode; onSelect: () => void }) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground data-[selected=true]:bg-accent"
    >
      {children}
    </Command.Item>
  );
}
