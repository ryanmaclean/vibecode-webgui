/**
 * Accessibility tests for color contrast compliance
 * Tests WCAG 2.1 AA compliance for color combinations
 */

import { describe, it, expect } from '@jest/globals'

// Color values from Tailwind CSS
const colors = {
  'gray-50': '#f9fafb',
  'gray-100': '#f3f4f6',
  'gray-200': '#e5e7eb',
  'gray-300': '#d1d5db',
  'gray-400': '#9ca3af',
  'gray-500': '#6b7280',
  'gray-600': '#4b5563',
  'gray-700': '#374151',
  'gray-800': '#1f2937',
  'gray-900': '#111827',
  'white': '#ffffff',
  'blue-600': '#2563eb',
  'green-600': '#16a34a',
  'purple-600': '#9333ea',
  'orange-600': '#ea580c',
}

/**
 * Calculate relative luminance of a color
 * Based on WCAG 2.1 specification
 */
function getLuminance(hex: string): number {
  const rgb = hexToRgb(hex)
  if (!rgb) return 0

  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(c => {
    c = c / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })

  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null
}

/**
 * Calculate contrast ratio between two colors
 */
function getContrastRatio(color1: string, color2: string): number {
  const l1 = getLuminance(color1)
  const l2 = getLuminance(color2)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Check if contrast ratio meets WCAG AA standards
 */
function meetsWCAGAA(ratio: number, isLargeText: boolean = false): boolean {
  return isLargeText ? ratio >= 3.0 : ratio >= 4.5
}

/**
 * Check if contrast ratio meets WCAG AAA standards
 */
function meetsWCAGAAA(ratio: number, isLargeText: boolean = false): boolean {
  return isLargeText ? ratio >= 4.5 : ratio >= 7.0
}

describe('Color Contrast Accessibility Tests', () => {
  describe('Main text combinations', () => {
    it('should have sufficient contrast for gray-900 text on white background', () => {
      const ratio = getContrastRatio(colors['gray-900'], colors.white)
      expect(ratio).toBeGreaterThanOrEqual(4.5)
      expect(meetsWCAGAA(ratio)).toBe(true)
    })

    it('should have sufficient contrast for gray-700 text on white background', () => {
      const ratio = getContrastRatio(colors['gray-700'], colors.white)
      expect(ratio).toBeGreaterThanOrEqual(4.5)
      expect(meetsWCAGAA(ratio)).toBe(true)
    })

    it('should have sufficient contrast for gray-600 text on white background', () => {
      const ratio = getContrastRatio(colors['gray-600'], colors.white)
      expect(ratio).toBeGreaterThanOrEqual(4.5)
      expect(meetsWCAGAA(ratio)).toBe(true)
    })
  })

  describe('Button and accent color combinations', () => {
    it('should have sufficient contrast for white text on blue-600 background', () => {
      const ratio = getContrastRatio(colors.white, colors['blue-600'])
      expect(ratio).toBeGreaterThanOrEqual(4.5)
      expect(meetsWCAGAA(ratio)).toBe(true)
    })

    it('should have sufficient contrast for white text on green-600 background', () => {
      const ratio = getContrastRatio(colors.white, colors['green-600'])
      expect(ratio).toBeGreaterThanOrEqual(4.5)
      expect(meetsWCAGAA(ratio)).toBe(true)
    })

    it('should have sufficient contrast for white text on purple-600 background', () => {
      const ratio = getContrastRatio(colors.white, colors['purple-600'])
      expect(ratio).toBeGreaterThanOrEqual(4.5)
      expect(meetsWCAGAA(ratio)).toBe(true)
    })

    it('should have sufficient contrast for white text on orange-600 background', () => {
      const ratio = getContrastRatio(colors.white, colors['orange-600'])
      expect(ratio).toBeGreaterThanOrEqual(4.5)
      expect(meetsWCAGAA(ratio)).toBe(true)
    })
  })

  describe('Background combinations', () => {
    it('should have sufficient contrast for gray-900 text on gray-50 background', () => {
      const ratio = getContrastRatio(colors['gray-900'], colors['gray-50'])
      expect(ratio).toBeGreaterThanOrEqual(4.5)
      expect(meetsWCAGAA(ratio)).toBe(true)
    })

    it('should have sufficient contrast for gray-700 text on gray-50 background', () => {
      const ratio = getContrastRatio(colors['gray-700'], colors['gray-50'])
      expect(ratio).toBeGreaterThanOrEqual(4.5)
      expect(meetsWCAGAA(ratio)).toBe(true)
    })
  })

  describe('Problematic combinations that should fail', () => {
    it('should fail WCAG AA for gray-400 text on white background', () => {
      const ratio = getContrastRatio(colors['gray-400'], colors.white)
      expect(meetsWCAGAA(ratio)).toBe(false)
    })

    it('should fail WCAG AA for gray-300 text on white background', () => {
      const ratio = getContrastRatio(colors['gray-300'], colors.white)
      expect(meetsWCAGAA(ratio)).toBe(false)
    })
  })

  describe('Large text combinations (18pt+ or 14pt+ bold)', () => {
    it('should meet WCAG AA for large text with lower contrast requirements', () => {
      const ratio = getContrastRatio(colors['gray-600'], colors.white)
      expect(meetsWCAGAA(ratio, true)).toBe(true) // Large text threshold is 3.0
    })
  })

  describe('Accessibility helper functions', () => {
    it('should calculate correct luminance values', () => {
      expect(getLuminance('#000000')).toBe(0)
      expect(getLuminance('#ffffff')).toBe(1)
    })

    it('should calculate correct contrast ratios', () => {
      // Black on white should have maximum contrast
      expect(getContrastRatio('#000000', '#ffffff')).toBe(21)
      // Same colors should have no contrast
      expect(getContrastRatio('#ffffff', '#ffffff')).toBe(1)
    })
  })
})

describe('Component-specific accessibility tests', () => {
  describe('Projects page color combinations', () => {
    it('should have proper contrast for main heading on white background', () => {
      const ratio = getContrastRatio(colors['gray-900'], colors.white)
      expect(ratio).toBeGreaterThanOrEqual(7.0) // AAA level for important headings
    })

    it('should have proper contrast for description text on white background', () => {
      const ratio = getContrastRatio(colors['gray-700'], colors.white)
      expect(ratio).toBeGreaterThanOrEqual(4.5)
    })

    it('should have proper contrast for card stats text on white background', () => {
      const ratio = getContrastRatio(colors['gray-700'], colors.white)
      expect(ratio).toBeGreaterThanOrEqual(4.5)
    })
  })
})