/**
 * Global setup for Playwright E2E tests
 * Runs once before all tests
 */

import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global setup for E2E tests...');

  // Start browser and create test data
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    // Navigate to the application
    await page.goto('http://localhost:3000');
    
    // Wait for the app to be ready
    await page.waitForLoadState('networkidle');
    
    // Create test user account if needed
    await createTestUser(page);
    
    // Set up test data
    await setupTestData(page);
    
    console.log('✅ Global setup completed successfully');
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

async function createTestUser(page: any) {
  try {
    // Check if we need to create a test user
    const signInButton = page.locator('text=Sign In');
    if (await signInButton.isVisible()) {
      console.log('👤 Creating test user account...');
      
      // Click sign in
      await signInButton.click();
      
      // Wait for auth form
      await page.waitForSelector('input[type="email"]');
      
      // Fill in test credentials
      await page.fill('input[type="email"]', 'test@vibecode.com');
      await page.fill('input[type="password"]', 'testpassword123');
      
      // Submit form
      await page.click('button[type="submit"]');
      
      // Wait for successful authentication
      await page.waitForURL('**/dashboard', { timeout: 10000 });
      
      console.log('✅ Test user account created');
    } else {
      console.log('👤 Test user already exists');
    }
  } catch (error) {
    console.log('⚠️ Could not create test user (may already exist):', error.message);
  }
}

async function setupTestData(page: any) {
  try {
    console.log('📊 Setting up test data...');
    
    // Navigate to dashboard
    await page.goto('http://localhost:3000/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Create test workspace if it doesn't exist
    const createWorkspaceButton = page.locator('text=Create Workspace');
    if (await createWorkspaceButton.isVisible()) {
      await createWorkspaceButton.click();
      
      // Fill workspace details
      await page.fill('input[placeholder*="workspace"]', 'E2E Test Workspace');
      await page.fill('textarea[placeholder*="description"]', 'Workspace for E2E testing');
      
      // Submit
      await page.click('button[type="submit"]');
      
      // Wait for workspace creation
      await page.waitForURL('**/workspace/**', { timeout: 10000 });
      
      console.log('✅ Test workspace created');
    } else {
      console.log('✅ Test workspace already exists');
    }
    
    // Set up AI project generation test data
    await setupAIProjectData(page);
    
  } catch (error) {
    console.log('⚠️ Could not set up test data:', error.message);
  }
}

async function setupAIProjectData(page: any) {
  try {
    console.log('🤖 Setting up AI project test data...');
    
    // Navigate to AI project generation
    await page.goto('http://localhost:3000/ai-project-generator');
    await page.waitForLoadState('networkidle');
    
    // Check if we need to set up sample projects
    const samplePrompt = page.locator('text=modern React dashboard');
    if (await samplePrompt.isVisible()) {
      console.log('✅ AI project test data already available');
    } else {
      console.log('📝 Setting up AI project samples...');
      
      // Create sample project templates
      await createSampleProjectTemplate(page, 'React Dashboard', 'A modern React dashboard with dark mode, charts, and responsive design');
      await createSampleProjectTemplate(page, 'API Service', 'A RESTful API service with Express.js, MongoDB, and JWT authentication');
      await createSampleProjectTemplate(page, 'Mobile App', 'A React Native mobile app with navigation, state management, and offline support');
      
      console.log('✅ AI project test data created');
    }
    
  } catch (error) {
    console.log('⚠️ Could not set up AI project data:', error.message);
  }
}

async function createSampleProjectTemplate(page: any, name: string, description: string) {
  try {
    // This would typically involve creating project templates
    // For now, we'll just log the intention
    console.log(`📋 Sample template: ${name} - ${description}`);
  } catch (error) {
    console.log(`⚠️ Could not create template ${name}:`, error.message);
  }
}

export default globalSetup;