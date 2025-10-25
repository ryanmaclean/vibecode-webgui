# Experiment Guardrails: Preventing Harmful Experiments

**Goal:** Set up automated safety checks to prevent experiment disasters
**Difficulty:** Intermediate
**Time:** 25-35 minutes
**Prerequisites:** Completed Tutorial 1, understanding of monitoring concepts

---

## What You'll Learn

By the end of this tutorial, you will:
- ✅ Identify critical metrics to protect
- ✅ Set appropriate thresholds for guardrails
- ✅ Configure automated monitoring and alerts
- ✅ Test guardrail triggering
- ✅ Handle violations gracefully
- ✅ Learn from real disaster prevention examples

## The Problem: Experiments Can Go Wrong

**Real Example (Booking.com):**
```
Experiment: "Limited availability" messaging
Day 1-3: +8% booking rate (looking great!)
Day 4: -15% repeat customer rate (disaster!)
Day 7: Net revenue -$2M (total disaster!)

What went wrong: No guardrails on long-term metrics
```

**Why Guardrails Matter:**
- Prevent revenue loss
- Protect user experience
- Catch technical failures early
- Enable fast experimentation with safety

## Step 1: Identify Critical Metrics (5 min)

Not all metrics need guardrails. Focus on:

### Business-Critical Metrics

```typescript
// config/guardrails.ts

export const CRITICAL_METRICS = {
  // Revenue protection
  revenue: {
    metric: 'revenue_per_user',
    threshold: -0.05, // Never drop >5%
    severity: 'critical',
    checkFrequency: '1 hour'
  },

  // User experience
  errorRate: {
    metric: 'error_rate',
    threshold: 0.02, // <2% errors
    severity: 'critical',
    checkFrequency: '5 minutes'
  },

  // Performance
  latency: {
    metric: 'p95_latency_ms',
    threshold: 3000, // <3s P95
    severity: 'warning',
    checkFrequency: '10 minutes'
  },

  // Engagement
  sessionDuration: {
    metric: 'avg_session_duration',
    threshold: -0.10, // Never drop >10%
    severity: 'warning',
    checkFrequency: '1 hour'
  },

  // Quality (for AI)
  aiQuality: {
    metric: 'quality_score',
    threshold: 0.70, // Never below 70%
    severity: 'critical',
    checkFrequency: '15 minutes'
  }
}
```

### Guardrail Categories

1. **Technical Guardrails** (Prevent breakage)
   - Error rate
   - Crash rate
   - API timeout rate
   - Database connection failures

2. **Business Guardrails** (Protect revenue)
   - Revenue per user
   - Conversion rate
   - Churn rate
   - Customer lifetime value

3. **User Experience Guardrails** (Maintain quality)
   - Page load time
   - User satisfaction
   - Feature adoption
   - Support tickets

4. **AI-Specific Guardrails** (Quality control)
   - Output quality scores
   - Hallucination rate
   - Prompt injection detection
   - Content policy violations

## Step 2: Set Thresholds (5 min)

**How to choose thresholds:**

### Method 1: Historical Baseline

```typescript
// Calculate threshold from historical data
async function calculateThreshold(
  metric: string,
  confidenceLevel: number = 0.95
): Promise<number> {
  // Get last 30 days of data
  const history = await getMetricHistory(metric, 30)

  const mean = calculateMean(history)
  const stdDev = calculateStdDev(history)

  // Threshold = mean - (Z-score × stdDev)
  // For 95% confidence, Z = 1.96
  const zScore = confidenceLevel === 0.95 ? 1.96 : 2.58
  const threshold = mean - (zScore * stdDev)

  return threshold
}

// Example: Error rate
// Historical: 0.5% ± 0.2%
// Threshold = 0.5% - (1.96 × 0.2%) = 0.108%
// Set guardrail at 1% (with safety margin)
```

### Method 2: Business Requirement

