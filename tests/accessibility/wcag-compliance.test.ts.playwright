/**
 * Comprehensive WCAG 2.1 AA Accessibility Compliance Tests
 * 
 * This test suite validates accessibility compliance across all major components
 * and user flows in the VibeCode platform according to WCAG 2.1 AA standards.
 * 
 * Test Categories:
 * - Perceivable: Color contrast, text alternatives, captions
 * - Operable: Keyboard navigation, timing, seizures  
 * - Understandable: Readable text, predictable functionality
 * - Robust: Compatible with assistive technologies
 */

import { test, expect } from '@playwright/test'
import { injectAxe, checkA11y } from 'axe-playwright'

const PAGES_TO_TEST = [
  '/',
  '/projects',
  '/chat/huggingface',
  '/chat/collaborative', 
  '/monitoring/dashboard',
  '/workspace/new'
]

const WCAG_AA_RULES = [
  // Level A Rules
  'area-alt',
  'aria-allowed-attr', 
  'aria-required-attr',
  'audio-caption',
  'button-name',
  'bypass',
  'color-contrast-enhanced',
  'document-title',
  'duplicate-id',
  'form-field-multiple-labels',
  'frame-title',
  'html-has-lang',
  'html-lang-valid',
  'image-alt',
  'input-image-alt',
  'label',
  'link-name',
  'list',
  'listitem',
  'marquee',
  'meta-refresh',
  'object-alt',
  'role-img-alt',
  'scope',
  'server-side-image-map',
  'valid-lang',
  'video-caption',
  
  // Level AA Rules  
  'autocomplete-valid',
  'avoid-inline-spacing',
  'color-contrast',
  'focus-order-semantics',
  'frame-tested',
  'heading-order',
  'hidden-content',
  'label-title-only',
  'landmark-banner-is-top-level',
  'landmark-complementary-is-top-level',
  'landmark-contentinfo-is-top-level',
  'landmark-main-is-top-level',
  'landmark-no-duplicate-banner',
  'landmark-no-duplicate-contentinfo',
  'landmark-no-duplicate-main',
  'landmark-one-main',
  'landmark-unique',
  'link-in-text-block',
  'no-autoplay-audio',
  'page-has-heading-one',
  'region',
  'scroll-element-content',
  'server-side-image-map'
]

