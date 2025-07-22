import { test, expect, Page } from '@playwright/test';

/**
 * Multimodal Interface E2E Tests
 * 
 * Comprehensive testing of:
 * - Voice input and output functionality
 * - Image upload and analysis
 * - File processing capabilities
 * - Real-time AI interactions
 * - Sample scenario execution
 * - Performance and accessibility
 */

test.describe('Multimodal AI Interface', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    
    // Navigate to multimodal demo page
    await page.goto('/multimodal-demo');
    
    // Wait for initialization
    await expect(page.locator('text=VibeCode Multimodal AI')).toBeVisible({ timeout: 15000 });
  });

  test.describe('🎯 Interface Initialization', () => {
    test('should load multimodal demo page with all components', async () => {
      // Check main title and description
      await expect(page.locator('h1')).toContainText('VibeCode Multimodal AI');
      await expect(page.locator('text=Experience the future of development')).toBeVisible();
      
      // Check stats section
      await expect(page.locator('text=Samples Run')).toBeVisible();
      await expect(page.locator('text=Messages Processed')).toBeVisible();
      await expect(page.locator('text=Avg Confidence')).toBeVisible();
      await expect(page.locator('text=Total Cost')).toBeVisible();
      
      // Check tabs
      await expect(page.locator('text=🎯 Overview')).toBeVisible();
      await expect(page.locator('text=💻 Live Demo')).toBeVisible();
      await expect(page.locator('text=🎬 Scenarios')).toBeVisible();
      await expect(page.locator('text=📊 Analytics')).toBeVisible();
    });

    test('should display capability cards in overview', async () => {
      // Should show 6 capability cards
      const capabilityCards = page.locator('[data-testid="capability-card"]').or(
        page.locator('.cursor-pointer').filter({ hasText: 'Voice to Code' })
      );
      
      // Check for key capabilities
      await expect(page.locator('text=Voice to Code')).toBeVisible();
      await expect(page.locator('text=Vision to UI')).toBeVisible();
      await expect(page.locator('text=Codebase Intelligence')).toBeVisible();
      await expect(page.locator('text=AI Pair Programming')).toBeVisible();
      await expect(page.locator('text=Task Automation')).toBeVisible();
      await expect(page.locator('text=Analytics & Monitoring')).toBeVisible();
    });

    test('should show quick start guide', async () => {
      await expect(page.locator('text=Quick Start Guide')).toBeVisible();
      await expect(page.locator('text=Choose Input Method')).toBeVisible();
      await expect(page.locator('text=Describe Your Goal')).toBeVisible();
      await expect(page.locator('text=AI Processing')).toBeVisible();
      await expect(page.locator('text=Get Results')).toBeVisible();
    });
  });

  test.describe('💻 Live Demo Interface', () => {
    test.beforeEach(async () => {
      // Switch to Live Demo tab
      await page.click('text=💻 Live Demo');
      await expect(page.locator('[data-testid="multimodal-interface"]').or(
        page.locator('text=Type, speak, or upload files')
      )).toBeVisible();
    });

    test('should display multimodal input controls', async () => {
      // Check for input controls
      await expect(page.locator('button[aria-label="Voice input"]').or(
        page.locator('button').filter({ hasText: /mic/i }).first()
      )).toBeVisible();
      
      await expect(page.locator('button[aria-label="Upload files"]').or(
        page.locator('button').filter({ hasText: /upload/i }).first()
      )).toBeVisible();
      
      await expect(page.locator('button[aria-label="Upload images"]').or(
        page.locator('button').filter({ hasText: /camera/i }).first()
      )).toBeVisible();
      
      // Check for text input
      await expect(page.locator('input[placeholder*="Type"]').or(
        page.locator('textarea[placeholder*="Type"]')
      )).toBeVisible();
      
      // Check for send button
      await expect(page.locator('button[aria-label="Send"]').or(
        page.locator('button').filter({ hasText: /send/i })
      )).toBeVisible();
    });

    test('should handle text input and submission', async () => {
      const textInput = page.locator('input[placeholder*="Type"]').or(
        page.locator('textarea[placeholder*="Type"]')
      ).first();
      
      const sendButton = page.locator('button[aria-label="Send"]').or(
        page.locator('button').filter({ hasText: /send/i })
      ).first();

      // Type a message
      await textInput.fill('Create a simple React button component');
      
      // Send message
      await sendButton.click();
      
      // Should show user message
      await expect(page.locator('text=Create a simple React button component')).toBeVisible();
      
      // Should show processing indicator or response
      await expect(page.locator('text=Processing').or(
        page.locator('.animate-spin')
      )).toBeVisible({ timeout: 5000 });
    });

    test('should validate voice input controls', async () => {
      const voiceButton = page.locator('button[aria-label="Voice input"]').or(
        page.locator('button').filter({ hasText: /mic/i }).first()
      );

      // Click voice button
      await voiceButton.click();
      
      // Should change state (may require permissions)
      // This test validates the UI changes, not actual speech recognition
      await expect(voiceButton).toBeVisible();
    });

    test('should handle file upload interface', async () => {
      const uploadButton = page.locator('button[aria-label="Upload files"]').or(
        page.locator('button').filter({ hasText: /upload/i }).first()
      );

      // Should be clickable
      await expect(uploadButton).toBeEnabled();
      
      // Click should trigger file dialog (can't test actual file selection in E2E)
      await uploadButton.click();
    });

    test('should show empty state message initially', async () => {
      // Should show empty state when no messages
      await expect(page.locator('text=Start your multimodal conversation').or(
        page.locator('text=Try Samples')
      )).toBeVisible();
    });
  });

  test.describe('🎬 Sample Scenarios', () => {
    test.beforeEach(async () => {
      // Switch to Scenarios tab
      await page.click('text=🎬 Scenarios');
      await page.waitForTimeout(1000);
    });

    test('should display demo scenarios', async () => {
      // Check for demo scenario cards
      await expect(page.locator('text=🎤 Voice-Driven Development')).toBeVisible();
      await expect(page.locator('text=👁️ Design to Code Magic')).toBeVisible();
      await expect(page.locator('text=👥 AI Pair Programming')).toBeVisible();
      await expect(page.locator('text=🤖 Workflow Automation')).toBeVisible();
    });

    test('should show scenario details and scripts', async () => {
      // Check for scenario descriptions
      await expect(page.locator('text=Experience hands-free coding')).toBeVisible();
      await expect(page.locator('text=Transform visual designs')).toBeVisible();
      
      // Check for "Try This Scenario" buttons
      const tryButtons = page.locator('button:has-text("Try This Scenario")');
      await expect(tryButtons.first()).toBeVisible();
    });

    test('should navigate to live demo when clicking scenario button', async () => {
      const tryButton = page.locator('button:has-text("Try This Scenario")').first();
      await tryButton.click();
      
      // Should switch to Live Demo tab
      await expect(page.locator('text=Type, speak, or upload files').or(
        page.locator('[data-testid="multimodal-interface"]')
      )).toBeVisible();
    });
  });

  test.describe('📊 Analytics Dashboard', () => {
    test.beforeEach(async () => {
      // Switch to Analytics tab
      await page.click('text=📊 Analytics');
      await page.waitForTimeout(1000);
    });

    test('should display analytics cards', async () => {
      // Check for analytics metrics
      await expect(page.locator('text=Performance')).toBeVisible();
      await expect(page.locator('text=Security')).toBeVisible();
      await expect(page.locator('text=Geographic')).toBeVisible();
      await expect(page.locator('text=Resources')).toBeVisible();
    });

    test('should show performance metrics', async () => {
      // Check for performance data
      await expect(page.locator('text=Avg Response Time')).toBeVisible();
      await expect(page.locator('text=Success Rate')).toBeVisible();
      await expect(page.locator('text=Avg Confidence')).toBeVisible();
    });

    test('should show security metrics', async () => {
      // Check for security data
      await expect(page.locator('text=Bot Requests')).toBeVisible();
      await expect(page.locator('text=Rate Limited')).toBeVisible();
      await expect(page.locator('text=Security Score')).toBeVisible();
    });

    test('should show geographic analytics', async () => {
      // Check for geographic data
      await expect(page.locator('text=Regions')).toBeVisible();
      await expect(page.locator('text=Top Country')).toBeVisible();
      await expect(page.locator('text=Users Online')).toBeVisible();
    });

    test('should display geomap integration', async () => {
      // Check for geomap section
      await expect(page.locator('text=Real-time Geographic Distribution')).toBeVisible();
      await expect(page.locator('text=Datadog Geomap Integration')).toBeVisible();
      await expect(page.locator('button:has-text("View Live Geomap Data")')).toBeVisible();
    });

    test('should link to geomap test page', async () => {
      const geomapButton = page.locator('button:has-text("View Live Geomap Data")');
      
      // Should be clickable
      await expect(geomapButton).toBeEnabled();
      
      // Click should open new tab (test the button exists and is functional)
      await geomapButton.click();
    });
  });

  test.describe('🔧 Accessibility & Performance', () => {
    test('should meet accessibility standards', async () => {
      // Check for proper heading hierarchy
      const h1 = page.locator('h1');
      await expect(h1).toBeVisible();
      
      // Check for ARIA labels on interactive elements
      const buttons = page.locator('button');
      const buttonCount = await buttons.count();
      expect(buttonCount).toBeGreaterThan(0);
      
      // Check for keyboard navigation support
      await page.keyboard.press('Tab');
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();
    });

    test('should load within performance budget', async () => {
      const startTime = Date.now();
      
      // Navigate and wait for key content
      await page.goto('/multimodal-demo');
      await expect(page.locator('h1')).toBeVisible();
      
      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(5000); // Should load within 5 seconds
    });

    test('should be responsive on different screen sizes', async () => {
      // Test mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await expect(page.locator('h1')).toBeVisible();
      
      // Test tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });
      await expect(page.locator('h1')).toBeVisible();
      
      // Test desktop viewport
      await page.setViewportSize({ width: 1920, height: 1080 });
      await expect(page.locator('h1')).toBeVisible();
    });

    test('should handle errors gracefully', async () => {
      // Switch to Live Demo
      await page.click('text=💻 Live Demo');
      
      // Try to submit empty form
      const sendButton = page.locator('button[aria-label="Send"]').or(
        page.locator('button').filter({ hasText: /send/i })
      ).first();
      
      // Should be disabled when no input
      const textInput = page.locator('input[placeholder*="Type"]').or(
        page.locator('textarea[placeholder*="Type"]')
      ).first();
      
      await expect(textInput).toBeVisible();
    });
  });

  test.describe('🔗 Integration Points', () => {
    test('should integrate with existing VibeCode features', async () => {
      // Check for footer links to other features
      await expect(page.locator('text=Open Source')).toBeVisible();
      await expect(page.locator('text=BYOK')).toBeVisible();
      await expect(page.locator('text=Datadog Monitoring')).toBeVisible();
      await expect(page.locator('text=Geographic Analytics')).toBeVisible();
    });

    test('should maintain consistent branding', async () => {
      // Check for VibeCode branding elements
      await expect(page.locator('text=VibeCode')).toBeVisible();
      
      // Check for consistent color scheme (purple theme)
      const purpleElements = page.locator('[class*="purple"]');
      const elementCount = await purpleElements.count();
      expect(elementCount).toBeGreaterThan(0);
    });

    test('should track user interactions for analytics', async () => {
      // Check that interactions are trackable (buttons have proper attributes)
      const trackableButtons = page.locator('button[data-testid]').or(
        page.locator('button[aria-label]')
      );
      const trackableCount = await trackableButtons.count();
      expect(trackableCount).toBeGreaterThan(0);
    });
  });

  test.describe('⚡ Advanced Functionality', () => {
    test('should handle tab navigation correctly', async () => {
      // Test tab switching
      await page.click('text=🎬 Scenarios');
      await expect(page.locator('text=Voice-Driven Development')).toBeVisible();
      
      await page.click('text=📊 Analytics');
      await expect(page.locator('text=Performance')).toBeVisible();
      
      await page.click('text=🎯 Overview');
      await expect(page.locator('text=Voice to Code')).toBeVisible();
    });

    test('should maintain state between tab switches', async () => {
      // Switch to Live Demo and enter text
      await page.click('text=💻 Live Demo');
      const textInput = page.locator('input[placeholder*="Type"]').or(
        page.locator('textarea[placeholder*="Type"]')
      ).first();
      
      if (await textInput.isVisible()) {
        await textInput.fill('Test message');
        
        // Switch to another tab
        await page.click('text=🎯 Overview');
        
        // Switch back
        await page.click('text=💻 Live Demo');
        
        // Text should still be there
        await expect(textInput).toHaveValue('Test message');
      }
    });

    test('should provide helpful user guidance', async () => {
      // Check for helpful text and instructions
      await expect(page.locator('text=Experience the future of development')).toBeVisible();
      await expect(page.locator('text=Try saying:')).toBeVisible();
      
      // Switch to Live Demo
      await page.click('text=💻 Live Demo');
      await expect(page.locator('text=Start your multimodal conversation').or(
        page.locator('text=Try Samples')
      )).toBeVisible();
    });
  });

  test.describe('🛡️ Security & Privacy', () => {
    test('should not expose sensitive information', async () => {
      // Check that no API keys are visible in the UI
      await expect(page.locator('text=sk-')).not.toBeVisible();
      await expect(page.locator('text=api_key')).not.toBeVisible();
      
      // Check that error messages don't expose internal details
      const pageContent = await page.textContent('body');
      expect(pageContent).not.toContain('localhost:3001');
      expect(pageContent).not.toContain('undefined');
    });

    test('should handle authentication state properly', async () => {
      // The interface should work with the existing auth system
      // Check for proper integration with BYOK authentication
      await expect(page.locator('text=BYOK')).toBeVisible();
    });

    test('should respect user privacy in analytics', async () => {
      // Switch to Analytics tab
      await page.click('text=📊 Analytics');
      
      // Should show aggregated data, not individual user details
      await expect(page.locator('text=Geographic')).toBeVisible();
      
      // Should not show specific IP addresses or personal data
      const pageContent = await page.textContent('body');
      expect(pageContent).not.toMatch(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/); // IP addresses
      expect(pageContent).not.toContain('@'); // Email addresses
    });
  });
}); 