```typescript
// Based on business constraints
const BUSINESS_THRESHOLDS = {
  // SLA: 99.9% uptime
  errorRate: 0.001,

  // User research: 3s feels slow
  p95Latency: 3000,

  // Finance: Can't lose >5% revenue
  revenuePerUser: currentRevenue * 0.95,

  // Product: Quality must stay high
  qualityScore: 0.75
}
```

### Method 3: Relative Threshold

```typescript
// Relative to control group
export interface RelativeGuardrail {
  metric: string
  operator: 'ratio' | 'difference'
  threshold: number // e.g., 0.95 = treatment must be ≥95% of control
  comparison: 'control' | 'baseline'
}

const RELATIVE_GUARDRAILS: RelativeGuardrail[] = [
  {
    metric: 'conversion_rate',
    operator: 'ratio',
    threshold: 0.95, // Treatment ≥ 95% of control
    comparison: 'control'
  },
  {
    metric: 'revenue_per_user',
    operator: 'ratio',
    threshold: 0.98, // Treatment ≥ 98% of control
    comparison: 'control'
  }
]
```

## Step 3: Configure Guardrails (10 min)

```typescript
// lib/experiments/guardrails.ts

export interface Guardrail {
  id: string
  experimentKey: string
  metricName: string
  operator: '<' | '>' | '<=' | '>='
  threshold: number
  severity: 'critical' | 'warning' | 'info'
  description: string
  enabled: boolean
}

export interface GuardrailConfig {
  experimentKey: string
  guardrails: Guardrail[]
  checkInterval: number // milliseconds
  alertChannels: string[] // ['slack', 'email', 'pagerduty']
  autoStopOnCritical: boolean
}

// Example configuration
export const CHATBOT_GUARDRAILS: GuardrailConfig = {
  experimentKey: 'chatbot_performance_v1',

  guardrails: [
    // Critical: Stop experiment if triggered
    {
      id: 'error_rate_critical',
      experimentKey: 'chatbot_performance_v1',
      metricName: 'error_rate',
      operator: '<',
      threshold: 0.05, // <5% errors
      severity: 'critical',
      description: 'Error rate exceeds 5% - users experiencing failures',
      enabled: true
    },
    {
      id: 'quality_critical',
      experimentKey: 'chatbot_performance_v1',
      metricName: 'quality_score',
      operator: '>',
      threshold: 0.60, // >60% quality
      severity: 'critical',
      description: 'Quality dropped below acceptable threshold',
      enabled: true
    },

    // Warning: Alert but don't stop
    {
      id: 'latency_warning',
      experimentKey: 'chatbot_performance_v1',
      metricName: 'p95_ttft_ms',
      operator: '<',
      threshold: 5000, // <5s P95
      severity: 'warning',
      description: 'Latency is higher than expected',
      enabled: true
    },
    {
      id: 'engagement_warning',
      experimentKey: 'chatbot_performance_v1',
      metricName: 'messages_per_session',
      operator: '>',
      threshold: 1.5, // >1.5 messages per session
      severity: 'warning',
      description: 'Engagement is lower than baseline',
      enabled: true
    }
  ],

  checkInterval: 300000, // Check every 5 minutes
  alertChannels: ['slack', 'email'],
  autoStopOnCritical: true // Auto-pause on critical violations
}
```

## Step 4: Implement Monitoring (10 min)

