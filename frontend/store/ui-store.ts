import { create } from 'zustand';
import type { JobProgressEvent } from '@/lib/types';

interface UiState {
  commandPaletteOpen: boolean;
  aiPanelOpen: boolean;
  /** Live job progress keyed by resourceId (file id / AI request id). */
  jobs: Record<string, JobProgressEvent>;
  setCommandPaletteOpen: (open: boolean) => void;
  toggleAiPanel: () => void;
  setAiPanelOpen: (open: boolean) => void;
  trackJob: (event: JobProgressEvent) => void;
  clearJob: (resourceId: string) => void;
}

export const useUiStore = create<UiState>((set) => ({
  commandPaletteOpen: false,
  aiPanelOpen: true,
  jobs: {},
  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
  toggleAiPanel: () => set((state) => ({ aiPanelOpen: !state.aiPanelOpen })),
  setAiPanelOpen: (aiPanelOpen) => set({ aiPanelOpen }),
  trackJob: (event) => set((state) => ({ jobs: { ...state.jobs, [event.resourceId]: event } })),
  clearJob: (resourceId) =>
    set((state) => {
      const { [resourceId]: _removed, ...rest } = state.jobs;
      return { jobs: rest };
    }),
}));
