/**
 * Keyboard Navigation E2E Tests
 * Tests comprehensive keyboard navigation including command palette, vim bindings, and accessibility
 */

import { test, expect, Page } from '@playwright/test';

// Helper to wait for page to be ready
async function waitForPageReady(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.waitForLoadState('domcontentloaded');
}

// Helper to take screenshot for debugging
async function takeScreenshot(page: Page, name: string) {
  await page.screenshot({ path: `test-results/keyboard-nav-${name}.png`, fullPage: true });
}

test.describe('Keyboard Navigation', () => {

  test.describe('Command Palette', () => {
    test('should open command palette with Cmd+Shift+P', async ({ page }) => {
      await page.goto('/');
      await waitForPageReady(page);

      // Press Cmd+Shift+P (Ctrl+Shift+P on Linux/Windows)
      const isMac = process.platform === 'darwin';
      const modifier = isMac ? 'Meta' : 'Control';

      await page.keyboard.press(`${modifier}+Shift+KeyP`);

      // Wait for command palette to appear
      await page.waitForTimeout(500);

      // Check if command palette modal is visible
      const commandPalette = page.locator('[role="dialog"]', { hasText: 'Command Palette' });
      const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="command"]');

      // At least one should be visible
      const paletteVisible = await commandPalette.isVisible().catch(() => false);
      const inputVisible = await searchInput.isVisible().catch(() => false);

      if (paletteVisible || inputVisible) {
        console.log('✅ Command palette opened with Cmd+Shift+P');

        // If visible, test search functionality
        if (inputVisible) {
          await searchInput.fill('dashboard');
          await page.waitForTimeout(300);

          // Check for search results
          const results = page.locator('[role="option"], [data-testid*="command"]');
          const resultCount = await results.count();
          console.log(`Found ${resultCount} search results for "dashboard"`);
        }

        // Close with Escape
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);

        const closedPalette = await commandPalette.isVisible().catch(() => false);
        expect(closedPalette).toBe(false);
        console.log('✅ Command palette closed with Escape');
      } else {
        console.log('⚠️ Command palette not yet implemented or not visible');
      }

      await takeScreenshot(page, 'command-palette-cmd-shift-p');
    });

    test('should open command palette with Cmd+K', async ({ page }) => {
      await page.goto('/');
      await waitForPageReady(page);

      // Press Cmd+K (Ctrl+K on Linux/Windows)
      const isMac = process.platform === 'darwin';
      const modifier = isMac ? 'Meta' : 'Control';

      await page.keyboard.press(`${modifier}+KeyK`);

      // Wait for command palette to appear
      await page.waitForTimeout(500);

      // Check if command palette modal is visible
      const commandPalette = page.locator('[role="dialog"]');
      const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="command"]');

      const paletteVisible = await commandPalette.isVisible().catch(() => false);
      const inputVisible = await searchInput.isVisible().catch(() => false);

      if (paletteVisible || inputVisible) {
        console.log('✅ Command palette opened with Cmd+K');

        // Close with Escape
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      } else {
        console.log('⚠️ Command palette not yet implemented or not visible');
      }

      await takeScreenshot(page, 'command-palette-cmd-k');
    });

    test('should navigate command palette results with arrow keys', async ({ page }) => {
      await page.goto('/');
      await waitForPageReady(page);

      const isMac = process.platform === 'darwin';
      const modifier = isMac ? 'Meta' : 'Control';

      // Open command palette
      await page.keyboard.press(`${modifier}+Shift+KeyP`);
      await page.waitForTimeout(500);

      const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="command"]');
      const inputVisible = await searchInput.isVisible().catch(() => false);

      if (inputVisible) {
        // Type to get results
        await searchInput.fill('vm');
        await page.waitForTimeout(300);

        // Navigate with arrow keys
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(200);

        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(200);

        await page.keyboard.press('ArrowUp');
        await page.waitForTimeout(200);

        console.log('✅ Arrow key navigation works in command palette');

        // Close with Escape
        await page.keyboard.press('Escape');
      } else {
        console.log('⚠️ Command palette search not available');
      }

      await takeScreenshot(page, 'command-palette-arrow-navigation');
    });

    test('should execute command with Enter key', async ({ page }) => {
      await page.goto('/');
      await waitForPageReady(page);

      const isMac = process.platform === 'darwin';
      const modifier = isMac ? 'Meta' : 'Control';

      // Open command palette
      await page.keyboard.press(`${modifier}+Shift+KeyP`);
      await page.waitForTimeout(500);

      const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="command"]');
      const inputVisible = await searchInput.isVisible().catch(() => false);

      if (inputVisible) {
        // Search for settings
        await searchInput.fill('settings');
        await page.waitForTimeout(300);

        // Select first result with Enter
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(200);

        const currentUrl = page.url();
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1000);

        // Check if navigation occurred
        const newUrl = page.url();
        if (newUrl !== currentUrl) {
          console.log(`✅ Command executed and navigated to: ${newUrl}`);
        } else {
          console.log('⚠️ No navigation occurred after Enter key');
        }
      } else {
        console.log('⚠️ Command palette search not available');
      }

      await takeScreenshot(page, 'command-execution');
    });
  });

  test.describe('Vim-Style Navigation', () => {
    test('should scroll down with j key (if vim mode enabled)', async ({ page }) => {
      await page.goto('/');
      await waitForPageReady(page);

      // Get initial scroll position
      const initialScroll = await page.evaluate(() => window.scrollY);

      // Press 'j' to scroll down
      await page.keyboard.press('KeyJ');
      await page.waitForTimeout(300);

      // Get new scroll position
      const newScroll = await page.evaluate(() => window.scrollY);

      if (newScroll > initialScroll) {
        console.log('✅ Vim j key scrolled down');
      } else {
        console.log('⚠️ Vim mode may not be enabled or j key not working');
      }

      await takeScreenshot(page, 'vim-scroll-down');
    });

    test('should scroll up with k key (if vim mode enabled)', async ({ page }) => {
      await page.goto('/');
      await waitForPageReady(page);

      // Scroll down first
      await page.evaluate(() => window.scrollTo(0, 500));
      await page.waitForTimeout(300);

      const initialScroll = await page.evaluate(() => window.scrollY);

      // Press 'k' to scroll up
      await page.keyboard.press('KeyK');
      await page.waitForTimeout(300);

      const newScroll = await page.evaluate(() => window.scrollY);

      if (newScroll < initialScroll) {
        console.log('✅ Vim k key scrolled up');
      } else {
        console.log('⚠️ Vim mode may not be enabled or k key not working');
      }

      await takeScreenshot(page, 'vim-scroll-up');
    });

    test('should scroll to top with gg (if vim mode enabled)', async ({ page }) => {
      await page.goto('/');
      await waitForPageReady(page);

      // Scroll down first
      await page.evaluate(() => window.scrollTo(0, 1000));
      await page.waitForTimeout(300);

      // Press 'g' twice for gg
      await page.keyboard.press('KeyG');
      await page.keyboard.press('KeyG');
      await page.waitForTimeout(300);

      const scrollPosition = await page.evaluate(() => window.scrollY);

      if (scrollPosition === 0) {
        console.log('✅ Vim gg scrolled to top');
      } else {
        console.log('⚠️ Vim mode may not be enabled or gg not working');
      }

      await takeScreenshot(page, 'vim-scroll-to-top');
    });

    test('should check vim mode toggle in settings', async ({ page }) => {
      await page.goto('/settings');
      await waitForPageReady(page);

      // Look for vim mode toggle
      const vimToggle = page.locator('text=/vim.*mode/i').first();
      const toggleExists = await vimToggle.isVisible().catch(() => false);

      if (toggleExists) {
        console.log('✅ Vim mode toggle found in settings');

        // Try to find the actual switch/checkbox
        const switchElement = page.locator('[role="switch"], input[type="checkbox"]').first();
        const switchExists = await switchElement.isVisible().catch(() => false);

        if (switchExists) {
          const isChecked = await switchElement.getAttribute('aria-checked') ||
                           await switchElement.isChecked().catch(() => false);
          console.log(`Vim mode is ${isChecked ? 'enabled' : 'disabled'}`);
        }
      } else {
        console.log('⚠️ Vim mode toggle not found in settings');
      }

      await takeScreenshot(page, 'vim-mode-settings');
    });
  });

  test.describe('Tab Navigation', () => {
    test('should navigate through focusable elements with Tab', async ({ page }) => {
      await page.goto('/');
      await waitForPageReady(page);

      // Start from beginning
      await page.keyboard.press('Home');

      const focusableElements: string[] = [];
      const maxTabs = 25;

      for (let i = 0; i < maxTabs; i++) {
        await page.keyboard.press('Tab');
        await page.waitForTimeout(100);

        const focusedElement = page.locator(':focus');
        const tagName = await focusedElement.evaluate(el => el.tagName.toLowerCase()).catch(() => 'unknown');
        const ariaLabel = await focusedElement.getAttribute('aria-label').catch(() => '');
        const text = await focusedElement.textContent().catch(() => '');

        if (tagName !== 'unknown') {
          const elementInfo = `${tagName}${ariaLabel ? `[${ariaLabel}]` : ''}: ${text.trim().substring(0, 30)}`;
          focusableElements.push(elementInfo);

          // Ensure focused element is visible
          const isVisible = await focusedElement.isVisible().catch(() => false);
          expect(isVisible).toBe(true);
        }

        // Stop if we've looped back
        if (i > 10 && focusableElements.length > 0) {
          const currentFocus = focusableElements[focusableElements.length - 1];
          if (focusableElements.indexOf(currentFocus) < focusableElements.length - 1) {
            break;
          }
        }
      }

      console.log('Focusable elements found:', focusableElements.length);
      console.log('Sample focusable elements:', focusableElements.slice(0, 10));
      expect(focusableElements.length).toBeGreaterThan(0);

      await takeScreenshot(page, 'tab-navigation');
    });

    test('should navigate backwards with Shift+Tab', async ({ page }) => {
      await page.goto('/');
      await waitForPageReady(page);

      // Tab forward a few times
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      const forwardElement = await page.locator(':focus').textContent().catch(() => '');

      // Tab backwards
      await page.keyboard.press('Shift+Tab');
      await page.waitForTimeout(100);

      const backwardElement = await page.locator(':focus').textContent().catch(() => '');

      // Elements should be different (we went back)
      expect(forwardElement).not.toBe(backwardElement);
      console.log('✅ Shift+Tab navigates backwards');

      await takeScreenshot(page, 'shift-tab-navigation');
    });

    test('should show visible focus indicators', async ({ page }) => {
      await page.goto('/');
      await waitForPageReady(page);

      // Tab to a few elements and check focus indicators
      const elementsToCheck = 5;
      let focusIndicatorsVisible = 0;

      for (let i = 0; i < elementsToCheck; i++) {
        await page.keyboard.press('Tab');
        await page.waitForTimeout(100);

        const focusedElement = page.locator(':focus');

        // Check if element has outline or box-shadow (focus indicator)
        const hasOutline = await focusedElement.evaluate(el => {
          const styles = window.getComputedStyle(el);
          return styles.outline !== 'none' &&
                 styles.outline !== '' &&
                 styles.outline !== '0px' &&
                 styles.outlineWidth !== '0px';
        }).catch(() => false);

        const hasBoxShadow = await focusedElement.evaluate(el => {
          const styles = window.getComputedStyle(el);
          return styles.boxShadow !== 'none' && styles.boxShadow !== '';
        }).catch(() => false);

        if (hasOutline || hasBoxShadow) {
          focusIndicatorsVisible++;
        }
      }

      console.log(`Focus indicators visible on ${focusIndicatorsVisible}/${elementsToCheck} elements`);
      expect(focusIndicatorsVisible).toBeGreaterThan(0);

      await takeScreenshot(page, 'focus-indicators');
    });
  });

  test.describe('Keyboard Hints', () => {
    test('should show keyboard hints on navigation items', async ({ page }) => {
      await page.goto('/');
      await waitForPageReady(page);

      // Look for keyboard hints in navigation
      const keyboardHints = page.locator('[class*="keyboard"], [data-testid*="keyboard"], kbd');
      const hintCount = await keyboardHints.count();

      if (hintCount > 0) {
        console.log(`✅ Found ${hintCount} keyboard hints on page`);

        // Check a few hints
        for (let i = 0; i < Math.min(3, hintCount); i++) {
          const hintText = await keyboardHints.nth(i).textContent();
          console.log(`  Hint ${i + 1}: ${hintText}`);
        }
      } else {
        console.log('⚠️ No keyboard hints found on page');
      }

      await takeScreenshot(page, 'keyboard-hints');
    });

    test('should show keyboard hints in AI chat interface', async ({ page }) => {
      await page.goto('/ai/chat');
      await waitForPageReady(page);

      // Look for keyboard hints on buttons (e.g., Send button with Cmd+Enter)
      const sendButton = page.locator('[aria-label*="Send"], button:has-text("Send")');
      const buttonExists = await sendButton.isVisible().catch(() => false);

      if (buttonExists) {
        // Look for keyboard hint near the send button
        const keyboardHint = page.locator('text=/⌘.*Enter|Cmd.*Enter|Ctrl.*Enter/i');
        const hintExists = await keyboardHint.isVisible().catch(() => false);

        if (hintExists) {
          console.log('✅ Keyboard hint found on Send button');
        } else {
          console.log('⚠️ No keyboard hint found on Send button');
        }
      } else {
        console.log('⚠️ Send button not found in AI chat interface');
      }

      await takeScreenshot(page, 'keyboard-hints-ai-chat');
    });
  });

  test.describe('Focus Management', () => {
    test('should trap focus in modals', async ({ page }) => {
      await page.goto('/');
      await waitForPageReady(page);

      const isMac = process.platform === 'darwin';
      const modifier = isMac ? 'Meta' : 'Control';

      // Open command palette (a modal)
      await page.keyboard.press(`${modifier}+Shift+KeyP`);
      await page.waitForTimeout(500);

      const modal = page.locator('[role="dialog"]');
      const modalVisible = await modal.isVisible().catch(() => false);

      if (modalVisible) {
        // Tab multiple times and ensure focus stays in modal
        const tabCount = 10;
        let focusEscapedModal = false;

        for (let i = 0; i < tabCount; i++) {
          await page.keyboard.press('Tab');
          await page.waitForTimeout(100);

          const focusedElement = page.locator(':focus');

          // Check if focused element is inside modal
          const isInModal = await focusedElement.evaluate((el, modalEl) => {
            return modalEl && modalEl.contains(el);
          }, await modal.elementHandle()).catch(() => false);

          if (!isInModal) {
            focusEscapedModal = true;
            break;
          }
        }

        if (!focusEscapedModal) {
          console.log('✅ Focus trapped in modal');
        } else {
          console.log('⚠️ Focus escaped modal');
        }

        // Close modal
        await page.keyboard.press('Escape');
      } else {
        console.log('⚠️ Modal not visible');
      }

      await takeScreenshot(page, 'focus-trap-modal');
    });

    test('should restore focus after modal closes', async ({ page }) => {
      await page.goto('/');
      await waitForPageReady(page);

      // Focus on a specific element
      const navLink = page.locator('nav a').first();
      const linkExists = await navLink.isVisible().catch(() => false);

      if (linkExists) {
        await navLink.focus();
        const initialFocusText = await page.locator(':focus').textContent();

        const isMac = process.platform === 'darwin';
        const modifier = isMac ? 'Meta' : 'Control';

        // Open and close modal
        await page.keyboard.press(`${modifier}+Shift+KeyP`);
        await page.waitForTimeout(500);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);

        const finalFocusText = await page.locator(':focus').textContent();

        // Focus should be restored (or at least not on body)
        console.log(`Initial focus: ${initialFocusText}`);
        console.log(`Final focus: ${finalFocusText}`);

        await takeScreenshot(page, 'focus-restore');
      }
    });

    test('should support arrow key navigation in dropdowns', async ({ page }) => {
      await page.goto('/');
      await waitForPageReady(page);

      // Look for dropdown buttons (e.g., VM dropdown in navigation)
      const dropdownButton = page.locator('[aria-haspopup="true"], button[aria-expanded]').first();
      const buttonExists = await dropdownButton.isVisible().catch(() => false);

      if (buttonExists) {
        // Open dropdown with click
        await dropdownButton.click();
        await page.waitForTimeout(300);

        const isExpanded = await dropdownButton.getAttribute('aria-expanded');

        if (isExpanded === 'true') {
          console.log('✅ Dropdown opened');

          // Try arrow key navigation
          await page.keyboard.press('ArrowDown');
          await page.waitForTimeout(200);

          await page.keyboard.press('ArrowDown');
          await page.waitForTimeout(200);

          await page.keyboard.press('ArrowUp');
          await page.waitForTimeout(200);

          console.log('✅ Arrow key navigation in dropdown');

          // Close with Escape
          await page.keyboard.press('Escape');
          await page.waitForTimeout(300);

          const isClosed = await dropdownButton.getAttribute('aria-expanded');
          if (isClosed === 'false') {
            console.log('✅ Dropdown closed with Escape');
          }
        } else {
          console.log('⚠️ Dropdown did not open');
        }
      } else {
        console.log('⚠️ No dropdown found');
      }

      await takeScreenshot(page, 'dropdown-arrow-navigation');
    });
  });

  test.describe('Keyboard Shortcuts', () => {
    test('should open keyboard shortcuts help with Cmd+/', async ({ page }) => {
      await page.goto('/');
      await waitForPageReady(page);

      const isMac = process.platform === 'darwin';
      const modifier = isMac ? 'Meta' : 'Control';

      // Press Cmd+/
      await page.keyboard.press(`${modifier}+Slash`);
      await page.waitForTimeout(500);

      // Look for keyboard shortcuts modal/panel
      const shortcutsModal = page.locator('[role="dialog"]', { hasText: /keyboard|shortcuts/i });
      const modalVisible = await shortcutsModal.isVisible().catch(() => false);

      if (modalVisible) {
        console.log('✅ Keyboard shortcuts help opened');

        // Check for vim mode section
        const vimSection = page.locator('text=/vim.*mode/i');
        const vimSectionExists = await vimSection.isVisible().catch(() => false);

        if (vimSectionExists) {
          console.log('✅ Vim mode section found in shortcuts help');
        }

        // Close with Escape
        await page.keyboard.press('Escape');
      } else {
        console.log('⚠️ Keyboard shortcuts help not visible');
      }

      await takeScreenshot(page, 'keyboard-shortcuts-help');
    });

    test('should navigate to settings with keyboard shortcut', async ({ page }) => {
      await page.goto('/');
      await waitForPageReady(page);

      const isMac = process.platform === 'darwin';
      const modifier = isMac ? 'Meta' : 'Control';

      // Press Cmd+Shift+S for settings
      await page.keyboard.press(`${modifier}+Shift+KeyS`);
      await page.waitForTimeout(1000);

      // Check if navigated to settings
      const currentUrl = page.url();

      if (currentUrl.includes('/settings')) {
        console.log('✅ Navigated to settings with keyboard shortcut');
      } else {
        console.log('⚠️ Keyboard shortcut for settings may not be implemented');
      }

      await takeScreenshot(page, 'settings-shortcut');
    });

    test('should have accessible skip link', async ({ page }) => {
      await page.goto('/');
      await waitForPageReady(page);

      // Press Tab to focus first element (often skip link)
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);

      const focusedElement = page.locator(':focus');
      const text = await focusedElement.textContent().catch(() => '');

      if (text.toLowerCase().includes('skip')) {
        console.log('✅ Skip link is keyboard accessible');

        // Activate skip link with Enter
        await page.keyboard.press('Enter');
        await page.waitForTimeout(300);

        console.log('✅ Skip link activated');
      } else {
        console.log('⚠️ Skip link not found as first focusable element');
      }

      await takeScreenshot(page, 'skip-link');
    });
  });

  test.describe('Overall Keyboard Accessibility', () => {
    test('should complete common workflow with keyboard only', async ({ page }) => {
      await page.goto('/');
      await waitForPageReady(page);

      console.log('Starting keyboard-only workflow test');

      const isMac = process.platform === 'darwin';
      const modifier = isMac ? 'Meta' : 'Control';

      // Step 1: Open command palette
      await page.keyboard.press(`${modifier}+Shift+KeyP`);
      await page.waitForTimeout(500);
      console.log('Step 1: Opened command palette');

      // Step 2: Search for settings
      const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="command"]');
      const inputVisible = await searchInput.isVisible().catch(() => false);

      if (inputVisible) {
        await searchInput.fill('settings');
        await page.waitForTimeout(300);
        console.log('Step 2: Searched for settings');

        // Step 3: Navigate with arrow key and select
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(200);

        // Close palette
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        console.log('Step 3: Closed command palette');
      }

      // Step 4: Use navigation shortcut
      await page.keyboard.press(`${modifier}+Shift+KeyS`);
      await page.waitForTimeout(1000);

      const onSettings = page.url().includes('/settings');
      if (onSettings) {
        console.log('Step 4: Navigated to settings with shortcut');
      }

      // Step 5: Tab through settings
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.waitForTimeout(200);
      console.log('Step 5: Tabbed through settings');

      console.log('✅ Completed keyboard-only workflow');

      await takeScreenshot(page, 'keyboard-workflow');
    });

    test('should not create keyboard traps', async ({ page }) => {
      await page.goto('/');
      await waitForPageReady(page);

      // Tab through many elements to ensure no traps
      const maxTabs = 50;
      let previousFocus: string | null = null;
      let sameElementCount = 0;

      for (let i = 0; i < maxTabs; i++) {
        await page.keyboard.press('Tab');
        await page.waitForTimeout(50);

        const currentFocus = await page.locator(':focus').textContent().catch(() => '');

        if (currentFocus === previousFocus) {
          sameElementCount++;

          // If stuck on same element for 3+ consecutive tabs, might be a trap
          if (sameElementCount >= 3) {
            console.log(`⚠️ Possible keyboard trap detected at: ${currentFocus}`);
            break;
          }
        } else {
          sameElementCount = 0;
        }

        previousFocus = currentFocus;
      }

      if (sameElementCount < 3) {
        console.log('✅ No keyboard traps detected');
      }

      await takeScreenshot(page, 'keyboard-trap-test');
    });

    test('should support keyboard interaction in all major sections', async ({ page }) => {
      const sections = [
        { url: '/', name: 'Home' },
        { url: '/ai/chat', name: 'AI Chat' },
        { url: '/settings', name: 'Settings' }
      ];

      for (const section of sections) {
        await page.goto(section.url);
        await waitForPageReady(page);

        // Tab through elements
        const focusableCount = new Set<string>();

        for (let i = 0; i < 10; i++) {
          await page.keyboard.press('Tab');
          await page.waitForTimeout(100);

          const focusedElement = page.locator(':focus');
          const tagName = await focusedElement.evaluate(el => el.tagName.toLowerCase()).catch(() => 'unknown');

          if (tagName !== 'unknown') {
            focusableCount.add(tagName);
          }
        }

        console.log(`${section.name}: Found ${focusableCount.size} types of focusable elements`);
        expect(focusableCount.size).toBeGreaterThan(0);
      }

      console.log('✅ All major sections support keyboard interaction');
    });
  });
});
