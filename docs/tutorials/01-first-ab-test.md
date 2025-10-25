# Your First A/B Test: Button Color Experiment

**Goal:** Ship a button color experiment in 15 minutes
**Difficulty:** Beginner
**Time:** 15-20 minutes
**Prerequisites:** Basic TypeScript knowledge, Node.js installed

---

## What You'll Learn

By the end of this tutorial, you will:
- ✅ Create your first A/B test configuration
- ✅ Implement variant logic in code
- ✅ Track user interactions
- ✅ Analyze statistical results
- ✅ Make a data-driven decision

## The Scenario

Your marketing team believes that changing the "Sign Up" button from blue to green will increase conversions. Before rolling out to all users, you need to test this hypothesis scientifically.

**Hypothesis:** "Changing the CTA button color from blue (#0066CC) to green (#28A745) will increase click-through rate by at least 15%."

## Step 1: Create Experiment Configuration (2 min)

First, define your experiment parameters:

```typescript
// experiments/button-color-test.ts

export const BUTTON_COLOR_EXPERIMENT = {
  // Unique identifier
  experimentKey: 'cta_button_color_v1',

  // Human-readable name
  name: 'CTA Button Color A/B Test',

  // What we're testing
  hypothesis: 'Green button increases clicks by 15% vs blue',

  // The variants
  variants: {
    control: {
      key: 'blue_button',
      name: 'Blue Button (Control)',
      buttonColor: '#0066CC',
      allocation: 0.5  // 50% of users
    },
    treatment: {
      key: 'green_button',
      name: 'Green Button (Treatment)',
      buttonColor: '#28A745',
      allocation: 0.5  // 50% of users
    }
  },

  // What we're measuring
  metrics: {
    primary: 'click_through_rate',
    secondary: ['time_to_click', 'bounce_rate']
  },

  // Safety checks
  guardrails: [
    { metric: 'error_rate', threshold: 0.01 },
    { metric: 'page_load_time', threshold: 2000 }
  ],

  // When to stop
  targetSampleSize: 5000,  // users per variant
  maxDuration: '14 days'
}
```

**Why this matters:**
- Clear hypothesis makes results interpretable
- 50/50 split ensures equal statistical power
- Guardrails protect against breaking the site
- Sample size ensures we can detect 15% improvement

## Step 2: Implement the Button Component (3 min)

Create a React component that shows different colors based on variant:

```typescript
// components/SignupButton.tsx

'use client'

import { useState, useEffect } from 'react'

export function SignupButton() {
  const [variant, setVariant] = useState<'blue_button' | 'green_button'>('blue_button')
  const [userId, setUserId] = useState<string>('')

  // Assign variant on component mount
  useEffect(() => {
    const uid = getUserId() // Get or create user ID
    const assignedVariant = assignVariant(uid, 'cta_button_color_v1')

    setUserId(uid)
    setVariant(assignedVariant)

    // Log assignment
    trackAssignment(uid, assignedVariant)
  }, [])

  // Get button color based on variant
  const buttonColor = variant === 'green_button' ? '#28A745' : '#0066CC'

  // Track click
  const handleClick = async () => {
    // Track the click event
    await trackClick(userId, variant)

    // Navigate to signup
    window.location.href = '/signup'
  }

  return (
    <button
      onClick={handleClick}
      style={{
        backgroundColor: buttonColor,
        color: 'white',
        padding: '16px 32px',
        fontSize: '18px',
        fontWeight: 'bold',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        transition: 'transform 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.05)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)'
      }}
    >
      Start Free Trial
    </button>
  )
}

// Helper: Get or create user ID
function getUserId(): string {
  let userId = localStorage.getItem('user_id')

  if (!userId) {
    userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    localStorage.setItem('user_id', userId)
  }

  return userId
}

// Helper: Assign variant using hash
function assignVariant(userId: string, experimentKey: string): 'blue_button' | 'green_button' {
  // Check if already assigned (sticky assignment)
  const cached = localStorage.getItem(`variant_${experimentKey}`)
  if (cached) return cached as any

  // Hash-based assignment for consistency
  const hash = hashString(userId + experimentKey)
  const variant = (hash % 2) === 0 ? 'blue_button' : 'green_button'

  // Cache the assignment
  localStorage.setItem(`variant_${experimentKey}`, variant)

  return variant
}

// Simple hash function
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash)
}

// Track assignment to experiment
async function trackAssignment(userId: string, variant: string) {
  await fetch('/api/experiments/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      experimentKey: 'cta_button_color_v1',
      userId,
      variant,
      event: 'assigned'
    })
  })
}

// Track button click
async function trackClick(userId: string, variant: string) {
  await fetch('/api/experiments/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      experimentKey: 'cta_button_color_v1',
      userId,
      variant,
      event: 'clicked',
      timestamp: new Date().toISOString()
    })
  })
}
```

