/**
 * UI Store - User interface preferences and layout state management
 *
 * Features:
 * - Panel visibility management (chat, history, settings)
 * - Layout preferences (grid, tabs, split)
 * - Theme preferences (light, dark, system)
 * - Keyboard shortcuts configuration
 * - Responsive breakpoint tracking
 *
 * @module stores/uiStore
 */

import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';

// ============================================================================
// Types
// ============================================================================

/**
 * Layout mode
 */
export type LayoutMode = 'grid' | 'tabs' | 'split';

/**
 * Theme mode
 */
export type ThemeMode = 'light' | 'dark' | 'system';

/**
 * Panel types
 */
export type PanelType = 'chat' | 'history' | 'settings' | 'terminal' | 'files' | 'metrics';

/**
 * Keyboard shortcut
 */
export interface KeyboardShortcut {
  /** Shortcut key combination (e.g., 'Ctrl+K') */
  key: string;

  /** Action name */
  action: string;

  /** Description */
  description: string;

  /** Whether shortcut is enabled */
  enabled: boolean;
}

/**
 * Panel state
 */
export interface PanelState {
  /** Whether panel is visible */
  visible: boolean;

  /** Panel width (for resizable panels) */
  width?: number;

  /** Panel height (for resizable panels) */
  height?: number;

  /** Panel position index */
  position?: number;

  /** Whether panel is minimized */
  minimized?: boolean;
}

/**
 * Responsive breakpoints
 */
export type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

/**
 * Notification settings
 */
export interface NotificationSettings {
  /** Enable desktop notifications */
  desktop: boolean;

  /** Enable sound notifications */
  sound: boolean;

  /** Notification volume (0-100) */
  volume: number;

  /** Enable agent status notifications */
  agentStatus: boolean;

  /** Enable message notifications */
  messages: boolean;

  /** Enable error notifications */
  errors: boolean;
}

/**
 * Accessibility settings
 */
export interface AccessibilitySettings {
  /** Enable high contrast mode */
  highContrast: boolean;

  /** Font size multiplier */
  fontSize: number;

  /** Enable reduced motion */
  reducedMotion: boolean;

  /** Enable screen reader optimizations */
  screenReader: boolean;

  /** Keyboard navigation only mode */
  keyboardOnly: boolean;
}

/**
 * UI store state
 */
interface UIStoreState {
  /** Current layout mode */
  layout: LayoutMode;

  /** Current theme */
  theme: ThemeMode;

  /** Panel states */
  panels: Record<PanelType, PanelState>;

  /** Keyboard shortcuts */
  shortcuts: Record<string, KeyboardShortcut>;

  /** Current breakpoint */
  breakpoint: Breakpoint;

  /** Whether sidebar is collapsed */
  sidebarCollapsed: boolean;

  /** Notification settings */
  notifications: NotificationSettings;

  /** Accessibility settings */
  accessibility: AccessibilitySettings;

  /** Active modal */
  activeModal: string | null;

  /** Whether command palette is open */
  commandPaletteOpen: boolean;

  /** Recent searches */
  recentSearches: string[];

  /** Pinned items */
  pinnedItems: string[];
}

/**
 * UI store actions
 */
interface UIStoreActions {
  // Layout
  setLayout: (layout: LayoutMode) => void;
  toggleLayout: () => void;

  // Theme
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;

  // Panels
  togglePanel: (panel: PanelType) => void;
  showPanel: (panel: PanelType) => void;
  hidePanel: (panel: PanelType) => void;
  minimizePanel: (panel: PanelType) => void;
  maximizePanel: (panel: PanelType) => void;
  resizePanel: (panel: PanelType, width?: number, height?: number) => void;
  resetPanel: (panel: PanelType) => void;
  resetAllPanels: () => void;

  // Sidebar
  toggleSidebar: () => void;
  collapseSidebar: () => void;
  expandSidebar: () => void;

  // Keyboard Shortcuts
  setShortcut: (action: string, shortcut: KeyboardShortcut) => void;
  removeShortcut: (action: string) => void;
  toggleShortcut: (action: string) => void;
  resetShortcuts: () => void;

  // Breakpoint
  setBreakpoint: (breakpoint: Breakpoint) => void;

  // Modals
  openModal: (modalId: string) => void;
  closeModal: () => void;

  // Command Palette
  toggleCommandPalette: () => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;

  // Notifications
  updateNotifications: (settings: Partial<NotificationSettings>) => void;
  resetNotifications: () => void;

