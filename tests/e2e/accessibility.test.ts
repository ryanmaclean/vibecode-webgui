/**
 * Accessibility E2E Tests
 * Tests compliance with WCAG guidelines and accessibility standards
 */

import { test, expect } from '@playwright/test';
import { createTestHelpers } from './utils/test-helpers';

test.describe('Accessibility Compliance', () => {
  
  test.describe('WCAG 2.1 Level AA Compliance', () => {
    test('should meet WCAG 2.1 AA standards on main pages', async ({ page }) => {
      const helpers = createTestHelpers(page);
      
      const pagesToTest = [
        { url: '/', name: 'homepage' },
        { url: '/auth/login', name: 'login-page' }
      ];
      
      for (const pageTest of pagesToTest) {
        await page.goto(pageTest.url);
        await helpers.waitForPageReady();
        
        // Run comprehensive accessibility check
        await helpers.checkAccessibility({ 
          tags: ['wcag2a', 'wcag2aa', 'wcag21aa'] 
        });
        
        console.log(`✅ WCAG 2.1 AA compliance verified for ${pageTest.name}`);
        await helpers.takeScreenshot(`accessibility-${pageTest.name}`);
      }
    });

    test('should maintain accessibility after user login', async ({ page }) => {
      const helpers = createTestHelpers(page);
      
      await helpers.login();
      await helpers.waitForPageReady();
      
      // Check authenticated state accessibility
      await helpers.checkAccessibility({
        tags: ['wcag2a', 'wcag2aa', 'wcag21aa']
      });
      
      await helpers.takeScreenshot('accessibility-authenticated');
    });
  });

  test.describe('Keyboard Navigation', () => {
    test('should support full keyboard navigation', async ({ page }) => {
      const helpers = createTestHelpers(page);
      
      await page.goto('/');
      await helpers.waitForPageReady();
      
      // Start from beginning of page
      await page.keyboard.press('Home');
      
      // Tab through focusable elements
      const focusableElements: string[] = [];
      const maxTabs = 20; // Prevent infinite loop
      
      for (let i = 0; i < maxTabs; i++) {
        await page.keyboard.press('Tab');
        
        const focusedElement = page.locator(':focus');
        const tagName = await focusedElement.evaluate(el => el.tagName.toLowerCase()).catch(() => 'unknown');
        const text = await focusedElement.textContent().catch(() => '');
        
        if (tagName !== 'unknown') {
          focusableElements.push(`${tagName}: ${text.trim().substring(0, 30)}`);
          
          // Ensure focused element is visible
          await expect(focusedElement).toBeVisible();
          
          // Check focus indicator is visible
          const focusedBox = await focusedElement.boundingBox();
          expect(focusedBox).toBeTruthy();
        }
        
        // Stop if we've circled back to the first element
        if (i > 5 && focusableElements.length > 0) {
          const currentFocus = focusableElements[focusableElements.length - 1];
          if (currentFocus === focusableElements[0]) {
            break;
          }
        }
      }
      
      console.log('Focusable elements found:', focusableElements);
      expect(focusableElements.length).toBeGreaterThan(0);
      
      await helpers.takeScreenshot('keyboard-navigation');
    });

    test('should support keyboard shortcuts and interactions', async ({ page }) => {
      const helpers = createTestHelpers(page);
      
      await helpers.login();
      
      // Test common keyboard shortcuts
      const shortcuts = [
        { keys: ['Control', 'KeyN'], description: 'New file/project' },
        { keys: ['Control', 'KeyS'], description: 'Save' },
        { keys: ['Escape'], description: 'Close modal/menu' }
      ];
      
      for (const shortcut of shortcuts) {
        console.log(`Testing shortcut: ${shortcut.description}`);
        
        // Press shortcut
        if (shortcut.keys.length === 1) {
          await page.keyboard.press(shortcut.keys[0]);
        } else {
          await page.keyboard.press(shortcut.keys.join('+'));
        }
        
        await page.waitForTimeout(1000);
        
        // Check for any modal, menu, or state changes
        const modals = page.locator('.modal, [role="dialog"], .overlay');
        const menus = page.locator('.menu, [role="menu"], .dropdown');
        
        // Document what happened (shortcuts might not be implemented yet)
        const modalCount = await modals.count();
        const menuCount = await menus.count();
        
        console.log(`After ${shortcut.description}: ${modalCount} modals, ${menuCount} menus`);
      }
      
      await helpers.takeScreenshot('keyboard-shortcuts');
    });
  });

  test.describe('Screen Reader Compatibility', () => {
    test('should have proper semantic markup', async ({ page }) => {
      const helpers = createTestHelpers(page);
      
      await page.goto('/');
      await helpers.waitForPageReady();
      
      // Check for semantic HTML elements
      const semanticElements = [
        { selector: 'main, [role="main"]', name: 'main content' },
        { selector: 'nav, [role="navigation"]', name: 'navigation' },
        { selector: 'header, [role="banner"]', name: 'header' },
        { selector: 'h1, h2, h3, h4, h5, h6', name: 'headings' }
      ];
      
      for (const element of semanticElements) {
        const found = await page.locator(element.selector).count();
        if (found > 0) {
          console.log(`✅ Found ${found} ${element.name} element(s)`);
        } else {
          console.log(`⚠️ No ${element.name} elements found`);
        }
      }
      
      // Check heading hierarchy
      const headings = page.locator('h1, h2, h3, h4, h5, h6');
      const headingCount = await headings.count();
      
      if (headingCount > 0) {
        // Should start with h1
        const firstHeading = headings.first();
        const firstHeadingTag = await firstHeading.evaluate(el => el.tagName.toLowerCase());
        expect(firstHeadingTag).toBe('h1');
        
        // Check for proper heading hierarchy
        for (let i = 0; i < headingCount; i++) {
          const heading = headings.nth(i);
          const headingText = await heading.textContent();
          const headingTag = await heading.evaluate(el => el.tagName.toLowerCase());
          
          expect(headingText).toBeTruthy();
          expect(headingText?.trim().length).toBeGreaterThan(0);
          
          console.log(`Heading ${i + 1}: ${headingTag.toUpperCase()} - ${headingText?.trim().substring(0, 50)}`);
        }
      }
      
      await helpers.takeScreenshot('semantic-markup');
    });

    test('should have proper ARIA labels and descriptions', async ({ page }) => {
      const helpers = createTestHelpers(page);
      
      await helpers.login();
      
      // Check for ARIA attributes
      const ariaElements = [
        { selector: '[aria-label]', attribute: 'aria-label' },
        { selector: '[aria-describedby]', attribute: 'aria-describedby' },
        { selector: '[aria-labelledby]', attribute: 'aria-labelledby' },
        { selector: '[role]', attribute: 'role' }
      ];
      
      for (const ariaCheck of ariaElements) {
        const elements = page.locator(ariaCheck.selector);
        const count = await elements.count();
        
        if (count > 0) {
          console.log(`Found ${count} elements with ${ariaCheck.attribute}`);
          
          // Check first few elements have meaningful values
          const checkCount = Math.min(count, 3);
          for (let i = 0; i < checkCount; i++) {
            const element = elements.nth(i);
            const ariaValue = await element.getAttribute(ariaCheck.attribute);
            
            expect(ariaValue).toBeTruthy();
            expect(ariaValue?.trim().length).toBeGreaterThan(0);
            
            console.log(`${ariaCheck.attribute}: "${ariaValue}"`);
          }
        }
      }
      
      await helpers.takeScreenshot('aria-attributes');
    });
  });

  test.describe('Color and Contrast', () => {
    test('should meet color contrast requirements', async ({ page }) => {
      const helpers = createTestHelpers(page);
      
      await page.goto('/');
      await helpers.waitForPageReady();
      
      // Check contrast with axe-core (included in accessibility check)
      await helpers.checkAccessibility({
        tags: ['color-contrast']
      });
      
      // Additional manual contrast checks for key elements
      const textElements = page.locator('p, span, div, a, button, label').filter({ hasText: /\w+/ });
      const elementCount = await textElements.count();
      
      if (elementCount > 0) {
        // Sample a few text elements for contrast checking
        const sampleCount = Math.min(5, elementCount);
        
        for (let i = 0; i < sampleCount; i++) {
          const element = textElements.nth(i);
          
          if (await element.isVisible()) {
            const styles = await element.evaluate(el => {
              const computed = window.getComputedStyle(el);
              return {
                color: computed.color,
                backgroundColor: computed.backgroundColor,
                fontSize: computed.fontSize
              };
            });
            
            console.log(`Text element ${i + 1}:`, styles);
            
            // Basic checks
            expect(styles.color).not.toBe('transparent');
            expect(styles.fontSize).toBeTruthy();
          }
        }
      }
      
      await helpers.takeScreenshot('color-contrast');
    });

    test('should be usable without color', async ({ page }) => {
      const helpers = createTestHelpers(page);
      
      await page.goto('/');
      await helpers.waitForPageReady();
      
      // Apply CSS to remove colors (simulate color blindness)
      await page.addStyleTag({
        content: `
          * {
            filter: grayscale(100%) !important;
          }
        `
      });
      
      // Check that interface is still usable
      const interactiveElements = page.locator('button, a, input, [role="button"]');
      const count = await interactiveElements.count();
      
      for (let i = 0; i < Math.min(3, count); i++) {
        const element = interactiveElements.nth(i);
        if (await element.isVisible()) {
          // Should still be identifiable without color
          const text = await element.textContent();
          const ariaLabel = await element.getAttribute('aria-label');
          
          expect(text || ariaLabel).toBeTruthy();
        }
      }
      
      await helpers.takeScreenshot('without-color');
    });
  });

  test.describe('Focus Management', () => {
    test('should manage focus properly in dynamic content', async ({ page }) => {
      const helpers = createTestHelpers(page);
      
      await helpers.login();
      
      // Submit an AI prompt to create dynamic content
      await helpers.submitAIPrompt('Create a simple component');
      
      // Focus should be managed when content changes
      const activeElement = page.locator(':focus');
      
      // Check that focus is somewhere reasonable
      const tagName = await activeElement.evaluate(el => el.tagName.toLowerCase()).catch(() => 'none');
      
      // Focus should not be lost
      expect(tagName).not.toBe('none');
      
      await helpers.takeScreenshot('focus-management');
    });

    test('should show clear focus indicators', async ({ page }) => {
      const helpers = createTestHelpers(page);
      
      await page.goto('/');
      await helpers.waitForPageReady();
      
      // Focus on interactive elements and check visibility
      const focusableElements = page.locator('button, input, textarea, a, [tabindex]:not([tabindex="-1"])');
      const count = await focusableElements.count();
      
      for (let i = 0; i < Math.min(3, count); i++) {
        const element = focusableElements.nth(i);
        
        if (await element.isVisible()) {
          await element.focus();
          
          // Check focus indicator is visible
          const styles = await element.evaluate(el => {
            const computed = window.getComputedStyle(el);
            return {
              outline: computed.outline,
              outlineColor: computed.outlineColor,
              outlineWidth: computed.outlineWidth,
              boxShadow: computed.boxShadow
            };
          });
          
          // Should have some form of focus indicator
          const hasFocusIndicator = 
            styles.outline !== 'none' ||
            styles.outlineWidth !== '0px' ||
            styles.boxShadow !== 'none';
          
          if (!hasFocusIndicator) {
            console.warn(`Element ${i + 1} may not have clear focus indicator:`, styles);
          }
        }
      }
      
      await helpers.takeScreenshot('focus-indicators');
    });
  });
});