**Key concepts:**

1. **Sticky assignment:** Once assigned, users always see the same variant
2. **Hash-based randomization:** Ensures 50/50 split without server call
3. **Separate tracking:** Assignment and clicks tracked independently

## Step 3: Set Up Backend Tracking (3 min)

Create an API endpoint to receive tracking events:

```typescript
// app/api/experiments/track/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { experimentWarehouse } from '@/lib/experiments/warehouse'

export async function POST(req: NextRequest) {
  try {
    const { experimentKey, userId, variant, event, timestamp } = await req.json()

    // Validate input
    if (!experimentKey || !userId || !variant || !event) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Log event to warehouse
    if (event === 'assigned') {
      // User assigned to variant
      await experimentWarehouse.logAssignment(
        experimentKey,
        userId,
        variant,
        { timestamp: timestamp || new Date() }
      )
    } else if (event === 'clicked') {
      // User clicked button
      await experimentWarehouse.logMetric(
        experimentKey,
        userId,
        'button_clicked',
        1, // Binary: 1 = clicked
        { variant, timestamp: timestamp || new Date() }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Tracking error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

## Step 4: Run the Experiment (5 min)

Deploy your changes and monitor the experiment:

```bash
# Build and deploy
npm run build
npm start

# Open in browser
open http://localhost:3000
```

**What to monitor:**

1. **Traffic split:** Should be ~50/50
   ```sql
   SELECT variant, COUNT(*) as users
   FROM experiment_assignments
   WHERE experiment_key = 'cta_button_color_v1'
   GROUP BY variant;

   -- Expected:
   -- blue_button:  ~2500 users
   -- green_button: ~2500 users
   ```

2. **Click-through rate:**
   ```sql
   SELECT
     a.variant,
     COUNT(DISTINCT a.user_id) as total_users,
     COUNT(DISTINCT m.user_id) as clicked_users,
     ROUND(COUNT(DISTINCT m.user_id)::numeric / COUNT(DISTINCT a.user_id), 4) as ctr
   FROM experiment_assignments a
   LEFT JOIN experiment_metrics m
     ON a.user_id = m.user_id
     AND m.metric_name = 'button_clicked'
   WHERE a.experiment_key = 'cta_button_color_v1'
   GROUP BY a.variant;

   -- Example results:
   -- blue_button:  2500 users, 125 clicks, 5.0% CTR
   -- green_button: 2500 users, 150 clicks, 6.0% CTR
   ```

3. **Sample Ratio Mismatch (SRM):**
   ```typescript
   import { detectSRM } from '@/lib/experiments/srm-detector'

   const result = await detectSRM({
     experimentKey: 'cta_button_color_v1',
     expected: [0.5, 0.5],
     observed: [2500, 2500]
   })

   if (result.hasSRM) {
     console.error('⚠️ Traffic split is broken! Investigate.')
   } else {
     console.log('✅ Traffic split looks good')
   }
   ```

## Step 5: Analyze Results (5 min)

After collecting ~5,000 users per variant (10,000 total), analyze:

```typescript
// scripts/analyze-button-experiment.ts

import { tTest, confidenceInterval, cohensD } from '@/lib/experiments/statistics'
import { experimentWarehouse } from '@/lib/experiments/warehouse'

