import { test, expect } from '@playwright/test';

// Minimal container monitoring smoke test to confirm the dashboard renders key widgets
// and prevents regressions where the IDE showed a blank screen under Playwright.

test.describe('Container monitoring dashboard smoke', () => {
  test('renders core container monitoring widgets', async ({ page }) => {
    await page.goto('/monitoring/containers');
    await page.waitForLoadState('networkidle');

    // Check for main heading
    await expect(page.getByText('Container Resource Monitor')).toBeVisible();

    // Check for summary cards by looking for specific text labels
    await expect(page.getByText('Total Containers')).toBeVisible();
    await expect(page.getByText('Running')).toBeVisible();
    await expect(page.getByText('Total CPU Usage')).toBeVisible();
    await expect(page.getByText('Total Memory Usage')).toBeVisible();

    // Check for container selection section
    await expect(page.getByText('Container Selection')).toBeVisible();

    // Check for all containers list section
    await expect(page.getByText(/All Containers \(\d+\)/)).toBeVisible();
  });
});