test.describe('WCAG 2.1 AA Accessibility Compliance', () => {
  test.beforeEach(async ({ page }) => {
    // Inject axe-core for accessibility testing
    await injectAxe(page)
  })

  PAGES_TO_TEST.forEach(pagePath => {
    test(`${pagePath} should meet WCAG 2.1 AA standards`, async ({ page }) => {
      await page.goto(`http://localhost:3000${pagePath}`)
      
      // Wait for page to fully load
      await page.waitForLoadState('networkidle')
      
      // Check accessibility with WCAG AA rules
      await checkA11y(page, null, {
        rules: WCAG_AA_RULES.reduce((acc, rule) => {
          acc[rule] = { enabled: true }
          return acc
        }, {} as Record<string, { enabled: boolean }>),
        tags: ['wcag2a', 'wcag2aa', 'wcag21aa']
      })
    })
  })

  test.describe('Keyboard Navigation', () => {
    test('should navigate main interface with keyboard only', async ({ page }) => {
      await page.goto('http://localhost:3000')
      
      // Test tab navigation through main elements
      await page.keyboard.press('Tab')
      const firstFocusable = await page.locator(':focus')
      expect(await firstFocusable.count()).toBe(1)
      
      // Continue tabbing through focusable elements
      const focusableElements = []
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('Tab')
        const focused = await page.locator(':focus')
        if (await focused.count() > 0) {
          const tagName = await focused.getAttribute('tagName')
          focusableElements.push(tagName)
        }
      }
      
      // Should have navigated through multiple focusable elements
      expect(focusableElements.length).toBeGreaterThan(3)
    })

    test('should support keyboard navigation in chat interface', async ({ page }) => {
      await page.goto('http://localhost:3000/chat/huggingface')
      
      // Focus on textarea and verify
      await page.keyboard.press('Tab')
      await page.keyboard.press('Tab')
      const textarea = page.locator('textarea')
      await expect(textarea).toBeFocused()
      
      // Test Enter key functionality
      await page.keyboard.type('Test message')
      await page.keyboard.press('Enter')
      
      // Verify message was sent (wait for it to appear)
      await expect(page.locator('text=Test message')).toBeVisible()
    })

    test('should navigate project generator with keyboard', async ({ page }) => {
      await page.goto('http://localhost:3000/projects')
      
      // Navigate to project generator button
      await page.keyboard.press('Tab')
      await page.keyboard.press('Tab')
      await page.keyboard.press('Enter')
      
      // Should open project generator interface
      await expect(page.locator('[data-testid="ai-project-generator"]')).toBeVisible()
    })
  })

  test.describe('Screen Reader Support', () => {
    test('should have proper ARIA labels and roles', async ({ page }) => {
      await page.goto('http://localhost:3000')
      
      // Check for main navigation landmarks
      await expect(page.locator('[role="main"]')).toBeVisible()
      await expect(page.locator('[role="navigation"]')).toBeVisible()
      
      // Check for proper button labels
      const buttons = page.locator('button')
      const buttonCount = await buttons.count()
      
      for (let i = 0; i < buttonCount; i++) {
        const button = buttons.nth(i)
        const hasAriaLabel = await button.getAttribute('aria-label')
        const hasText = await button.textContent()
        const hasAriaLabelledBy = await button.getAttribute('aria-labelledby')
        
        // Each button should have some form of accessible label
        expect(hasAriaLabel || hasText || hasAriaLabelledBy).toBeTruthy()
      }
    })

    test('should have proper heading hierarchy', async ({ page }) => {
      await page.goto('http://localhost:3000')
      
      // Check for h1 element
      const h1Elements = page.locator('h1')
      await expect(h1Elements).toHaveCount(1)
      
      // Check heading order (h1, h2, h3, etc.)
      const headings = await page.locator('h1, h2, h3, h4, h5, h6').all()
      const headingLevels = []
      
      for (const heading of headings) {
        const tagName = await heading.evaluate(el => el.tagName.toLowerCase())
        const level = parseInt(tagName.charAt(1))
        headingLevels.push(level)
      }
      
      // First heading should be h1
      expect(headingLevels[0]).toBe(1)
      
      // Check for proper nesting (no skipping levels)
      for (let i = 1; i < headingLevels.length; i++) {
        const current = headingLevels[i]
        const previous = headingLevels[i - 1]
        const difference = current - previous
        
        // Should not skip more than one level
        expect(difference).toBeLessThanOrEqual(1)
      }
    })

    test('should have proper form labels', async ({ page }) => {
      await page.goto('http://localhost:3000/chat/huggingface')
      
      // Check all input elements have labels
      const inputs = page.locator('input, textarea, select')
      const inputCount = await inputs.count()
      
      for (let i = 0; i < inputCount; i++) {
        const input = inputs.nth(i)
        const id = await input.getAttribute('id')
        const ariaLabel = await input.getAttribute('aria-label')
        const ariaLabelledBy = await input.getAttribute('aria-labelledby')
        
        if (id) {
          const label = page.locator(`label[for="${id}"]`)
          const hasLabel = await label.count() > 0
          
          // Each input should have a label, aria-label, or aria-labelledby
          expect(hasLabel || ariaLabel || ariaLabelledBy).toBeTruthy()
        }
      }
    })
  })

  test.describe('Color and Visual Accessibility', () => {
    test('should not rely solely on color for information', async ({ page }) => {
      await page.goto('http://localhost:3000/monitoring/dashboard')
      
      // Check for status indicators that use more than just color
      const statusElements = page.locator('[data-testid*="status"], .status')
      const statusCount = await statusElements.count()
      
      for (let i = 0; i < statusCount; i++) {
        const element = statusElements.nth(i)
        const text = await element.textContent()
        const ariaLabel = await element.getAttribute('aria-label')
        
        // Status should have text or aria-label in addition to color
        expect(text || ariaLabel).toBeTruthy()
      }
    })

    test('should have sufficient color contrast for all text', async ({ page }) => {
      await page.goto('http://localhost:3000')
      
      // This is handled by axe-core color-contrast rule
      await checkA11y(page, null, {
        rules: {
          'color-contrast': { enabled: true }
        }
      })
    })

    test('should support high contrast mode', async ({ page }) => {
      // Simulate high contrast mode
      await page.emulateMedia({ colorScheme: 'dark' })
      await page.goto('http://localhost:3000')
      
      // Check that elements are still visible and accessible
      await expect(page.locator('h1')).toBeVisible()
      await expect(page.locator('button').first()).toBeVisible()
      
      // Run accessibility check in dark mode
      await checkA11y(page)
    })
  })

  test.describe('Motion and Animation', () => {
    test('should respect prefers-reduced-motion', async ({ page }) => {
      // Set prefers-reduced-motion preference
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto('http://localhost:3000')
      
      // Check that animations are reduced or disabled
      const animatedElements = page.locator('[class*="animate"], [class*="transition"]')
      const elementCount = await animatedElements.count()
      
      for (let i = 0; i < elementCount; i++) {
        const element = animatedElements.nth(i)
        const computedStyle = await element.evaluate(el => 
          window.getComputedStyle(el).animationDuration
        )
        
        // Animations should be significantly reduced or removed
        expect(computedStyle === '0s' || computedStyle === 'none').toBeTruthy()
      }
    })

    test('should not cause seizures with flashing content', async ({ page }) => {
      await page.goto('http://localhost:3000')
      
      // Check for any rapidly flashing content
      await checkA11y(page, null, {
        rules: {
          'blink': { enabled: true },
          'marquee': { enabled: true }
        }
      })
    })
  })

  test.describe('Focus Management', () => {
    test('should have visible focus indicators', async ({ page }) => {
      await page.goto('http://localhost:3000')
      
      // Tab through focusable elements and check focus visibility
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('Tab')
        const focused = page.locator(':focus')
        
        if (await focused.count() > 0) {
          // Check for focus ring or other visual indicator
          const outline = await focused.evaluate(el => 
            window.getComputedStyle(el).outline
          )
          const boxShadow = await focused.evaluate(el => 
            window.getComputedStyle(el).boxShadow
          )
          
          // Should have some form of visual focus indicator
          expect(outline !== 'none' || boxShadow !== 'none').toBeTruthy()
        }
      }
    })

    test('should manage focus properly in modal dialogs', async ({ page }) => {
      await page.goto('http://localhost:3000/projects')
      
      // Open a modal (if available)
      const modalTrigger = page.locator('[data-testid="open-modal"], button:has-text("Settings")')
      if (await modalTrigger.count() > 0) {
        await modalTrigger.click()
        
        // Focus should be trapped within modal
        const modal = page.locator('[role="dialog"], .modal')
        await expect(modal).toBeVisible()
        
        // First focusable element in modal should be focused
        const focusedElement = page.locator(':focus')
        const modalArea = await modal.boundingBox()
        const focusedArea = await focusedElement.boundingBox()
        
        if (modalArea && focusedArea) {
          // Focused element should be within modal bounds
          expect(focusedArea.x).toBeGreaterThanOrEqual(modalArea.x)
          expect(focusedArea.y).toBeGreaterThanOrEqual(modalArea.y)
        }
      }
    })
  })

  test.describe('Language and Content', () => {
    test('should have proper language declarations', async ({ page }) => {
      await page.goto('http://localhost:3000')
      
      // Check html lang attribute
      const htmlLang = await page.getAttribute('html', 'lang')
      expect(htmlLang).toBeTruthy()
      expect(htmlLang).toMatch(/^[a-z]{2}(-[A-Z]{2})?$/)
    })

    test('should have descriptive page titles', async ({ page }) => {
      for (const pagePath of PAGES_TO_TEST) {
        await page.goto(`http://localhost:3000${pagePath}`)
        const title = await page.title()
        
        // Title should be descriptive and not empty
        expect(title.length).toBeGreaterThan(5)
        expect(title.toLowerCase()).not.toBe('untitled')
      }
    })
  })

  test.describe('Error Handling and User Guidance', () => {
    test('should provide clear error messages', async ({ page }) => {
      await page.goto('http://localhost:3000/chat/huggingface')
      
      // Try to submit empty form or trigger an error
      const submitButton = page.locator('button[type="submit"], button:has-text("Send")')
      if (await submitButton.count() > 0) {
        await submitButton.click()
        
        // Look for error messages
        const errorMessages = page.locator('[role="alert"], .error, [aria-live="polite"]')
        if (await errorMessages.count() > 0) {
          const errorText = await errorMessages.first().textContent()
          expect(errorText).toBeTruthy()
          expect(errorText!.length).toBeGreaterThan(5)
        }
      }
    })

    test('should provide helpful form validation', async ({ page }) => {
      await page.goto('http://localhost:3000')
      
      // Check for form inputs with validation
      const requiredInputs = page.locator('input[required], textarea[required]')
      const inputCount = await requiredInputs.count()
      
      if (inputCount > 0) {
        const input = requiredInputs.first()
        await input.focus()
        await input.fill('')
        await page.keyboard.press('Tab')
        
        // Should show validation message
        const validationMessage = await input.evaluate(el => 
          (el as HTMLInputElement).validationMessage
        )
        expect(validationMessage).toBeTruthy()
      }
    })
  })

  test.describe('Mobile and Responsive Accessibility', () => {
    test('should be accessible on mobile devices', async ({ page, browser }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 })
      await page.goto('http://localhost:3000')
      
      // Check accessibility on mobile
      await checkA11y(page, null, {
        tags: ['wcag2a', 'wcag2aa', 'wcag21aa']
      })
      
      // Check touch targets are large enough (44x44 pixels minimum)
      const touchTargets = page.locator('button, a, input, [role="button"]')
      const targetCount = await touchTargets.count()
      
      for (let i = 0; i < Math.min(targetCount, 10); i++) {
        const target = touchTargets.nth(i)
        const box = await target.boundingBox()
        
        if (box) {
          // Touch targets should be at least 44x44 pixels
          expect(box.width).toBeGreaterThanOrEqual(44)
          expect(box.height).toBeGreaterThanOrEqual(44)
        }
      }
    })
  })
})