async function analyzeButtonExperiment() {
  // Get click data
  const controlData = await getClickData('blue_button')
  const treatmentData = await getClickData('green_button')

  // Calculate click rates
  const controlCTR = calculateMean(controlData)
  const treatmentCTR = calculateMean(treatmentData)
  const absoluteDifference = treatmentCTR - controlCTR
  const relativeLift = (absoluteDifference / controlCTR) * 100

  // Statistical test
  const testResult = tTest(controlData, treatmentData, 0.05)

  // Confidence interval for difference
  const ci = confidenceInterval(treatmentData, 0.95)

  // Effect size
  const effectSize = cohensD(controlData, treatmentData)

  // Print results
  console.log('=== Button Color Experiment Results ===')
  console.log(`\nSample sizes:`)
  console.log(`  Control (blue):   ${controlData.length} users`)
  console.log(`  Treatment (green): ${treatmentData.length} users`)

  console.log(`\nClick-through rates:`)
  console.log(`  Control:   ${(controlCTR * 100).toFixed(2)}%`)
  console.log(`  Treatment: ${(treatmentCTR * 100).toFixed(2)}%`)
  console.log(`  Absolute difference: ${(absoluteDifference * 100).toFixed(2)} percentage points`)
  console.log(`  Relative lift: ${relativeLift.toFixed(1)}%`)

  console.log(`\nStatistical significance:`)
  console.log(`  P-value: ${testResult.pValue.toFixed(4)}`)
  console.log(`  Significant at α=0.05? ${testResult.significant ? 'YES ✅' : 'NO ❌'}`)

  console.log(`\nConfidence interval (95%):`)
  console.log(`  Treatment CTR: ${(ci.lower * 100).toFixed(2)}% to ${(ci.upper * 100).toFixed(2)}%`)

  console.log(`\nEffect size:`)
  console.log(`  Cohen's d: ${effectSize.toFixed(3)}`)
  console.log(`  Interpretation: ${interpretEffectSize(effectSize)}`)

  // Decision
  console.log(`\n=== RECOMMENDATION ===`)
  console.log(makeDecision(testResult, relativeLift, effectSize))
}

function calculateMean(data: number[]): number {
  return data.reduce((a, b) => a + b, 0) / data.length
}

function interpretEffectSize(d: number): string {
  if (d < 0.2) return 'Small effect'
  if (d < 0.5) return 'Medium effect'
  if (d < 0.8) return 'Large effect'
  return 'Very large effect'
}

function makeDecision(
  testResult: { significant: boolean; pValue: number },
  relativeLift: number,
  effectSize: number
): string {
  // Not statistically significant
  if (!testResult.significant) {
    if (relativeLift > 5) {
      return '⏸️ CONTINUE EXPERIMENT\n' +
             'Result is trending positive but not yet statistically significant.\n' +
             'Recommend collecting more data before making decision.'
    }
    return '❌ KEEP CONTROL (Blue Button)\n' +
           'No statistically significant difference detected.\n' +
           'Insufficient evidence to change.'
  }

  // Statistically significant
  if (relativeLift > 10 && effectSize > 0.2) {
    return '✅ SHIP TREATMENT (Green Button)\n' +
           'Statistically and practically significant improvement.\n' +
           'Green button increases clicks meaningfully.'
  }

  if (relativeLift > 0 && relativeLift < 5) {
    return '🤔 BORDERLINE\n' +
           'Statistically significant but small effect size.\n' +
           'Consider: Is a ' + relativeLift.toFixed(1) + '% improvement worth the change?'
  }

  if (relativeLift < 0) {
    return '❌ KEEP CONTROL (Blue Button)\n' +
           'Treatment is actually WORSE than control.\n' +
           'Do not ship green button.'
  }

  return '🤔 REVIEW MANUALLY\n' +
         'Results are ambiguous. Discuss with team.'
}

async function getClickData(variant: string): Promise<number[]> {
  const assignments = await experimentWarehouse.getAssignments(
    'cta_button_color_v1',
    variant
  )

  const clicks = await experimentWarehouse.getMetrics(
    'cta_button_color_v1',
    variant,
    'button_clicked'
  )

  // Create binary array: 1 if user clicked, 0 if not
  const clickSet = new Set(clicks.map(c => c.userId))
  return assignments.map(a => clickSet.has(a.userId) ? 1 : 0)
}

// Run analysis
analyzeButtonExperiment()
```

**Example output:**

```
=== Button Color Experiment Results ===

Sample sizes:
  Control (blue):   5,000 users
  Treatment (green): 5,000 users

Click-through rates:
  Control:   5.20%
  Treatment: 6.00%
  Absolute difference: 0.80 percentage points
  Relative lift: 15.4%

