'use client';

import { LogOut, Moon, Search, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { API_URL } from '@/lib/api';
import { disconnectSocket } from '@/lib/socket';
import { initials } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import { useUiStore } from '@/store/ui-store';

export function Topbar({ title }: { title?: string }) {
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);
  const setCommandPaletteOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  // Theme is only known on the client; render the icon after hydration.
  useEffect(() => setMounted(true), []);

  const logout = async () => {
    await fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
    disconnectSocket();
    clear();
    router.replace('/login');
  };

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b px-4">
      <h1 className="truncate text-sm font-medium">{title}</h1>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="gap-2 text-muted-foreground"
          onClick={() => setCommandPaletteOpen(true)}
        >
          <Search className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Search</span>
          <kbd className="hidden rounded border bg-muted px-1.5 font-mono text-[10px] sm:inline">
            Ctrl K
          </kbd>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          aria-label="Toggle theme"
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
        >
          {mounted && resolvedTheme === 'dark' ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar>
                {user?.avatar && <AvatarImage src={user.avatar} alt={user.name ?? 'User'} />}
                <AvatarFallback>{initials(user?.name)}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5">
              <p className="truncate text-sm font-medium">{user?.name ?? 'Signed in'}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={() => void logout()}>
              <LogOut className="h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
