import { create } from 'zustand';

export type TabId =
  | 'overview' | 'employees' | 'today' | 'candidates' | 'sites'
  | 'chronology' | 'dynamics' | 'migration' | 'discrepancies' | 'files'
  | 'tickets' | 'calendar' | 'ratings' | 'settings';

interface AppState {
  activeTab: TabId;
  sidebarOpen: boolean;
  isLoading: boolean;
  dbLoaded: boolean;
  dbRows: number;
  setActiveTab: (tab: TabId) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setIsLoading: (loading: boolean) => void;
  setDbLoaded: (loaded: boolean, rows?: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeTab: 'overview',
  sidebarOpen: true,
  isLoading: false,
  dbLoaded: false,
  dbRows: 0,
  setActiveTab: (tab) => set({ activeTab: tab }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setDbLoaded: (loaded, rows) => set({ dbLoaded: loaded, dbRows: rows ?? 0 }),
}));