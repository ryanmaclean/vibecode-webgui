# Performance Benchmark Results

This directory contains performance benchmark results for the vibecode-webgui application.

## Directory Structure

```
performance-results/
├── README.md                    # This file
├── run_TIMESTAMP/              # Results from a specific benchmark run
│   ├── SUMMARY.md              # Overall summary of the run
│   ├── db-benchmark-*.md       # Database performance results
│   ├── cache-benchmark-*.md    # Cache performance results
│   ├── api-benchmark-*.md      # API endpoint results (if run)
│   ├── load-test-*.json        # k6 load test results (if run)
│   └── *.log                   # Individual test logs
└── archived/                   # Old results (move here to keep history)
```

## Latest Results

To view the latest benchmark results:

```bash
# List all runs
ls -lt run_*/

# View latest summary
cat $(ls -t run_*/SUMMARY.md | head -1)

# View latest database results
cat $(ls -t run_*/db-benchmark-*.md | head -1)
```

## Running Benchmarks

```bash
# From project root
./scripts/performance/run-all-benchmarks.sh

# Results will be saved to:
# performance-results/run_[TIMESTAMP]/
```

## Understanding Results

Each benchmark run creates a timestamped directory with:

### SUMMARY.md
- Overall test results (passed/failed)
- Links to detailed reports
- Validation status against claimed improvements

### db-benchmark-*.md
- Database query performance
- Connection pool metrics
- Index effectiveness
- Batch operation performance

### cache-benchmark-*.md
- Cache hit/miss rates
- Response time improvements
- Invalidation performance
- TTL validation

### api-benchmark-*.md
- API endpoint response times
- Success rates
- Throughput metrics
- Cache effectiveness

### load-test-*.json
- k6 load test results
- Performance under concurrent load
- Stress test metrics
- Spike recovery behavior

## Claimed Improvements

The benchmarks validate these claimed improvements:

1. **Database Performance:** 40-60% improvement
2. **AI Response Caching:** 50-70% latency reduction
3. **Vector Search Cache:** 80%+ hit rate
4. **Dashboard Load:** 3x faster

See individual benchmark reports for validation results.

## Interpreting Results

### ✅ Good Performance Indicators

- Database queries: P95 < 100ms
- API endpoints: P95 < 500ms
- Cache hit rate: > 70%
- Error rate: < 5%
- Success rate: > 95%

### ⚠️ Warning Signs

- P95 > 1000ms (investigate slow queries)
- Cache hit rate < 50% (review caching strategy)
- Error rate > 5% (check logs for issues)
- Connection pool exhaustion (increase pool size)

### 🚨 Critical Issues

- Error rate > 20% (immediate investigation needed)
- P99 > 5000ms (severe performance degradation)
- Memory leaks during soak test
- System crashes under load

## Comparing Results

To compare different runs:

```bash
# Compare database performance
diff run_20251023_100000/db-benchmark-*.md \
     run_20251023_140000/db-benchmark-*.md

# Extract metrics for comparison
grep "Avg:" run_*/db-benchmark-*.md

# Compare cache hit rates
grep "Cache Hit Rate:" run_*/cache-benchmark-*.md
```

## Archiving Results

To keep the directory clean, move old results to archive:

```bash
# Create archive directory
mkdir -p archived/

# Move results older than 30 days
find . -maxdepth 1 -type d -name "run_*" -mtime +30 -exec mv {} archived/ \;
```

## Continuous Monitoring

For production monitoring, consider:

1. **Set up automated benchmarks** - Run weekly or after major changes
2. **Track trends** - Monitor if performance degrades over time
3. **Alert on regressions** - Automated alerts if metrics drop below thresholds
4. **Compare releases** - Benchmark before/after each release

## Getting Help

If benchmark results indicate performance issues:

1. Review the [Validation Report](../docs/performance/VALIDATION_REPORT.md)
2. Check individual test logs for errors
3. Review the [Troubleshooting Guide](../scripts/performance/README.md#troubleshooting)
4. Analyze slow queries with database query analyzer

## Related Documentation

- [Performance Validation Report](../docs/performance/VALIDATION_REPORT.md) - Complete validation methodology
- [Benchmark Scripts README](../scripts/performance/README.md) - How to run benchmarks
- [Database Schema](../prisma/schema.prisma) - Index configuration
- [Cache Implementation](../src/lib/cache/query-cache.ts) - Caching strategy

---

**Note:** This directory is gitignored. Benchmark results are not committed to version control.
For historical tracking, consider uploading results to a monitoring dashboard or artifact storage.
