'use client';

import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';
import { FileText, FolderOpen, HardDrive, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge, Skeleton } from '@/components/ui/misc';
import { useDashboard } from '@/hooks/use-dashboard';
import { formatBytes } from '@/lib/utils';

export default function DashboardPage() {
  const { data, isLoading } = useDashboard();

  const cards = [
    { label: 'Documents', value: data?.totalDocuments ?? 0, icon: FileText },
    { label: 'AI requests', value: data?.aiRequests ?? 0, icon: Sparkles },
    { label: 'Files', value: data?.totalFiles ?? 0, icon: FolderOpen },
    {
      label: 'Storage used',
      value: formatBytes(data?.storageBytes ?? 0),
      icon: HardDrive,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Workspace</h2>
        <p className="text-sm text-muted-foreground">Everything you have written and uploaded.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card, index) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.label}
                </CardTitle>
                <card.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <p className="text-2xl font-semibold tabular-nums">{card.value}</p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Recent documents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {isLoading && <Skeleton className="h-24 w-full" />}
            {data?.recentDocuments.map((doc) => (
              <Link
                key={doc.id}
                href={`/documents/${doc.id}`}
                className="flex items-center justify-between rounded-md px-2 py-2 text-sm transition-colors hover:bg-accent"
              >
                <span className="truncate">
                  {doc.icon ? `${doc.icon} ` : ''}
                  {doc.title}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(doc.updatedAt), { addSuffix: true })}
                </span>
              </Link>
            ))}
            {data?.recentDocuments.length === 0 && (
              <p className="px-2 py-6 text-sm text-muted-foreground">
                No documents yet — press <kbd className="rounded border px-1">Ctrl K</kbd> to create one.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent files</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data?.recentFiles.map((file) => (
              <div key={file.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{file.filename}</span>
                <Badge variant={statusVariant(file.status)}>{file.status.toLowerCase()}</Badge>
              </div>
            ))}
            {data?.recentFiles.length === 0 && (
              <p className="text-sm text-muted-foreground">No uploads yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data?.recentActivity.map((activity) => (
            <div key={activity.id} className="flex items-center gap-3 text-sm">
              <Badge variant="outline" className="w-24 shrink-0 justify-center capitalize">
                {activity.type.toLowerCase()}
              </Badge>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{activity.input}</span>
              <Badge variant={statusVariant(activity.status)}>{activity.status.toLowerCase()}</Badge>
              <span className="w-24 shrink-0 text-right text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
              </span>
            </div>
          ))}
          {data?.recentActivity.length === 0 && (
            <p className="text-sm text-muted-foreground">Nothing yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function statusVariant(status: string) {
  if (status === 'COMPLETED') return 'success' as const;
  if (status === 'FAILED') return 'destructive' as const;
  return 'warning' as const;
}
