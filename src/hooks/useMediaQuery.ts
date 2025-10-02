/**
 * useMediaQuery Hook
 * React hook for responsive design with SSR support
 * Returns true if the media query matches
 */

import { useState, useEffect } from 'react';

/**
 * Check if media query matches current viewport
 * @param query - CSS media query string (e.g., "(min-width: 768px)")
 * @returns boolean indicating if query matches
 *
 * @example
 * ```tsx
 * const isMobile = useMediaQuery('(max-width: 767px)');
 * const isDesktop = useMediaQuery('(min-width: 1024px)');
 * const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
 * ```
 */
export function useMediaQuery(query: string): boolean {
  // Initialize with false to avoid hydration mismatch
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    // Check if window is defined (client-side)
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia(query);

    // Set initial value
    setMatches(mediaQuery.matches);

    // Define listener for changes
    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      // Legacy browsers (Safari < 14, iOS < 14)
      mediaQuery.addListener(handleChange);
    }

    // Cleanup
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, [query]);

  return matches;
}

/**
 * Hook for checking if user prefers reduced motion
 * Useful for accessibility (respecting prefers-reduced-motion)
 *
 * @example
 * ```tsx
 * const prefersReducedMotion = useReducedMotion();
 *
 * <motion.div
 *   animate={{ y: prefersReducedMotion ? 0 : 20 }}
 *   transition={{ duration: prefersReducedMotion ? 0.01 : 0.3 }}
 * />
 * ```
 */
export function useReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

/**
 * Hook for checking if user prefers dark color scheme
 * Can be used in conjunction with theme store
 *
 * @example
 * ```tsx
 * const prefersDark = usePrefersDarkMode();
 *
 * useEffect(() => {
 *   if (prefersDark) {
 *     document.documentElement.classList.add('dark');
 *   }
 * }, [prefersDark]);
 * ```
 */
export function usePrefersDarkMode(): boolean {
  return useMediaQuery('(prefers-color-scheme: dark)');
}

/**
 * Hook for common breakpoints
 * Returns object with boolean flags for each breakpoint
 *
 * @example
 * ```tsx
 * const { isMobile, isTablet, isDesktop } = useBreakpoints();
 *
 * return (
 *   <>
 *     {isMobile && <MobileLayout />}
 *     {isTablet && <TabletLayout />}
 *     {isDesktop && <DesktopLayout />}
 *   </>
 * );
 * ```
 */
export function useBreakpoints() {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const isLargeDesktop = useMediaQuery('(min-width: 1280px)');
  const isExtraLarge = useMediaQuery('(min-width: 1536px)');

  return {
    isMobile,
    isTablet,
    isDesktop,
    isLargeDesktop,
    isExtraLarge,
    // Convenience flags
    isTouchDevice: isMobile || isTablet,
    isWideScreen: isLargeDesktop || isExtraLarge,
  };
}

/**
 * Hook for detecting device orientation
 * Useful for responsive layouts that adapt to portrait/landscape
 *
 * @example
 * ```tsx
 * const { isPortrait, isLandscape } = useOrientation();
 *
 * return (
 *   <div className={isPortrait ? 'layout-portrait' : 'layout-landscape'}>
 *     Content
 *   </div>
 * );
 * ```
 */
export function useOrientation() {
  const isPortrait = useMediaQuery('(orientation: portrait)');
  const isLandscape = useMediaQuery('(orientation: landscape)');

  return {
    isPortrait,
    isLandscape,
  };
}