Statistical significance:
  P-value: 0.0312
  Significant at α=0.05? YES ✅

Confidence interval (95%):
  Treatment CTR: 5.48% to 6.52%

Effect size:
  Cohen's d: 0.189
  Interpretation: Small effect

=== RECOMMENDATION ===
✅ SHIP TREATMENT (Green Button)
Statistically and practically significant improvement.
Green button increases clicks meaningfully.
```

## Step 6: Make Your Decision

Based on results, choose one:

### ✅ Ship (Green Button Wins)

**Criteria met:**
- Statistically significant (p < 0.05)
- Meaningful improvement (> 10%)
- Guardrails passed

**Action:**
```typescript
// Update default button color
export const DEFAULT_BUTTON_COLOR = '#28A745' // Green

// Archive experiment
await archiveExperiment('cta_button_color_v1', {
  decision: 'ship_treatment',
  winner: 'green_button',
  impact: '+15.4% CTR',
  dateDecided: new Date()
})
```

### ❌ Don't Ship (Blue Button Stays)

**Criteria:**
- Not significant OR
- Improvement too small OR
- Treatment is worse

**Action:**
```typescript
await archiveExperiment('cta_button_color_v1', {
  decision: 'keep_control',
  winner: 'blue_button',
  reason: 'No significant improvement',
  dateDecided: new Date()
})
```

### ⏸️ Continue Experiment

**Criteria:**
- Trending positive but not significant
- Need more data

**Action:**
```typescript
// Extend duration
await updateExperiment('cta_button_color_v1', {
  targetSampleSize: 10000, // Double the sample
  maxDuration: '21 days'    // Extra week
})
```

## Troubleshooting

### Issue: Traffic split is 60/40 instead of 50/50

**Cause:** Hash function bias or caching issues

**Fix:**
```typescript
// Check hash distribution
const distribution = {}
for (let i = 0; i < 10000; i++) {
  const userId = `user_${i}`
  const variant = assignVariant(userId, 'cta_button_color_v1')
  distribution[variant] = (distribution[variant] || 0) + 1
}
console.log(distribution)
// Should be ~5000/5000
```

### Issue: No clicks recorded

**Cause:** Tracking endpoint not working

**Fix:**
```typescript
// Test tracking manually
await fetch('/api/experiments/track', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    experimentKey: 'cta_button_color_v1',
    userId: 'test_user_123',
    variant: 'green_button',
    event: 'clicked'
  })
})
// Check database for entry
```

### Issue: Results are inconclusive after 10,000 users

**Cause:** Effect size is smaller than expected (< 10%)

**Options:**
1. Increase sample size to detect smaller effects
2. Accept that difference is negligible
3. Try a more dramatic change (e.g., blue vs red vs yellow)

## What If Test Is Inconclusive?

**Scenario:**
```
P-value: 0.23 (not significant)
Relative lift: +3%
```

**Options:**

1. **Increase sample size**
   - Current: 5,000 users
   - Needed for 3% effect: ~50,000 users
   - Decision: Worth it if CTR is critical metric

2. **Accept null hypothesis**
   - 3% difference is too small to matter
   - Keep current blue button
   - Focus experiments elsewhere

3. **Test bigger change**
   - Try red button (more dramatic)
   - Test button size/copy instead
   - Combination: green + larger size

## Next Steps

Congratulations! You've run your first A/B test. 🎉

**What you learned:**
- ✅ Creating experiment configurations
- ✅ Implementing variant assignment
- ✅ Tracking user events
- ✅ Analyzing statistical significance
- ✅ Making data-driven decisions

**Next tutorials:**
- [AI Model Comparison](./02-ai-model-comparison.md) - Compare GPT-4 vs Claude
- [Multi-Armed Bandits](./03-multi-armed-bandits.md) - Dynamic optimization
- [Experiment Guardrails](./04-experiment-guardrails.md) - Prevent disasters

**Challenges:**
1. Add a third variant (red button)
2. Track secondary metric (time to click)
3. Implement automated winner selection
4. Set up Slack alerts for results

---

**Estimated completion time:** 15-20 minutes
**Tutorial word count:** 2,156 words

**Feedback:** Was this helpful? [Open an issue](https://github.com/your-repo/issues) with suggestions!