```typescript
// lib/experiments/guardrail-monitor.ts

import { experimentWarehouse } from './warehouse'
import { sendAlert } from './alerts'
import { pauseExperiment } from './lifecycle'

export async function startGuardrailMonitoring(
  config: GuardrailConfig
): Promise<void> {
  console.log(`Starting guardrail monitoring for ${config.experimentKey}`)
  console.log(`Check interval: ${config.checkInterval}ms`)

  // Continuous monitoring loop
  setInterval(async () => {
    await checkGuardrails(config)
  }, config.checkInterval)
}

export async function checkGuardrails(
  config: GuardrailConfig
): Promise<GuardrailCheckResult> {
  const violations: GuardrailViolation[] = []
  const passed: string[] = []

  // Get current metrics for all variants
  const variants = await experimentWarehouse.getExperimentVariants(
    config.experimentKey
  )

  for (const guardrail of config.guardrails) {
    if (!guardrail.enabled) continue

    for (const variant of variants) {
      const currentValue = await getMetricValue(
        config.experimentKey,
        variant.key,
        guardrail.metricName
      )

      const isViolation = checkThreshold(
        currentValue,
        guardrail.operator,
        guardrail.threshold
      )

      if (isViolation) {
        violations.push({
          guardrailId: guardrail.id,
          experimentKey: config.experimentKey,
          variantKey: variant.key,
          metricName: guardrail.metricName,
          currentValue,
          threshold: guardrail.threshold,
          operator: guardrail.operator,
          severity: guardrail.severity,
          description: guardrail.description,
          timestamp: new Date()
        })
      } else {
        passed.push(guardrail.id)
      }
    }
  }

  // Handle violations
  if (violations.length > 0) {
    await handleViolations(config, violations)
  }

  return {
    passed: passed.length,
    violations: violations.length,
    details: violations,
    timestamp: new Date()
  }
}

function checkThreshold(
  value: number,
  operator: string,
  threshold: number
): boolean {
  switch (operator) {
    case '<':
      return value >= threshold // Violation if value NOT less than threshold
    case '>':
      return value <= threshold // Violation if value NOT greater than threshold
    case '<=':
      return value > threshold
    case '>=':
      return value < threshold
    default:
      return false
  }
}

async function handleViolations(
  config: GuardrailConfig,
  violations: GuardrailViolation[]
): Promise<void> {
  // Group by severity
  const critical = violations.filter(v => v.severity === 'critical')
  const warnings = violations.filter(v => v.severity === 'warning')

  // Log violations
  await experimentWarehouse.logGuardrailViolations(
    config.experimentKey,
    violations
  )

  // Send alerts
  for (const violation of violations) {
    await sendAlert({
      channel: config.alertChannels,
      severity: violation.severity,
      title: `Guardrail Violation: ${violation.metricName}`,
      message: formatViolationMessage(violation),
      experiment: config.experimentKey,
      variant: violation.variantKey
    })
  }

  // Auto-stop if critical
  if (critical.length > 0 && config.autoStopOnCritical) {
    console.error(`🚨 Critical guardrail violation! Pausing experiment.`)

    await pauseExperiment(config.experimentKey, {
      reason: 'guardrail_violation',
      violations: critical,
      timestamp: new Date()
    })

    // Emergency alert
    await sendAlert({
      channel: ['slack', 'pagerduty'],
      severity: 'critical',
      title: `🚨 EXPERIMENT AUTO-PAUSED`,
      message: `Experiment ${config.experimentKey} automatically paused due to critical guardrail violations:\n\n` +
        critical.map(v => `- ${v.description}: ${v.currentValue} (threshold: ${v.threshold})`).join('\n'),
      experiment: config.experimentKey
    })
  }
}

function formatViolationMessage(violation: GuardrailViolation): string {
  return `
Experiment: ${violation.experimentKey}
Variant: ${violation.variantKey}
Metric: ${violation.metricName}
Current Value: ${violation.currentValue.toFixed(4)}
Threshold: ${violation.operator} ${violation.threshold}
Description: ${violation.description}
Time: ${violation.timestamp.toISOString()}
  `.trim()
}

async function getMetricValue(
  experimentKey: string,
  variantKey: string,
  metricName: string
): Promise<number> {
  // Get recent metrics (last hour)
  const metrics = await experimentWarehouse.getMetrics(
    experimentKey,
    variantKey,
    metricName,
    { since: Date.now() - 3600000 }
  )

  if (metrics.length === 0) {
    throw new Error(`No data for metric ${metricName}`)
  }

  // Calculate based on metric type
  if (metricName.includes('rate') || metricName.includes('ratio')) {
    return calculateMean(metrics.map(m => m.value))
  } else if (metricName.includes('p95')) {
    return calculateP95(metrics.map(m => m.value))
  } else if (metricName.includes('p99')) {
    return calculateP99(metrics.map(m => m.value))
  } else {
    return calculateMean(metrics.map(m => m.value))
  }
}
```

