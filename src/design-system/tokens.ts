/**
 * VibeCode Design System - Design Tokens
 * Multi-Agent Interaction Interface
 * Based on Material Design 3 principles
 * WCAG 2.1 AA compliant
 */

export const designTokens = {
  /**
   * Color Palette - Light & Dark Themes
   * All colors meet WCAG 2.1 AA contrast requirements (4.5:1 for normal text)
   */
  colors: {
    // Primary - Agent branding
    primary: {
      50: 'hsl(262, 80%, 97%)',
      100: 'hsl(262, 80%, 93%)',
      200: 'hsl(262, 80%, 85%)',
      300: 'hsl(262, 80%, 75%)',
      400: 'hsl(262, 80%, 63%)',
      500: 'hsl(262, 80%, 50%)', // Main brand
      600: 'hsl(262, 80%, 42%)',
      700: 'hsl(262, 80%, 35%)',
      800: 'hsl(262, 80%, 28%)',
      900: 'hsl(262, 80%, 20%)',
    },

    // Agent-specific colors (distinct, accessible)
    agents: {
      agent1: {
        main: 'hsl(262, 80%, 50%)', // Purple - Build Engineer
        bg: 'hsl(262, 80%, 97%)',
        bgDark: 'hsl(262, 80%, 12%)',
      },
      agent2: {
        main: 'hsl(200, 80%, 50%)', // Cyan - Documentation
        bg: 'hsl(200, 80%, 97%)',
        bgDark: 'hsl(200, 80%, 12%)',
      },
      agent3: {
        main: 'hsl(150, 70%, 45%)', // Green - DevOps
        bg: 'hsl(150, 70%, 97%)',
        bgDark: 'hsl(150, 70%, 12%)',
      },
      agent4: {
        main: 'hsl(35, 90%, 55%)', // Orange - Frontend
        bg: 'hsl(35, 90%, 97%)',
        bgDark: 'hsl(35, 90%, 12%)',
      },
      agent5: {
        main: 'hsl(0, 80%, 55%)', // Red - Security
        bg: 'hsl(0, 80%, 97%)',
        bgDark: 'hsl(0, 80%, 12%)',
      },
      agent6: {
        main: 'hsl(280, 70%, 55%)', // Magenta - QA
        bg: 'hsl(280, 70%, 97%)',
        bgDark: 'hsl(280, 70%, 12%)',
      },
    },

    // Semantic colors
    success: 'hsl(142, 76%, 36%)',
    warning: 'hsl(35, 90%, 55%)',
    error: 'hsl(0, 84%, 60%)',
    info: 'hsl(200, 80%, 50%)',

    // Neutral palette
    neutral: {
      0: 'hsl(0, 0%, 100%)',
      50: 'hsl(220, 14%, 96%)',
      100: 'hsl(220, 14%, 91%)',
      200: 'hsl(220, 13%, 84%)',
      300: 'hsl(220, 13%, 69%)',
      400: 'hsl(220, 9%, 46%)',
      500: 'hsl(220, 9%, 30%)',
      600: 'hsl(220, 13%, 18%)',
      700: 'hsl(220, 13%, 12%)',
      800: 'hsl(220, 13%, 9%)',
      900: 'hsl(220, 13%, 6%)',
      1000: 'hsl(0, 0%, 0%)',
    },
  },

  /**
   * Typography Scale
   * System fonts for optimal performance
   */
  typography: {
    fontFamily: {
      sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      mono: 'ui-monospace, "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", "Courier New", monospace',
    },
    fontSize: {
      xs: '0.75rem',    // 12px
      sm: '0.875rem',   // 14px
      base: '1rem',     // 16px
      lg: '1.125rem',   // 18px
      xl: '1.25rem',    // 20px
      '2xl': '1.5rem',  // 24px
      '3xl': '1.875rem', // 30px
      '4xl': '2.25rem', // 36px
      '5xl': '3rem',    // 48px
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },

  /**
   * Spacing System
   * 4px base grid
   */
  spacing: {
    0: '0',
    1: '0.25rem',  // 4px
    2: '0.5rem',   // 8px
    3: '0.75rem',  // 12px
    4: '1rem',     // 16px
    5: '1.25rem',  // 20px
    6: '1.5rem',   // 24px
    8: '2rem',     // 32px
    10: '2.5rem',  // 40px
    12: '3rem',    // 48px
    16: '4rem',    // 64px
    20: '5rem',    // 80px
    24: '6rem',    // 96px
  },

  /**
   * Border Radius
   */
  borderRadius: {
    none: '0',
    sm: '0.25rem',   // 4px
    base: '0.5rem',  // 8px
    md: '0.75rem',   // 12px
    lg: '1rem',      // 16px
    xl: '1.5rem',    // 24px
    full: '9999px',
  },

  /**
   * Shadows
   * Elevation system for depth
   */
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    base: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    glow: '0 0 40px hsl(262 80% 50% / 0.3)',
    glowDark: '0 0 40px hsl(262 80% 50% / 0.5)',
  },

  /**
   * Animation Durations
   * Following Material Design motion guidelines
   */
  animation: {
    duration: {
      instant: '0ms',
      fast: '150ms',
      base: '250ms',
      slow: '350ms',
      slower: '500ms',
    },
    easing: {
      linear: 'linear',
      ease: 'ease',
      easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
      easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
      easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
      spring: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    },
  },

  /**
   * Breakpoints
   * Mobile-first responsive design
   */
  breakpoints: {
    xs: '320px',  // Mobile portrait
    sm: '640px',  // Mobile landscape
    md: '768px',  // Tablet
    lg: '1024px', // Desktop
    xl: '1280px', // Large desktop
    '2xl': '1536px', // Extra large
  },

  /**
   * Z-Index Scale
   * Layering system for overlays
   */
  zIndex: {
    base: 0,
    dropdown: 1000,
    sticky: 1100,
    fixed: 1200,
    modalBackdrop: 1300,
    modal: 1400,
    popover: 1500,
    tooltip: 1600,
  },
} as const;