test.describe('Component-Specific Accessibility', () => {
  test('AI Chat Interface accessibility', async ({ page }) => {
    await page.goto('http://localhost:3000/chat/huggingface')
    
    // Check specific chat interface accessibility
    await checkA11y(page, '[data-testid="chat-interface"]', {
      tags: ['wcag2a', 'wcag2aa']
    })
    
    // Test message history navigation
    const messages = page.locator('[data-testid="chat-message"]')
    if (await messages.count() > 0) {
      // Messages should be in reading order
      const firstMessage = messages.first()
      const lastMessage = messages.last()
      
      const firstBox = await firstMessage.boundingBox()
      const lastBox = await lastMessage.boundingBox()
      
      if (firstBox && lastBox) {
        // First message should be above last message
        expect(firstBox.y).toBeLessThan(lastBox.y)
      }
    }
  })

  test('Project Generator accessibility', async ({ page }) => {
    await page.goto('http://localhost:3000/projects')
    
    // Test project generator component
    const generator = page.locator('[data-testid="ai-project-generator"]')
    if (await generator.count() > 0) {
      await checkA11y(page, '[data-testid="ai-project-generator"]', {
        tags: ['wcag2a', 'wcag2aa']
      })
    }
  })

  test('Monitoring Dashboard accessibility', async ({ page }) => {
    await page.goto('http://localhost:3000/monitoring/dashboard')
    
    // Check dashboard accessibility
    await checkA11y(page, null, {
      tags: ['wcag2a', 'wcag2aa']
    })
    
    // Check data tables are accessible
    const tables = page.locator('table')
    const tableCount = await tables.count()
    
    for (let i = 0; i < tableCount; i++) {
      const table = tables.nth(i)
      
      // Tables should have caption or summary
      const caption = table.locator('caption')
      const summary = await table.getAttribute('summary')
      const ariaLabel = await table.getAttribute('aria-label')
      
      expect(await caption.count() > 0 || summary || ariaLabel).toBeTruthy()
      
      // Check for proper header structure
      const headers = table.locator('th')
      if (await headers.count() > 0) {
        const firstHeader = headers.first()
        const scope = await firstHeader.getAttribute('scope')
        expect(scope === 'col' || scope === 'row').toBeTruthy()
      }
    }
  })
})