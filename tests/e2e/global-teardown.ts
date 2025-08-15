/**
 * Global teardown for Playwright E2E tests
 * Runs once after all tests complete
 */

import { chromium, FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting global teardown for E2E tests...');

  // Start browser for cleanup
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    // Navigate to the application
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    // Clean up test data
    await cleanupTestData(page);

    // Clean up test user if needed
    await cleanupTestUser(page);

    // Clean up test workspaces
    await cleanupTestWorkspaces(page);

    // Clean up test projects
    await cleanupTestProjects(page);

    console.log('✅ Global teardown completed successfully');
  } catch (error) {
    console.error('❌ Global teardown failed:', error);
    // Don't throw error during teardown to avoid masking test failures
  } finally {
    await browser.close();
  }

  // Additional cleanup tasks
  await performSystemCleanup();
}

async function cleanupTestData(page: any) {
  try {
    console.log('🗑️ Cleaning up test data...');
    
    // Navigate to dashboard
    await page.goto('http://localhost:3000/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Look for test data that needs cleanup
    const testItems = page.locator('[data-testid*="test-"], [data-testid*="e2e-"]');
    const count = await testItems.count();
    
    if (count > 0) {
      console.log(`🗑️ Found ${count} test items to clean up`);
      
      // Delete test items
      for (let i = 0; i < count; i++) {
        try {
          const item = testItems.nth(i);
          const deleteButton = item.locator('button[aria-label*="delete"], button[aria-label*="Delete"]');
          
          if (await deleteButton.isVisible()) {
            await deleteButton.click();
            
            // Confirm deletion if confirmation dialog appears
            const confirmButton = page.locator('button:has-text("Delete"), button:has-text("Confirm")');
            if (await confirmButton.isVisible()) {
              await confirmButton.click();
            }
            
            // Wait for deletion to complete
            await page.waitForTimeout(1000);
          }
        } catch (error) {
          console.log(`⚠️ Could not delete test item ${i}:`, error.message);
        }
      }
      
      console.log('✅ Test data cleanup completed');
    } else {
      console.log('✅ No test data found to clean up');
    }
    
  } catch (error) {
    console.log('⚠️ Could not clean up test data:', error.message);
  }
}

async function cleanupTestUser(page: any) {
  try {
    console.log('👤 Cleaning up test user...');
    
    // Navigate to user settings
    await page.goto('http://localhost:3000/settings');
    await page.waitForLoadState('networkidle');
    
    // Look for test user deletion option
    const deleteAccountButton = page.locator('button:has-text("Delete Account"), button[aria-label*="delete account"]');
    
    if (await deleteAccountButton.isVisible()) {
      console.log('🗑️ Deleting test user account...');
      
      await deleteAccountButton.click();
      
      // Confirm deletion
      const confirmButton = page.locator('button:has-text("Delete"), button:has-text("Confirm")');
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }
      
      // Wait for deletion to complete
      await page.waitForURL('**/auth/signin', { timeout: 10000 });
      
      console.log('✅ Test user account deleted');
    } else {
      console.log('✅ No test user account found to delete');
    }
    
  } catch (error) {
    console.log('⚠️ Could not clean up test user:', error.message);
  }
}

async function cleanupTestWorkspaces(page: any) {
  try {
    console.log('🏢 Cleaning up test workspaces...');
    
    // Navigate to workspaces
    await page.goto('http://localhost:3000/workspaces');
    await page.waitForLoadState('networkidle');
    
    // Look for test workspaces
    const testWorkspaces = page.locator('text=E2E Test Workspace, text=Test Workspace');
    const count = await testWorkspaces.count();
    
    if (count > 0) {
      console.log(`🗑️ Found ${count} test workspaces to clean up`);
      
      for (let i = 0; i < count; i++) {
        try {
          const workspace = testWorkspaces.nth(i);
          const deleteButton = workspace.locator('xpath=..').locator('button[aria-label*="delete"]');
          
          if (await deleteButton.isVisible()) {
            await deleteButton.click();
            
            // Confirm deletion
            const confirmButton = page.locator('button:has-text("Delete"), button:has-text("Confirm")');
            if (await confirmButton.isVisible()) {
              await confirmButton.click();
            }
            
            await page.waitForTimeout(1000);
          }
        } catch (error) {
          console.log(`⚠️ Could not delete test workspace ${i}:`, error.message);
        }
      }
      
      console.log('✅ Test workspaces cleanup completed');
    } else {
      console.log('✅ No test workspaces found to clean up');
    }
    
  } catch (error) {
    console.log('⚠️ Could not clean up test workspaces:', error.message);
  }
}

async function cleanupTestProjects(page: any) {
  try {
    console.log('📁 Cleaning up test projects...');
    
    // Navigate to projects
    await page.goto('http://localhost:3000/projects');
    await page.waitForLoadState('networkidle');
    
    // Look for test projects
    const testProjects = page.locator('text=Test Project, text=E2E Project');
    const count = await testProjects.count();
    
    if (count > 0) {
      console.log(`🗑️ Found ${count} test projects to clean up`);
      
      for (let i = 0; i < count; i++) {
        try {
          const project = testProjects.nth(i);
          const deleteButton = project.locator('xpath=..').locator('button[aria-label*="delete"]');
          
          if (await deleteButton.isVisible()) {
            await deleteButton.click();
            
            // Confirm deletion
            const confirmButton = page.locator('button:has-text("Delete"), button:has-text("Confirm")');
            if (await confirmButton.isVisible()) {
              await confirmButton.click();
            }
            
            await page.waitForTimeout(1000);
          }
        } catch (error) {
          console.log(`⚠️ Could not delete test project ${i}:`, error.message);
        }
      }
      
      console.log('✅ Test projects cleanup completed');
    } else {
      console.log('✅ No test projects found to clean up');
    }
    
  } catch (error) {
    console.log('⚠️ Could not clean up test projects:', error.message);
  }
}

async function performSystemCleanup() {
  try {
    console.log('🧹 Performing system cleanup...');
    
    // Clean up test files and directories
    const fs = require('fs');
    const path = require('path');
    
    const testDirs = [
      'test-uploads',
      'test-workspaces',
      'test-projects',
      'test-results',
      'playwright-report'
    ];
    
    testDirs.forEach(dir => {
      const fullPath = path.join(process.cwd(), dir);
      if (fs.existsSync(fullPath)) {
        try {
          fs.rmSync(fullPath, { recursive: true, force: true });
          console.log(`🗑️ Cleaned up ${dir}`);
        } catch (error) {
          console.log(`⚠️ Could not clean up ${dir}:`, error.message);
        }
      }
    });
    
    // Clean up test environment variables
    delete process.env.TEST_USER_EMAIL;
    delete process.env.TEST_USER_PASSWORD;
    delete process.env.TEST_WORKSPACE_ID;
    
    console.log('✅ System cleanup completed');
    
  } catch (error) {
    console.log('⚠️ Could not perform system cleanup:', error.message);
  }
}

export default globalTeardown;