// desktop/src/state/previewState.ts
// Phase 115.1: Browser Preview State Management (Zustand)
// Phase 115.3: Added reloadToken for auto-refresh support
// Phase 115.4: Added autoRefreshEnabled toggle for Cursor-like toolbar
// Phase 115.5: Added ViewportMode for Device Frames (Desktop/Tablet/Mobile)
// Phase 116.1: Multi Preview Tabs support
// Phase 117: Added showLogs toggle for Console Panel
// Phase 119.1: State persistence with localStorage
// Phase 119.6: Each tab has its own independent URL
import { create } from 'zustand';

// Phase 115.5: Viewport modes for device preview
export type ViewportMode = 'full' | 'desktop' | 'tablet' | 'mobile';

// Phase 132.1: Fit mode for auto-scaling content
export type FitMode = 'auto' | '100%' | '75%' | '50%';

// Phase 116.1: Preview Tab type
export type PreviewTab = {
  id: string;
  title: string;
  url: string;
  viewportMode: ViewportMode;
  isActive: boolean;
};

// Phase 119.8: Default URL - change to your dev server URL
const DEFAULT_URL = 'http://localhost:3030/en';

// Phase 119.1: Storage key for localStorage
const STORAGE_KEY = 'f0_preview_state';

// Phase 119.1: Type for persisted state (only serializable parts)
type PersistedPreviewState = {
  isOpen: boolean;
  url: string;
  autoRefreshEnabled: boolean;
  viewportMode: ViewportMode;
  showLogs: boolean;
  tabs: PreviewTab[];
  fitMode: FitMode; // Phase 132.1
};

// Phase 119.1: Save state to localStorage
function saveStateToStorage(state: PersistedPreviewState): void {
  try {
    const safe: PersistedPreviewState = {
      isOpen: state.isOpen,
      url: state.url,
      autoRefreshEnabled: state.autoRefreshEnabled,
      viewportMode: state.viewportMode,
      showLogs: state.showLogs,
      tabs: state.tabs,
      fitMode: state.fitMode, // Phase 132.1
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
  } catch (e) {
    console.warn('[previewState] Failed to save state:', e);
  }
}

// Phase 119.1: Load state from localStorage
function loadStateFromStorage(): PersistedPreviewState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedPreviewState;
    // Validate essential fields
    if (!parsed.tabs || !Array.isArray(parsed.tabs) || parsed.tabs.length === 0) {
      return null;
    }
    return parsed;
  } catch (e) {
    console.warn('[previewState] Failed to load state:', e);
    return null;
  }
}

// Phase 119.1: Get default tab
function getDefaultTab(): PreviewTab {
  return {
    id: 'tab-1',
    title: 'Home',
    url: DEFAULT_URL,
    viewportMode: 'full',
    isActive: true,
  };
}

// Phase 119.1: Load persisted state or use defaults
const persisted = loadStateFromStorage();

interface PreviewState {
  isOpen: boolean;
  url: string;
  reloadToken: number; // Phase 115.3: Increment to trigger reload
  autoRefreshEnabled: boolean; // Phase 115.4: Toggle for auto-refresh
  viewportMode: ViewportMode; // Phase 115.5: Current viewport mode
  showLogs: boolean; // Phase 117: Toggle for Console logs panel
  fitMode: FitMode; // Phase 132.1: Auto-fit scaling mode

  // Phase 116.1: Tabs
  tabs: PreviewTab[];

  toggle: () => void;
  open: () => void;
  close: () => void;
  setUrl: (url: string) => void;
  reload: () => void; // Phase 115.3: Trigger preview reload
  enableAutoRefresh: () => void;
  disableAutoRefresh: () => void;
  toggleAutoRefresh: () => void;
  setViewportMode: (mode: ViewportMode) => void; // Phase 115.5
  toggleLogs: () => void; // Phase 117: Toggle console logs panel
  setFitMode: (mode: FitMode) => void; // Phase 132.1: Set fit mode

  // Phase 116.1: Tabs actions
  openTab: (url?: string) => void;
  closeTab: (id: string) => void;
  activateTab: (id: string) => void;
  nextTab: () => void;
  prevTab: () => void;
}

