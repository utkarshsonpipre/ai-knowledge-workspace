'use client';

import { useQuery } from '@tanstack/react-query';
import { searchService, usersService } from '@/services';

export function useDashboard() {
  return useQuery({ queryKey: ['dashboard'], queryFn: usersService.dashboard });
}

export function useSearch(query: string, mode: 'keyword' | 'semantic' | 'all' = 'all') {
  return useQuery({
    queryKey: ['search', query, mode],
    queryFn: () => searchService.run(query, mode),
    enabled: query.trim().length > 1,
    staleTime: 15_000,
  });
}
