'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Toaster } from 'sonner';
import { refreshAccessToken } from '@/lib/api';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import type { JobProgressEvent } from '@/lib/types';
import { useAuthStore } from '@/store/auth-store';
import { useUiStore } from '@/store/ui-store';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: (failureCount, error) =>
              // 401/403/404 will not fix themselves on retry.
              failureCount < 2 && !/(40[134])/.test(String((error as Error).message)),
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <SessionBootstrap />
        <RealtimeBridge />
        {children}
        <Toaster position="bottom-right" richColors closeButton />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

/**
 * The access token lives in memory, so every page load (and every hard refresh)
 * starts by trading the httpOnly cookie for a fresh one.
 */
function SessionBootstrap() {
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    if (status === 'loading') void refreshAccessToken();
  }, [status]);

  return null;
}

/** Keeps the Socket.IO connection tied to the current token and fans out progress events. */
function RealtimeBridge() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const trackJob = useUiStore((s) => s.trackJob);
  const router = useRouter();

  useEffect(() => {
    if (!accessToken) return;

    const socket = connectSocket(accessToken);
    socket.on('job:progress', (event: JobProgressEvent) => trackJob(event));
    // A finished job changed server state the cache does not know about.
    socket.on('resource:updated', () => router.refresh());

    return () => {
      socket.off('job:progress');
      socket.off('resource:updated');
    };
  }, [accessToken, trackJob, router]);

  useEffect(() => disconnectSocket, []);

  return null;
}
