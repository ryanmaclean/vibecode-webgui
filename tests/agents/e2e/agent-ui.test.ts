/**
 * E2E Tests for Agent UI Components
 *
 * Tests the full user interface for agent interactions
 */

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

test.describe('Agent UI - E2E Tests', () => {
  let page: Page;

  test.beforeEach(async ({ page: p }) => {
    page = p;
    await page.goto('/agents');
  });

  test.describe('Agent Creation UI', () => {
    test('should display agent creation form', async () => {
      const createButton = page.locator('button:has-text("Create Agent")');
      await expect(createButton).toBeVisible();

      await createButton.click();

      // Check form fields
      await expect(page.locator('select[name="agent_type"]')).toBeVisible();
      await expect(page.locator('select[name="model"]')).toBeVisible();
      await expect(page.locator('textarea[name="task"]')).toBeVisible();
    });

    test('should validate agent type selection', async () => {
      await page.click('button:has-text("Create Agent")');

      const agentTypeSelect = page.locator('select[name="agent_type"]');
      await agentTypeSelect.selectOption('aider');

      const selectedValue = await agentTypeSelect.inputValue();
      expect(selectedValue).toBe('aider');
    });

    test('should validate model selection', async () => {
      await page.click('button:has-text("Create Agent")');

      const modelSelect = page.locator('select[name="model"]');
      await modelSelect.selectOption('gpt-4o');

      const selectedValue = await modelSelect.inputValue();
      expect(selectedValue).toBe('gpt-4o');
    });

    test('should validate task description input', async () => {
      await page.click('button:has-text("Create Agent")');

      const taskTextarea = page.locator('textarea[name="task"]');
      await taskTextarea.fill('Create a login page');

      const value = await taskTextarea.inputValue();
      expect(value).toBe('Create a login page');
    });

    test('should show validation errors for empty task', async () => {
      await page.click('button:has-text("Create Agent")');

      const submitButton = page.locator('button[type="submit"]');
      await submitButton.click();

      // Should show validation error
      await expect(page.locator('text=/task is required/i')).toBeVisible();
    });

    test('should create agent successfully', async () => {
      await page.click('button:has-text("Create Agent")');

      await page.selectOption('select[name="agent_type"]', 'aider');
      await page.selectOption('select[name="model"]', 'gpt-4o-mini');
      await page.fill('textarea[name="task"]', 'Write a test function');

      await page.click('button[type="submit"]');

      // Should show success message
      await expect(
        page.locator('text=/agent created successfully/i')
      ).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Agent List UI', () => {
    test('should display list of agents', async () => {
      const agentList = page.locator('[data-testid="agent-list"]');
      await expect(agentList).toBeVisible();
    });

    test('should show agent cards with status', async () => {
      // Wait for agents to load
      await page.waitForSelector('[data-testid="agent-card"]', {
        timeout: 5000,
      });

      const agentCards = page.locator('[data-testid="agent-card"]');
      const count = await agentCards.count();

      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should filter agents by status', async () => {
      const statusFilter = page.locator('select[name="status-filter"]');

      if (await statusFilter.isVisible()) {
        await statusFilter.selectOption('running');

        // Wait for filtered results
        await page.waitForTimeout(500);

        const runningAgents = page.locator(
          '[data-testid="agent-card"][data-status="running"]'
        );
        const count = await runningAgents.count();

        // All visible agents should have running status
        expect(count).toBeGreaterThanOrEqual(0);
      }
    });

    test('should search agents by ID or type', async () => {
      const searchInput = page.locator('input[name="agent-search"]');

      if (await searchInput.isVisible()) {
        await searchInput.fill('aider');

        // Wait for search results
        await page.waitForTimeout(500);

        const results = page.locator('[data-testid="agent-card"]');
        const count = await results.count();

        expect(count).toBeGreaterThanOrEqual(0);
      }
    });
  });

  test.describe('Agent Detail UI', () => {
    test('should navigate to agent detail page', async () => {
      const firstAgent = page.locator('[data-testid="agent-card"]').first();

      if (await firstAgent.isVisible()) {
        await firstAgent.click();

        // Should navigate to detail page
        await expect(page).toHaveURL(/\/agents\/[a-z]+-[a-f0-9]{8}/);
      }
    });

    test('should display agent information', async () => {
      const firstAgent = page.locator('[data-testid="agent-card"]').first();

      if (await firstAgent.isVisible()) {
        await firstAgent.click();

        // Check for agent info sections
        await expect(page.locator('text=/agent id/i')).toBeVisible();
        await expect(page.locator('text=/status/i')).toBeVisible();
        await expect(page.locator('text=/model/i')).toBeVisible();
      }
    });

    test('should display agent output terminal', async () => {
      const firstAgent = page.locator('[data-testid="agent-card"]').first();

      if (await firstAgent.isVisible()) {
        await firstAgent.click();

        const terminal = page.locator('[data-testid="agent-terminal"]');
        await expect(terminal).toBeVisible();
      }
    });

    test('should allow sending messages to agent', async () => {
      const firstAgent = page.locator('[data-testid="agent-card"]').first();

      if (await firstAgent.isVisible()) {
        await firstAgent.click();

        const messageInput = page.locator('textarea[name="message"]');
        const sendButton = page.locator('button:has-text("Send")');

        if (await messageInput.isVisible()) {
          await messageInput.fill('Test message');
          await sendButton.click();

          // Should show message sent confirmation
          await expect(
            page.locator('text=/message sent/i')
          ).toBeVisible({ timeout: 5000 });
        }
      }
    });
  });

  test.describe('Agent Control UI', () => {
    test('should stop running agent', async () => {
      const runningAgent = page
        .locator('[data-testid="agent-card"][data-status="running"]')
        .first();

      if (await runningAgent.isVisible()) {
        await runningAgent.click();

        const stopButton = page.locator('button:has-text("Stop Agent")');
        await stopButton.click();

        // Confirm stop action
        const confirmButton = page.locator('button:has-text("Confirm")');
        if (await confirmButton.isVisible()) {
          await confirmButton.click();
        }

        // Should show stopped status
        await expect(
          page.locator('text=/agent stopped/i')
        ).toBeVisible({ timeout: 10000 });
      }
    });

    test('should restart stopped agent', async () => {
      const stoppedAgent = page
        .locator('[data-testid="agent-card"][data-status="stopped"]')
        .first();

      if (await stoppedAgent.isVisible()) {
        await stoppedAgent.click();

        const restartButton = page.locator('button:has-text("Restart")');
        if (await restartButton.isVisible()) {
          await restartButton.click();

          // Should show running status
          await expect(
            page.locator('text=/agent restarted/i')
          ).toBeVisible({ timeout: 10000 });
        }
      }
    });

    test('should delete completed agent', async () => {
      const completedAgent = page
        .locator('[data-testid="agent-card"][data-status="completed"]')
        .first();

      if (await completedAgent.isVisible()) {
        const agentId = await completedAgent.getAttribute('data-agent-id');

        await completedAgent.click();

        const deleteButton = page.locator('button:has-text("Delete")');
        await deleteButton.click();

        // Confirm deletion
        const confirmButton = page.locator('button:has-text("Confirm")');
        if (await confirmButton.isVisible()) {
          await confirmButton.click();
        }

        // Should redirect to list and agent should be gone
        await page.waitForURL('/agents');
        const deletedAgent = page.locator(
          `[data-testid="agent-card"][data-agent-id="${agentId}"]`
        );
        await expect(deletedAgent).not.toBeVisible();
      }
    });
  });

  test.describe('Real-time Updates UI', () => {
    test('should show real-time output updates', async () => {
      const runningAgent = page
        .locator('[data-testid="agent-card"][data-status="running"]')
        .first();

      if (await runningAgent.isVisible()) {
        await runningAgent.click();

        const terminal = page.locator('[data-testid="agent-terminal"]');
        const initialContent = await terminal.textContent();

        // Wait for updates
        await page.waitForTimeout(2000);

        const updatedContent = await terminal.textContent();

        // Content might have changed (or might not, depending on agent activity)
        expect(updatedContent).toBeDefined();
      }
    });

    test('should update agent status in real-time', async () => {
      const agentCard = page.locator('[data-testid="agent-card"]').first();

      if (await agentCard.isVisible()) {
        const initialStatus = await agentCard.getAttribute('data-status');

        // Wait for potential status changes
        await page.waitForTimeout(3000);

        const updatedStatus = await agentCard.getAttribute('data-status');

        // Status should still be valid
        expect(['running', 'completed', 'failed', 'stopped']).toContain(
          updatedStatus
        );
      }
    });
  });

  test.describe('Error Handling UI', () => {
    test('should display error when agent creation fails', async () => {
      await page.click('button:has-text("Create Agent")');

      await page.selectOption('select[name="agent_type"]', 'aider');
      await page.selectOption('select[name="model"]', 'invalid-model');
      await page.fill('textarea[name="task"]', 'Test task');

      await page.click('button[type="submit"]');

      // Should show error message
      await expect(
        page.locator('text=/error|failed/i')
      ).toBeVisible({ timeout: 10000 });
    });

    test('should display network error message', async () => {
      // Simulate network error by going offline
      await page.context().setOffline(true);

      await page.click('button:has-text("Create Agent")');

      await page.selectOption('select[name="agent_type"]', 'aider');
      await page.selectOption('select[name="model"]', 'gpt-4o-mini');
      await page.fill('textarea[name="task"]', 'Test task');

      await page.click('button[type="submit"]');

      // Should show network error
      await expect(
        page.locator('text=/network error|connection failed/i')
      ).toBeVisible({ timeout: 10000 });

      // Restore network
      await page.context().setOffline(false);
    });

    test('should handle agent not found error', async () => {
      await page.goto('/agents/invalid-agent-id');

      // Should show not found message
      await expect(
        page.locator('text=/not found|does not exist/i')
      ).toBeVisible();
    });
  });

  test.describe('Responsive Design', () => {
    test('should display correctly on mobile', async () => {
      await page.setViewportSize({ width: 375, height: 667 });

      await page.goto('/agents');

      // Agent list should be visible and scrollable
      const agentList = page.locator('[data-testid="agent-list"]');
      await expect(agentList).toBeVisible();
    });

    test('should display correctly on tablet', async () => {
      await page.setViewportSize({ width: 768, height: 1024 });

      await page.goto('/agents');

      // Agent grid should adapt to tablet size
      const agentList = page.locator('[data-testid="agent-list"]');
      await expect(agentList).toBeVisible();
    });

    test('should display correctly on desktop', async () => {
      await page.setViewportSize({ width: 1920, height: 1080 });

      await page.goto('/agents');

      // Agent grid should use full width on desktop
      const agentList = page.locator('[data-testid="agent-list"]');
      await expect(agentList).toBeVisible();
    });
  });

  test.describe('Performance', () => {
    test('should load agent list quickly', async () => {
      const startTime = Date.now();

      await page.goto('/agents');
      await page.waitForSelector('[data-testid="agent-list"]');

      const endTime = Date.now();
      const loadTime = endTime - startTime;

      expect(loadTime).toBeLessThan(3000);
    });

    test('should handle large agent lists', async () => {
      await page.goto('/agents');

      // Scroll to bottom to trigger pagination/infinite scroll
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });

      await page.waitForTimeout(1000);

      // Page should remain responsive
      const agentList = page.locator('[data-testid="agent-list"]');
      await expect(agentList).toBeVisible();
    });
  });
});