  // Accessibility
  updateAccessibility: (settings: Partial<AccessibilitySettings>) => void;
  resetAccessibility: () => void;

  // Search
  addRecentSearch: (query: string) => void;
  clearRecentSearches: () => void;

  // Pinned Items
  pinItem: (item: string) => void;
  unpinItem: (item: string) => void;
  togglePinItem: (item: string) => void;

  // Reset
  resetAll: () => void;
}

type UIStore = UIStoreState & UIStoreActions;

// ============================================================================
// Initial State
// ============================================================================

const defaultShortcuts: Record<string, KeyboardShortcut> = {
  toggleCommandPalette: {
    key: 'Ctrl+K',
    action: 'toggleCommandPalette',
    description: 'Toggle command palette',
    enabled: true,
  },
  toggleSidebar: {
    key: 'Ctrl+B',
    action: 'toggleSidebar',
    description: 'Toggle sidebar',
    enabled: true,
  },
  toggleChat: {
    key: 'Ctrl+Shift+C',
    action: 'toggleChat',
    description: 'Toggle chat panel',
    enabled: true,
  },
  toggleTerminal: {
    key: 'Ctrl+`',
    action: 'toggleTerminal',
    description: 'Toggle terminal panel',
    enabled: true,
  },
  toggleSettings: {
    key: 'Ctrl+,',
    action: 'toggleSettings',
    description: 'Toggle settings panel',
    enabled: true,
  },
  focusSearch: {
    key: 'Ctrl+F',
    action: 'focusSearch',
    description: 'Focus search input',
    enabled: true,
  },
  newAgent: {
    key: 'Ctrl+N',
    action: 'newAgent',
    description: 'Start new agent',
    enabled: true,
  },
  stopAgent: {
    key: 'Ctrl+Shift+Q',
    action: 'stopAgent',
    description: 'Stop active agent',
    enabled: true,
  },
};

const defaultPanels: Record<PanelType, PanelState> = {
  chat: { visible: true, width: 400, position: 0 },
  history: { visible: true, width: 300, position: 1 },
  settings: { visible: false, width: 350, position: 2 },
  terminal: { visible: true, height: 300, position: 3 },
  files: { visible: true, width: 250, position: 4 },
  metrics: { visible: false, width: 300, position: 5 },
};

const defaultNotifications: NotificationSettings = {
  desktop: false,
  sound: false,
  volume: 50,
  agentStatus: true,
  messages: true,
  errors: true,
};

const defaultAccessibility: AccessibilitySettings = {
  highContrast: false,
  fontSize: 1.0,
  reducedMotion: false,
  screenReader: false,
  keyboardOnly: false,
};

