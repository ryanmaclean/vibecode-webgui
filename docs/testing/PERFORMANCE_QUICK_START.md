# Performance Testing & Monitoring - Quick Reference

## 🎯 Overview

Comprehensive performance testing and monitoring infrastructure addressing **Issue #77**.

## ✅ Features Implemented

### 1. Automated Performance Testing
- **Jest Performance Tests** - Load testing, system metrics validation, regression detection
- **Lighthouse CI** - Performance scores, Core Web Vitals, accessibility
- **Datadog Synthetics** - Automated end-to-end testing
- **Bundle Analysis** - Size tracking and budget enforcement

### 2. Performance Budgets
- Build time < 15s (current: 13.0s ✅)
- Page load < 2s
- API p50 < 500ms (current: 285ms ✅)
- Bundle size < 500KB
- Lighthouse performance > 70

### 3. Real User Monitoring (RUM)
- **Core Web Vitals** - FCP, LCP, FID, CLS, TTFB, INP
- **Page Load Metrics** - DNS, TCP, TTFB, download, DOM timing
- **User Journeys** - Navigation patterns, feature usage
- **Error Tracking** - JavaScript errors with context

### 4. CI/CD Integration
- Automated tests on every PR and push
- Performance regression detection
- Budget enforcement
- Comprehensive reporting

## 🚀 Quick Start

### Run Performance Tests Locally

```bash
# Install dependencies (if needed)
npm install

# Build the application
npm run build

# Start the server
npm start

# In another terminal, run performance tests
npm run test:performance:jest          # Jest performance tests
npm run test:performance:lighthouse    # Lighthouse audit
npm run test:performance:all          # All tests
```

### Check Performance Budgets

```bash
# Enforce performance budgets
npm run performance:budget:check
```

### Monitor Real User Metrics

```bash
# Get Web Vitals
curl http://localhost:3000/api/monitoring/web-vitals | jq

# Get user journeys
curl http://localhost:3000/api/monitoring/user-journey | jq

# Get page load metrics
curl http://localhost:3000/api/monitoring/page-load | jq
```

## 📊 CI/CD Workflow

Performance tests run automatically in GitHub Actions:

1. **Bundle Analysis** - Validates bundle sizes
2. **Lighthouse CI** - Measures performance scores
3. **Core Web Vitals** - Validates user experience
4. **Jest Performance Tests** - Load and system validation
5. **Regression Detection** - Compares against budgets
6. **Summary Report** - Posted to PR

### Performance Gates

Pull requests fail if:
- Performance budget exceeded
- Regression > 10% from baseline
- Lighthouse score < 70
- Core Web Vitals exceed thresholds

## 📈 Performance Targets

| Metric | Target | Current |
|--------|--------|---------|
| Build Time | < 15s | ✅ 13.0s |
| Page Load | < 2s | 🔍 Monitored |
| API Response (p50) | < 500ms | ✅ 285ms |
| Memory Usage | < 1GB | 🔍 Monitored |
| Bundle Size | < 500KB | 🔍 Enforced |
| Lighthouse | > 70 | 🔍 Enforced |

## 📚 Documentation

- [Performance Testing Guide](./PERFORMANCE_TESTING.md) - Complete testing documentation
- [RUM Guide](../../monitoring/RUM.md) - Real User Monitoring setup
- [Performance Budget](../../../performance-budget.json) - Budget configuration
- [CI Testing Guide](./CI_TESTING.md) - CI/CD integration details

## 🔧 Configuration Files

```
vibecode-webgui/
├── performance-budget.json           # Performance budgets
├── jest.performance.config.mjs       # Jest performance config
├── tests/performance-jest.setup.js   # Performance test utilities
├── .github/workflows/
│   └── performance-testing.yml       # CI/CD workflow
├── src/lib/monitoring/
│   └── rum.ts                        # RUM library
└── src/app/api/monitoring/
    ├── web-vitals/                   # Web Vitals API
    ├── user-journey/                 # Journey tracking API
    └── page-load/                    # Page load API
```

## 🎯 Issue #77 Requirements Status

### ✅ Completed

- [x] Automated performance testing in CI
- [x] Performance regression detection
- [x] Browser performance metrics
- [x] Core Web Vitals tracking
- [x] User journey performance
- [x] Error rate monitoring
- [x] Performance budgets enforced

### 🚧 In Progress

- [ ] Kubernetes resource monitoring
- [ ] Database query performance
- [ ] AI API response time monitoring
- [ ] Cache hit rate tracking
- [ ] Performance dashboards
- [ ] Alerting for regressions

## 🛠️ Troubleshooting

### Tests Failing?

1. Ensure application is running: `npm run build && npm start`
2. Check application is accessible at http://localhost:3000
3. Review test output for specific failures
4. Check performance budgets in `performance-budget.json`

### No RUM Data?

1. Verify PerformanceMonitor is added to layout
2. Check browser console for errors
3. Check network tab for API calls
4. Verify endpoints are accessible

## 🔗 Related Links

- **Issue**: #77 - Performance: Add performance testing and monitoring
- **Workflow**: `.github/workflows/performance-testing.yml`
- **Package Scripts**: See `package.json` for all commands

## 📝 Next Steps

1. Set up historical baseline storage
2. Configure Datadog dashboards  
3. Add database query monitoring
4. Implement K8s resource monitoring
5. Add automated alerting
6. Create performance reports

---

**Last Updated**: 2025-10-12
**Status**: Phase 1 & 2 Complete ✅
