/**
 * Core Web Vitals Performance Test Suite
 * Validates LCP, FID, CLS, INP metrics against targets
 *
 * NOTE: This is a Playwright E2E test - skip in Jest
 */

// Skip this test file in Jest - it requires Playwright/browser environment
if (typeof jest !== 'undefined') {
  describe.skip('Core Web Vitals - Playwright E2E Tests', () => {
    test('skipped in Jest environment - run with Playwright', () => {
      expect(true).toBe(true)
    })
  })
  // Exit early to avoid importing Playwright in Jest
  // @ts-ignore
  module.exports = {}
} else {
  // Only import Playwright when running with Playwright
  const playwright = require('@playwright/test')
  const test = playwright.test
  const expect = playwright.expect

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'

// Core Web Vitals Thresholds
const THRESHOLDS = {
  LCP: 2500, // Largest Contentful Paint (ms)
  FID: 100,  // First Input Delay (ms)
  CLS: 0.1,  // Cumulative Layout Shift
  INP: 200,  // Interaction to Next Paint (ms)
  FCP: 1500, // First Contentful Paint (ms)
  TTI: 3500, // Time to Interactive (ms)
  TBT: 200,  // Total Blocking Time (ms)
}

test.describe('Core Web Vitals', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to home page
    await page.goto(BASE_URL)
  })

  test('should meet LCP target (<2.5s)', async ({ page }) => {
    // Measure Largest Contentful Paint
    const lcp = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          const lastEntry = entries[entries.length - 1] as any
          resolve(lastEntry?.renderTime || lastEntry?.loadTime || 0)
        })
        observer.observe({ type: 'largest-contentful-paint', buffered: true })

        // Timeout after 10 seconds
        setTimeout(() => resolve(0), 10000)
      })
    })

    console.log(`LCP: ${lcp.toFixed(0)}ms`)
    expect(lcp).toBeLessThan(THRESHOLDS.LCP)
    expect(lcp).toBeGreaterThan(0)
  })

  test('should meet FID target (<100ms)', async ({ page }) => {
    // Measure First Input Delay
    const fid = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          const firstEntry = entries[0] as any
          resolve(firstEntry?.processingStart - firstEntry?.startTime || 0)
        })
        observer.observe({ type: 'first-input', buffered: true })

        // Trigger input
        document.body.click()

        // Timeout after 5 seconds
        setTimeout(() => resolve(0), 5000)
      })
    })

    console.log(`FID: ${fid.toFixed(0)}ms`)
    if (fid > 0) {
      expect(fid).toBeLessThan(THRESHOLDS.FID)
    }
  })

  test('should meet CLS target (<0.1)', async ({ page }) => {
    // Measure Cumulative Layout Shift
    await page.waitForLoadState('networkidle')

    const cls = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let clsScore = 0
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!(entry as any).hadRecentInput) {
              clsScore += (entry as any).value
            }
          }
        })
        observer.observe({ type: 'layout-shift', buffered: true })

        // Wait for layout to stabilize
        setTimeout(() => resolve(clsScore), 3000)
      })
    })

    console.log(`CLS: ${cls.toFixed(3)}`)
    expect(cls).toBeLessThan(THRESHOLDS.CLS)
  })

  test('should meet FCP target (<1.5s)', async ({ page }) => {
    // Measure First Contentful Paint
    const fcp = await page.evaluate(() => {
      const entry = performance.getEntriesByName('first-contentful-paint')[0]
      return entry?.startTime || 0
    })

    console.log(`FCP: ${fcp.toFixed(0)}ms`)
    expect(fcp).toBeLessThan(THRESHOLDS.FCP)
    expect(fcp).toBeGreaterThan(0)
  })

  test('should meet TTI target (<3.5s)', async ({ page }) => {
    // Wait for page to be interactive
    await page.waitForLoadState('domcontentloaded')

    const tti = await page.evaluate(() => {
      return performance.timing.domInteractive - performance.timing.navigationStart
    })

    console.log(`TTI: ${tti.toFixed(0)}ms`)
    expect(tti).toBeLessThan(THRESHOLDS.TTI)
  })
})

