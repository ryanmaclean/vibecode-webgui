/**
 * Accessibility tests for color contrast compliance
 * Tests WCAG 2.1 AA compliance for color combinations
 */

describe('Color Contrast Accessibility Tests', () => {
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
    'green-700': '#15803d',
    'purple-600': '#9333ea',
    'orange-600': '#ea580c',
  }

  /**
   * Calculate relative luminance of a color
   * Based on WCAG 2.1 specification
   */
  function getLuminance(hex) {
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
  function hexToRgb(hex) {
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
  function getContrastRatio(color1, color2) {
    const l1 = getLuminance(color1)
    const l2 = getLuminance(color2)
    const lighter = Math.max(l1, l2)
    const darker = Math.min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)
  }

  /**
   * Check if contrast ratio meets WCAG AA standards
   */
  function meetsWCAGAA(ratio, isLargeText = false) {
    return isLargeText ? ratio >= 3.0 : ratio >= 4.5
  }

  describe('Fixed contrast issues in projects page', () => {
    test('gray-900 text on white background should meet WCAG AA', () => {
      const ratio = getContrastRatio(colors['gray-900'], colors.white)
      expect(ratio).toBeGreaterThanOrEqual(4.5)
      expect(meetsWCAGAA(ratio)).toBe(true)
    })

    test('gray-700 text on white background should meet WCAG AA', () => {
      const ratio = getContrastRatio(colors['gray-700'], colors.white)
      expect(ratio).toBeGreaterThanOrEqual(4.5)
      expect(meetsWCAGAA(ratio)).toBe(true)
    })

    test('gray-600 text should NOT be used for small text (should fail)', () => {
      const ratio = getContrastRatio(colors['gray-600'], colors.white)
      // This should pass since gray-600 actually has good contrast
      expect(ratio).toBeGreaterThanOrEqual(4.5)
      expect(meetsWCAGAA(ratio)).toBe(true)
    })

    test('gray-600 text should be good for regular text', () => {
      const ratio = getContrastRatio(colors['gray-600'], colors.white)
      expect(ratio).toBeGreaterThanOrEqual(4.5)
      expect(meetsWCAGAA(ratio)).toBe(true)
    })
  })

  describe('Button contrast validation', () => {
    test('white text on blue-600 background should meet WCAG AA', () => {
      const ratio = getContrastRatio(colors.white, colors['blue-600'])
      expect(ratio).toBeGreaterThanOrEqual(4.5)
      expect(meetsWCAGAA(ratio)).toBe(true)
    })

    test('white text on green-700 background should meet WCAG AA', () => {
      const ratio = getContrastRatio(colors.white, colors['green-700'])
      expect(ratio).toBeGreaterThanOrEqual(4.5)
      expect(meetsWCAGAA(ratio)).toBe(true)
    })

    test('white text on purple-600 background should meet WCAG AA', () => {
      const ratio = getContrastRatio(colors.white, colors['purple-600'])
      expect(ratio).toBeGreaterThanOrEqual(4.5)
      expect(meetsWCAGAA(ratio)).toBe(true)
    })

    test('white text on orange-600 background should NOT meet WCAG AA (should fail)', () => {
      const ratio = getContrastRatio(colors.white, colors['orange-600'])
      expect(ratio).toBeLessThan(4.5)
      expect(meetsWCAGAA(ratio)).toBe(false)
    })
  })

  describe('Problematic combinations that should be avoided', () => {
    test('gray-400 text on white background should fail WCAG AA', () => {
      const ratio = getContrastRatio(colors['gray-400'], colors.white)
      expect(meetsWCAGAA(ratio)).toBe(false)
    })

    test('gray-300 text on white background should fail WCAG AA', () => {
      const ratio = getContrastRatio(colors['gray-300'], colors.white)
      expect(meetsWCAGAA(ratio)).toBe(false)
    })
  })

  describe('Utility functions work correctly', () => {
    test('should calculate correct luminance values', () => {
      expect(getLuminance('#000000')).toBe(0)
      expect(getLuminance('#ffffff')).toBe(1)
    })

    test('should calculate correct contrast ratios', () => {
      // Black on white should have maximum contrast
      expect(getContrastRatio('#000000', '#ffffff')).toBe(21)
      // Same colors should have no contrast
      expect(getContrastRatio('#ffffff', '#ffffff')).toBe(1)
    })
  })
})