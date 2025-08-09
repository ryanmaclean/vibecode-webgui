/**
 * Global setup for Playwright E2E tests
 * Sets up test database, users, and environment
 */

import { chromium, FullConfig } from '@playwright/test'
import { execSync } from 'child_process'
import path from 'path'

async function globalSetup(config: FullConfig) {
  console.log('🚀 Setting up E2E test environment...')
  
  const testDatabaseUrl = process.env.TEST_DATABASE_URL || 'postgresql://postgres:password@localhost:5432/vibecode_test'
  const testRedisUrl = process.env.TEST_REDIS_URL || 'redis://localhost:6379/1'
  
  try {
    // 1. Setup test database
    console.log('📊 Setting up test database...')
    process.env.DATABASE_URL = testDatabaseUrl
    process.env.REDIS_URL = testRedisUrl
    process.env.NODE_ENV = 'test'
    
    // Run database migrations
    try {
      execSync('npx prisma migrate deploy', { 
        stdio: 'inherit',
        cwd: path.resolve(process.cwd())
      })
      console.log('✅ Database migrations completed')
    } catch (error) {
      console.warn('⚠️  Database migration failed, continuing with existing schema')
    }
    
    // Seed test data
    try {
      execSync('npx prisma db seed', { 
        stdio: 'inherit',
        cwd: path.resolve(process.cwd())
      })
      console.log('✅ Database seeded with test data')
    } catch (error) {
      console.warn('⚠️  Database seeding failed, tests will use dynamic data')
    }
    
    // 2. Setup test authentication
    console.log('🔐 Setting up test authentication...')
    const browser = await chromium.launch()
    const context = await browser.newContext()
    const page = await context.newPage()
    
    // Create test user session if needed
    try {
      await page.goto('http://localhost:3000/api/auth/test-setup', { 
        waitUntil: 'networkidle',
        timeout: 10000 
      })
      console.log('✅ Test authentication setup completed')
    } catch (error) {
      console.log('ℹ️  Test authentication endpoint not available')
    }
    
    await browser.close()
    
    // 3. Clear Redis test cache
    console.log('🧹 Clearing test caches...')
    try {
      const redis = require('redis')
      const client = redis.createClient({ url: testRedisUrl })
      await client.connect()
      await client.flushDb()
      await client.quit()
      console.log('✅ Test cache cleared')
    } catch (error) {
      console.log('ℹ️  Redis not available for cache clearing')
    }
    
    // 4. Setup test directories
    console.log('📁 Setting up test directories...')
    const fs = require('fs')
    const testDirs = [
      'test-uploads',
      'test-workspaces', 
      'test-projects',
      'test-results'
    ]
    
    testDirs.forEach(dir => {
      const fullPath = path.join(process.cwd(), dir)
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true })
      }
    })
    
    console.log('✅ E2E test environment setup complete!')
    
  } catch (error) {
    console.error('❌ Failed to setup E2E test environment:', error)
    throw error
  }
}

export default globalSetup