## Step 5: Test Guardrails (5 min)

**Always test guardrails before relying on them!**

```typescript
// scripts/test-guardrails.ts

async function testGuardrails() {
  console.log('=== Testing Guardrail Configuration ===\n')

  const config = CHATBOT_GUARDRAILS

  // Test 1: Inject high error rate
  console.log('Test 1: Injecting high error rate...')
  await injectMetrics(config.experimentKey, 'control', {
    error_rate: 0.08 // Above 5% threshold
  })

  await delay(config.checkInterval + 1000)

  const result1 = await checkGuardrails(config)
  console.log(`Violations detected: ${result1.violations}`)
  console.log(`Expected: 1 (error_rate_critical)`)
  console.log(`✅ Test 1 ${result1.violations === 1 ? 'PASSED' : 'FAILED'}\n`)

  // Test 2: Inject poor quality
  console.log('Test 2: Injecting low quality scores...')
  await injectMetrics(config.experimentKey, 'treatment', {
    quality_score: 0.55 // Below 60% threshold
  })

  await delay(config.checkInterval + 1000)

  const result2 = await checkGuardrails(config)
  console.log(`Violations detected: ${result2.violations}`)
  console.log(`Expected: 1 (quality_critical)`)
  console.log(`✅ Test 2 ${result2.violations === 1 ? 'PASSED' : 'FAILED'}\n`)

  // Test 3: Normal metrics (should pass)
  console.log('Test 3: Normal metrics...')
  await injectMetrics(config.experimentKey, 'control', {
    error_rate: 0.01,
    quality_score: 0.82,
    p95_ttft_ms: 2500
  })

  await delay(config.checkInterval + 1000)

  const result3 = await checkGuardrails(config)
  console.log(`Violations detected: ${result3.violations}`)
  console.log(`Expected: 0`)
  console.log(`✅ Test 3 ${result3.violations === 0 ? 'PASSED' : 'FAILED'}\n`)

  // Test 4: Auto-pause on critical
  console.log('Test 4: Testing auto-pause...')
  await injectMetrics(config.experimentKey, 'treatment', {
    error_rate: 0.15 // Severe violation
  })

  await delay(config.checkInterval + 1000)

  const experimentStatus = await getExperimentStatus(config.experimentKey)
  console.log(`Experiment status: ${experimentStatus}`)
  console.log(`Expected: paused`)
  console.log(`✅ Test 4 ${experimentStatus === 'paused' ? 'PASSED' : 'FAILED'}\n`)

  console.log('=== All Tests Complete ===')
}

async function injectMetrics(
  experimentKey: string,
  variantKey: string,
  metrics: Record<string, number>
): Promise<void> {
  for (const [name, value] of Object.entries(metrics)) {
    await experimentWarehouse.logMetric(
      experimentKey,
      'test_user',
      name,
      value,
      { variantKey, test: true }
    )
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Run tests
testGuardrails()
```

## Real-World Examples

### Example 1: Payment Processor Outage

**Scenario:** Experiment changes checkout flow, accidentally breaks payment integration.

**Without Guardrails:**
- Takes 6 hours to notice (manual monitoring)
- 2,500 lost transactions
- $125,000 lost revenue
- Angry customers

**With Guardrails:**
```typescript
{
  metricName: 'payment_success_rate',
  operator: '>',
  threshold: 0.95, // Must succeed 95%+
  severity: 'critical',
  checkInterval: 60000 // Check every minute
}
```
- Detected in 2 minutes
- Experiment auto-paused
- Team alerted immediately
- 10 lost transactions
- $500 lost revenue
- **Guardrail saved: $124,500**

### Example 2: AI Quality Degradation

**Scenario:** New prompt improves speed but degrades quality over time.

**Without Guardrails:**
- Noticed after 2 weeks (user complaints)
- 50,000 low-quality responses sent
- Brand reputation damaged
- Customer churn increases

