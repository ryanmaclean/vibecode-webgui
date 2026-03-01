/**
 * Status Bar State Management Hook
 *
 * Manages UI state for the Unified Status Bar including:
 * - Collapsed/expanded state with localStorage persistence
 * - User preferences (auto-expand, metrics, refresh interval)
 * - Active service/category selection
 * - Keyboard shortcut handling
 *
 * Use cases:
 * - Status bar collapse/expand state persistence
 * - User preference management across sessions
 * - Service focus/selection state
 * - Responsive UI state management
 *
 * Performance Impact:
 * - Minimal overhead with localStorage synchronization
 * - Automatic cross-tab state synchronization
 * - SSR-safe with graceful fallback
 *
 * @module hooks/useStatusBarState
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import type { StatusBarPreferences, ServiceCategory } from '@/types/unified-status';
import { DEFAULT_STATUS_BAR_PREFERENCES } from '@/types/unified-status';

const STORAGE_KEY_PREFERENCES = 'status-bar-preferences';
const STORAGE_KEY_COLLAPSED = 'status-bar-collapsed';
const STORAGE_KEY_ACTIVE_SERVICE = 'status-bar-active-service';

/**
 * Status bar state return type
 */
export interface UseStatusBarStateReturn {
  /** Whether the status bar is collapsed */
  isCollapsed: boolean;
  /** Set collapsed state */
  setIsCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
  /** Toggle collapsed state */
  toggleCollapsed: () => void;
  /** User preferences */
  preferences: StatusBarPreferences;
  /** Update preferences (partial or full) */
  updatePreferences: (updates: Partial<StatusBarPreferences>) => void;
  /** Reset preferences to defaults */
  resetPreferences: () => void;
  /** Currently active/selected service name (if any) */
  activeService: string | null;
  /** Set active service */
  setActiveService: (serviceName: string | null) => void;
  /** Currently active/selected category (if any) */
  activeCategory: ServiceCategory | null;
  /** Set active category */
  setActiveCategory: (category: ServiceCategory | null) => void;
}

/**
 * Custom hook for managing status bar UI state
 *
 * @param initialCollapsed - Initial collapsed state (default: true)
 * @param initialPreferences - Initial preferences (default: DEFAULT_STATUS_BAR_PREFERENCES)
 * @returns Status bar state and control functions
 *
 * @example
 * ```tsx
 * function StatusBar() {
 *   const {
 *     isCollapsed,
 *     toggleCollapsed,
 *     preferences,
 *     updatePreferences,
 *   } = useStatusBarState();
 *
 *   return (
 *     <div>
 *       <button onClick={toggleCollapsed}>
 *         {isCollapsed ? 'Expand' : 'Collapse'}
 *       </button>
 *       <button onClick={() => updatePreferences({ showDetailedMetrics: !preferences.showDetailedMetrics })}>
 *         Toggle Metrics
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // With custom initial values
 * const state = useStatusBarState(false, {
 *   ...DEFAULT_STATUS_BAR_PREFERENCES,
 *   autoExpandOnUnhealthy: false,
 * });
 * ```
 */