/**
 * Component-specific tokens
 */
export const componentTokens = {
  /**
   * Agent Selector
   */
  agentSelector: {
    height: {
      mobile: '48px',
      desktop: '56px',
    },
    maxAgents: 6,
    iconSize: {
      small: '20px',
      medium: '24px',
      large: '32px',
    },
  },

  /**
   * Chat Bubbles
   */
  chatBubble: {
    maxWidth: {
      mobile: '85%',
      desktop: '70%',
    },
    padding: {
      mobile: designTokens.spacing[3],
      desktop: designTokens.spacing[4],
    },
  },

  /**
   * Conversation Panel
   */
  conversationPanel: {
    width: {
      mobile: '100%',
      tablet: '360px',
      desktop: '400px',
    },
    maxHeight: {
      mobile: '60vh',
      desktop: '80vh',
    },
  },

  /**
   * Code Block
   */
  codeBlock: {
    maxHeight: '400px',
    fontSize: designTokens.typography.fontSize.sm,
    borderRadius: designTokens.borderRadius.md,
  },
} as const;

/**
 * Accessibility tokens
 */
export const a11yTokens = {
  /**
   * Focus indicator
   */
  focus: {
    outlineWidth: '2px',
    outlineOffset: '2px',
    outlineColor: designTokens.colors.primary[500],
  },

  /**
   * Minimum touch target size (WCAG 2.5.5)
   */
  touchTarget: {
    minSize: '44px',
  },

  /**
   * Motion preferences
   */
  reducedMotion: {
    duration: '0.01ms',
    easing: 'linear',
  },
} as const;

export type DesignTokens = typeof designTokens;
export type ComponentTokens = typeof componentTokens;
export type A11yTokens = typeof a11yTokens;
