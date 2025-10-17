# Performance Testing Guide

## Overview

This guide covers the comprehensive performance testing infrastructure for VibeCode Web GUI, implementing the requirements from Issue #77.

## Performance Testing Infrastructure

### 1. Automated Performance Testing ✅

#### Jest-Based Performance Tests

Run comprehensive load testing and system metrics validation:

```bash
# Run all Jest performance tests
npm run test:performance:jest

# Run in CI mode (optimized for CI/CD)
npm run test:performance:jest:ci

# Run all performance tests (Jest + Lighthouse + Datadog)
npm run test:performance:all
```

**Existing Test Suites:**
- `tests/performance/load-testing.test.ts` - Load testing with concurrent requests
- `tests/performance/system-metrics-validation.test.ts` - System metrics validation
- `tests/performance/performance-regression.test.ts` - Regression detection

#### Lighthouse Performance Audits

```bash
# Run Lighthouse CI
npm run test:performance:lighthouse

# Results include:
# - Performance score
# - First Contentful Paint (FCP)
# - Largest Contentful Paint (LCP)
# - Time to Interactive (TTI)
# - Total Blocking Time (TBT)
# - Cumulative Layout Shift (CLS)
```

#### Datadog Synthetic Monitoring

```bash
# Run Datadog synthetic tests
npm run test:performance:synthetic

# Required environment variables:
# - DD_API_KEY
# - DD_APP_KEY
```

### 2. Performance Budgets 🎯

Performance budgets are defined in `performance-budget.json`:

```json
{
  "budgets": {
    "build": { "time": 15000 },           // 15 seconds
    "pageLoad": { "time": 2000 },         // 2 seconds
    "api": {
      "responseTime": {
        "p50": 500,                       // 500ms
        "p90": 1000,                      // 1 second
        "p95": 1500                       // 1.5 seconds
      }
    },
    "memory": { "usage": 1073741824 },    // 1GB
    "bundle": {
      "totalSize": 524288,                // 500KB
      "jsChunkSize": 512000,              // 500KB
      "cssSize": 102400                   // 100KB
    },
    "lighthouse": {
      "performance": 70,
      "accessibility": 90,
      "bestPractices": 80,
      "seo": 80
    },
    "webVitals": {
      "fcp": 1800,                        // First Contentful Paint
      "lcp": 2500,                        // Largest Contentful Paint
      "fid": 100,                         // First Input Delay
      "cls": 0.1,                         // Cumulative Layout Shift
      "ttfb": 600                         // Time to First Byte
    }
  }
}
```

**Enforce Performance Budgets:**

```bash
# Check performance budgets
npm run performance:budget:check

# The script validates:
# - Build times
# - Bundle sizes
# - API response times
# - Lighthouse scores
# - Core Web Vitals
```

### 3. CI/CD Integration ✅

Performance tests run automatically in GitHub Actions on:
- Pull requests to `main`
- Pushes to `main`
- Daily scheduled runs (6 AM UTC)

**Workflow Jobs:**

1. **Bundle Analysis** - Validates bundle sizes
2. **Lighthouse CI** - Measures performance scores
3. **Core Web Vitals** - Validates user experience metrics
4. **Jest Performance Tests** - Runs load and system tests
5. **Performance Regression** - Detects regressions
6. **Performance Summary** - Generates comprehensive report

**Performance Gates:**

The CI pipeline will fail if:
- Any performance budget is exceeded
- Performance regression > 10% from baseline
- Lighthouse performance score < 70
- Core Web Vitals exceed thresholds

### 4. Performance Regression Detection ✅

Automatic regression detection compares current performance against:
- Performance budgets (defined thresholds)
- Historical baselines (when available)

**Regression Tolerance:** 10% (configurable in `performance-budget.json`)

```javascript
// Example: Detecting API response time regression
{
  "type": "api_p95",
  "budget": 1500,
  "actual": 1650,
  "difference": 150,
  "message": "API p95 response time 1650ms exceeds budget of 1500ms"
}
```

### 5. Real User Monitoring (RUM)

#### Browser Performance Metrics

Core Web Vitals are automatically tracked:

```typescript
// Tracked metrics:
- First Contentful Paint (FCP)
- Largest Contentful Paint (LCP)
- First Input Delay (FID)
- Cumulative Layout Shift (CLS)
- Time to First Byte (TTFB)
```

#### Datadog RUM Integration

Datadog Real User Monitoring is configured in the application for:
- Page load times
- User interactions
- Error tracking
- Session replay

### 6. Performance Test Utilities