export const usePreviewState = create<PreviewState>((set) => ({
  // Phase 119.1: Use persisted state or defaults
  isOpen: persisted?.isOpen ?? true,
  url: persisted?.url ?? DEFAULT_URL,
  reloadToken: 0,
  autoRefreshEnabled: persisted?.autoRefreshEnabled ?? true,
  viewportMode: persisted?.viewportMode ?? 'full',
  showLogs: persisted?.showLogs ?? false,
  fitMode: persisted?.fitMode ?? 'auto', // Phase 132.1: Default to auto-fit

  // Phase 116.1 + 119.1: Use persisted tabs or default
  tabs: persisted?.tabs ?? [getDefaultTab()],

  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),

  // Phase 116.1: setUrl updates active tab
  setUrl: (url: string) =>
    set((state) => {
      const tabs = state.tabs.map((t) =>
        t.isActive ? { ...t, url } : t
      );
      return { url, tabs };
    }),

  // Phase 115.3: Increment reloadToken to trigger webview remount
  reload: () => set((state) => ({ reloadToken: state.reloadToken + 1 })),

  // Phase 115.4: Auto-refresh controls
  enableAutoRefresh: () => set({ autoRefreshEnabled: true }),
  disableAutoRefresh: () => set({ autoRefreshEnabled: false }),
  toggleAutoRefresh: () => set((state) => ({ autoRefreshEnabled: !state.autoRefreshEnabled })),

  // Phase 115.5: Viewport mode control - also updates active tab
  setViewportMode: (mode: ViewportMode) =>
    set((state) => {
      const tabs = state.tabs.map((t) =>
        t.isActive ? { ...t, viewportMode: mode } : t
      );
      return { viewportMode: mode, tabs };
    }),

  // Phase 117: Toggle logs panel
  toggleLogs: () => set((state) => ({ showLogs: !state.showLogs })),

  // Phase 132.1: Set fit mode
  setFitMode: (mode: FitMode) => set({ fitMode: mode }),

  // Phase 116.1: Open new tab
  openTab: (url?: string) =>
    set((state) => {
      const id = `tab-${Date.now()}`;
      const activeTab = state.tabs.find((t) => t.isActive);
      const newUrl = url ?? activeTab?.url ?? DEFAULT_URL;
      const newViewport = activeTab?.viewportMode ?? 'full';

      const newTab: PreviewTab = {
        id,
        title: 'New Tab',
        url: newUrl,
        viewportMode: newViewport,
        isActive: true,
      };

      const tabs = state.tabs.map((t) => ({ ...t, isActive: false }));
      tabs.push(newTab);

      return {
        tabs,
        url: newUrl,
        viewportMode: newViewport,
        reloadToken: state.reloadToken + 1,
      };
    }),

  // Phase 116.1: Close tab
  closeTab: (id: string) =>
    set((state) => {
      if (state.tabs.length === 1) return state; // Don't close last tab

      const closingTab = state.tabs.find((t) => t.id === id);
      const wasActive = closingTab?.isActive ?? false;
      const tabs = state.tabs.filter((t) => t.id !== id);

      // If we closed the active tab, activate the last one
      if (wasActive && tabs.length > 0) {
        const last = tabs[tabs.length - 1];
        last.isActive = true;

        return {
          tabs,
          url: last.url,
          viewportMode: last.viewportMode,
          reloadToken: state.reloadToken + 1,
        };
      }

      return { tabs };
    }),

  // Phase 116.1: Activate tab
  activateTab: (id: string) =>
    set((state) => {
      const tabs = state.tabs.map((t) => ({
        ...t,
        isActive: t.id === id,
      }));
      const active = tabs.find((t) => t.id === id);
      if (!active) return state;

      return {
        tabs,
        url: active.url,
        viewportMode: active.viewportMode,
        reloadToken: state.reloadToken + 1,
      };
    }),

  // Phase 116.1: Next tab
  nextTab: () =>
    set((state) => {
      if (state.tabs.length <= 1) return state;

      const currentIndex = state.tabs.findIndex((t) => t.isActive);
      const nextIndex = (currentIndex + 1) % state.tabs.length;

      const tabs = state.tabs.map((t, i) => ({
        ...t,
        isActive: i === nextIndex,
      }));
      const active = tabs[nextIndex];

      return {
        tabs,
        url: active.url,
        viewportMode: active.viewportMode,
        reloadToken: state.reloadToken + 1,
      };
    }),

  // Phase 116.1: Previous tab
  prevTab: () =>
    set((state) => {
      if (state.tabs.length <= 1) return state;

      const currentIndex = state.tabs.findIndex((t) => t.isActive);
      const prevIndex = (currentIndex - 1 + state.tabs.length) % state.tabs.length;

      const tabs = state.tabs.map((t, i) => ({
        ...t,
        isActive: i === prevIndex,
      }));
      const active = tabs[prevIndex];

      return {
        tabs,
        url: active.url,
        viewportMode: active.viewportMode,
        reloadToken: state.reloadToken + 1,
      };
    }),
}));

// Phase 119.1: Subscribe to state changes and persist
usePreviewState.subscribe((state) => {
  saveStateToStorage({
    isOpen: state.isOpen,
    url: state.url,
    autoRefreshEnabled: state.autoRefreshEnabled,
    viewportMode: state.viewportMode,
    showLogs: state.showLogs,
    tabs: state.tabs,
    fitMode: state.fitMode, // Phase 132.1
  });
});

// Phase 115.3: Helper to trigger reload from anywhere (non-React code)
// Phase 115.4: Now respects autoRefreshEnabled toggle
export function triggerPreviewReload() {
  const { autoRefreshEnabled, reload } = usePreviewState.getState();
  if (!autoRefreshEnabled) return;
  reload();
}
