/**
 * Global setup for Playwright tests
 * This runs once before all tests start
 */

import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  const { baseURL } = config.projects[0].use;
  
  console.log('🚀 Starting global setup...');
  console.log(`📍 Base URL: ${baseURL}`);
  
  // Start browser to check if the app is accessible
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // Wait for the app to be ready
    console.log('⏳ Waiting for application to be ready...');
    
    // Try to access the health endpoint first
    await page.goto(`${baseURL}/api/health`);
    await page.waitForLoadState('networkidle');
    
    // Check if we get a valid response
    const response = await page.waitForResponse(`${baseURL}/api/health`);
    if (response.ok()) {
      console.log('✅ Health endpoint is accessible');
    } else {
      console.log('⚠️ Health endpoint returned non-200 status');
    }
    
    // Navigate to the main page
    await page.goto(baseURL!);
    await page.waitForLoadState('networkidle');
    
    // Wait for the app to be fully loaded
    await page.waitForSelector('body', { timeout: 30000 });
    
    console.log('✅ Application is ready for testing');
    
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
  
  console.log('🎯 Global setup completed successfully');
}

export default globalSetup;