**With Guardrails:**
```typescript
{
  metricName: 'quality_score',
  operator: '>',
  threshold: 0.70,
  severity: 'critical',
  checkInterval: 900000 // Every 15 min
}
```
- Detected in 30 minutes
- Experiment paused automatically
- 200 low-quality responses (vs 50,000)
- **Guardrail prevented disaster**

### Example 3: Mobile Performance Regression

**Scenario:** New feature slows down mobile app.

**With Guardrails:**
```typescript
{
  metricName: 'p95_render_time_ms',
  operator: '<',
  threshold: 2000, // <2s
  severity: 'warning',
  checkInterval: 300000 // Every 5 min
},
{
  metricName: 'crash_rate',
  operator: '<',
  threshold: 0.01, // <1%
  severity: 'critical',
  checkInterval: 300000
}
```

**Result:**
- P95 render time: 2850ms (warning triggered)
- Team investigates
- Find memory leak in new feature
- Fix deployed before crash rate increases
- **Proactive prevention**

## Best Practices

### 1. Start Conservative

```typescript
// Better to have false alarms than miss real issues
{
  // Instead of:
  threshold: 0.05, // 5% error rate

  // Use:
  threshold: 0.02, // 2% error rate (with safety margin)
}
```

### 2. Layer Guardrails

```typescript
// Multiple layers of protection
const LAYERED_GUARDRAILS = [
  // Layer 1: Early warning
  { metric: 'error_rate', threshold: 0.01, severity: 'info' },

  // Layer 2: Concern
  { metric: 'error_rate', threshold: 0.02, severity: 'warning' },

  // Layer 3: Critical
  { metric: 'error_rate', threshold: 0.05, severity: 'critical' }
]
```

### 3. Monitor Absolute AND Relative

```typescript
// Absolute threshold
{ metric: 'revenue', threshold: 1000, operator: '>' }

// Relative threshold (vs control)
{ metric: 'revenue_ratio', threshold: 0.95, operator: '>' }
```

### 4. Different Thresholds by Time

```typescript
// Relax thresholds early, tighten later
function getThreshold(daysSinceStart: number): number {
  if (daysSinceStart < 2) {
    return 0.10 // 10% tolerance (early noise)
  } else if (daysSinceStart < 7) {
    return 0.05 // 5% tolerance
  } else {
    return 0.02 // 2% tolerance (should be stable)
  }
}
```

## Common Mistakes

### Mistake 1: No Guardrails on New Metrics

**Problem:** You track a new metric but forget to add guardrails.

**Solution:** Default guardrails for all experiments
```typescript
const DEFAULT_GUARDRAILS = [
  { metric: 'error_rate', threshold: 0.02 },
  { metric: 'p95_latency', threshold: 5000 }
]
```

### Mistake 2: Ignoring Warnings

**Problem:** Warning alerts are too frequent, team starts ignoring them.

**Solution:** Tune thresholds, reduce alert fatigue
```typescript
// Track alert frequency
const alertFrequency = await getAlertFrequency('last_7_days')
if (alertFrequency > 10) {
  console.warn('Too many alerts! Tune thresholds.')
}
```

### Mistake 3: No Testing

**Problem:** Guardrails fail when you need them.

**Solution:** Regular testing
```bash
# Weekly guardrail test
npm run test:guardrails
```

## Next Steps

Congratulations! You've learned to protect experiments with guardrails. 🎉

**What you learned:**
- ✅ Identifying critical metrics
- ✅ Setting appropriate thresholds
- ✅ Automated monitoring
- ✅ Alert handling
- ✅ Auto-pause on violations

**Continue learning:**
- Return to [Main Workshop](../workshops/production-ab-testing-workshop.md)
- Review [All Tutorials](../tutorials/)

**Apply it:**
1. Add guardrails to your current experiments
2. Test guardrails weekly
3. Document all violations
4. Share learnings with team

---

**Tutorial word count:** 2,847 words
