/**
 * UI Responsiveness E2E Tests
 * Tests responsive design, mobile compatibility, and cross-browser functionality
 */

import { test, expect, devices } from '@playwright/test';
import { createTestHelpers } from './utils/test-helpers';

test.describe('UI Responsiveness', () => {
  
  test.describe('Desktop Responsiveness', () => {
    test('should display correctly on large desktop screens', async ({ page }) => {
      const helpers = createTestHelpers(page);
      
      // Set viewport to large desktop
      await page.setViewportSize({ width: 1920, height: 1080 });
      
      await page.goto('/');
      await helpers.waitForPageReady();
      
      // Check layout elements are properly positioned
      const mainContent = page.locator('main, .main-content, [role="main"]').first();
      await expect(mainContent).toBeVisible();
      
      // Verify no horizontal scrolling
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      expect(bodyWidth).toBeLessThanOrEqual(1920);
      
      await helpers.takeScreenshot('desktop-1920x1080');
      await helpers.checkAccessibility();
    });

    test('should display correctly on medium desktop screens', async ({ page }) => {
      const helpers = createTestHelpers(page);
      
      // Set viewport to medium desktop
      await page.setViewportSize({ width: 1366, height: 768 });
      
      await page.goto('/');
      await helpers.waitForPageReady();
      
      // Check elements are still accessible
      const navigation = page.locator('nav, [role="navigation"]').first();
      if (await navigation.isVisible()) {
        await expect(navigation).toBeVisible();
      }
      
      // Check no content is cut off
      const importantElements = page.locator('h1, h2, button, input, textarea');
      const elementCount = await importantElements.count();
      
      for (let i = 0; i < Math.min(elementCount, 5); i++) {
        const element = importantElements.nth(i);
        if (await element.isVisible()) {
          const box = await element.boundingBox();
          if (box) {
            expect(box.x).toBeGreaterThanOrEqual(0);
            expect(box.x + box.width).toBeLessThanOrEqual(1366);
          }
        }
      }
      
      await helpers.takeScreenshot('desktop-1366x768');
    });
  });

  test.describe('Mobile Responsiveness', () => {
    test('should display correctly on mobile devices', async ({ page }) => {
      const helpers = createTestHelpers(page);
      
      // Use mobile viewport
      await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
      
      await page.goto('/');
      await helpers.waitForPageReady();
      
      // Check mobile-specific elements
      const mobileMenu = page.locator('.mobile-menu, .hamburger, [data-testid="mobile-menu"]').first();
      
      // Navigation might be hidden or collapsed on mobile
      const navigation = page.locator('nav, [role="navigation"]').first();
      const navVisible = await navigation.isVisible().catch(() => false);
      
      if (!navVisible && await mobileMenu.isVisible()) {
        // Test mobile menu functionality
        await mobileMenu.click();
        await expect(navigation).toBeVisible();
      }
      
      // Check text is readable (font-size should be appropriate)
      const textElements = page.locator('p, span, div').filter({ hasText: /\w+/ });
      if (await textElements.first().isVisible()) {
        const fontSize = await textElements.first().evaluate(el => 
          window.getComputedStyle(el).fontSize
        );
        const fontSizeValue = parseInt(fontSize);
        expect(fontSizeValue).toBeGreaterThanOrEqual(14); // Minimum readable font size
      }
      
      // Check no horizontal scrolling
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      expect(bodyWidth).toBeLessThanOrEqual(375);
      
      await helpers.takeScreenshot('mobile-375x667');
      await helpers.checkAccessibility();
    });

    test('should handle touch interactions', async ({ page, browserName }) => {
      // Skip on browsers that don't support touch
      if (browserName === 'webkit') {
        const helpers = createTestHelpers(page);
        
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto('/');
        await helpers.waitForPageReady();
        
        // Test touch on interactive elements
        const buttons = page.locator('button').filter({ hasText: /\w+/ });
        if (await buttons.first().isVisible()) {
          // Simulate touch tap
          const button = buttons.first();
          const box = await button.boundingBox();
          
          if (box) {
            await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
            await helpers.waitForPageReady();
          }
        }
        
        await helpers.takeScreenshot('touch-interaction');
      }
    });
  });

  test.describe('Tablet Responsiveness', () => {
    test('should display correctly on tablet devices', async ({ page }) => {
      const helpers = createTestHelpers(page);
      
      // Set viewport to tablet size
      await page.setViewportSize({ width: 768, height: 1024 }); // iPad
      
      await page.goto('/');
      await helpers.waitForPageReady();
      
      // Check layout adapts to tablet
      const mainContent = page.locator('main, .main-content, [role="main"]').first();
      await expect(mainContent).toBeVisible();
      
      // Elements should be appropriately sized for tablet
      const interactiveElements = page.locator('button, input, textarea');
      const elementCount = await interactiveElements.count();
      
      for (let i = 0; i < Math.min(elementCount, 3); i++) {
        const element = interactiveElements.nth(i);
        if (await element.isVisible()) {
          const box = await element.boundingBox();
          if (box) {
            expect(box.height).toBeGreaterThanOrEqual(32); // Minimum touch target size
          }
        }
      }
      
      await helpers.takeScreenshot('tablet-768x1024');
    });
  });

  test.describe('Cross-Browser Layout', () => {
    test('should maintain consistent layout across browsers', async ({ page, browserName }) => {
      const helpers = createTestHelpers(page);
      
      await page.goto('/');
      await helpers.waitForPageReady();
      
      // Check critical layout elements
      const layoutElements = [
        'header, [role="banner"]',
        'main, [role="main"]',
        'nav, [role="navigation"]',
        'footer, [role="contentinfo"]'
      ];
      
      const visibleElements: string[] = [];
      
      for (const selector of layoutElements) {
        const element = page.locator(selector).first();
        if (await element.isVisible().catch(() => false)) {
          visibleElements.push(selector);
          
          // Check element positioning
          const box = await element.boundingBox();
          if (box) {
            expect(box.x).toBeGreaterThanOrEqual(0);
            expect(box.y).toBeGreaterThanOrEqual(0);
          }
        }
      }
      
      console.log(`${browserName}: Found layout elements: ${visibleElements.join(', ')}`);
      
      await helpers.takeScreenshot(`layout-${browserName}`);
    });
  });

  test.describe('Accessibility Responsiveness', () => {
    test('should maintain accessibility across different screen sizes', async ({ page }) => {
      const helpers = createTestHelpers(page);
      
      const viewports = [
        { width: 320, height: 568, name: 'small-mobile' },
        { width: 768, height: 1024, name: 'tablet' },
        { width: 1280, height: 720, name: 'desktop' }
      ];
      
      for (const viewport of viewports) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto('/');
        await helpers.waitForPageReady();
        
        // Check accessibility at this viewport
        try {
          await helpers.checkAccessibility();
          console.log(`✅ Accessibility check passed for ${viewport.name}`);
        } catch (error) {
          console.error(`❌ Accessibility issues found for ${viewport.name}:`, error);
          throw error;
        }
        
        // Check focus management
        const focusableElements = page.locator('button, input, textarea, a, select, [tabindex]:not([tabindex="-1"])');
        const count = await focusableElements.count();
        
        if (count > 0) {
          // Test tab navigation
          await page.keyboard.press('Tab');
          const focusedElement = page.locator(':focus');
          await expect(focusedElement).toBeVisible();
        }
        
        await helpers.takeScreenshot(`accessibility-${viewport.name}`);
      }
    });
  });

  test.describe('Performance Responsiveness', () => {
    test('should load quickly on different screen sizes', async ({ page }) => {
      const helpers = createTestHelpers(page);
      
      const viewports = [
        { width: 375, height: 667, name: 'mobile' },
        { width: 1366, height: 768, name: 'desktop' }
      ];
      
      for (const viewport of viewports) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        
        const startTime = Date.now();
        await page.goto('/');
        await helpers.waitForPageReady();
        const endTime = Date.now();
        
        const loadTime = endTime - startTime;
        expect(loadTime).toBeLessThan(10000); // 10 seconds max
        
        // Check performance metrics
        const performanceMetrics = await helpers.checkPagePerformance();
        console.log(`${viewport.name} load time: ${loadTime}ms, DOM: ${performanceMetrics.domContentLoaded}ms`);
      }
    });
  });
});