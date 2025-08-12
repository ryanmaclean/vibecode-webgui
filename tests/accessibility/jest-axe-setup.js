/**
 * Jest setup for axe-core accessibility testing
 * Configures jest-axe for WCAG 2.1 AA compliance testing
 */

import { configureAxe, toHaveNoViolations } from 'jest-axe'

// Extend Jest matchers with axe accessibility matchers
expect.extend(toHaveNoViolations)

// Configure axe-core for WCAG 2.1 AA testing
global.axe = configureAxe({
  // WCAG 2.1 AA rules configuration
  rules: {
    // Level A rules (required for AA compliance)
    'area-alt': { enabled: true },
    'aria-allowed-attr': { enabled: true },
    'aria-required-attr': { enabled: true },
    'aria-required-children': { enabled: true },
    'aria-required-parent': { enabled: true },
    'aria-roles': { enabled: true },
    'aria-valid-attr': { enabled: true },
    'aria-valid-attr-value': { enabled: true },
    'button-name': { enabled: true },
    'bypass': { enabled: true },
    'color-contrast': { enabled: true },
    'document-title': { enabled: true },
    'duplicate-id': { enabled: true },
    'form-field-multiple-labels': { enabled: true },
    'frame-title': { enabled: true },
    'html-has-lang': { enabled: true },
    'html-lang-valid': { enabled: true },
    'image-alt': { enabled: true },
    'input-image-alt': { enabled: true },
    'label': { enabled: true },
    'link-name': { enabled: true },
    'list': { enabled: true },
    'listitem': { enabled: true },
    'object-alt': { enabled: true },
    'role-img-alt': { enabled: true },
    'scope': { enabled: true },
    'valid-lang': { enabled: true },
    
    // Level AA rules
    'autocomplete-valid': { enabled: true },
    'color-contrast-enhanced': { enabled: false }, // AAA rule, not required
    'focus-order-semantics': { enabled: true },
    'heading-order': { enabled: true },
    'landmark-banner-is-top-level': { enabled: true },
    'landmark-complementary-is-top-level': { enabled: true },
    'landmark-contentinfo-is-top-level': { enabled: true },
    'landmark-main-is-top-level': { enabled: true },
    'landmark-no-duplicate-banner': { enabled: true },
    'landmark-no-duplicate-contentinfo': { enabled: true },
    'landmark-no-duplicate-main': { enabled: true },
    'landmark-one-main': { enabled: true },
    'landmark-unique': { enabled: true },
    'page-has-heading-one': { enabled: true },
    'region': { enabled: true },
    'timing-adjustable': { enabled: true }
  },
  
  // Tags to include in testing
  tags: ['wcag2a', 'wcag2aa', 'wcag21aa'],
  
  // Accessibility standards to test against
  standards: {
    wcag2a: true,
    wcag2aa: true,
    wcag21aa: true,
    wcag21aaa: false // Not required for AA compliance
  },
  
  // Performance settings
  performanceTimer: true,
  
  // Include experimental rules
  experimental: false,
  
  // Reporter configuration
  reporter: 'v2'
})

// Custom matchers for accessibility testing
expect.extend({
  /**
   * Custom matcher to check WCAG 2.1 AA compliance
   */
  async toPassWCAGAA(received) {
    const results = await global.axe(received)
    const pass = results.violations.length === 0
    
    if (pass) {
      return {
        message: () => `Expected element to fail WCAG 2.1 AA compliance, but it passed`,
        pass: true
      }
    } else {
      const violationMessages = results.violations
        .map(violation => `  - ${violation.id}: ${violation.description}`)
        .join('\\n')
      
      return {
        message: () => 
          `Expected element to pass WCAG 2.1 AA compliance, but found violations:\\n${violationMessages}`,
        pass: false
      }
    }
  },
  
  /**
   * Custom matcher to check for specific accessibility violation
   */
  async toHaveAccessibilityViolation(received, violationId) {
    const results = await global.axe(received)
    const hasViolation = results.violations.some(v => v.id === violationId)
    
    if (hasViolation) {
      return {
        message: () => `Expected element not to have violation "${violationId}", but it was found`,
        pass: true
      }
    } else {
      return {
        message: () => `Expected element to have violation "${violationId}", but it was not found`,
        pass: false
      }
    }
  },
  
  /**
   * Custom matcher to check color contrast
   */
  toMeetColorContrastRatio(foreground, background, expectedRatio = 4.5) {
    // Simple color contrast calculation (for basic testing)
    // In production, use a proper color contrast library
    const ratio = calculateContrastRatio(foreground, background)
    const pass = ratio >= expectedRatio
    
    if (pass) {
      return {
        message: () => 
          `Expected contrast ratio ${ratio.toFixed(2)} to be less than ${expectedRatio}`,
        pass: true
      }
    } else {
      return {
        message: () => 
          `Expected contrast ratio ${ratio.toFixed(2)} to be at least ${expectedRatio} for WCAG AA compliance`,
        pass: false
      }
    }
  }
})

/**
 * Helper function to calculate color contrast ratio
 */
function calculateContrastRatio(color1, color2) {
  const l1 = getLuminance(color1)
  const l2 = getLuminance(color2)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Helper function to get luminance of a color
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
 * Helper function to convert hex to RGB
 */
function hexToRgb(hex) {
  const result = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(hex)
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null
}

// Global test utilities for accessibility testing
global.a11yTestUtils = {
  /**
   * Create a test container with proper document structure
   */
  createTestContainer(innerHTML = '') {
    const container = document.createElement('div')
    container.innerHTML = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <title>Accessibility Test</title>
        </head>
        <body>
          <main role="main">
            ${innerHTML}
          </main>
        </body>
      </html>
    `
    document.body.appendChild(container)
    return container
  },
  
  /**
   * Clean up test containers
   */
  cleanupTestContainer(container) {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container)
    }
  },
  
  /**
   * Wait for element to be accessible (have proper ARIA attributes)
   */
  async waitForAccessibleElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now()
      
      const check = () => {
        const element = document.querySelector(selector)
        if (element) {
          const hasAriaLabel = element.getAttribute('aria-label')
          const hasAriaLabelledBy = element.getAttribute('aria-labelledby')
          const hasRole = element.getAttribute('role')
          
          if (hasAriaLabel || hasAriaLabelledBy || hasRole) {
            resolve(element)
            return
          }
        }
        
        if (Date.now() - startTime > timeout) {
          reject(new Error(`Element ${selector} did not become accessible within ${timeout}ms`))
          return
        }
        
        setTimeout(check, 100)
      }
      
      check()
    })
  },
  
  /**
   * Simulate keyboard navigation
   */
  simulateKeyboardNavigation(startElement, keys = ['Tab']) {
    const events = []
    let currentElement = startElement
    
    keys.forEach(key => {
      const event = new KeyboardEvent('keydown', { key, bubbles: true })
      currentElement.dispatchEvent(event)
      
      // Find next focusable element
      const focusableElements = document.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      const currentIndex = Array.from(focusableElements).indexOf(currentElement)
      
      if (key === 'Tab' && currentIndex < focusableElements.length - 1) {
        currentElement = focusableElements[currentIndex + 1]
        currentElement.focus()
      }
      
      events.push({ key, element: currentElement })
    })
    
    return events
  }
}

// Console logging for accessibility test results
const originalConsoleLog = console.log
console.log = (...args) => {
  if (args[0] && typeof args[0] === 'string' && args[0].includes('axe')) {
    // Format axe results for better readability
    originalConsoleLog('🔍 Accessibility Test Results:', ...args.slice(1))
  } else {
    originalConsoleLog(...args)
  }
}