# Performance Benchmarking Suite

Comprehensive performance testing and validation framework for vibecode-webgui.

## Quick Start

```bash
# Run all benchmarks
./run-all-benchmarks.sh

# Or run individual benchmarks
npx ts-node db-benchmark.ts
npx ts-node cache-benchmark.ts
npx ts-node api-benchmark.ts  # Requires server running
k6 run load-test.k6.js        # Requires k6 installed and server running
```

## Prerequisites

### Required
- Node.js 18+
- PostgreSQL database running
- npm dependencies installed

### Optional (for full suite)
- API server running on http://localhost:3000
- k6 installed (for load testing)

## Installation

```bash
# Install Node.js dependencies
npm install

# Install k6 (optional, for load testing)
# macOS
brew install k6

# Ubuntu/Debian
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Windows
choco install k6
```

## Available Benchmarks

### 1. Database Performance (`db-benchmark.ts`)

Tests database query performance, connection pooling, and index effectiveness.

**What it tests:**
- Simple SELECT queries
- JOIN queries (single and multiple)
- Connection pool vs. direct connection
- Batch operations vs. individual inserts
- Index performance (indexed vs. non-indexed)
- Dashboard query optimization

**Run:**
```bash
npx ts-node db-benchmark.ts
```

**Expected runtime:** 3-5 minutes

**Output:** `/performance-results/db-benchmark-[timestamp].md`

---

### 2. Cache Performance (`cache-benchmark.ts`)

Tests cache effectiveness, hit rates, and invalidation performance.

**What it tests:**
- Simple cache operations (get/set)
- Large object caching (AI responses, vector results)
- TTL behavior (1s and 30-minute TTLs)
- Cache invalidation speed
- Vector search cache integration

**Run:**
```bash
npx ts-node cache-benchmark.ts
```

**Expected runtime:** 2-4 minutes

**Output:** `/performance-results/cache-benchmark-[timestamp].md`

---

### 3. API Endpoint Performance (`api-benchmark.ts`)

Tests API response times and cache effectiveness.

**What it tests:**
- AI chat endpoint (cached vs. uncached)
- Vector search endpoint
- Dashboard loading
- CRUD endpoints (workspaces, projects)
- Health check baseline

**Prerequisites:**
```bash
# Start the API server
npm run dev
```

**Run:**
```bash
# With default URL (http://localhost:3000)
npx ts-node api-benchmark.ts

# With custom URL
API_BASE_URL=http://localhost:3000 npx ts-node api-benchmark.ts

# With authentication
AUTH_TOKEN=your-token npx ts-node api-benchmark.ts
```

**Expected runtime:** 2-3 minutes

**Output:** `/performance-results/api-benchmark-[timestamp].md`

---

### 4. Load Testing (`load-test.k6.js`)

Tests system behavior under concurrent load.

**What it tests:**
- Smoke test (basic functionality)
- Load test (normal traffic: 10 concurrent users)
- Stress test (push limits: up to 100 users)
- Spike test (sudden traffic increase)
- Soak test (sustained load over 10 minutes)

**Prerequisites:**
```bash
# Install k6
brew install k6  # macOS
# or see installation section above

# Start the API server
npm run dev
```

**Run:**
```bash
# Full test suite (takes ~30 minutes)
k6 run load-test.k6.js

# Quick load test only
k6 run --vus 10 --duration 30s load-test.k6.js

# Stress test
k6 run --vus 100 --duration 60s load-test.k6.js

# With custom base URL
BASE_URL=http://localhost:3000 k6 run load-test.k6.js

# With authentication
AUTH_TOKEN=your-token k6 run load-test.k6.js
```

**Expected runtime:**
- Quick test: 30s
- Load test: 5 minutes
- Full suite: 30 minutes

**Output:**
- Console summary
- `/performance-results/load-test-[timestamp].json`

---

## Running All Benchmarks

The `run-all-benchmarks.sh` script runs all benchmarks in sequence and generates a summary report.

```bash
./run-all-benchmarks.sh
```

**What it does:**
1. Runs database benchmarks
2. Runs cache benchmarks
3. Runs API benchmarks (if server is running)
4. Runs k6 load tests (if k6 is installed and server is running)
5. Generates a comprehensive SUMMARY.md report

**Expected total runtime:** 10-15 minutes (without load tests), 30-40 minutes (with full load test suite)