export function useStatusBarState(
  initialCollapsed: boolean = true,
  initialPreferences: StatusBarPreferences = DEFAULT_STATUS_BAR_PREFERENCES
): UseStatusBarStateReturn {
  // SSR safety check
  const isClient = typeof window !== 'undefined';

  // Collapsed state with localStorage persistence
  const [isCollapsed, setIsCollapsedState] = useState<boolean>(() => {
    if (!isClient) {
      return initialCollapsed;
    }

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY_COLLAPSED);
      return stored !== null ? JSON.parse(stored) : initialCollapsed;
    } catch (error) {
      console.warn('Error reading status bar collapsed state from localStorage:', error);
      return initialCollapsed;
    }
  });

  // Preferences with localStorage persistence
  const [preferences, setPreferencesState] = useState<StatusBarPreferences>(() => {
    if (!isClient) {
      return initialPreferences;
    }

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY_PREFERENCES);
      return stored !== null
        ? { ...DEFAULT_STATUS_BAR_PREFERENCES, ...JSON.parse(stored) }
        : initialPreferences;
    } catch (error) {
      console.warn('Error reading status bar preferences from localStorage:', error);
      return initialPreferences;
    }
  });

  // Active service (for highlighting/focus)
  const [activeService, setActiveServiceState] = useState<string | null>(() => {
    if (!isClient) {
      return null;
    }

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY_ACTIVE_SERVICE);
      return stored;
    } catch (error) {
      console.warn('Error reading active service from localStorage:', error);
      return null;
    }
  });

  // Active category (for highlighting/focus)
  const [activeCategory, setActiveCategoryState] = useState<ServiceCategory | null>(null);

  /**
   * Set collapsed state with localStorage persistence
   */
  const setIsCollapsed = useCallback(
    (value: boolean | ((prev: boolean) => boolean)) => {
      try {
        const newValue = value instanceof Function ? value(isCollapsed) : value;
        setIsCollapsedState(newValue);

        if (isClient) {
          window.localStorage.setItem(STORAGE_KEY_COLLAPSED, JSON.stringify(newValue));
        }
      } catch (error) {
        console.warn('Error setting status bar collapsed state:', error);
      }
    },
    [isCollapsed, isClient]
  );

  /**
   * Toggle collapsed state
   */
  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((prev: boolean) => !prev);
  }, [setIsCollapsed]);

  /**
   * Update preferences with localStorage persistence
   */
  const updatePreferences = useCallback(
    (updates: Partial<StatusBarPreferences>) => {
      try {
        const newPreferences = { ...preferences, ...updates };
        setPreferencesState(newPreferences);

        if (isClient) {
          window.localStorage.setItem(STORAGE_KEY_PREFERENCES, JSON.stringify(newPreferences));
        }
      } catch (error) {
        console.warn('Error updating status bar preferences:', error);
      }
    },
    [preferences, isClient]
  );

  /**
   * Reset preferences to defaults
   */
  const resetPreferences = useCallback(() => {
    try {
      setPreferencesState(DEFAULT_STATUS_BAR_PREFERENCES);

      if (isClient) {
        window.localStorage.setItem(
          STORAGE_KEY_PREFERENCES,
          JSON.stringify(DEFAULT_STATUS_BAR_PREFERENCES)
        );
      }
    } catch (error) {
      console.warn('Error resetting status bar preferences:', error);
    }
  }, [isClient]);

  /**
   * Set active service with localStorage persistence
   */
  const setActiveService = useCallback(
    (serviceName: string | null) => {
      try {
        setActiveServiceState(serviceName);

        if (isClient) {
          if (serviceName !== null) {
            window.localStorage.setItem(STORAGE_KEY_ACTIVE_SERVICE, serviceName);
          } else {
            window.localStorage.removeItem(STORAGE_KEY_ACTIVE_SERVICE);
          }
        }
      } catch (error) {
        console.warn('Error setting active service:', error);
      }
    },
    [isClient]
  );

  /**
   * Set active category (session-only, not persisted)
   */
  const setActiveCategory = useCallback((category: ServiceCategory | null) => {
    setActiveCategoryState(category);
  }, []);

  /**
   * Listen for localStorage changes from other tabs
   */
  useEffect(() => {
    if (!isClient) {
      return;
    }

    const handleStorageChange = (e: StorageEvent) => {
      try {
        if (e.key === STORAGE_KEY_COLLAPSED && e.newValue !== null) {
          setIsCollapsedState(JSON.parse(e.newValue));
        } else if (e.key === STORAGE_KEY_PREFERENCES && e.newValue !== null) {
          setPreferencesState({ ...DEFAULT_STATUS_BAR_PREFERENCES, ...JSON.parse(e.newValue) });
        } else if (e.key === STORAGE_KEY_ACTIVE_SERVICE) {
          setActiveServiceState(e.newValue);
        }
      } catch (error) {
        console.warn('Error handling storage change event:', error);
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [isClient]);

  /**
   * Sync preferences.collapsed with isCollapsed state
   */
  useEffect(() => {
    if (preferences.collapsed !== isCollapsed) {
      updatePreferences({ collapsed: isCollapsed });
    }
  }, [isCollapsed]); // Intentionally exclude updatePreferences and preferences to avoid loops

  return {
    isCollapsed,
    setIsCollapsed,
    toggleCollapsed,
    preferences,
    updatePreferences,
    resetPreferences,
    activeService,
    setActiveService,
    activeCategory,
    setActiveCategory,
  };
}

/**
 * Hook for keyboard shortcuts specific to status bar
 *
 * @param onToggle - Callback when toggle shortcut is pressed
 * @returns Cleanup function
 *
 * @example
 * ```tsx
 * function StatusBar() {
 *   const { toggleCollapsed } = useStatusBarState();
 *   useStatusBarKeyboardShortcuts(toggleCollapsed);
 *
 *   return <div>Status Bar</div>;
 * }
 * ```
 */
export function useStatusBarKeyboardShortcuts(onToggle: () => void): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcuts when typing in inputs / textareas / contenteditable
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      const mod = e.metaKey || e.ctrlKey;

      // Cmd/Ctrl + Shift + B — toggle status bar
      if (mod && e.shiftKey && e.key === 'B') {
        e.preventDefault();
        onToggle();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onToggle]);
}
