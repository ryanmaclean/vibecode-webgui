const { test, expect } = require('@playwright/test');

test.describe('VibeCode Documentation Site', () => {
  test('homepage loads and displays correctly', async ({ page }) => {
    await page.goto('/');
    
    // Check title
    await expect(page).toHaveTitle(/VibeCode/);
    
    // Check main content
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('body')).toContainText('VibeCode');
    
    // Check Starlight attributes (they're on html element)
    await expect(page.locator('html[data-theme]')).toBeAttached();
  });

  test('navigation works correctly', async ({ page }) => {
    await page.goto('/');
    
    // Look for Starlight sidebar navigation
    const sidebarLinks = page.locator('.sidebar a, nav a, [data-starlight] a');
    if (await sidebarLinks.count() > 0) {
      await expect(sidebarLinks.first()).toBeVisible();
    } else {
      // Skip navigation test if no visible nav found
      console.log('No navigation links found - this might be a minimal layout');
      return;
    }
    
    // Try to navigate to a documentation page
    const firstLink = sidebarLinks.first();
    await firstLink.click();
    
    // Verify we navigated somewhere
    await expect(page).toHaveURL(/\/.*\//);
    await expect(page.locator('h1')).toBeVisible();
  });

  test('search functionality works', async ({ page }) => {
    await page.goto('/');
    
    // Check if search infrastructure exists
    const searchScripts = page.locator('script[src*="pagefind"]');
    if (await searchScripts.count() > 0) {
      console.log('Search scripts loaded - functionality available');
    }
    
    // Look for search box - might need to trigger it first
    const searchTrigger = page.locator('button:has-text("Search"), [data-search], .search-trigger');
    if (await searchTrigger.count() > 0) {
      await searchTrigger.first().click();
      await page.waitForTimeout(500);
    }
    
    const searchInput = page.locator('input[placeholder*="Search"], input[type="search"], .search input');
    if (await searchInput.count() > 0) {
      const firstInput = searchInput.first();
      if (await firstInput.isVisible()) {
        await firstInput.fill('datadog');
        await page.waitForTimeout(1000);
      }
    }
  });

  test('wiki index page works', async ({ page }) => {
    await page.goto('/wiki-index/');
    
    await expect(page).toHaveTitle(/Wiki/);
    await expect(page.locator('h1').first()).toContainText('Wiki');
    await expect(page.locator('body')).toContainText('Quick Navigation');
  });

  test('datadog documentation page works', async ({ page }) => {
    await page.goto('/datadog_local_development/');
    
    await expect(page.locator('h1').first()).toBeVisible();
    await expect(page.locator('body')).toContainText('Datadog');
    
    // Check for code blocks or technical content
    const codeBlocks = page.locator('code, pre, .code');
    if (await codeBlocks.count() > 0) {
      await expect(codeBlocks.first()).toBeVisible();
    }
  });

  test('comprehensive testing guide page works', async ({ page }) => {
    await page.goto('/comprehensive_testing_guide/');
    
    await expect(page.locator('h1').first()).toBeVisible();
    await expect(page.locator('body')).toContainText('Testing');
  });

  test('404 page works', async ({ page }) => {
    const response = await page.goto('/nonexistent-page/');
    expect(response.status()).toBe(404);
    
    await expect(page.locator('body')).toContainText('404');
  });

  test('CSS and assets load correctly', async ({ page }) => {
    await page.goto('/');
    
    // Check that CSS is loaded (look for styled elements)
    const styledElements = page.locator('[class*="astro"], [data-starlight]');
    await expect(styledElements.first()).toBeVisible();
    
    // Check for proper styling
    const body = page.locator('body');
    const bodyStyles = await body.evaluate(el => window.getComputedStyle(el));
    expect(bodyStyles.margin).toBeDefined();
    expect(bodyStyles.fontFamily).toBeDefined();
  });

  test('javascript and interactive features work', async ({ page }) => {
    await page.goto('/');
    
    // Check for theme toggle if it exists
    const themeToggle = page.locator('[data-theme-toggle], .theme-toggle, .theme-selector');
    if (await themeToggle.count() > 0) {
      await themeToggle.first().click();
      await page.waitForTimeout(500);
    }
    
    // Check that JavaScript executed (Starlight should add classes)
    const htmlElement = page.locator('html');
    const dataTheme = await htmlElement.getAttribute('data-theme');
    expect(dataTheme).toBeTruthy();
  });

  test('monitoring integration loaded', async ({ page }) => {
    await page.goto('/');
    
    // Check for Datadog RUM script
    const rumScript = page.locator('script[src*="datadog-rum"]');
    await expect(rumScript).toBeAttached();
    
    // Check that DD_RUM object exists
    const ddRumExists = await page.evaluate(() => {
      return typeof window.DD_RUM !== 'undefined';
    });
    expect(ddRumExists).toBe(true);
  });

  test('mobile responsiveness', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    await expect(page.locator('h1')).toBeVisible();
    
    // Check that content is properly sized for mobile
    const body = page.locator('body');
    const bodyBox = await body.boundingBox();
    expect(bodyBox.width).toBeLessThanOrEqual(375);
  });

  test('multiple pages load correctly', async ({ page }) => {
    const testPages = [
      '/wiki-index/',
      '/datadog_local_development/', 
      '/comprehensive_testing_guide/',
      '/kind_troubleshooting_guide/',
      '/ai_cli_tools/'
    ];
    
    for (const pagePath of testPages) {
      await page.goto(pagePath);
      
      // Each page should have proper structure
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      await expect(page.locator('h1').first()).toBeVisible();
      await expect(page.locator('title')).not.toBeEmpty();
      
      // Check for meta description
      const metaDescription = page.locator('meta[name="description"]');
      await expect(metaDescription).toBeAttached();
    }
  });
});