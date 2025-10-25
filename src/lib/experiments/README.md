# Experiment Data Warehouse

PostgreSQL-based data warehouse for experiment assignments and metrics, following Eppo's SQL-based assignment logging pattern.

## Overview

This module provides a complete experimentation platform with:

- **Assignment Logging**: Track which variant each user receives
- **Metric Tracking**: Record conversion events, revenue, and custom metrics
- **Batch Processing**: High-throughput event logging (1000+ ops/sec)
- **Statistical Analysis**: Variant performance, sample ratio checks, retention analysis
- **Efficient Querying**: Optimized indexes for common access patterns

## Architecture

```
┌─────────────────┐
│  Feature Flags  │  ← Existing feature flag engine
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Warehouse     │  ← Assignment & metric logging
│   (batch)       │     Buffer → Flush (100 events / 5s)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   PostgreSQL    │  ← Experiments, Assignments, Metrics
│   (indexed)     │     Optimized for analytics queries
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Queries      │  ← Statistical analysis & reporting
│   (analytics)   │     Variant distribution, retention, etc.
└─────────────────┘
```

## Database Schema

### Experiment

Stores experiment configuration and metadata.

```typescript
{
  id: string              // CUID
  key: string             // Unique identifier (e.g., 'ai_assistant_v2')
  name: string            // Display name
  hypothesis: string?     // Hypothesis statement
  status: string          // draft, review, running, completed, archived
  config: JSON            // Variants, metrics, guardrails
  created_at: DateTime
  updated_at: DateTime
}
```

**Indexes:**
- `key` (unique)
- `status`
- `(key, status)` - compound
- `created_at`

### ExperimentAssignment