**Output:** `/performance-results/run_[timestamp]/`
- `SUMMARY.md` - Overview of all test results
- `db-benchmark.md` - Database benchmark details
- `cache-benchmark.md` - Cache benchmark details
- `api-benchmark.md` - API benchmark details (if run)
- `load-test.json` - k6 test results (if run)
- `*.log` - Individual test logs

---

## Understanding Results

### Database Benchmark Results

```markdown
| Operation | Avg (ms) | Min (ms) | Max (ms) | P95 (ms) | P99 (ms) | Throughput (ops/s) |
|-----------|----------|----------|----------|----------|----------|--------------------|
| Select Users | 2.45 | 1.20 | 5.30 | 3.50 | 4.20 | 408.16 |
```

**Key metrics:**
- **Avg:** Average execution time (lower is better)
- **P95/P99:** 95th/99th percentile (most requests are faster than this)
- **Throughput:** Operations per second (higher is better)

**Good performance:**
- Simple queries: < 5ms average
- JOINs: < 20ms average
- Complex queries: < 50ms average
- Connection pool improvement: > 30%

---

### Cache Benchmark Results

```markdown
| Operation | Cache | Avg (ms) | Hit Rate |
|-----------|-------|----------|----------|
| Vector Search | No | 300.50 | N/A |
| Vector Search | Yes | 30.25 | 85.5% |
```

**Key metrics:**
- **Hit Rate:** Percentage of cache hits (target: >80%)
- **Avg time:** Response time (cached should be >70% faster)

**Good performance:**
- Cache hit rate: > 80%
- Cached responses: > 70% faster
- Invalidation: < 100ms

---

### API Benchmark Results

```markdown
| Endpoint | Method | Avg (ms) | P95 (ms) | Success Rate | Cache Hit |
|----------|--------|----------|----------|--------------|-----------|
| /api/dashboard | GET | 65.30 | 95.20 | 100.0% | N/A |
| /api/ai/chat | POST | 52.10 | 78.50 | 100.0% | 82.5% |
```

**Key metrics:**
- **Success Rate:** Percentage of successful requests (target: >95%)
- **Cache Hit:** Cache effectiveness (target: >70%)

**Good performance:**
- Health check: < 10ms
- Dashboard: < 100ms P95
- Cached AI: < 100ms P95
- Success rate: > 95%

---

### Load Test Results

```
HTTP Request Duration:
  avg: 125.50ms
  p95: 450.30ms
  p99: 850.20ms

Total Requests: 15000
Request Rate: 150.00 req/s
Check Pass Rate: 98.50%
Cache Hit Rate: 75.20%
Error Rate: 1.50%
```

**Key metrics:**
- **Request Rate:** Throughput (higher is better)
- **Check Pass Rate:** Percentage of successful validations (target: >95%)
- **Error Rate:** Percentage of failed requests (target: <5%)

**Good performance:**
- P95 < 500ms under normal load
- P95 < 1000ms under stress
- Error rate < 5%
- No connection pool exhaustion

---

## Performance Targets

Based on claimed improvements, we expect:

### Database Performance
- ✅ **40-60% improvement** in query performance with indexes
- ✅ **30%+ faster** connection acquisition with pooling
- ✅ **50%+ faster** batch operations

### Cache Performance
- ✅ **50-70% latency reduction** for AI responses with caching
- ✅ **80%+ cache hit rate** for vector searches
- ✅ **< 100ms** cache invalidation

### Dashboard Performance
- ✅ **3x faster load times** with parallel query execution
- ✅ **< 500ms** P95 load time

### Load Testing
- ✅ **< 5% error rate** under stress (100 concurrent users)
- ✅ **Stable performance** during 10-minute soak test
- ✅ **Quick recovery** from traffic spikes

---

## Troubleshooting

### "Cannot find module" errors

```bash
# Install dependencies
npm install

# Rebuild TypeScript
npm run build
```

### "Connection refused" errors (API benchmarks)

```bash
# Start the server first
npm run dev

# Verify it's running
curl http://localhost:3000/api/health
```

### "Command not found: k6"

```bash
# Install k6
brew install k6  # macOS
# or see Installation section above

# Verify installation
k6 version
```

### Database connection errors

