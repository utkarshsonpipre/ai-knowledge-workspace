'use client';

import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { refreshAccessToken } from '@/lib/api';

/**
 * The backend redirected here after setting the httpOnly refresh cookie. No
 * token ever appears in the URL — we exchange the cookie for an access token
 * and move on.
 */
export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    void refreshAccessToken().then((token) => router.replace(token ? '/dashboard' : '/login'));
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="flex items-center gap-3 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Signing you in…
      </div>
    </main>
  );
}