Logs user variant assignments (Eppo's assignment logging pattern).

```typescript
{
  id: string              // CUID
  experiment_id: string   // FK to Experiment
  user_id: string         // User identifier
  variant_key: string     // Assigned variant
  timestamp: DateTime     // Assignment time
  metadata: JSON?         // Context (browser, region, etc.)
}
```

**Indexes:**
- `(experiment_id, user_id)` - unique constraint
- `(experiment_id, variant_key)` - variant lookups
- `timestamp` - time-based queries
- `(user_id, timestamp)` - user activity

### ExperimentMetric

Tracks metric events for analysis.

```typescript
{
  id: string              // CUID
  experiment_id: string   // FK to Experiment
  assignment_id: string?  // FK to Assignment
  user_id: string         // User identifier
  variant_key: string     // Variant (denormalized for performance)
  metric_name: string     // Metric identifier
  value: float            // Metric value
  timestamp: DateTime     // Event time
  metadata: JSON?         // Event context
}
```

**Indexes:**
- `(experiment_id, metric_name)` - metric lookups
- `(experiment_id, variant_key, metric_name)` - variant analysis
- `(experiment_id, timestamp)` - time series
- `(user_id, timestamp)` - user activity
- `(metric_name, timestamp)` - global metric trends

## Usage

### 1. Create an Experiment

```typescript
import { experimentWarehouse } from '@/lib/experiments'

await experimentWarehouse.upsertExperiment(
  'ai_assistant_v2',
  'AI Assistant V2',
  {
    variants: [
      { key: 'control', name: 'Current Assistant', weight: 0.5 },
      { key: 'enhanced', name: 'Enhanced Assistant', weight: 0.5 }
    ],
    metrics: ['code_completions', 'user_satisfaction'],
    guardrails: {
      minSampleSize: 100,
      maxDuration: 30 // days
    }
  },
  'Hypothesis: Enhanced assistant increases user satisfaction by 15%',
  'running'
)
```

### 2. Log Assignments

```typescript
// When user is assigned a variant
await experimentWarehouse.logAssignment(
  'ai_assistant_v2',
  'user_123',
  'enhanced',
  {
    browser: 'chrome',
    region: 'us-east',
    userTier: 'premium'
  }
)
```

Assignments are **batched** for performance:
- Buffer size: 100 events
- Flush interval: 5 seconds
- Automatic flush on process exit

### 3. Log Metrics

```typescript
// Track a conversion event
await experimentWarehouse.logMetric(
  'ai_assistant_v2',
  'user_123',
  'code_completion',
  1.0,  // binary metric (0 or 1)
  {
    language: 'typescript',
    completionLength: 42
  }
)

// Track a continuous metric
await experimentWarehouse.logMetric(
  'ai_assistant_v2',
  'user_123',
  'satisfaction_score',
  4.5,  // 1-5 scale
  {
    surveyId: 'post_session_1'
  }
)
```

### 4. Retrieve Results

```typescript
const results = await experimentWarehouse.getExperimentResults('ai_assistant_v2')

console.log('Experiment:', results.experiment)
console.log('Variant Distribution:', results.variantDistribution)
// { control: 512, enhanced: 488 }

console.log('Metrics:', results.metrics)
// {
//   control_code_completion: {
//     count: 512,
//     mean: 0.73,
//     median: 1.0,
//     p95: 1.0,
//     p99: 1.0,
//     stdDev: 0.44
//   },
//   enhanced_code_completion: {
//     count: 488,
//     mean: 0.84,
//     ...
//   }
// }
```

## Analytics Queries

### Variant Distribution

```typescript
import { experimentQueries } from '@/lib/experiments'

const distribution = await experimentQueries.getVariantDistribution('ai_assistant_v2')
// [
//   { variantKey: 'control', count: 512, percentage: 51.2 },
//   { variantKey: 'enhanced', count: 488, percentage: 48.8 }
// ]
```

### Metric Aggregation

```typescript
const aggregation = await experimentQueries.getMetricAggregation(
  'ai_assistant_v2',
  'code_completion'
)

for (const variant of aggregation) {
  console.log(`${variant.variantKey}:`)
  console.log(`  Mean: ${variant.mean}`)
  console.log(`  P95: ${variant.p95}`)
  console.log(`  StdDev: ${variant.stdDev}`)
}
```

### Time Series Analysis

```typescript
const timeSeries = await experimentQueries.getTimeSeriesData(
  'ai_assistant_v2',
  'code_completion',
  'day',  // interval: 'hour', 'day', 'week'
  new Date('2024-01-01'),  // start date
  new Date('2024-01-31')   // end date
)

// Returns daily aggregated metrics per variant
// Use for trend visualization in dashboard
```

### Retention Analysis

```typescript
const retention = await experimentQueries.getUserRetention(
  'ai_assistant_v2',
  'session_started'  // activity metric
)

// Returns cohort retention by variant
// [
//   {
//     variantKey: 'control',
//     cohortDate: '2024-01-01',
//     day0: 100,  // assigned users
//     day1: 73,   // active on day 1
//     day7: 54,   // active on day 7
//     day14: 42,
//     day30: 31
//   },
//   ...
// ]
```

### Sample Ratio Check

```typescript
// Detect sample ratio mismatch (SRM)
const srmCheck = await experimentQueries.calculateSampleRatio(
  'ai_assistant_v2',
  {
    control: 0.5,    // expected 50%
    enhanced: 0.5
  }
)

if (!srmCheck.isPassing) {
  console.warn('Sample ratio mismatch detected!')
  console.log('Chi-square:', srmCheck.chiSquare)
  console.log('P-value:', srmCheck.pValue)
  console.log('Observed:', srmCheck.observedRatio)
}
```

### Experiment Summary

```typescript
const summary = await experimentQueries.getExperimentSummary('ai_assistant_v2')

console.log('Experiment:', summary.experiment.name)
console.log('Total Assignments:', summary.totalAssignments)
console.log('Total Metrics:', summary.totalMetrics)
console.log('Unique Metrics:', summary.uniqueMetrics)
console.log('Date Range:', summary.dateRange)
console.log('Variant Distribution:', summary.variantDistribution)
```

## Integration with Feature Flags

```typescript
import { featureFlagEngine } from '@/lib/feature-flags'
import { experimentWarehouse } from '@/lib/experiments'

// 1. Evaluate feature flag
const result = await featureFlagEngine.evaluateFlag(
  'ai_assistant_v2',
  { userId: 'user_123', workspaceId: 'ws_456' }
)

// 2. Log assignment to warehouse
await experimentWarehouse.logAssignment(
  'ai_assistant_v2',
  'user_123',
  result.variant,
  {
    workspaceId: 'ws_456',
    isExperiment: result.isExperiment
  }
)

// 3. Track metrics
await experimentWarehouse.logMetric(
  'ai_assistant_v2',
  'user_123',
  'feature_used',
  1.0
)
```

## Performance Characteristics

### Throughput (Batch Mode)

- **Assignment logging**: 10,000+ ops/sec (buffered)
- **Metric logging**: 10,000+ ops/sec (buffered)
- **Batch flush**: < 1000ms for 100 events

### Query Performance

With proper indexes:
- **Get assignments**: < 100ms for 10K+ assignments
- **Get metrics**: < 100ms for 10K+ events
- **Aggregated results**: < 200ms for 10K+ events

### Memory Usage

- Buffer overhead: ~50MB for 10,000 buffered events
- Automatic cleanup via periodic flush

## Best Practices

### 1. Use Meaningful Experiment Keys

```typescript
// Good
'ai_assistant_v2'
'editor_theme_dark_plus'
'checkout_flow_redesign'

// Bad
'exp1'
'test_a'
'new_feature'
```

### 2. Include Rich Metadata

```typescript
await experimentWarehouse.logAssignment(
  'checkout_flow_redesign',
  userId,
  variant,
  {
    userTier: 'premium',
    region: 'us-east',
    deviceType: 'mobile',
    browser: 'chrome',
    previousPurchases: 5
  }
)
```

### 3. Track Multiple Metric Types

```typescript
// Primary metric
await experimentWarehouse.logMetric(experimentKey, userId, 'conversion', 1.0)

// Guardrail metrics
await experimentWarehouse.logMetric(experimentKey, userId, 'load_time_ms', 234)
await experimentWarehouse.logMetric(experimentKey, userId, 'error_rate', 0.0)

// Secondary metrics
await experimentWarehouse.logMetric(experimentKey, userId, 'revenue', 99.99)
await experimentWarehouse.logMetric(experimentKey, userId, 'session_duration', 342)
```

### 4. Flush Before Process Exit

```typescript
// Ensure all buffered events are written
process.on('SIGTERM', async () => {
  await experimentWarehouse.flush()
  await experimentWarehouse.stop()
  process.exit(0)
})
```

### 5. Monitor Sample Ratio

```typescript
// Check for SRM regularly
const srmCheck = await experimentQueries.calculateSampleRatio(
  experimentKey,
  expectedRatio
)

if (!srmCheck.isPassing) {
  // Alert: Possible randomization issue
  logger.error('SRM detected', { experimentKey, srmCheck })
}
```

## Testing

### Unit Tests

```bash
npm run test -- warehouse.test.ts
npm run test -- queries.test.ts
```

### Performance Benchmarks

```bash
npm run test:performance -- performance.bench.ts
```

Expected results:
- Assignment logging: 1000+ ops/sec
- Metric logging: 1000+ ops/sec
- Query latency: < 100ms

## Migration

To apply the database schema:

```bash
npx prisma migrate deploy
```

Or manually run:

```bash
psql $DATABASE_URL < prisma/migrations/20251024194925_add_experiments_schema/migration.sql
```

## Troubleshooting

### Slow Queries

Check index usage:

```sql
EXPLAIN ANALYZE
SELECT * FROM experiment_assignments
WHERE experiment_id = 'exp1'
  AND variant_key = 'control';
```

Should use index: `experiment_assignments_experiment_id_variant_key_idx`

### Memory Leaks

Monitor buffer sizes:

```typescript
// Add monitoring
setInterval(() => {
  const bufferSize = experimentWarehouse['assignmentBuffer'].items.length
  console.log('Buffer size:', bufferSize)

  if (bufferSize > 10000) {
    console.warn('Buffer overflow risk!')
  }
}, 60000)
```

### Lost Events

Ensure proper shutdown:

```typescript
// Always flush before exit
process.on('SIGTERM', async () => {
  await experimentWarehouse.stop()
})

process.on('SIGINT', async () => {
  await experimentWarehouse.stop()
})
```

## Roadmap

- [ ] Redis-backed buffer for distributed systems
- [ ] Streaming export to data lake (S3, BigQuery)
- [ ] Real-time aggregation with materialized views
- [ ] A/B test calculator UI component
- [ ] Automated SRM detection alerts
- [ ] Bayesian statistical analysis
- [ ] Multi-armed bandit support

## References

- [Eppo's SQL-based assignment logging](https://www.geteppo.com/blog/sql-based-assignment-logging)
- [Trustworthy Online Controlled Experiments](https://experimentguide.com/)
- [Sample Ratio Mismatch (SRM)](https://dl.acm.org/doi/10.1145/3292500.3330722)