```bash
# Check database is running
docker-compose ps

# Start database
docker-compose up -d postgres

# Verify connection
psql $DATABASE_URL -c "SELECT 1"
```

### Low cache hit rates

This is expected on first run. Cache needs to "warm up":
1. First benchmark run populates cache
2. Second run should show higher hit rates
3. Run benchmarks multiple times for accurate results

### Slow benchmark execution

Normal! Full suite can take 30-40 minutes. To speed up:

```bash
# Run only specific benchmarks
npx ts-node db-benchmark.ts  # ~3 min

# Skip load tests (longest)
# Comment out load test in run-all-benchmarks.sh

# Reduce iterations in benchmark scripts
# Edit db-benchmark.ts and reduce 'runs' parameter
```

---

## Interpreting Results

### Validating Claims

After running benchmarks, compare results against claims:

#### ✅ Database Performance (40-60% improvement)
```
Baseline (no index): 10ms avg
Optimized (with index): 4ms avg
Improvement: 60% ✅
```

#### ✅ AI Response Caching (50-70% reduction)
```
Uncached: 2000ms avg
Cached: 500ms avg
Reduction: 75% ✅
```

#### ✅ Vector Cache Hit Rate (80%+)
```
Cache Hit Rate: 85%
Target: 80%+
Status: ✅ PASS
```

#### ✅ Dashboard (3x faster)
```
Sequential queries: 150ms
Parallel queries: 50ms
Improvement: 3x ✅
```

### Red Flags

Watch for these warning signs:

🚨 **High error rates** (>5%)
- Check server logs
- Verify database connection
- Review rate limiting

🚨 **Low cache hit rates** (<70%)
- Increase TTL
- Check cache invalidation frequency
- Review cache key generation

🚨 **Connection pool exhaustion**
- Increase max pool size
- Check for connection leaks
- Optimize query times

🚨 **Memory leaks** (increasing memory during soak test)
- Review cache size limits
- Check for unbounded growth
- Profile with Node.js heap snapshots

---

## Advanced Usage

### Custom Benchmark Parameters

Edit benchmark scripts to customize:

**Database benchmarks:**
```typescript
// In db-benchmark.ts
await this.runBenchmark(
  'My Test',
  'Custom operation',
  async () => { /* your test */ },
  50  // Change number of runs
);
```

**Cache benchmarks:**
```typescript
// In cache-benchmark.ts
this.queryCache = new QueryCache({
  maxSize: 200 * 1024 * 1024, // Increase cache size
  defaultTTL: 60 * 60 * 1000,  // Increase TTL to 1 hour
});
```

**Load tests:**
```javascript
// In load-test.k6.js
export const options = {
  scenarios: {
    my_test: {
      executor: 'constant-vus',
      vus: 50,        // Change concurrent users
      duration: '5m', // Change duration
    },
  },
};
```

### CI/CD Integration

Add to your CI/CD pipeline:

```yaml
# GitHub Actions example
- name: Run Performance Benchmarks
  run: |
    ./scripts/performance/run-all-benchmarks.sh

- name: Upload Results
  uses: actions/upload-artifact@v3
  with:
    name: performance-results
    path: performance-results/
```

### Continuous Monitoring

Set up alerts based on benchmark results:

```bash
# Extract key metrics from results
cat performance-results/run_*/SUMMARY.md | grep "Success Rate"

# Alert if success rate < 95%
# Alert if P95 > 500ms
# Alert if cache hit rate < 70%
```

---

## Contributing

To add new benchmarks:

1. Create a new TypeScript file in `/scripts/performance/`
2. Follow the existing benchmark structure
3. Export a default class with a `runAll()` method
4. Add to `run-all-benchmarks.sh`
5. Document in this README

---

## Related Documentation

- [Performance Validation Report](../../docs/performance/VALIDATION_REPORT.md)
- [Database Schema](../../prisma/schema.prisma)
- [Connection Pool Implementation](../../src/lib/db/connection-pool.ts)
- [Cache Implementation](../../src/lib/cache/query-cache.ts)

---

## Support

For issues or questions:

1. Check the [Troubleshooting](#troubleshooting) section
2. Review the [Validation Report](../../docs/performance/VALIDATION_REPORT.md)
3. Check benchmark logs in `/performance-results/`
4. Open an issue with benchmark results attached

---

**Last Updated:** 2025-10-23
**Maintained By:** Performance Validation Team
