import { test, expect } from '@playwright/test';

// Minimal monitoring smoke test to confirm the dashboard renders key widgets
// and prevents regressions where the IDE showed a blank screen under Playwright.

test.describe('Monitoring dashboard smoke', () => {
  test('renders core health + metrics cards', async ({ page }) => {
    await page.goto('/monitoring');
    await page.waitForLoadState('networkidle');

    await expect(page.getByTestId('health-status-card')).toBeVisible();
    await expect(page.getByTestId('overall-health-status')).toContainText('Healthy');
    await expect(page.getByTestId('metrics-overview-card')).toBeVisible();

    const alerts = page.getByTestId('alerts-list').locator('[data-testid^="alert-"]');
    await expect(alerts).toHaveCount(3);
  });
});
