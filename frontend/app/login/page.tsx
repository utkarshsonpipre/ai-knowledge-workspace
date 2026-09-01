'use client';

import { motion } from 'framer-motion';
import { Github, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { API_URL } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';

const FEATURES = [
  'Block editor with slash commands and AI actions',
  'Upload PDF, DOCX, TXT and Markdown — indexed automatically',
  'Ask questions across everything you have written',
  'Keyword and semantic search side by side',
];

export default function LoginPage() {
  const status = useAuthStore((s) => s.status);
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') router.replace('/dashboard');
  }, [status, router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-md space-y-8"
      >
        <div className="space-y-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Sparkles className="h-5 w-5" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Knowledge Workspace</h1>
          <p className="text-muted-foreground">
            Your documents, your files, and an assistant that has actually read them.
          </p>
        </div>

        <ul className="space-y-2 text-sm text-muted-foreground">
          {FEATURES.map((feature) => (
            <li key={feature} className="flex gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-foreground/40" />
              {feature}
            </li>
          ))}
        </ul>

        {/* Full page navigation, not fetch: the OAuth dance needs the browser. */}
        <Button asChild size="lg" className="w-full">
          <a href={`${API_URL}/auth/github`}>
            <Github className="h-4 w-4" />
            Continue with GitHub
          </a>
        </Button>

        <p className="text-xs text-muted-foreground">
          We only read your public profile and primary email address.
        </p>
      </motion.div>
    </main>
  );
}
