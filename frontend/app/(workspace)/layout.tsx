'use client';

import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { CommandPalette } from '@/components/command-palette';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { useAuthStore } from '@/store/auth-store';

/**
 * Client-side guard: the session lives in an httpOnly cookie the Next server
 * cannot usefully validate without duplicating JWT logic, and every API call is
 * authorised independently anyway. This only controls what the shell renders.
 */
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const router = useRouter();

  useEffect(() => {
    if (status === 'anonymous') router.replace('/login');
  }, [status, router]);

  if (status !== 'authenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
      <CommandPalette />
    </div>
  );
}
