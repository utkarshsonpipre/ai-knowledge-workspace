import { create } from 'zustand';
import type { User } from '@/lib/types';

interface AuthState {
  /**
   * Kept in memory only — never localStorage. The httpOnly refresh cookie is
   * the durable credential, so an XSS payload cannot read a long-lived token.
   */
  accessToken: string | null;
  user: User | null;
  status: 'loading' | 'authenticated' | 'anonymous';
  setSession: (accessToken: string, user: User) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  status: 'loading',
  setSession: (accessToken, user) => set({ accessToken, user, status: 'authenticated' }),
  clear: () => set({ accessToken: null, user: null, status: 'anonymous' }),
}));
