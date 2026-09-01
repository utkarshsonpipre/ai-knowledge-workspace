'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/misc';
import { usersService } from '@/services';
import { useAuthStore } from '@/store/auth-store';

const THEMES = ['light', 'dark', 'system'] as const;

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const setSession = useAuthStore((s) => s.setSession);
  const accessToken = useAuthStore((s) => s.accessToken);
  const [name, setName] = useState(user?.name ?? '');
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();

  useEffect(() => setName(user?.name ?? ''), [user?.name]);

  const save = useMutation({
    mutationFn: () => usersService.update({ name }),
    onSuccess: (updated) => {
      if (accessToken) setSession(accessToken, { ...updated });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Profile updated');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
        <p className="text-sm text-muted-foreground">Profile and appearance.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>Signed in with GitHub.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="name" className="text-sm font-medium">
              Display name
            </label>
            <Input id="name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>

          <div className="space-y-1.5">
            <span className="text-sm font-medium">Email</span>
            <p className="text-sm text-muted-foreground">{user?.email ?? 'Not provided'}</p>
          </div>

          <Button onClick={() => save.mutate()} disabled={save.isPending || !name.trim()}>
            {save.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Appearance</CardTitle>
          <CardDescription>Theme preference for this browser.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          {THEMES.map((option) => (
            <button key={option} type="button" onClick={() => setTheme(option)}>
              <Badge variant={theme === option ? 'default' : 'outline'} className="capitalize">
                {option}
              </Badge>
            </button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
