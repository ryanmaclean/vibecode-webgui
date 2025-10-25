# Experiment Scenarios

This directory contains pre-built experiment scenarios that demonstrate different A/B testing use cases.

## Available Scenarios

### Chatbot Performance Optimization (`chatbot-speed.ts`)

Compares two chatbot loading strategies to optimize user engagement:

**Variants:**
- **Lazy Load**: Initialize RAG client on first message (faster page load)
- **Preload**: Initialize RAG client on page load (instant response)

**Hypothesis:**
> Preloaded chatbot increases user engagement (messages per session) by 30% compared to lazy loading, despite slower initial load.

**Key Metrics:**
- Time to First Token (TTFT)
- Cold Start Latency
- Messages per Session
- Engagement Score (0-1)
- Session Duration

**Files:**
- `chatbot-speed.ts` - Main experiment logic
- `chatbot-test-data.ts` - Synthetic data generator
- Demo: `/experiments/demos/chatbot-performance`
- Tests: `/tests/lib/experiments/scenarios/chatbot-speed.test.ts`
- Workshop: `/docs/workshops/chatbot-performance-optimization.md`

**Quick Start:**

```typescript
import { createChatSession, sendChatMessage } from '@/lib/experiments/scenarios/chatbot-speed'

// Create session (automatically assigns variant)
const session = await createChatSession(userId, sessionId)

// Send message
const response = await sendChatMessage({
  userId,
  sessionId,
  message: 'How do I deploy to production?'
})

console.log(response.message)
console.log('TTFT:', response.metrics.ttftMs, 'ms')
console.log('Engagement:', response.metrics.engagementScore)
```

**Generate Test Data:**

```bash
# Generate 1000 synthetic sessions
npx tsx scripts/generate-chatbot-data.ts 1000
```

**Expected Results (1000+ sessions):**

| Metric | Lazy Load | Preload | Improvement |
|--------|-----------|---------|-------------|
| TTFT | ~1200ms | ~800ms | -33% ✓ |
| Cold Start | ~3500ms | 0ms | Eliminated |
| Messages/Session | ~2.8 | ~3.2 | +14% ✓ |
| Engagement | ~0.65 | ~0.72 | +11% ✓ |

**Decision:** Ship Preload variant (statistically significant engagement improvement)

---

## Creating New Scenarios

To create a new experiment scenario:

### 1. Define Experiment Configuration

```typescript
export const MY_EXPERIMENT = {
  experimentKey: 'my_experiment_v1',
  name: 'My Experiment Name',
  hypothesis: 'Clear, testable hypothesis',
  variants: {
    control: {
      key: 'control',
      description: 'Current behavior'
    },
    treatment: {
      key: 'treatment',
      description: 'New behavior'
    }
  },
  metrics: [
    { name: 'primary_metric', description: 'Main decision metric' },
    { name: 'secondary_metric', description: 'Supporting metric' }
  ]
}
```

### 2. Implement Core Functions

```typescript
// Session/user assignment
export async function assignVariant(
  userId: string,
  context?: any
): Promise<VariantKey> {
  // 50/50 randomization
  const variant = Math.random() < 0.5 ? 'control' : 'treatment'

  // Log to warehouse
  await experimentWarehouse.logAssignment(
    MY_EXPERIMENT.experimentKey,
    userId,
    variant,
    context
  )

  return variant
}

// Execute variant logic
export async function executeVariant(
  variantKey: VariantKey,
  context: any
): Promise<Result> {
  if (variantKey === 'control') {
    return await controlLogic(context)
  } else {
    return await treatmentLogic(context)
  }
}

// Track metrics
export async function logMetrics(
  userId: string,
  result: Result
): Promise<void> {
  await experimentWarehouse.logMetric(
    MY_EXPERIMENT.experimentKey,
    userId,
    'primary_metric',
    result.value,
    { variantKey: result.variant }
  )
}

// Get summary
export async function getSummary(): Promise<Summary> {
  const results = await experimentWarehouse.getExperimentResults(
    MY_EXPERIMENT.experimentKey
  )

  // Calculate statistics
  const summary = calculateStatistics(results)

  return summary
}
```

### 3. Create Test Data Generator

```typescript
export async function generateSyntheticData(count: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    const userId = `synthetic-user-${i}`
    const variant = i % 2 === 0 ? 'control' : 'treatment'

    await experimentWarehouse.logAssignment(
      MY_EXPERIMENT.experimentKey,
      userId,
      variant
    )

    // Generate realistic metrics
    const metricValue = variant === 'control'
      ? baselineValue + randomNoise()
      : baselineValue * (1 + expectedEffect) + randomNoise()

    await experimentWarehouse.logMetric(
      MY_EXPERIMENT.experimentKey,
      userId,
      'primary_metric',
      metricValue,
      { variant }
    )
  }

  await experimentWarehouse.flush()
}
```

