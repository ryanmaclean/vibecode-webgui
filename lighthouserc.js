/**
 * Lighthouse CI Configuration
 * Enhanced performance monitoring with strict budgets
 */

module.exports = {
  ci: {
    collect: {
      url: [
        'http://localhost:3000',
        'http://localhost:3000/monitoring',
        'http://localhost:3000/marketplace',
        'http://localhost:3000/workspace/test',
      ],
      numberOfRuns: 5, // Run 5 times and average
      settings: {
        preset: 'desktop',
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
        skipAudits: ['uses-http2'], // Skip HTTP/2 for local testing
        throttling: {
          rttMs: 40,
          throughputKbps: 10240,
          cpuSlowdownMultiplier: 1, // No CPU throttling for desktop
          requestLatencyMs: 0,
          downloadThroughputKbps: 0,
          uploadThroughputKbps: 0,
        },
        // Load budget configuration
        budgets: require('./budget.json').budgets,
      },
    },
    assert: {
      preset: 'lighthouse:recommended',
      assertions: {
        // Core Web Vitals
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.85 }],
        'categories:seo': ['error', { minScore: 0.85 }],

        // Performance Metrics
        'first-contentful-paint': ['error', { maxNumericValue: 1500 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['error', { maxNumericValue: 200 }],
        'interactive': ['error', { maxNumericValue: 3500 }],
        'speed-index': ['error', { maxNumericValue: 3000 }],
        'max-potential-fid': ['error', { maxNumericValue: 100 }],

        // Resource Optimization
        'uses-optimized-images': 'warn',
        'uses-webp-images': 'warn',
        'uses-text-compression': 'error',
        'uses-responsive-images': 'warn',
        'offscreen-images': 'warn',
        'unminified-css': 'error',
        'unminified-javascript': 'error',
        'unused-css-rules': 'warn',
        'unused-javascript': 'warn',

        // Loading Performance
        'render-blocking-resources': 'warn',
        'bootup-time': ['warn', { maxNumericValue: 3000 }],
        'mainthread-work-breakdown': ['warn', { maxNumericValue: 4000 }],
        'dom-size': ['warn', { maxNumericValue: 1500 }],

        // Network Performance
        'network-requests': 'off', // Don't fail on request count
        'network-rtt': 'off',
        'network-server-latency': 'off',
        'uses-long-cache-ttl': 'warn',
        'uses-rel-preconnect': 'warn',
        'uses-rel-preload': 'warn',

        // Accessibility
        'color-contrast': 'error',
        'button-name': 'error',
        'image-alt': 'error',
        'link-name': 'error',
        'aria-valid-attr': 'error',
        'aria-required-attr': 'error',

        // Best Practices
        'errors-in-console': 'warn',
        'no-vulnerable-libraries': 'error',
        'uses-http2': 'off',
        'uses-passive-event-listeners': 'warn',
        'no-document-write': 'error',
        'doctype': 'error',
      },
    },
    upload: {
      target: 'temporary-public-storage',
      // Alternative: Store results in Datadog
      // target: 'datadog',
      // token: process.env.DD_API_KEY,
    },
  },
}