Custom utilities are available in performance tests:

```javascript
// Measure async function execution
const { result, duration } = await performanceUtils.measureAsync(async () => {
  return await fetch('/api/endpoint');
});

// Run concurrent requests
const stats = await performanceUtils.runConcurrent(
  () => fetch('/api/endpoint'),
  100 // number of concurrent requests
);
// Returns: { total, successful, failed, successRate, duration, avgDuration }

// Calculate percentiles
const percentiles = performanceUtils.calculatePercentiles([100, 200, 300, ...]);
// Returns: { p50, p75, p90, p95, p99, min, max, avg }
```

### 7. Custom Jest Matchers

Performance-specific Jest matchers:

```typescript
// Check if duration is within budget
expect(duration).toBeWithinPerformanceBudget(2000); // 2 seconds

// Check success rate
expect(successRate).toHaveAcceptableSuccessRate(0.95); // 95%
```

## Performance Targets

| Metric | Target | Current Status |
|--------|--------|---------------|
| Build Time | < 15s | ✅ 13.0s |
| Page Load | < 2s | 🔍 Monitored |
| API Response (p50) | < 500ms | ✅ 285ms |
| API Response (p90) | < 1000ms | 🔍 Monitored |
| Memory Usage | < 1GB | 🔍 Monitored |
| Bundle Size | < 500KB | 🔍 Enforced |
| Lighthouse Performance | > 70 | 🔍 Enforced |

## Running Tests Locally

### Prerequisites

1. Start the application:
```bash
npm run build
npm start
```

2. Application should be accessible at `http://localhost:3000`

### Run Individual Test Suites

```bash
# Jest performance tests
npm run test:performance:jest

# Load testing
npm test tests/performance/load-testing.test.ts

# System metrics validation
npm test tests/performance/system-metrics-validation.test.ts

# Performance regression tests
npm test tests/performance/performance-regression.test.ts

# Core Web Vitals
npm run test:e2e tests/performance/core-web-vitals.test.ts
```

### Run Complete Performance Test Suite

```bash
# Run all performance tests
npm run test:performance:all

# Results will be saved to:
# - ./performance-results/ - Performance metrics
# - ./test-results/ - JUnit XML results
# - ./.lighthouseci/ - Lighthouse reports
```

## Monitoring and Reporting

### CI Artifacts

After each CI run, the following artifacts are available:
- `bundle-analysis` - Bundle size reports
- `lighthouse-results` - Lighthouse CI results
- `performance-test-results` - Playwright test results
- `jest-performance-results` - Jest test results

### Performance Summary

On pull requests, a comprehensive performance summary is posted as a comment, including:
- Bundle analysis
- Lighthouse scores
- Core Web Vitals
- Jest test results
- Performance budget status

### Real-Time Monitoring

```bash
# Check current performance metrics
npm run performance:monitor

# Sample output:
{
  "responseTime": 285,
  "throughput": 850,
  "errorRate": 0.5,
  "cpuUsage": 45,
  "memoryUsage": 512
}
```

## Troubleshooting

### Tests Failing Locally

1. Ensure application is running on port 3000
2. Check that all endpoints are accessible
3. Verify system has sufficient resources

### CI Failures

1. Check performance budget violations in artifacts
2. Review regression detection output
3. Verify all jobs completed successfully

### Performance Degradation

1. Check bundle size increases
2. Review API response time trends
3. Analyze Lighthouse score changes
4. Check for memory leaks in load tests

## Best Practices

1. **Run tests before pushing** - Catch regressions early
2. **Monitor trends** - Track performance over time
3. **Set realistic budgets** - Balance performance vs features
4. **Profile before optimizing** - Measure, don't guess
5. **Test under load** - Simulate production traffic

## Next Steps

- [ ] Set up historical baseline storage
- [ ] Configure Datadog dashboards
- [ ] Add database query performance monitoring
- [ ] Implement Kubernetes resource monitoring
- [ ] Add cache hit rate tracking

## Related Documentation

- [CI/CD Testing Guide](./CI_TESTING.md)
- [Performance Optimization Guide](../claudedocs/PERFORMANCE_OPTIMIZATION_GUIDE.md)
- [Agent Performance Analysis](../claudedocs/AGENTAPI_PERFORMANCE_ANALYSIS.md)
- [GitHub Actions Workflow](./.github/workflows/performance-testing.yml)

## Issue Tracking

This implementation addresses Issue #77: "Performance: Add performance testing and monitoring"

See the issue for acceptance criteria and implementation status.