test.describe('Performance - Route-Specific', () => {
  const routes = [
    { path: '/', name: 'Home' },
    { path: '/monitoring', name: 'Monitoring' },
    { path: '/marketplace', name: 'Marketplace' },
  ]

  routes.forEach(({ path, name }) => {
    test(`${name} route should load quickly`, async ({ page }) => {
      const startTime = Date.now()
      await page.goto(`${BASE_URL}${path}`)
      await page.waitForLoadState('networkidle')
      const loadTime = Date.now() - startTime

      console.log(`${name} load time: ${loadTime}ms`)
      expect(loadTime).toBeLessThan(5000) // 5 second max
    })
  })
})

test.describe('Performance - Interaction', () => {
  test('should respond to user input quickly (<200ms INP)', async ({ page }) => {
    await page.goto(BASE_URL)

    // Measure Interaction to Next Paint
    const inp = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          const lastEntry = entries[entries.length - 1] as any
          resolve(lastEntry?.duration || 0)
        })
        observer.observe({ type: 'event', buffered: true })

        // Trigger interaction
        const button = document.querySelector('button')
        if (button) {
          button.click()
        }

        setTimeout(() => resolve(0), 2000)
      })
    })

    console.log(`INP: ${inp.toFixed(0)}ms`)
    if (inp > 0) {
      expect(inp).toBeLessThan(THRESHOLDS.INP)
    }
  })

  test('should handle scrolling smoothly', async ({ page }) => {
    await page.goto(BASE_URL)

    // Measure scroll performance
    const scrollPerf = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let frameCount = 0
        let startTime = performance.now()

        function countFrame() {
          frameCount++
          if (performance.now() - startTime < 1000) {
            requestAnimationFrame(countFrame)
          } else {
            resolve(frameCount)
          }
        }

        // Start scrolling
        window.scrollBy(0, 1000)
        requestAnimationFrame(countFrame)
      })
    })

    // Should maintain ~60fps (60 frames in 1 second)
    console.log(`Scroll FPS: ${scrollPerf}`)
    expect(scrollPerf).toBeGreaterThan(50) // Allow for some variance
  })
})

test.describe('Performance - Resource Loading', () => {
  test('should load critical resources first', async ({ page }) => {
    const resources = await page.goto(BASE_URL).then(() =>
      page.evaluate(() => {
        return performance.getEntriesByType('resource').map((entry: any) => ({
          name: entry.name,
          type: entry.initiatorType,
          duration: entry.duration,
          size: entry.transferSize
        }))
      })
    )

    // Check that critical resources load quickly
    const criticalResources = resources.filter((r: any) =>
      r.type === 'script' || r.type === 'css'
    )

    const slowResources = criticalResources.filter((r: any) => r.duration > 1000)
    console.log('Slow critical resources:', slowResources)

    expect(slowResources.length).toBeLessThan(2) // Max 1 slow critical resource
  })

  test('should optimize image loading', async ({ page }) => {
    await page.goto(BASE_URL)

    const images = await page.evaluate(() => {
      return Array.from(document.images).map(img => ({
        src: img.src,
        width: img.naturalWidth,
        height: img.naturalHeight,
        loading: img.loading
      }))
    })

    // Check that images use lazy loading
    const aboveFoldImages = images.slice(0, 3) // First 3 images
    const belowFoldImages = images.slice(3)

    // Above-fold images should not be lazy
    aboveFoldImages.forEach(img => {
      expect(img.loading).not.toBe('lazy')
    })

    // Below-fold images should be lazy
    belowFoldImages.forEach(img => {
      expect(img.loading).toBe('lazy')
    })
  })
})
}
