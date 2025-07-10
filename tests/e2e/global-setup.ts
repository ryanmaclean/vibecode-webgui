/**
 * Global setup for Playwright E2E tests
 * Runs before all tests
 */
import { chromium, FullConfig } from '@playwright/test'

async function globalSetup(config: FullConfig) {
  const { baseURL } = config.projects[0].use
  
  console.log('🚀 Starting E2E test setup...')
  
  // Launch browser for setup
  const browser = await chromium.launch()
  const page = await browser.newPage()
  
  try {
    // Wait for the development server to be ready
    console.log(`⏳ Waiting for server at ${baseURL}`)
    
    let retries = 30
    while (retries > 0) {
      try {
        const response = await page.goto(baseURL!)
        if (response && response.ok()) {
          console.log('✅ Development server is ready')
          break
        }
      } catch (error) {
        retries--
        if (retries === 0) {
          throw new Error(`Server at ${baseURL} did not start in time`)
        }
        await page.waitForTimeout(2000)
      }
    }
    
    // Set up test data if needed
    console.log('📝 Setting up test data...')
    
    // You can add authentication setup here
    // For example, create test users, set up test projects, etc.
    
    console.log('✅ E2E test setup completed')
    
  } catch (error) {
    console.error('❌ E2E test setup failed:', error)
    throw error
  } finally {
    await browser.close()
  }
}

export default globalSetup