### 4. Write Tests

```typescript
describe('My Experiment', () => {
  it('should assign variants correctly', async () => {
    const variant = await assignVariant('test-user-1')
    expect(['control', 'treatment']).toContain(variant)
  })

  it('should track metrics', async () => {
    const result = await executeVariant('treatment', context)
    await logMetrics('test-user', result)

    // Verify metrics logged
    const metrics = await experimentWarehouse.getMetrics(
      MY_EXPERIMENT.experimentKey,
      'primary_metric'
    )
    expect(metrics.length).toBeGreaterThan(0)
  })

  it('should generate summary', async () => {
    const summary = await getSummary()
    expect(summary.totalUsers).toBeGreaterThan(0)
    expect(summary.metrics).toBeDefined()
  })
})
```

### 5. Create Demo UI (Optional)

```typescript
// src/app/experiments/demos/my-experiment/page.tsx

export default function MyExperimentDemo() {
  const [variant, setVariant] = useState<VariantKey | null>(null)
  const [result, setResult] = useState<Result | null>(null)

  useEffect(() => {
    // Assign variant on mount
    assignVariant(userId).then(setVariant)
  }, [])

  async function runExperiment() {
    if (!variant) return

    const result = await executeVariant(variant, context)
    await logMetrics(userId, result)
    setResult(result)
  }

  return (
    <div>
      <h1>My Experiment</h1>
      <p>Your variant: {variant}</p>
      <button onClick={runExperiment}>Run Experiment</button>
      {result && <ResultDisplay result={result} />}
    </div>
  )
}
```

### 6. Document in Workshop Guide

Create a comprehensive workshop guide (see `chatbot-performance-optimization.md` as template):

- Introduction to the problem
- Experiment design
- Implementation guide
- Statistical analysis
- Best practices
- Exercises and quiz

---

## Best Practices

### Experiment Design

1. **Clear Hypothesis**: State expected effect size and direction
2. **Primary Metric**: Choose ONE main decision metric
3. **Guardrails**: Define safety thresholds
4. **Sample Size**: Calculate required users before launch

### Implementation

1. **Deterministic Assignment**: Same user always gets same variant
2. **Log Everything**: Track assignments and metrics
3. **Flush Regularly**: Use batch processing for high volume
4. **Error Handling**: Gracefully handle failures

### Analysis

1. **Statistical Significance**: p-value < 0.05
2. **Practical Significance**: Effect size > minimum threshold
3. **Guardrails**: All safety metrics pass
4. **SRM Check**: No sample ratio mismatch

### Decision Making

```typescript
function makeDecision(summary: Summary): Decision {
  // 1. Check guardrails
  if (!passesGuardrails(summary)) {
    return 'rollback'
  }

  // 2. Check statistical significance
  if (!summary.statisticalSignificance.primaryMetric.significant) {
    return 'continue'
  }

  // 3. Check practical significance
  if (summary.metrics.primaryMetric.improvement < 5) {
    return 'no_change'
  }

  // 4. Ship it!
  return 'ship_treatment'
}
```

---

## Common Pitfalls

### 1. Peeking

Don't stop early just because results look good. This inflates false positive rate.

**Solution:** Pre-determine sample size and duration.

### 2. Multiple Testing

Testing many variants/metrics increases false positive rate.

**Solution:** Use Bonferroni or Benjamini-Hochberg correction.

### 3. Sample Ratio Mismatch

Assignment distribution deviates from expected (e.g., not 50/50).

**Solution:** Always check SRM before analyzing results.

### 4. Novelty Effect

Users behave differently with new features initially.

**Solution:** Run experiments for at least 1-2 weeks.

### 5. Ignoring Practical Significance

Statistical significance doesn't mean business impact.

**Solution:** Define minimum effect size before experiment.

---

## Resources

- **Workshop Guide**: `/docs/workshops/chatbot-performance-optimization.md`
- **Statistics Library**: `/src/lib/experiments/statistics.ts`
- **Warehouse API**: `/src/lib/experiments/warehouse.ts`
- **Example Tests**: `/tests/lib/experiments/scenarios/chatbot-speed.test.ts`

---

## Contributing

To add a new scenario:

1. Create scenario file in this directory
2. Add test data generator
3. Write comprehensive tests
4. Create demo UI (optional)
5. Write workshop guide
6. Update this README

**Template Structure:**
```
scenarios/
├── my-experiment.ts          # Main logic
├── my-experiment-data.ts     # Test data generator
└── README.md                 # This file

tests/lib/experiments/scenarios/
└── my-experiment.test.ts     # Unit tests

docs/workshops/
└── my-experiment.md          # Workshop guide

src/app/experiments/demos/my-experiment/
└── page.tsx                  # Demo UI
```