const initialState: UIStoreState = {
  layout: 'grid',
  theme: 'system',
  panels: defaultPanels,
  shortcuts: defaultShortcuts,
  breakpoint: 'lg',
  sidebarCollapsed: false,
  notifications: defaultNotifications,
  accessibility: defaultAccessibility,
  activeModal: null,
  commandPaletteOpen: false,
  recentSearches: [],
  pinnedItems: [],
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Cycle through layout modes
 */
function cycleLayout(current: LayoutMode): LayoutMode {
  const layouts: LayoutMode[] = ['grid', 'tabs', 'split'];
  const currentIndex = layouts.indexOf(current);
  return layouts[(currentIndex + 1) % layouts.length];
}

/**
 * Cycle through theme modes
 */
function cycleTheme(current: ThemeMode): ThemeMode {
  const themes: ThemeMode[] = ['light', 'dark', 'system'];
  const currentIndex = themes.indexOf(current);
  return themes[(currentIndex + 1) % themes.length];
}

/**
 * Apply theme to document
 */
function applyTheme(theme: ThemeMode) {
  const root = document.documentElement;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  let resolvedTheme = theme;
  if (theme === 'system') {
    resolvedTheme = prefersDark ? 'dark' : 'light';
  }

  root.classList.remove('light', 'dark');
  root.classList.add(resolvedTheme);
  root.setAttribute('data-theme', resolvedTheme);
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useUIStore = create<UIStore>()(
  devtools(
    persist(
      subscribeWithSelector((set, get) => ({
        ...initialState,

        // ============================================================================
        // Layout
        // ============================================================================

        setLayout: (layout: LayoutMode) => {
          set({ layout });
        },

        toggleLayout: () => {
          set((state) => ({ layout: cycleLayout(state.layout) }));
        },

        // ============================================================================
        // Theme
        // ============================================================================

        setTheme: (theme: ThemeMode) => {
          set({ theme });
          applyTheme(theme);
        },

        toggleTheme: () => {
          const newTheme = cycleTheme(get().theme);
          get().setTheme(newTheme);
        },

        // ============================================================================
        // Panels
        // ============================================================================

        togglePanel: (panel: PanelType) => {
          set((state) => ({
            panels: {
              ...state.panels,
              [panel]: {
                ...state.panels[panel],
                visible: !state.panels[panel].visible,
              },
            },
          }));
        },

        showPanel: (panel: PanelType) => {
          set((state) => ({
            panels: {
              ...state.panels,
              [panel]: {
                ...state.panels[panel],
                visible: true,
                minimized: false,
              },
            },
          }));
        },

        hidePanel: (panel: PanelType) => {
          set((state) => ({
            panels: {
              ...state.panels,
              [panel]: {
                ...state.panels[panel],
                visible: false,
              },
            },
          }));
        },

        minimizePanel: (panel: PanelType) => {
          set((state) => ({
            panels: {
              ...state.panels,
              [panel]: {
                ...state.panels[panel],
                minimized: true,
              },
            },
          }));
        },

        maximizePanel: (panel: PanelType) => {
          set((state) => ({
            panels: {
              ...state.panels,
              [panel]: {
                ...state.panels[panel],
                minimized: false,
              },
            },
          }));
        },

        resizePanel: (panel: PanelType, width?: number, height?: number) => {
          set((state) => ({
            panels: {
              ...state.panels,
              [panel]: {
                ...state.panels[panel],
                ...(width !== undefined && { width }),
                ...(height !== undefined && { height }),
              },
            },
          }));
        },

        resetPanel: (panel: PanelType) => {
          set((state) => ({
            panels: {
              ...state.panels,
              [panel]: defaultPanels[panel],
            },
          }));
        },

        resetAllPanels: () => {
          set({ panels: defaultPanels });
        },

        // ============================================================================
        // Sidebar
        // ============================================================================

        toggleSidebar: () => {
          set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
        },

        collapseSidebar: () => {
          set({ sidebarCollapsed: true });
        },

        expandSidebar: () => {
          set({ sidebarCollapsed: false });
        },

        // ============================================================================
        // Keyboard Shortcuts
        // ============================================================================

        setShortcut: (action: string, shortcut: KeyboardShortcut) => {
          set((state) => ({
            shortcuts: {
              ...state.shortcuts,
              [action]: shortcut,
            },
          }));
        },

        removeShortcut: (action: string) => {
          set((state) => {
            const { [action]: _, ...rest } = state.shortcuts;
            return { shortcuts: rest };
          });
        },

        toggleShortcut: (action: string) => {
          set((state) => ({
            shortcuts: {
              ...state.shortcuts,
              [action]: {
                ...state.shortcuts[action],
                enabled: !state.shortcuts[action]?.enabled,
              },
            },
          }));
        },

        resetShortcuts: () => {
          set({ shortcuts: defaultShortcuts });
        },

        // ============================================================================
        // Breakpoint
        // ============================================================================

        setBreakpoint: (breakpoint: Breakpoint) => {
          set({ breakpoint });
        },

        // ============================================================================
        // Modals
        // ============================================================================

        openModal: (modalId: string) => {
          set({ activeModal: modalId });
        },

        closeModal: () => {
          set({ activeModal: null });
        },

        // ============================================================================
        // Command Palette
        // ============================================================================

        toggleCommandPalette: () => {
          set((state) => ({ commandPaletteOpen: !state.commandPaletteOpen }));
        },

        openCommandPalette: () => {
          set({ commandPaletteOpen: true });
        },

        closeCommandPalette: () => {
          set({ commandPaletteOpen: false });
        },

        // ============================================================================
        // Notifications
        // ============================================================================

        updateNotifications: (settings: Partial<NotificationSettings>) => {
          set((state) => ({
            notifications: { ...state.notifications, ...settings },
          }));
        },

        resetNotifications: () => {
          set({ notifications: defaultNotifications });
        },

        // ============================================================================
        // Accessibility
        // ============================================================================

        updateAccessibility: (settings: Partial<AccessibilitySettings>) => {
          set((state) => ({
            accessibility: { ...state.accessibility, ...settings },
          }));
        },

        resetAccessibility: () => {
          set({ accessibility: defaultAccessibility });
        },

        // ============================================================================
        // Search
        // ============================================================================

        addRecentSearch: (query: string) => {
          set((state) => {
            const searches = [query, ...state.recentSearches.filter((s) => s !== query)];
            return { recentSearches: searches.slice(0, 10) }; // Keep last 10
          });
        },

        clearRecentSearches: () => {
          set({ recentSearches: [] });
        },

        // ============================================================================
        // Pinned Items
        // ============================================================================

        pinItem: (item: string) => {
          set((state) => {
            if (!state.pinnedItems.includes(item)) {
              return { pinnedItems: [...state.pinnedItems, item] };
            }
            return state;
          });
        },

        unpinItem: (item: string) => {
          set((state) => ({
            pinnedItems: state.pinnedItems.filter((i) => i !== item),
          }));
        },

        togglePinItem: (item: string) => {
          set((state) => {
            if (state.pinnedItems.includes(item)) {
              return { pinnedItems: state.pinnedItems.filter((i) => i !== item) };
            }
            return { pinnedItems: [...state.pinnedItems, item] };
          });
        },

        // ============================================================================
        // Reset
        // ============================================================================

        resetAll: () => {
          set(initialState);
          applyTheme(initialState.theme);
        },
      })),
      {
        name: 'ui-store',
        partialize: (state) => ({
          layout: state.layout,
          theme: state.theme,
          panels: state.panels,
          shortcuts: state.shortcuts,
          sidebarCollapsed: state.sidebarCollapsed,
          notifications: state.notifications,
          accessibility: state.accessibility,
          recentSearches: state.recentSearches,
          pinnedItems: state.pinnedItems,
        }),
        onRehydrateStorage: () => (state) => {
          if (state) {
            applyTheme(state.theme);
          }
        },
      }
    ),
    { name: 'UIStore' }
  )
);

// ============================================================================
// Selectors
// ============================================================================

/**
 * Select layout mode
 */
export const selectLayout = (state: UIStore) => state.layout;

/**
 * Select theme
 */
export const selectTheme = (state: UIStore) => state.theme;

/**
 * Select panel state
 */
export const selectPanel = (panel: PanelType) => (state: UIStore) => state.panels[panel];

/**
 * Select visible panels
 */
export const selectVisiblePanels = (state: UIStore) =>
  Object.entries(state.panels)
    .filter(([_, panel]) => panel.visible)
    .map(([name]) => name as PanelType);

/**
 * Select shortcuts
 */
export const selectShortcuts = (state: UIStore) => state.shortcuts;

/**
 * Select enabled shortcuts
 */
export const selectEnabledShortcuts = (state: UIStore) =>
  Object.entries(state.shortcuts)
    .filter(([_, shortcut]) => shortcut.enabled)
    .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {} as Record<string, KeyboardShortcut>);

/**
 * Select breakpoint
 */
export const selectBreakpoint = (state: UIStore) => state.breakpoint;

/**
 * Select is mobile
 */
export const selectIsMobile = (state: UIStore) =>
  state.breakpoint === 'xs' || state.breakpoint === 'sm';

/**
 * Select notifications
 */
export const selectNotifications = (state: UIStore) => state.notifications;

/**
 * Select accessibility
 */
export const selectAccessibility = (state: UIStore) => state.accessibility;

/**
 * Select sidebar state
 */
export const selectSidebarCollapsed = (state: UIStore) => state.sidebarCollapsed;

/**
 * Select active modal
 */
export const selectActiveModal = (state: UIStore) => state.activeModal;

/**
 * Select command palette state
 */
export const selectCommandPaletteOpen = (state: UIStore) => state.commandPaletteOpen;

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to detect breakpoint changes
 */
export function useBreakpointDetector() {
  const setBreakpoint = useUIStore((state) => state.setBreakpoint);

  if (typeof window !== 'undefined') {
    const updateBreakpoint = () => {
      const width = window.innerWidth;
      let breakpoint: Breakpoint = 'xs';

      if (width >= 1536) breakpoint = '2xl';
      else if (width >= 1280) breakpoint = 'xl';
      else if (width >= 1024) breakpoint = 'lg';
      else if (width >= 768) breakpoint = 'md';
      else if (width >= 640) breakpoint = 'sm';

      setBreakpoint(breakpoint);
    };

    window.addEventListener('resize', updateBreakpoint);
    updateBreakpoint();

    return () => window.removeEventListener('resize', updateBreakpoint);
  }
}
