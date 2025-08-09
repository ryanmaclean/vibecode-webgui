/**
 * Global teardown for Playwright E2E tests
 * Cleans up test data and environment
 */

import { FullConfig } from '@playwright/test'
import path from 'path'
import { promises as fs } from 'fs'

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Cleaning up E2E test environment...')
  
  try {
    // 1. Clear test database
    console.log('🗑️  Clearing test database...')
    const testDatabaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL
    
    if (testDatabaseUrl?.includes('_test')) {
      try {
        // Only clean if it's clearly a test database
        const { PrismaClient } = require('@prisma/client')
        const prisma = new PrismaClient({
          datasources: { db: { url: testDatabaseUrl } }
        })
        
        // Delete test data in proper order (respecting foreign keys)
        await prisma.aIRequest.deleteMany()
        await prisma.rAGChunk.deleteMany() 
        await prisma.file.deleteMany()
        await prisma.project.deleteMany()
        await prisma.workspace.deleteMany()
        await prisma.session.deleteMany()
        await prisma.user.deleteMany({ 
          where: { 
            email: { contains: 'test' }
          }
        })
        
        await prisma.$disconnect()
        console.log('✅ Test database cleaned')
      } catch (error) {
        console.warn('⚠️  Database cleanup failed:', error.message)
      }
    }
    
    // 2. Clear Redis test cache
    console.log('🧹 Clearing test caches...')
    try {
      const redis = require('redis')
      const testRedisUrl = process.env.TEST_REDIS_URL || 'redis://localhost:6379/1'
      const client = redis.createClient({ url: testRedisUrl })
      await client.connect()
      await client.flushDb()
      await client.quit()
      console.log('✅ Test cache cleared')
    } catch (error) {
      console.log('ℹ️  Redis cleanup skipped')
    }
    
    // 3. Remove test directories
    console.log('📁 Removing test directories...')
    const testDirs = [
      'test-uploads',
      'test-workspaces', 
      'test-projects'
    ]
    
    for (const dir of testDirs) {
      const fullPath = path.join(process.cwd(), dir)
      try {
        await fs.rmdir(fullPath, { recursive: true })
        console.log(`✅ Removed ${dir}`)
      } catch (error) {
        console.log(`ℹ️  Could not remove ${dir}`)
      }
    }
    
    // 4. Clear temporary test files
    console.log('🗑️  Clearing temporary files...')
    const tempPaths = [
      'playwright-report/temp',
      'test-results/temp',
      '.next/cache/test'
    ]
    
    for (const tempPath of tempPaths) {
      try {
        await fs.rmdir(path.join(process.cwd(), tempPath), { recursive: true })
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    
    console.log('✅ E2E test environment cleanup complete!')
    
  } catch (error) {
    console.error('❌ Failed to cleanup E2E test environment:', error)
    // Don't throw - cleanup failures shouldn't fail the test run
  }
}

export default globalTeardown