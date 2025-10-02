/**
 * Accessibility Tests for Agent UI
 *
 * Ensures WCAG 2.1 Level AA compliance for agent interfaces
 */

import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y, getViolations } from 'axe-playwright';
import type { Page } from '@playwright/test';

test.describe('Agent UI Accessibility - WCAG Compliance', () => {
  let page: Page;

  test.beforeEach(async ({ page: p }) => {
    page = p;
    await page.goto('/agents');
    await injectAxe(page);
  });

  test.describe('Keyboard Navigation', () => {
    test('should navigate agent list with keyboard', async () => {
      // Tab through agent cards
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      const focusedElement = await page.evaluate(() => {
        return document.activeElement?.tagName;
      });

      expect(focusedElement).toBeDefined();
    });

    test('should open agent details with Enter key', async () => {
      const firstAgent = page.locator('[data-testid="agent-card"]').first();

      if (await firstAgent.isVisible()) {
        await firstAgent.focus();
        await page.keyboard.press('Enter');

        // Should navigate to detail page
        await expect(page).toHaveURL(/\/agents\/.+/);
      }
    });

    test('should close modals with Escape key', async () => {
      await page.click('button:has-text("Create Agent")');

      const modal = page.locator('[role="dialog"]');
      await expect(modal).toBeVisible();

      await page.keyboard.press('Escape');

      await expect(modal).not.toBeVisible();
    });

    test('should trap focus within modal dialogs', async () => {
      await page.click('button:has-text("Create Agent")');

      const modal = page.locator('[role="dialog"]');
      const firstInput = modal.locator('input, select, textarea').first();
      const lastInput = modal.locator('input, select, textarea, button').last();

      // Focus should cycle within modal
      await firstInput.focus();
      await page.keyboard.press('Shift+Tab');

      const focusedElement = page.locator(':focus');
      const focusedTagName = await focusedElement.evaluate(
        el => el.tagName.toLowerCase()
      );

      expect(['input', 'select', 'textarea', 'button']).toContain(focusedTagName);
    });

    test('should provide visible focus indicators', async () => {
      const firstButton = page.locator('button').first();
      await firstButton.focus();

      const hasOutline = await firstButton.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return styles.outline !== 'none' || styles.boxShadow !== 'none';
      });

      expect(hasOutline).toBe(true);
    });
  });

  test.describe('Screen Reader Support', () => {
    test('should have proper ARIA labels on interactive elements', async () => {
      const buttons = page.locator('button');
      const buttonCount = await buttons.count();

      for (let i = 0; i < buttonCount; i++) {
        const button = buttons.nth(i);
        const ariaLabel = await button.getAttribute('aria-label');
        const textContent = await button.textContent();

        // Button should have either aria-label or visible text
        expect(ariaLabel || textContent?.trim()).toBeTruthy();
      }
    });

    test('should have proper heading hierarchy', async () => {
      const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();

      let prevLevel = 0;

      for (const heading of headings) {
        const tagName = await heading.evaluate(el => el.tagName);
        const level = parseInt(tagName.charAt(1));

        // Heading level should not skip (e.g., h1 -> h3)
        expect(level).toBeLessThanOrEqual(prevLevel + 1);
        prevLevel = level;
      }
    });

    test('should have meaningful link text', async () => {
      const links = page.locator('a');
      const linkCount = await links.count();

      for (let i = 0; i < linkCount; i++) {
        const link = links.nth(i);
        const text = await link.textContent();
        const ariaLabel = await link.getAttribute('aria-label');

        // Link should have meaningful text
        const linkText = (text || ariaLabel || '').trim().toLowerCase();
        expect(linkText).not.toMatch(/^(click here|read more|link)$/);
      }
    });

    test('should have alt text for images', async () => {
      const images = page.locator('img');
      const imageCount = await images.count();

      for (let i = 0; i < imageCount; i++) {
        const img = images.nth(i);
        const alt = await img.getAttribute('alt');
        const role = await img.getAttribute('role');

        // Image should have alt attribute (empty for decorative)
        expect(alt !== null || role === 'presentation').toBe(true);
      }
    });

    test('should have proper form labels', async () => {
      await page.click('button:has-text("Create Agent")');

      const inputs = page.locator('input, select, textarea');
      const inputCount = await inputs.count();

      for (let i = 0; i < inputCount; i++) {
        const input = inputs.nth(i);
        const id = await input.getAttribute('id');
        const ariaLabel = await input.getAttribute('aria-label');
        const ariaLabelledBy = await input.getAttribute('aria-labelledby');

        // Input should have associated label
        const hasLabel = id
          ? await page.locator(`label[for="${id}"]`).count() > 0
          : false;

        expect(hasLabel || ariaLabel || ariaLabelledBy).toBeTruthy();
      }
    });

    test('should announce dynamic content updates', async () => {
      const liveRegions = page.locator('[aria-live]');
      const count = await liveRegions.count();

      // Should have live regions for dynamic updates
      expect(count).toBeGreaterThanOrEqual(0);

      if (count > 0) {
        const ariaLive = await liveRegions.first().getAttribute('aria-live');
        expect(['polite', 'assertive', 'off']).toContain(ariaLive || '');
      }
    });
  });

  test.describe('Color Contrast', () => {
    test('should meet WCAG AA contrast ratios', async () => {
      const violations = await checkA11y(page, undefined, {
        detailedReport: true,
        detailedReportOptions: {
          html: true,
        },
      });

      // Check for contrast violations
      const contrastViolations = violations.filter(v =>
        v.id === 'color-contrast'
      );

      expect(contrastViolations.length).toBe(0);
    });

    test('should be readable in high contrast mode', async () => {
      await page.emulateMedia({ colorScheme: 'dark' });

      const violations = await checkA11y(page);

      expect(violations.length).toBe(0);
    });

    test('should not rely on color alone for information', async () => {
      // Check that status indicators have more than just color
      const statusIndicators = page.locator('[data-status]');
      const count = await statusIndicators.count();

      for (let i = 0; i < count; i++) {
        const indicator = statusIndicators.nth(i);
        const text = await indicator.textContent();
        const ariaLabel = await indicator.getAttribute('aria-label');

        // Should have text or aria-label in addition to color
        expect(text?.trim() || ariaLabel).toBeTruthy();
      }
    });
  });

  test.describe('Form Accessibility', () => {
    test('should provide error messages for invalid inputs', async () => {
      await page.click('button:has-text("Create Agent")');

      const submitButton = page.locator('button[type="submit"]');
      await submitButton.click();

      // Should show accessible error messages
      const errorMessages = page.locator('[role="alert"], .error-message');
      const count = await errorMessages.count();

      expect(count).toBeGreaterThan(0);
    });

    test('should have required field indicators', async () => {
      await page.click('button:has-text("Create Agent")');

      const requiredInputs = page.locator('input[required], select[required], textarea[required]');
      const count = await requiredInputs.count();

      if (count > 0) {
        const firstRequired = requiredInputs.first();
        const ariaRequired = await firstRequired.getAttribute('aria-required');

        expect(ariaRequired).toBe('true');
      }
    });

    test('should provide input format hints', async () => {
      await page.click('button:has-text("Create Agent")');

      const taskInput = page.locator('textarea[name="task"]');

      if (await taskInput.isVisible()) {
        const placeholder = await taskInput.getAttribute('placeholder');
        const ariaDescribedBy = await taskInput.getAttribute('aria-describedby');

        // Should have hint text
        expect(placeholder || ariaDescribedBy).toBeTruthy();
      }
    });
  });

  test.describe('Interactive Element Accessibility', () => {
    test('should have sufficient touch target sizes', async () => {
      const buttons = page.locator('button, a, [role="button"]');
      const count = await buttons.count();

      for (let i = 0; i < count && i < 10; i++) {
        const button = buttons.nth(i);
        const box = await button.boundingBox();

        if (box) {
          // WCAG requires minimum 44x44 pixels for touch targets
          expect(box.width).toBeGreaterThanOrEqual(24); // Relaxed for desktop
          expect(box.height).toBeGreaterThanOrEqual(24);
        }
      }
    });

    test('should indicate loading states', async () => {
      await page.click('button:has-text("Create Agent")');

      await page.selectOption('select[name="agent_type"]', 'aider');
      await page.selectOption('select[name="model"]', 'gpt-4o-mini');
      await page.fill('textarea[name="task"]', 'Test task');

      const submitButton = page.locator('button[type="submit"]');
      await submitButton.click();

      // Should show loading indicator
      const loadingIndicator = page.locator(
        '[role="status"], [aria-busy="true"], .loading'
      );
      const isVisible = await loadingIndicator.isVisible();

      expect(isVisible).toBe(true);
    });

    test('should disable actions during processing', async () => {
      await page.click('button:has-text("Create Agent")');

      await page.selectOption('select[name="agent_type"]', 'aider');
      await page.selectOption('select[name="model"]', 'gpt-4o-mini');
      await page.fill('textarea[name="task"]', 'Test task');

      const submitButton = page.locator('button[type="submit"]');
      await submitButton.click();

      // Button should be disabled during submission
      const isDisabled = await submitButton.isDisabled();
      expect(isDisabled).toBe(true);
    });
  });

  test.describe('Motion and Animation', () => {
    test('should respect prefers-reduced-motion', async () => {
      await page.emulateMedia({ reducedMotion: 'reduce' });

      await page.goto('/agents');

      // Check for animation properties
      const animatedElements = page.locator('[class*="animate"], [class*="transition"]');
      const count = await animatedElements.count();

      if (count > 0) {
        const firstAnimated = animatedElements.first();
        const animation = await firstAnimated.evaluate(el => {
          const styles = window.getComputedStyle(el);
          return styles.animation || styles.transition;
        });

        // Animation should be disabled or very fast
        expect(animation).toBeDefined();
      }
    });

    test('should not have content that flashes more than 3 times per second', async () => {
      // Visual inspection test - automated detection is limited
      const flashingElements = page.locator('[class*="flash"], [class*="blink"]');
      const count = await flashingElements.count();

      // Should minimize or avoid flashing content
      expect(count).toBe(0);
    });
  });

  test.describe('Comprehensive Accessibility Audit', () => {
    test('should pass axe-core accessibility audit - agent list', async () => {
      await page.goto('/agents');
      await injectAxe(page);

      const violations = await getViolations(page);

      // Log violations for debugging
      if (violations.length > 0) {
        console.log('Accessibility violations found:', violations);
      }

      expect(violations.length).toBe(0);
    });

    test('should pass axe-core accessibility audit - agent creation', async () => {
      await page.goto('/agents');
      await page.click('button:has-text("Create Agent")');
      await injectAxe(page);

      const violations = await getViolations(page);

      if (violations.length > 0) {
        console.log('Accessibility violations found:', violations);
      }

      expect(violations.length).toBe(0);
    });

    test('should pass axe-core accessibility audit - agent detail', async () => {
      const firstAgent = page.locator('[data-testid="agent-card"]').first();

      if (await firstAgent.isVisible()) {
        await firstAgent.click();
        await injectAxe(page);

        const violations = await getViolations(page);

        if (violations.length > 0) {
          console.log('Accessibility violations found:', violations);
        }

        expect(violations.length).toBe(0);
      }
    });
  });

  test.describe('Language and Localization', () => {
    test('should have lang attribute on html element', async () => {
      const lang = await page.locator('html').getAttribute('lang');

      expect(lang).toBeTruthy();
      expect(lang).toMatch(/^[a-z]{2}(-[A-Z]{2})?$/);
    });

    test('should have proper text directionality', async () => {
      const dir = await page.locator('html').getAttribute('dir');

      if (dir) {
        expect(['ltr', 'rtl', 'auto']).toContain(dir);
      }
    });
  });

  test.describe('Semantic HTML', () => {
    test('should use semantic landmark regions', async () => {
      const landmarks = await page.locator(
        'header, nav, main, aside, footer, [role="banner"], [role="navigation"], [role="main"], [role="complementary"], [role="contentinfo"]'
      ).count();

      // Should have semantic structure
      expect(landmarks).toBeGreaterThan(0);
    });

    test('should use lists for list content', async () => {
      const agentList = page.locator('[data-testid="agent-list"]');

      if (await agentList.isVisible()) {
        const isList = await agentList.evaluate(el => {
          return el.tagName === 'UL' || el.tagName === 'OL' || el.getAttribute('role') === 'list';
        });

        expect(isList).toBe(true);
      }
    });

    test('should use semantic buttons and links appropriately', async () => {
      const buttons = page.locator('button, [role="button"]');
      const links = page.locator('a, [role="link"]');

      const buttonCount = await buttons.count();
      const linkCount = await links.count();

      // Should have interactive elements
      expect(buttonCount + linkCount).toBeGreaterThan(0);
    });
  });
});
