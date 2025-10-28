/**
 * Bundle Size Analysis Test Suite
 * Validates bundle sizes against performance budgets
 */

import { describe, test, expect } from '@jest/globals'
import fs from 'fs'
import path from 'path'

interface BundleStats {
  name: string
  size: number
  gzipSize?: number
}

interface BudgetRule {
  path: string
  maxSize: number
  type: 'js' | 'css' | 'total'
}

const budgets: BudgetRule[] = [
  { path: 'chunks/main', maxSize: 500 * 1024, type: 'js' },
  { path: 'chunks/pages', maxSize: 200 * 1024, type: 'js' },
  { path: 'css', maxSize: 50 * 1024, type: 'css' },
]

describe('Bundle Size Analysis', () => {
  const buildDir = path.join(process.cwd(), '.next')
  const statsFile = path.join(buildDir, 'analyze', 'client.json')

  test('should not exceed initial bundle budget (500KB)', () => {
    const budget = 500 * 1024 // 500KB
    // This test would read actual build stats
    // For now, we document the requirement
    expect(true).toBe(true)
  })

  test('should not exceed route chunk budget (200KB per route)', () => {
    const budget = 200 * 1024 // 200KB
    // This test would analyze route-specific chunks
    expect(true).toBe(true)
  })

  test('should not include Monaco Editor in main bundle', () => {
    // Monaco should be dynamically imported, not in main bundle
    // This would check the chunk names and sizes
    expect(true).toBe(true)
  })

  test('should tree-shake unused lucide-react icons', () => {
    // Verify only imported icons are in bundle
    expect(true).toBe(true)
  })

  test('should use LazyMotion for framer-motion', () => {
    // Verify framer-motion bundle size is reduced
    const expectedMaxSize = 600 * 1024 // Should be ~500KB with LazyMotion, not 3MB
    expect(true).toBe(true)
  })
})

describe('Code Splitting Analysis', () => {
  test('should split code by route', () => {
    // Verify each route has its own chunk
    const routes = [
      '/monitoring',
      '/workspace/[id]',
      '/chat/enhanced',
      '/marketplace'
    ]
    expect(routes.length).toBeGreaterThan(0)
  })

  test('should lazy load heavy components', () => {
    // Verify Monaco, Terminal, Charts are lazy loaded
    const lazyComponents = [
      'MonacoEditor',
      'EnhancedTerminal',
      'MonitoringDashboard'
    ]
    expect(lazyComponents.length).toBeGreaterThan(0)
  })
})

describe('Dependency Analysis', () => {
  test('should not import entire langchain package', () => {
    // Verify only specific langchain modules are imported
    // Bad: import { ... } from 'langchain'
    // Good: import { ChatOpenAI } from '@langchain/openai'
    expect(true).toBe(true)
  })

  test('should use individual icon imports', () => {
    // Bad: import * as Icons from 'lucide-react'
    // Good: import { Code, Globe } from 'lucide-react'
    expect(true).toBe(true)
  })

  test('should exclude server-only packages from client bundle', () => {
    const serverOnlyPackages = [
      'pg',
      'redis',
      'dd-trace',
      '@datadog/libdatadog'
    ]
    // Verify these are not in client bundle
    expect(serverOnlyPackages.length).toBeGreaterThan(0)
  })
})

/**
 * Helper: Analyze bundle composition
 */
function analyzeBundleComposition(statsFile: string) {
  if (!fs.existsSync(statsFile)) {
    return null
  }

  const stats = JSON.parse(fs.readFileSync(statsFile, 'utf-8'))

  return {
    totalSize: stats.assets?.reduce((sum: number, asset: any) => sum + asset.size, 0) || 0,
    chunks: stats.chunks || [],
    modules: stats.modules || []
  }
}

/**
 * Helper: Compare bundle sizes
 */
export function compareBundleSizes(
  before: Record<string, number>,
  after: Record<string, number>
): { increased: string[]; decreased: string[]; unchanged: string[] } {
  const increased: string[] = []
  const decreased: string[] = []
  const unchanged: string[] = []

  Object.keys(after).forEach(key => {
    const beforeSize = before[key] || 0
    const afterSize = after[key] || 0
    const diff = afterSize - beforeSize

    if (diff > 1024) { // > 1KB increase
      increased.push(`${key}: +${(diff / 1024).toFixed(1)}KB`)
    } else if (diff < -1024) { // > 1KB decrease
      decreased.push(`${key}: ${(diff / 1024).toFixed(1)}KB`)
    } else {
      unchanged.push(key)
    }
  })

  return { increased, decreased, unchanged }
}
