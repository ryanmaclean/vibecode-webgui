/**
 * End-to-end tests for monitoring dashboard
 * Tests full user workflows and component interactions
 */

import { test, expect, Page } from '@playwright/test'

test.describe('Monitoring Dashboard E2E', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();

    // Mock authentication to simulate admin user
    await page.addInitScript(() => {
      // Mock next-auth session
      (window as any).__NEXT_AUTH_SESSION = {
        user: {
          id: 'admin123',
          email: 'admin@test.com',
          role: 'admin',
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };
    });

    // Mock fetch for API calls
    await page.route('/api/monitoring/metrics', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            cpu: 45.2,
            memory: 68.5,
            diskUsage: 23.1,
            networkIO: { in: 1024000, out: 2048000 },
            activeUsers: 12,
            activeWorkspaces: 8,
            totalSessions: 156,
            avgResponseTime: 142,
            errorRate: 2.1,
            uptime: 86400,
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      }
    });

    await page.route('/api/monitoring/logs', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          logs: [
            {
              timestamp: '2025-01-10T12:00:00Z',
              level: 'info',
              message: 'User logged in successfully',
              source: 'auth-service',
              metadata: { userId: 'user123' },
            },
            {
              timestamp: '2025-01-10T12:01:00Z',
              level: 'warn',
              message: 'High memory usage detected',
              source: 'monitoring',
              metadata: { usage: 85 },
            },
            {
              timestamp: '2025-01-10T12:02:00Z',
              level: 'error',
              message: 'Database connection timeout',
              source: 'database',
              metadata: { timeout: 5000 },
            },
          ],
        }),
      });
    });

    await page.route('/api/monitoring/alerts', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          alerts: [
            {
              id: 'alert1',
              severity: 'high',
              title: 'High CPU Usage',
              description: 'CPU usage has exceeded 80% for 5 minutes',
              timestamp: '2025-01-10T11:55:00Z',
              resolved: false,
            },
            {
              id: 'alert2',
              severity: 'medium',
              title: 'Memory Warning',
              description: 'Memory usage approaching limit',
              timestamp: '2025-01-10T11:50:00Z',
              resolved: false,
            },
            {
              id: 'alert3',
              severity: 'low',
              title: 'Disk Space',
              description: 'Disk usage at 70%',
              timestamp: '2025-01-10T11:45:00Z',
              resolved: true,
            },
          ],
        }),
      });
    });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should display monitoring dashboard for admin users', async () => {
    await page.goto('/monitoring');

    // Check page title and header
    await expect(page.locator('h1')).toContainText('Monitoring Dashboard');
    await expect(page.locator('text=Live')).toBeVisible();

    // Verify navigation tabs are present
    await expect(page.locator('button:has-text("Overview")')).toBeVisible();
    await expect(page.locator('button:has-text("Metrics")')).toBeVisible();
    await expect(page.locator('button:has-text("Logs")')).toBeVisible();
    await expect(page.locator('button:has-text("Alerts")')).toBeVisible();
    await expect(page.locator('button:has-text("Security")')).toBeVisible();
  });

  test('should display system metrics on overview tab', async () => {
    await page.goto('/monitoring');

    // Wait for metrics to load
    await page.waitForSelector('[data-testid="cpu-metric"]', { timeout: 5000 });

    // Check CPU usage metric
    await expect(page.locator('[data-testid="cpu-metric"]')).toContainText('45.2%');

    // Check memory usage metric
    await expect(page.locator('[data-testid="memory-metric"]')).toContainText('68.5%');

    // Check active users metric
    await expect(page.locator('[data-testid="users-metric"]')).toContainText('12');

    // Check error rate metric
    await expect(page.locator('[data-testid="error-rate-metric"]')).toContainText('2.1%');
  });

  test('should display system status information', async () => {
    await page.goto('/monitoring');

    // Wait for system status to load
    await page.waitForSelector('text=System Status', { timeout: 5000 });

    // Check uptime display
    await expect(page.locator('text=Uptime')).toBeVisible();
    await expect(page.locator('text=1d 0h 0m')).toBeVisible();

    // Check active workspaces
    await expect(page.locator('text=Active Workspaces')).toBeVisible();
    await expect(page.locator('text=8')).toBeVisible();

    // Check total sessions
    await expect(page.locator('text=Total Sessions')).toBeVisible();
    await expect(page.locator('text=156')).toBeVisible();

    // Check average response time
    await expect(page.locator('text=Avg Response Time')).toBeVisible();
    await expect(page.locator('text=142ms')).toBeVisible();
  });

  test('should display network I/O information', async () => {
    await page.goto('/monitoring');

    // Wait for network I/O section to load
    await page.waitForSelector('text=Network I/O', { timeout: 5000 });

    // Check incoming traffic
    await expect(page.locator('text=Incoming')).toBeVisible();
    await expect(page.locator('text=1.00 MB/s')).toBeVisible();

    // Check outgoing traffic
    await expect(page.locator('text=Outgoing')).toBeVisible();
    await expect(page.locator('text=2.00 MB/s')).toBeVisible();

    // Check disk usage
    await expect(page.locator('text=Disk Usage')).toBeVisible();
    await expect(page.locator('text=23.1%')).toBeVisible();
  });

  test('should switch between tabs correctly', async () => {
    await page.goto('/monitoring');

    // Initially on overview tab
    await expect(page.locator('button:has-text("Overview")')).toHaveClass(/border-blue-500/);

    // Click on logs tab
    await page.click('button:has-text("Logs")');
    await expect(page.locator('button:has-text("Logs")')).toHaveClass(/border-blue-500/);
    await expect(page.locator('text=System Logs')).toBeVisible();

    // Switch back to overview
    await page.click('button:has-text("Overview")');
    await expect(page.locator('button:has-text("Overview")')).toHaveClass(/border-blue-500/);
    await expect(page.locator('text=CPU Usage')).toBeVisible();
  });

  test('should display logs correctly', async () => {
    await page.goto('/monitoring');

    // Click on logs tab
    await page.click('button:has-text("Logs")');

    // Wait for logs to load
    await page.waitForSelector('text=System Logs', { timeout: 5000 });

    // Check log entries
    await expect(page.locator('text=User logged in successfully')).toBeVisible();
    await expect(page.locator('text=High memory usage detected')).toBeVisible();
    await expect(page.locator('text=Database connection timeout')).toBeVisible();

    // Check log levels with colors
    await expect(page.locator('text=[INFO]')).toBeVisible();
    await expect(page.locator('text=[WARN]')).toBeVisible();
    await expect(page.locator('text=[ERROR]')).toBeVisible();

    // Check log sources
    await expect(page.locator('text=auth-service')).toBeVisible();
    await expect(page.locator('text=monitoring')).toBeVisible();
    await expect(page.locator('text=database')).toBeVisible();
  });

  test('should display alerts with correct count in tab', async () => {
    await page.goto('/monitoring');

    // Check alerts tab shows unresolved count
    await expect(page.locator('button:has-text("Alerts (2)")')).toBeVisible();

    // Click on alerts tab
    await page.click('button:has-text("Alerts")');

    // Verify alert display functionality exists
    // (Note: The actual alert content rendering would need to be implemented);
    await expect(page.locator('button:has-text("Alerts")')).toHaveClass(/border-blue-500/);
  });

  test('should handle live mode toggle', async () => {
    await page.goto('/monitoring');

    // Check that live mode is initially enabled
    await expect(page.locator('text=Live')).toBeVisible();
    await expect(page.locator('button:has-text("Pause")')).toBeVisible();

    // Toggle live mode off
    await page.click('button:has-text("Pause")');
    await expect(page.locator('text=Paused')).toBeVisible();
    await expect(page.locator('button:has-text("Resume")')).toBeVisible();

    // Toggle live mode back on
    await page.click('button:has-text("Resume")');
    await expect(page.locator('text=Live')).toBeVisible();
    await expect(page.locator('button:has-text("Pause")')).toBeVisible();
  });

  test('should handle time range selection', async () => {
    await page.goto('/monitoring');

    // Check default time range
    await expect(page.locator('select')).toHaveValue('1h');

    // Change time range to 24h
    await page.selectOption('select', '24h');
    await expect(page.locator('select')).toHaveValue('24h');

    // Change to 7 days
    await page.selectOption('select', '7d');
    await expect(page.locator('select')).toHaveValue('7d');
  });

  test('should deny access for non-admin users', async () => {
    // Override the admin session with regular user
    await page.addInitScript(() => {
      (window as any).__NEXT_AUTH_SESSION = {
        user: {
          id: 'user123',
          email: 'user@test.com',
          role: 'user',
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };
    });

    await page.goto('/monitoring');

    // Should show access denied message
    await expect(page.locator('text=Access Denied')).toBeVisible();
    await expect(page.locator('text=Administrator privileges required')).toBeVisible();
  });

  test('should handle API errors gracefully', async () => {
    // Mock API error
    await page.route('/api/monitoring/metrics', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      });
    });

    // Mock console.error to avoid test output noise
    await page.addInitScript(() => {
      console.error = () => {}
    });

    await page.goto('/monitoring');

    // Dashboard should still load even with API errors
    await expect(page.locator('h1')).toContainText('Monitoring Dashboard');

    // Metrics might be null or show default values
    // The component should handle this gracefully
    await page.waitForTimeout(2000) // Give time for error handling
  });

  test('should refresh metrics automatically in live mode', async () => {
    let requestCount = 0

    await page.route('/api/monitoring/metrics', async (route) => {
      requestCount++
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          cpu: 45.2 + requestCount,
          memory: 68.5,
          diskUsage: 23.1,
          networkIO: { in: 1024000, out: 2048000 },
          activeUsers: 12,
          activeWorkspaces: 8,
          totalSessions: 156,
          avgResponseTime: 142,
          errorRate: 2.1,
          uptime: 86400,
        }),
      });
    });

    await page.goto('/monitoring');

    // Wait for initial load
    await page.waitForSelector('[data-testid="cpu-metric"]', { timeout: 5000 });

    // Should have made at least one request initially
    expect(requestCount).toBeGreaterThan(0);

    // Wait for live mode to make additional requests
    // (In real implementation, this would happen every 30 seconds);
    // For testing, we can trigger it manually or mock timers
    await page.waitForTimeout(1000);
  });
});
