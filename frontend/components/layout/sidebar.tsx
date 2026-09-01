'use client';

import { motion } from 'framer-motion';
import {
  FileText,
  FolderOpen,
  LayoutDashboard,
  Plus,
  Search,
  Settings,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/misc';
import { useCreateDocument, useDocuments } from '@/hooks/use-documents';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/dashboard', label: 'Workspace', icon: LayoutDashboard },
  { href: '/documents', label: 'Documents', icon: FileText },
  { href: '/assistant', label: 'AI Assistant', icon: Sparkles },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/files', label: 'Files', icon: FolderOpen },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data } = useDocuments();
  const createDocument = useCreateDocument();

  const newDocument = () =>
    createDocument.mutate(
      { title: 'Untitled' },
      { onSuccess: (doc) => router.push(`/documents/${doc.id}`) },
    );

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r bg-muted/30 md:flex">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Sparkles className="h-3.5 w-3.5" />
        </div>
        <span className="text-sm font-semibold tracking-tight">Knowledge</span>
      </div>

      <nav className="space-y-0.5 p-2">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'relative flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                active
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              {active && (
                <motion.span
                  layoutId="sidebar-active"
                  className="absolute inset-0 -z-10 rounded-md bg-accent"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center justify-between px-4 pb-1 pt-3">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Recent
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={newDocument}
          disabled={createDocument.isPending}
          aria-label="New document"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      <ScrollArea className="flex-1 px-2 pb-4">
        <div className="space-y-0.5">
          {data?.items.slice(0, 20).map((doc) => (
            <Link
              key={doc.id}
              href={`/documents/${doc.id}`}
              className={cn(
                'block truncate rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
                pathname === `/documents/${doc.id}` && 'bg-accent text-foreground',
              )}
            >
              {doc.icon ? `${doc.icon} ` : ''}
              {doc.title}
            </Link>
          ))}
          {data?.items.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">No documents yet</p>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}
