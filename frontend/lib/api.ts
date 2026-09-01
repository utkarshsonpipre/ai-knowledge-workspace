import { useAuthStore } from '@/store/auth-store';
import type { User } from './types';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

/**
 * Single in-flight refresh shared by every concurrent 401. Without this, a
 * page that fires six queries at once would rotate the refresh token six times
 * and trip the reuse detector on the server.
 */
let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  refreshInFlight ??= (async () => {
    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('refresh failed');

      const data = (await response.json()) as { accessToken: string; user: User };
      useAuthStore.getState().setSession(data.accessToken, data.user);
      return data.accessToken;
    } catch {
      useAuthStore.getState().clear();
      return null;
    } finally {
      // Cleared on the next tick so simultaneous callers all see this attempt.
      setTimeout(() => {
        refreshInFlight = null;
      }, 0);
    }
  })();

  return refreshInFlight;
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Internal: prevents an infinite refresh loop. */
  _retried?: boolean;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, _retried, headers, ...rest } = options;
  const token = useAuthStore.getState().accessToken;

  const response = await fetch(`${API_URL}${path}`, {
    ...rest,
    credentials: 'include',
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (response.status === 401 && !_retried) {
    const fresh = await refreshAccessToken();
    if (fresh) return apiFetch<T>(path, { ...options, _retried: true });
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { message?: string; details?: unknown }
      | null;
    throw new ApiError(payload?.message ?? response.statusText, response.status, payload?.details);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
};

export { refreshAccessToken };
