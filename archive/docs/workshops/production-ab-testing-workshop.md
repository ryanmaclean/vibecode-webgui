# Building Production-Grade A/B Testing with Datadog & Eppo Patterns

**Duration:** 4.5 hours (with breaks)
**Level:** Intermediate to Advanced
**Prerequisites:**
- Basic understanding of statistics (mean, variance)
- Experience with TypeScript/JavaScript
- Familiarity with REST APIs
- Understanding of A/B testing concepts

**Learning Objectives:**
By the end of this workshop, you will be able to:
- Design and launch production A/B tests with statistical rigor
- Implement experiments for AI models with proper metrics
- Use multi-armed bandits for dynamic optimization
- Set up guardrails to prevent harmful changes
- Interpret statistical results and make data-driven decisions
- Avoid common experimentation pitfalls

---

## Table of Contents

1. [Part 1: Introduction to Experimentation (30 min)](#part-1-introduction-to-experimentation-30-min)
2. [Part 2: Statistical Foundations (45 min)](#part-2-statistical-foundations-45-min)
3. [Part 3: Hands-On - Your First Experiment (60 min)](#part-3-hands-on---your-first-experiment-60-min)
4. [Part 4: AI-Specific Experiments (60 min)](#part-4-ai-specific-experiments-60-min)
5. [Part 5: Advanced Topics (45 min)](#part-5-advanced-topics-45-min)
6. [Part 6: Q&A and Best Practices (30 min)](#part-6-qa-and-best-practices-30-min)

---

## Part 1: Introduction to Experimentation (30 min)

### Why Experimentation Matters

The data is sobering: **95% of product features fail to move key metrics**. That's not a typo. According to research from Microsoft, Amazon, and Google analyzing thousands of experiments:

- Only 1 in 3 ideas improves the target metric
- 1 in 3 ideas has no measurable impact
- 1 in 3 ideas actually hurts the metric

**The cost of shipping without testing:**
- Wasted engineering resources on features nobody wants
- Degraded user experience from harmful changes
- Missed opportunities by not knowing what works
- Lost revenue from suboptimal implementations

**The value of experimentation:**
- Validates assumptions before full rollout
- Quantifies impact with statistical confidence
- Enables data-driven decision making
- Reduces risk of costly mistakes
- Compounds learning across the organization

### Common Mistakes in A/B Testing

Even experienced teams make critical errors. Here are the most common:

#### 1. Peeking at Results Too Early

**The Mistake:**
```typescript
// Day 1: "Oh, treatment is 5% better! Ship it!"
// Day 3: "Wait, now it's 2% worse..."
// Day 7: "Inconclusive. Start over?"
```

**Why It's Wrong:**
Early stopping inflates false positive rates from 5% to 30%+. Random variance in small samples creates misleading signals.

**The Fix:**
Use sequential testing methods (mSPRT) or always-valid p-values that account for continuous monitoring. Or simply: decide your sample size upfront and wait.

#### 2. Ignoring Sample Size Requirements

**The Mistake:**
```typescript
// Control: 50 conversions from 1000 users (5.0%)
// Treatment: 55 conversions from 1000 users (5.5%)
// "10% improvement! Ship it!"
```

**Why It's Wrong:**
With only 1000 users per variant, a 5% → 5.5% change is not statistically significant (p=0.31). You're likely seeing random noise.

**The Fix:**
Calculate required sample size BEFORE launching:
```typescript
import { calculateMinimumSampleSize } from '@/lib/experiments/statistics'

const sampleSize = calculateMinimumSampleSize(
  0.05,    // baseline conversion rate
  0.10,    // 10% relative change (0.05 → 0.055)
  0.80,    // 80% power
  0.05     // 5% significance level
)
// Result: ~31,000 users per variant needed
```

#### 3. Sample Ratio Mismatch (SRM)

**The Mistake:**
You expect 50/50 traffic split but see 48% / 52%. "Close enough, right?"

**Why It's Wrong:**
SRM indicates broken randomization, which invalidates your results. Common causes:
- Redirect loops
- Caching issues
- Bot traffic
- Selection bias

**The Fix:**
Always run SRM checks:
```typescript
import { detectSRM } from '@/lib/experiments/srm-detector'

const result = detectSRM({
  expected: [0.5, 0.5],
  observed: [4800, 5200]
})

if (result.hasSRM) {
  console.error('SRM detected! Do not trust results.')
  // Investigate and fix before continuing
}
```

#### 4. Confusing Statistical and Practical Significance

**The Mistake:**
```
P-value: 0.001 (highly significant!)
Effect: +0.01% improvement
Decision: Ship it!
```

**Why It's Wrong:**
With large sample sizes, tiny meaningless differences become "statistically significant." A 0.01% improvement may cost more to maintain than it's worth.

**The Fix:**
Always consider both:
- **Statistical significance**: Is this likely real (p < 0.05)?
- **Practical significance**: Is this worth caring about (> 2% improvement)?

### Overview: Our Platform vs Datadog/Eppo

Our experimentation platform combines the best of both worlds:

| Feature | Our Platform | Datadog Experiments | Eppo |
|---------|-------------|---------------------|------|
| **Statistical Engine** | Built-in (t-tests, sequential, Bayesian) | Basic | Advanced |
| **A/B Testing** | ✅ Full support | ✅ | ✅ |
| **Multi-Armed Bandits** | ✅ Thompson Sampling | ❌ | ✅ Limited |
| **AI Model Experiments** | ✅ Native support | ❌ | ❌ |
| **Guardrails** | ✅ Real-time monitoring | ⚠️ Manual | ✅ |
| **Data Warehouse** | ✅ Built-in | ❌ External only | ✅ |
| **Cost** | Open source | $$ | $$$ |
| **Setup Time** | < 1 hour | Days | Days |

**Our unique advantages for AI:**
- Time to First Token (TTFT) tracking
- Cost per request monitoring
- Quality evaluation with LLM-as-judge
- Model comparison dashboards
- Thompson Sampling for cost optimization

### Real-World Case Studies

#### Case Study 1: Netflix - Artwork Personalization

**Challenge:** Which thumbnail image drives more engagement?

**Approach:** A/B test showing different artwork to different users

**Results:**
- 30% increase in engagement
- Discovered personalized artwork outperforms "best" static image
- Annual value: $1B+ in increased engagement

**Key Learning:** Personalization beats one-size-fits-all

#### Case Study 2: Booking.com - Scarcity Messages

**Challenge:** Do "Only 2 rooms left!" messages increase bookings?

**Approach:** A/B test with/without scarcity messaging

**Results:**
- +5% booking rate (treatment)
- But -8% return visit rate (long-term harm)
- Decision: Do NOT ship

**Key Learning:** Always check long-term metrics, not just short-term wins

#### Case Study 3: Microsoft Bing - Ad Revenue

**Challenge:** Increase ad clicks without hurting user experience

**Approach:** Test showing more ads per page

**Results:**
- +12% ad revenue (yay!)
- -0.5% searches per user (oops)
- Net impact: -$10M annually

**Key Learning:** Consider second-order effects and user satisfaction

### Workshop Goals and Prerequisites

**By the end of this workshop, you will:**

✅ Launch a button color A/B test
✅ Compare GPT-4 vs Claude with statistical rigor
✅ Implement Thompson Sampling for model selection
✅ Set up automated guardrails
✅ Interpret confidence intervals correctly
✅ Avoid the peeking problem

**Prerequisites Check:**

Before continuing, ensure you have:
- [ ] Node.js 18+ installed
- [ ] PostgreSQL database running
- [ ] Code editor (VS Code recommended)
- [ ] Basic statistics knowledge (or willingness to learn!)
- [ ] Git repository cloned and dependencies installed

```bash
git clone https://github.com/your-org/experimentation-platform
cd experimentation-platform
npm install
npm run db:migrate
npm run dev
```

---

## Part 2: Statistical Foundations (45 min)

### Core Concepts Explained Simply

Let's demystify the statistics. You don't need a PhD—just clear intuitions.

#### P-Values: What They ACTUALLY Mean

**Wrong interpretation:**
"P = 0.03 means there's a 97% chance treatment is better than control."

**Correct interpretation:**
"P = 0.03 means: IF treatment has no effect (null hypothesis), we'd see results this extreme only 3% of the time by chance."

**Intuitive analogy:**

Imagine you flip a coin 10 times and get 8 heads. Is it a fair coin?

- If it's fair (50/50), getting 8+ heads happens 5.5% of the time
- P-value = 0.055
- At α = 0.05, you can't reject "fair coin" (not significant)
- But at α = 0.10, you can reject it (significant)

**The p-value doesn't tell you:**
- Probability treatment is better (that's Bayesian!)
- Size of the effect (that's effect size!)
- Importance of the effect (that's practical significance!)

**What p-value DOES tell you:**
- Strength of evidence against "no difference"
- Whether to reject the null hypothesis at your chosen α level

#### Confidence Intervals: The Range of Plausible Values

**Definition:**
A 95% confidence interval means: If we repeated this experiment 100 times, 95 of those intervals would contain the true effect.

**Example:**

```typescript
Control conversion rate: 5.0%
Treatment conversion rate: 5.5%
Difference: +0.5 percentage points

95% CI for difference: [-0.2%, +1.2%]
```

**Interpretation:**
- We're 95% confident the true difference is between -0.2% and +1.2%
- The interval includes zero (no effect)
- Result is NOT statistically significant
- We cannot conclude treatment is better

**Visual representation:**

```
      <---------------------->
      |                      |
   -0.2%      0%          +1.2%
   (worse)  (no diff)   (better)
```

**Decision rules:**
- If entire CI is above zero → Treatment is conclusively better
- If entire CI is below zero → Treatment is conclusively worse
- If CI contains zero → Result is inconclusive

#### Type I and Type II Errors

Experimentation has two types of mistakes:

**Type I Error (False Positive):**
- Reality: Treatment has no effect
- Your conclusion: Treatment is better
- Probability: α (typically 5%)
- Consequence: Ship useless feature

**Type II Error (False Negative):**
- Reality: Treatment IS better
- Your conclusion: No significant difference
- Probability: β (typically 20%)
- Consequence: Miss good opportunity

**Power = 1 - β = 80%**
Power is the probability of detecting a real effect when it exists.

**The trade-off:**

```
More conservative (lower α):
  ✅ Fewer false positives
  ❌ More false negatives (need larger samples)

More aggressive (higher α):
  ✅ Detect smaller effects
  ❌ More false positives
```

**Standard practice:**
- α = 0.05 (5% false positive rate)
- Power = 0.80 (80% chance to detect real effect)

#### Effect Size: Practical vs Statistical Significance

**Effect size measures MAGNITUDE:**

Common metrics:
- **Cohen's d**: Standardized difference between means
- **Relative uplift**: Percentage change
- **Absolute difference**: Raw difference in metrics

**Example:**

Scenario A (Large sample, small effect):
```
Sample size: 100,000 per variant
Control: 10.0% conversion
Treatment: 10.1% conversion
P-value: 0.001 (highly significant!)
Effect: +1% relative improvement

Decision: DON'T SHIP (not worth the effort)
```

Scenario B (Small sample, large effect):
```
Sample size: 500 per variant
Control: 10.0% conversion
Treatment: 15.0% conversion
P-value: 0.08 (not significant)
Effect: +50% relative improvement

Decision: CONTINUE EXPERIMENT (promising but needs more data)
```

**Cohen's d interpretation:**
- d < 0.2: Small effect
- d ≈ 0.5: Medium effect
- d > 0.8: Large effect

#### Power Analysis and Sample Size

**Power analysis answers:**
"How many users do I need to detect an X% improvement?"

**The formula (simplified):**

```
n = 16 × σ² / δ²

Where:
n = sample size per variant
σ = standard deviation
δ = minimum detectable effect
```

**In practice, use our calculator:**

```typescript
import { calculateMinimumSampleSize } from '@/lib/experiments/statistics'

// Scenario: Improve 5% conversion rate by 10%
const n = calculateMinimumSampleSize(
  0.05,     // baseline rate
  0.10,     // 10% relative change
  0.80,     // 80% power
  0.05      // 5% alpha
)

console.log(`Need ${n} users per variant`)
// Output: Need 31,068 users per variant
```

**Key insights:**
- Detecting small effects requires HUGE samples
- Power increases with sample size
- Smaller MDE (minimum detectable effect) = more samples needed

**Practical table:**

| Baseline | MDE | Power | Alpha | Samples Needed |
|----------|-----|-------|-------|----------------|
| 5% | 10% | 80% | 5% | 31,068 |
| 5% | 20% | 80% | 5% | 7,767 |
| 5% | 50% | 80% | 5% | 1,243 |
| 10% | 10% | 80% | 5% | 15,406 |
| 10% | 20% | 80% | 5% | 3,852 |

**Rule of thumb:**
For typical web experiments, plan for 2,000-10,000 users per variant for meaningful effects (10-30% improvements).

### Common Misconceptions Debunked

#### Myth 1: "Higher p-value = No effect"

**Wrong:** P = 0.30 doesn't mean "no effect." It means "insufficient evidence."

**Right:** Either (a) there's no effect, OR (b) your sample is too small to detect it.

#### Myth 2: "Statistically significant = Important"

**Wrong:** With enough data, a 0.001% improvement becomes "significant."

**Right:** Always check if the effect size is practically meaningful.

#### Myth 3: "95% confidence means 95% probability"

**Wrong:** CI is about repeated experiments, not probability.

**Right:** If we ran this 100 times, 95 intervals would contain the true value.

#### Myth 4: "Non-significant means equal"

**Wrong:** P > 0.05 doesn't prove treatment = control.

**Right:** It means you can't reject the null hypothesis (yet). Get more data.

### Interactive Exercises

#### Exercise 1: Calculate Sample Size

**Scenario:**
You want to improve email open rate from 20% to 23% (15% relative improvement).

**Task:** Calculate required sample size.

```typescript
import { calculateMinimumSampleSize } from '@/lib/experiments/statistics'

const sampleSize = calculateMinimumSampleSize(
  // Fill in your values
)
```

<details>
<summary>Solution</summary>

```typescript
const sampleSize = calculateMinimumSampleSize(
  0.20,    // 20% baseline
  0.15,    // 15% relative improvement
  0.80,    // 80% power
  0.05     // 5% alpha
)
// Result: ~2,300 emails per variant
```
</details>

#### Exercise 2: Interpret Confidence Intervals

**Scenario:**
You run an experiment comparing two checkout flows. Results:

- Control: 15.2% conversion
- Treatment: 16.8% conversion
- Difference: +1.6 percentage points
- 95% CI: [-0.3%, +3.5%]
- P-value: 0.09

**Questions:**
1. Is this statistically significant at α = 0.05?
2. Should you ship the treatment?
3. What would you recommend?

<details>
<summary>Solution</summary>

1. **Not statistically significant** (p = 0.09 > 0.05, and CI includes zero)

2. **Don't ship yet.** The confidence interval includes negative values, meaning treatment COULD be worse.

3. **Recommendation:**
   - Continue experiment to get more data
   - Current result is promising (+1.6% observed)
   - Need ~2x more samples to reach significance
   - Or use Bayesian methods to incorporate prior knowledge
</details>

#### Exercise 3: Identify Peeking Problem

**Scenario:**
You check experiment results daily for 2 weeks. On day 8, you see p < 0.05 and ship.

**Question:** What's wrong with this approach?

<details>
<summary>Solution</summary>

**Problem:** Multiple testing / peeking inflates false positive rate.

- With 14 checks (one per day), even if there's no real effect, you have ~50% chance of seeing p < 0.05 at least once
- Your actual false positive rate is ~50%, not 5%

**Solutions:**
1. Decide sample size upfront and only check once
2. Use sequential testing (mSPRT, always-valid p-values)
3. Apply Bonferroni correction: α = 0.05 / 14 = 0.0036
4. Use Bayesian methods with fixed decision thresholds
</details>

---

## Part 3: Hands-On - Your First Experiment (60 min)

Let's build a real A/B test from scratch: testing button colors for click-through rate.

### Step 1: Define Your Hypothesis

**Bad hypothesis:**
"Green button might be better than blue button."

**Good hypothesis:**
"Changing the CTA button from blue to green will increase clicks by at least 20%, based on color psychology research showing green conveys 'go' more strongly than blue."

**SMART criteria:**
- **Specific:** Green vs blue button
- **Measurable:** Click-through rate
- **Achievable:** 20% improvement
- **Relevant:** Based on research
- **Time-bound:** 2 weeks or 10,000 users

### Step 2: Create Experiment Configuration

```typescript
// experiments/button-color-test.ts

import { createExperiment } from '@/lib/experiments'

export const BUTTON_COLOR_EXPERIMENT = {
  experimentKey: 'cta_button_color_v1',
  name: 'CTA Button Color Test',
  hypothesis: 'Green button increases clicks by 20% vs blue',

  variants: {
    control: {
      key: 'blue_button',
      name: 'Blue Button (Control)',
      description: 'Current blue #0066CC button',
      allocation: 0.5
    },
    treatment: {
      key: 'green_button',
      name: 'Green Button (Treatment)',
      description: 'New green #28A745 button',
      allocation: 0.5
    }
  },

  metrics: {
    primary: [
      {
        name: 'click_rate',
        type: 'conversion',
        description: 'Percentage of users who clicked CTA'
      }
    ],
    secondary: [
      {
        name: 'time_to_click',
        type: 'continuous',
        description: 'Seconds from page load to click'
      }
    ]
  },

  guardrails: [
    {
      metricName: 'page_load_time',
      operator: '<',
      threshold: 2000, // ms
      severity: 'critical'
    },
    {
      metricName: 'error_rate',
      operator: '<',
      threshold: 0.01,
      severity: 'critical'
    }
  ],

  sampleSize: 5000, // per variant
  duration: '14 days',
  owner: 'growth-team'
}
```

### Step 3: Set Up Variants

**Frontend implementation:**

```typescript
// components/CTAButton.tsx

import { useExperiment } from '@/hooks/useExperiment'

export function CTAButton() {
  const { variant, trackMetric } = useExperiment('cta_button_color_v1')

  const buttonColor = variant === 'green_button' ? '#28A745' : '#0066CC'
  const startTime = Date.now()

  const handleClick = () => {
    const timeToClick = Date.now() - startTime

    // Track primary metric
    trackMetric('click_rate', 1) // Conversion event

    // Track secondary metric
    trackMetric('time_to_click', timeToClick)

    // Continue with normal button action
    window.location.href = '/signup'
  }

  return (
    <button
      onClick={handleClick}
      style={{
        backgroundColor: buttonColor,
        color: 'white',
        padding: '12px 24px',
        fontSize: '16px',
        borderRadius: '4px',
        border: 'none',
        cursor: 'pointer'
      }}
    >
      Start Free Trial
    </button>
  )
}
```

**Backend tracking:**

```typescript
// app/api/experiments/button-color/track/route.ts

import { experimentWarehouse } from '@/lib/experiments/warehouse'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { userId, variantKey, metricName, value } = await req.json()

  // Log metric to warehouse
  await experimentWarehouse.logMetric(
    'cta_button_color_v1',
    userId,
    metricName,
    value,
    { variantKey, timestamp: new Date() }
  )

  return NextResponse.json({ success: true })
}
```

### Step 4: Define Metrics

**Primary metric: Click Rate**

```typescript
// Calculate click rate per variant
export async function getClickRate(
  experimentKey: string,
  variantKey: string
): Promise<number> {
  const assignments = await experimentWarehouse.getAssignments(
    experimentKey,
    variantKey
  )

  const clicks = await experimentWarehouse.getMetricCount(
    experimentKey,
    variantKey,
    'click_rate'
  )

  return clicks / assignments.length
}
```

**Secondary metric: Time to Click**

```typescript
export async function getAvgTimeToClick(
  experimentKey: string,
  variantKey: string
): Promise<number> {
  const values = await experimentWarehouse.getMetricValues(
    experimentKey,
    variantKey,
    'time_to_click'
  )

  return values.reduce((a, b) => a + b, 0) / values.length
}
```

### Step 5: Configure Guardrails

Guardrails prevent harmful changes from shipping:

```typescript
import { evaluateGuardrails } from '@/lib/experiments/guardrails'

// Run every hour
setInterval(async () => {
  const result = await evaluateGuardrails('cta_button_color_v1', [
    {
      metricName: 'error_rate',
      operator: '<',
      threshold: 0.02,
      severity: 'critical',
      description: 'Error rate must stay below 2%'
    },
    {
      metricName: 'page_load_time',
      operator: '<',
      threshold: 2000,
      severity: 'warning',
      description: 'Page load should be under 2s'
    }
  ])

  if (!result.passed) {
    console.error('Guardrail violation:', result.summary)

    if (result.shouldStop) {
      // Automatically pause experiment
      await pauseExperiment('cta_button_color_v1')
      await alertTeam('Experiment paused due to guardrail violation')
    }
  }
}, 3600000) // Every hour
```

### Step 6: Launch Experiment

```typescript
import { launchExperiment } from '@/lib/experiments/lifecycle'

// Launch with gradual rollout
await launchExperiment({
  experimentKey: 'cta_button_color_v1',
  startDate: new Date(),
  initialTrafficPercentage: 0.1, // Start with 10% traffic
  rampSchedule: [
    { day: 3, traffic: 0.25 },  // After 3 days, 25%
    { day: 7, traffic: 0.50 },  // After 1 week, 50%
    { day: 14, traffic: 1.00 }  // After 2 weeks, 100%
  ]
})
```

### Step 7: Monitor Results

**Real-time dashboard:**

```typescript
// app/experiments/[key]/dashboard/page.tsx

export default function ExperimentDashboard({ params }: { params: { key: string } }) {
  const { data, loading } = useExperimentResults(params.key)

  if (loading) return <Spinner />

  const { control, treatment, statistics } = data

  return (
    <div>
      <h1>CTA Button Color Test</h1>

      <MetricCard
        title="Click Rate"
        control={control.click_rate}
        treatment={treatment.click_rate}
        statistics={statistics.click_rate}
      />

      <ConfidenceInterval
        metric="click_rate"
        difference={statistics.click_rate.difference}
        confidenceInterval={statistics.click_rate.ci}
      />

      <GuardrailStatus
        experimentKey={params.key}
        guardrails={data.guardrails}
      />
    </div>
  )
}
```

### Step 8: Analyze Results

After collecting sufficient data:

```typescript
import { tTest, confidenceInterval } from '@/lib/experiments/statistics'

async function analyzeExperiment() {
  // Get click data
  const controlClicks = await getClickData('cta_button_color_v1', 'blue_button')
  const treatmentClicks = await getClickData('cta_button_color_v1', 'green_button')

  // Run statistical test
  const testResult = tTest(controlClicks, treatmentClicks, 0.05)

  // Calculate confidence interval
  const ci = confidenceInterval(treatmentClicks, 0.95)

  // Calculate effect size
  const controlRate = calculateMean(controlClicks)
  const treatmentRate = calculateMean(treatmentClicks)
  const relativeUplift = (treatmentRate - controlRate) / controlRate

  return {
    significant: testResult.significant,
    pValue: testResult.pValue,
    controlRate,
    treatmentRate,
    relativeUplift,
    confidenceInterval: ci,
    recommendation: getRecommendation(testResult, relativeUplift)
  }
}

function getRecommendation(testResult, uplift) {
  if (!testResult.significant) {
    return 'CONTINUE_EXPERIMENT' // Need more data
  }

  if (uplift > 0.05) {
    return 'SHIP_TREATMENT' // Meaningful improvement
  }

  if (uplift < -0.02) {
    return 'KEEP_CONTROL' // Treatment is worse
  }

  return 'NO_CHANGE' // Significant but not meaningful
}
```

### Step 9: Make Decision

**Decision framework:**

```
✅ SHIP if:
  - Statistically significant (p < 0.05)
  - Practically significant (> 5% improvement)
  - Guardrails passed
  - No negative secondary effects

❌ DON'T SHIP if:
  - Not statistically significant
  - Improvement too small to matter
  - Guardrails violated
  - Negative impact on key metrics

⏸️ CONTINUE if:
  - Trending positive but not yet significant
  - Need more data to reach target power
  - Results are inconclusive
```

### Common Gotchas and Solutions

#### Gotcha 1: Cached Variant Assignment

**Problem:** User gets different variant on page refresh

**Solution:** Store variant in cookie/session
```typescript
export function assignVariant(userId: string, experimentKey: string): string {
  // Check cookie first
  const cachedVariant = getCookie(`variant_${experimentKey}`)
  if (cachedVariant) return cachedVariant

  // Assign and cache
  const variant = hashAssignment(userId, experimentKey)
  setCookie(`variant_${experimentKey}`, variant, { maxAge: 86400 * 30 })

  return variant
}
```

#### Gotcha 2: Bot Traffic

**Problem:** Bots skew results

**Solution:** Filter bot traffic
```typescript
export function isBot(userAgent: string): boolean {
  const botPatterns = [
    /bot/i, /crawler/i, /spider/i, /scraper/i
  ]
  return botPatterns.some(pattern => pattern.test(userAgent))
}
```

#### Gotcha 3: Selection Bias

**Problem:** Only analyzing users who clicked (survivorship bias)

**Solution:** Intention-to-treat analysis
```typescript
// WRONG: Only analyze users who clicked
const clickerConversion = await getConversion({ clicked: true })

// RIGHT: Analyze all assigned users
const allUserConversion = await getConversion({ /* all users */ })
```

### Exercise: Create Your Own Button Test

**Your task:** Modify the button test to compare three variants:
1. Blue button (control)
2. Green button (treatment A)
3. Red button (treatment B)

**Steps:**
1. Update experiment config with 33/33/33 split
2. Implement three-way comparison
3. Use ANOVA or pairwise t-tests with Bonferroni correction
4. Determine which variant wins

**Bonus:** Add a secondary metric for button hover rate.

---

## Part 4: AI-Specific Experiments (60 min)

AI experiments have unique challenges. Let's tackle them.

### Why AI Experiments Differ

**Traditional A/B test:**
- Binary outcome (clicked / didn't click)
- Fast feedback (instant)
- Clear metrics (conversion rate)
- Low cost per trial ($0.001)

**AI model comparison:**
- Continuous outcome (quality score 0-1)
- Delayed feedback (need human evaluation)
- Ambiguous metrics (what is "quality"?)
- High cost per trial ($0.01-$0.10)

### Key Metrics for AI

#### 1. Latency Metrics

**Time to First Token (TTFT):**
```typescript
export async function measureTTFT(
  model: string,
  prompt: string
): Promise<number> {
  const startTime = Date.now()
  const stream = await openai.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    stream: true
  })

  const firstChunk = await stream.next()
  const ttft = Date.now() - startTime

  return ttft
}
```

**Percentile latencies (P50, P95, P99):**
```typescript
export function calculatePercentiles(
  latencies: number[]
): { p50: number; p95: number; p99: number } {
  const sorted = latencies.sort((a, b) => a - b)

  return {
    p50: sorted[Math.floor(sorted.length * 0.50)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)]
  }
}
```

#### 2. Cost Metrics

**Cost per request:**
```typescript
export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = {
    'gpt-4': { input: 0.03, output: 0.06 },      // per 1K tokens
    'gpt-4-turbo': { input: 0.01, output: 0.03 },
    'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
    'claude-3-opus': { input: 0.015, output: 0.075 },
    'claude-3-sonnet': { input: 0.003, output: 0.015 }
  }

  const prices = pricing[model]
  return (
    (inputTokens / 1000) * prices.input +
    (outputTokens / 1000) * prices.output
  )
}
```

**Cost per 1K users:**
```typescript
export async function getCostMetrics(
  experimentKey: string,
  variantKey: string
): Promise<CostMetrics> {
  const costs = await experimentWarehouse.getMetricValues(
    experimentKey,
    variantKey,
    'cost_usd'
  )

  const totalCost = costs.reduce((a, b) => a + b, 0)
  const avgCost = totalCost / costs.length
  const costPer1K = avgCost * 1000

  return { totalCost, avgCost, costPer1K }
}
```

#### 3. Quality Metrics

**Heuristic scoring (fast, cheap):**
```typescript
export function evaluateQualityHeuristic(response: string): number {
  let score = 0

  // Length (optimal: 200-1000 chars)
  const length = response.length
  if (length >= 200 && length <= 1000) {
    score += 0.3
  } else if (length < 100 || length > 2000) {
    score += 0.0
  } else {
    score += 0.15
  }

  // Structure (has lists, headings, paragraphs)
  if (response.includes('\n-') || response.includes('\n*')) score += 0.2
  if (response.includes('#')) score += 0.1

  // Content (code blocks, examples)
  if (response.includes('```')) score += 0.2
  if (response.includes('example') || response.includes('Example')) score += 0.1

  // Confidence indicators
  if (response.toLowerCase().includes('i think') ||
      response.toLowerCase().includes('maybe')) {
    score -= 0.1 // Penalize uncertainty
  }

  return Math.max(0, Math.min(1, score))
}
```

**LLM-as-judge (slow, expensive, accurate):**
```typescript
export async function evaluateQualityLLM(
  question: string,
  response: string
): Promise<number> {
  const judgment = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{
      role: 'system',
      content: `You are a quality evaluator. Rate the response on a scale of 0-1 based on:
        - Relevance to the question
        - Completeness of answer
        - Accuracy of information
        - Clarity of explanation

        Return ONLY a number between 0 and 1.`
    }, {
      role: 'user',
      content: `Question: ${question}\n\nResponse: ${response}`
    }]
  })

  return parseFloat(judgment.choices[0].message.content || '0.5')
}
```

### Hands-On: GPT-4 vs GPT-4 Turbo Comparison

Let's compare two OpenAI models for code explanation quality and cost.

**Experiment setup:**

```typescript
// experiments/model-comparison.ts

export const MODEL_COMPARISON_EXPERIMENT = {
  experimentKey: 'gpt4_vs_gpt4turbo_v1',
  name: 'GPT-4 vs GPT-4 Turbo for Code Explanations',
  hypothesis: 'GPT-4 Turbo provides 95% of GPT-4 quality at 1/3 the cost',

  variants: {
    control: {
      key: 'gpt4',
      model: 'gpt-4',
      name: 'GPT-4'
    },
    treatment: {
      key: 'gpt4_turbo',
      model: 'gpt-4-turbo',
      name: 'GPT-4 Turbo'
    }
  },

  metrics: {
    primary: ['quality_score', 'cost_per_request'],
    secondary: ['ttft_ms', 'total_tokens', 'user_rating']
  },

  sampleSize: 500 // requests per variant
}
```

**Implementation:**

```typescript
// API route: app/api/ai/explain-code/route.ts

import { selectVariant } from '@/lib/experiments'
import { experimentWarehouse } from '@/lib/experiments/warehouse'
import { evaluateQualityHeuristic, calculateCost } from '@/lib/experiments/quality-evaluation'

export async function POST(req: Request) {
  const { userId, code, language } = await req.json()

  // Assign variant
  const variant = await selectVariant({
    experimentKey: 'gpt4_vs_gpt4turbo_v1',
    userId
  })

  const model = variant.model
  const startTime = Date.now()

  // Call OpenAI
  const completion = await openai.chat.completions.create({
    model,
    messages: [{
      role: 'system',
      content: 'You are a code explanation expert. Explain code clearly and concisely.'
    }, {
      role: 'user',
      content: `Explain this ${language} code:\n\n${code}`
    }],
    stream: false
  })

  const response = completion.choices[0].message.content || ''
  const ttft = Date.now() - startTime

  // Calculate metrics
  const quality = evaluateQualityHeuristic(response)
  const cost = calculateCost(
    model,
    completion.usage?.prompt_tokens || 0,
    completion.usage?.completion_tokens || 0
  )

  // Log to warehouse
  await experimentWarehouse.logMetrics('gpt4_vs_gpt4turbo_v1', userId, {
    quality_score: quality,
    cost_per_request: cost,
    ttft_ms: ttft,
    total_tokens: completion.usage?.total_tokens || 0
  }, { variantKey: variant.key })

  return Response.json({
    explanation: response,
    variantKey: variant.key,
    metrics: { quality, cost, ttft }
  })
}
```

**Analyze results:**

```typescript
async function analyzeModelComparison() {
  const gpt4Data = await getExperimentData('gpt4_vs_gpt4turbo_v1', 'gpt4')
  const gpt4TurboData = await getExperimentData('gpt4_vs_gpt4turbo_v1', 'gpt4_turbo')

  // Quality comparison
  const qualityTest = tTest(
    gpt4Data.quality_scores,
    gpt4TurboData.quality_scores
  )

  // Cost comparison
  const avgCostGPT4 = calculateMean(gpt4Data.costs)
  const avgCostGPT4Turbo = calculateMean(gpt4TurboData.costs)
  const costSavings = (avgCostGPT4 - avgCostGPT4Turbo) / avgCostGPT4

  // Calculate ROI
  const qualityLoss = (
    calculateMean(gpt4Data.quality_scores) -
    calculateMean(gpt4TurboData.quality_scores)
  )

  return {
    qualityPValue: qualityTest.pValue,
    qualityDifference: qualityLoss,
    costSavingsPercent: costSavings * 100,
    recommendation: getROIRecommendation(qualityLoss, costSavings)
  }
}

function getROIRecommendation(qualityLoss: number, costSavings: number): string {
  if (qualityLoss < 0.05 && costSavings > 0.5) {
    return 'SHIP GPT-4 Turbo: Minimal quality loss, huge cost savings'
  }

  if (qualityLoss > 0.15) {
    return 'KEEP GPT-4: Quality degradation too high'
  }

  return 'CONSIDER HYBRID: Use GPT-4 Turbo for simple tasks, GPT-4 for complex ones'
}
```

**Real example results:**

```
GPT-4:
  Quality: 0.82 ± 0.08
  Cost: $0.028 per request
  TTFT: 1,850ms

GPT-4 Turbo:
  Quality: 0.78 ± 0.09
  Cost: $0.009 per request
  TTFT: 1,200ms

Analysis:
  Quality difference: -0.04 (5% worse)
  P-value: 0.034 (statistically significant)
  Cost savings: 68%
  TTFT improvement: 35% faster

Decision: SHIP GPT-4 Turbo
  - Quality loss is minimal (95% of GPT-4)
  - Cost savings are massive (68% reduction)
  - Faster response time (bonus!)
  - Annual savings: $20,400 at 1M requests/year
```

### Hands-On: Multi-Armed Bandits

When should you use bandits instead of A/B tests?

**Use bandits when:**
- You have multiple models to compare (4+)
- Cost of exploration is high
- Models change over time
- You want continuous optimization

**Thompson Sampling implementation:**

See `/src/lib/experiments/multi-arm-bandit.ts` for full implementation. Here's how to use it:

```typescript
import { selectArm, updateArm, calculateReward } from '@/lib/experiments/multi-arm-bandit'

// Initialize bandit with 4 models
const bandit = {
  experimentKey: 'model_selection_bandit',
  arms: [
    { key: 'gpt4', name: 'GPT-4', model: 'gpt-4', priorAlpha: 1, priorBeta: 1 },
    { key: 'claude', name: 'Claude 3.5', model: 'claude-3-5-sonnet-20241022', priorAlpha: 1, priorBeta: 1 },
    { key: 'gemini', name: 'Gemini 1.5', model: 'gemini-1.5-pro', priorAlpha: 1, priorBeta: 1 },
    { key: 'llama', name: 'Llama 3.1', model: 'llama-3.1-70b', priorAlpha: 1, priorBeta: 1 }
  ],
  explorationRate: 0.1, // 10% exploration
  rewardFunction: calculateReward
}

// For each request, select best arm
const selection = selectArm(bandit)
const chosenModel = selection.selectedArm.model

// Execute request
const { quality, latency, cost } = await executeModelRequest(chosenModel, prompt)

// Calculate reward (0-1)
const reward = calculateReward({
  qualityScore: quality,
  latencyMs: latency,
  costUsd: cost,
  tokensGenerated: 500
})

// Update arm with observed reward
const updatedArm = updateArm(selection.selectedArm, reward, { quality, latency, cost })

// Track convergence
const hasConverged = hasConverged(bandit.arms, 1000)
if (hasConverged) {
  console.log('Bandit has converged!')
  const allocation = getTrafficAllocation(bandit.arms)
  console.log('Final allocation:', allocation)
}
```

**Monitoring convergence:**

```typescript
export function plotConvergence(arms: BanditArm[], requestHistory: Request[]) {
  const allocationOverTime = []

  for (let i = 0; i < requestHistory.length; i += 100) {
    const snapshot = arms.slice() // Copy current state
    allocationOverTime.push({
      requests: i,
      allocation: getTrafficAllocation(snapshot)
    })
  }

  // Visualize how traffic shifts over time
  console.log('Allocation evolution:')
  allocationOverTime.forEach(({ requests, allocation }) => {
    console.log(`After ${requests} requests:`, allocation)
  })
}
```

### Exercise: Design an AI Experiment

**Scenario:** You want to improve your chatbot's response quality while minimizing cost.

**Your task:**
1. Choose 2-3 models to compare
2. Define quality evaluation method
3. Set up cost tracking
4. Determine sample size
5. Create decision criteria (when to switch models)

**Bonus:** Implement a hybrid approach: use cheap model for simple questions, expensive model for complex ones.

---

## Part 5: Advanced Topics (45 min)

### Sample Ratio Mismatch (SRM)

**What it is:**
When observed traffic split doesn't match expected split.

**Example:**
```
Expected: 50% control, 50% treatment
Observed: 48% control, 52% treatment
Chi-square test: p = 0.03 (SRM detected!)
```

**Why it matters:**
SRM indicates broken randomization, which invalidates your entire experiment.

**Common causes:**

1. **Redirect loops**
   ```typescript
   // BAD: Creates infinite redirect for treatment users
   if (variant === 'treatment' && !hasSeenPage) {
     redirect('/landing-v2')
     // Landing-v2 assigns variant again → loop!
   }
   ```

2. **Caching issues**
   ```typescript
   // BAD: Cached page serves same variant to everyone
   <meta http-equiv="Cache-Control" content="public, max-age=3600" />

   // GOOD: Disable caching for variant pages
   <meta http-equiv="Cache-Control" content="no-cache, no-store" />
   ```

3. **Bot traffic**
   ```typescript
   // Bots may favor one variant due to URL patterns
   const isControl = url.includes('/control') // Bots crawl this more
   ```

**How to detect SRM:**

```typescript
import { detectSRM } from '@/lib/experiments/srm-detector'

const result = await detectSRM({
  experimentKey: 'my_experiment',
  expected: [0.5, 0.5],
  observed: [4800, 5200],
  alpha: 0.001 // Very conservative threshold
})

if (result.hasSRM) {
  console.error('SRM detected!')
  console.log('Chi-square:', result.chiSquare)
  console.log('P-value:', result.pValue)
  console.log('Expected:', result.expected)
  console.log('Observed:', result.observed)

  // STOP EXPERIMENT - results are invalid
  await pauseExperiment('my_experiment')
}
```

**How to fix SRM:**

1. Investigate traffic sources (check for bots, API vs web, etc.)
2. Review variant assignment logic
3. Check for caching or redirect issues
4. Ensure consistent user identification
5. Restart experiment after fixing root cause

### Sequential Testing

**The problem:**
Traditional fixed-horizon testing requires you to decide sample size upfront and never peek.

**The solution:**
Sequential testing allows continuous monitoring without inflating false positive rate.

**mSPRT (modified Sequential Probability Ratio Test):**

```typescript
import { sequentialTest } from '@/lib/experiments/sequential'

// Check results daily
const result = await sequentialTest({
  control: controlData,
  treatment: treatmentData,
  alpha: 0.05,
  beta: 0.20,
  mde: 0.10 // 10% minimum detectable effect
})

if (result.decision === 'REJECT_NULL') {
  console.log('Treatment is better! Ship it.')
} else if (result.decision === 'ACCEPT_NULL') {
  console.log('No meaningful difference. Stop experiment.')
} else {
  console.log('Continue collecting data...')
}
```

**Always-valid p-values:**

```typescript
export function alwaysValidPValue(
  control: number[],
  treatment: number[],
  alpha: number = 0.05
): { pValue: number; canStop: boolean } {
  // Adjusts p-value to account for continuous monitoring
  const rawPValue = tTest(control, treatment).pValue

  // Bonferroni-style correction for multiple looks
  const maxLooks = 20 // Assume max 20 looks at data
  const adjustedAlpha = alpha / maxLooks

  return {
    pValue: rawPValue,
    canStop: rawPValue < adjustedAlpha
  }
}
```

**Early stopping criteria:**

```
✅ Stop early (ship treatment) if:
  - Sequential test rejects null
  - Effect size is large and stable
  - Guardrails passed

⏸️ Stop early (keep control) if:
  - Sequential test accepts null
  - Clear negative trend
  - Guardrails violated

❌ Don't stop if:
  - Results are borderline
  - High variance in metrics
  - Insufficient data for power
```

### Guardrail Metrics

**Purpose:**
Prevent harmful changes from shipping by monitoring critical metrics.

**Categories:**

1. **User experience guardrails**
   - Error rate < 1%
   - Page load time < 2s
   - Crash rate < 0.1%

2. **Business guardrails**
   - Revenue per user > baseline
   - Churn rate < baseline
   - Support tickets < baseline

3. **Quality guardrails**
   - User satisfaction > 4.0 / 5
   - NPS > baseline
   - Feature adoption > 10%

**Implementation:**

```typescript
// Set up continuous monitoring
import { startGuardrailMonitoring } from '@/lib/experiments/guardrails'

await startGuardrailMonitoring({
  experimentKey: 'my_experiment',
  guardrails: [
    {
      metricName: 'error_rate',
      operator: '<',
      threshold: 0.01,
      severity: 'critical',
      description: 'Error rate must stay below 1%'
    },
    {
      metricName: 'page_load_time_p95',
      operator: '<',
      threshold: 2000,
      severity: 'warning',
      description: 'P95 load time should be under 2s'
    },
    {
      metricName: 'user_satisfaction',
      operator: '>',
      threshold: 4.0,
      severity: 'critical',
      description: 'User satisfaction must stay above 4.0'
    }
  ],
  checkIntervalMs: 300000, // Check every 5 minutes
  onViolation: async (violation) => {
    if (violation.severity === 'critical') {
      // Auto-pause experiment
      await pauseExperiment(violation.experimentKey)
      await sendAlert({
        channel: '#experiments',
        message: `🚨 Critical guardrail violated: ${violation.description}`,
        details: violation
      })
    } else {
      // Warning only
      await sendAlert({
        channel: '#experiments',
        message: `⚠️ Guardrail warning: ${violation.description}`
      })
    }
  }
})
```

**Real example: Prevented disaster**

```
Experiment: New checkout flow
Guardrail: Error rate < 2%

Day 3:
  - Error rate jumps to 8% (4x threshold!)
  - Guardrail triggers automatic pause
  - Investigation reveals mobile browser bug
  - Fix deployed before significant damage

Impact:
  - Prevented ~$50K in lost revenue
  - Avoided user frustration
  - Caught issue in <6 hours instead of days
```

### Experiment Lifecycle

**Stages:**

```
Draft → Review → Approved → Running → Analysis → Decision → Archived
```

**1. Draft**
- Define hypothesis
- Set up configuration
- Calculate sample size
- Review with stakeholders

**2. Review**
- Statistical review (power analysis)
- Technical review (implementation)
- Business review (impact estimation)
- Legal/compliance review (if needed)

**3. Approved**
- Pre-launch checklist complete
- Guardrails configured
- Monitoring dashboards ready
- Rollback plan documented

**4. Running**
- Gradual traffic ramp (1% → 10% → 50% → 100%)
- Continuous guardrail monitoring
- Daily SRM checks
- Weekly analysis reviews

**5. Analysis**
- Statistical significance achieved
- Practical significance evaluated
- Secondary metrics reviewed
- Guardrails passed

**6. Decision**
- Ship treatment (full rollout)
- Keep control (rollback)
- Iterate (run variant of experiment)
- Hybrid (segment-based rollout)

**7. Archived**
- Document learnings
- Share results with team
- Archive data for future reference

**Gradual rollout schedule:**

```typescript
const rolloutSchedule = [
  { day: 0, traffic: 0.01 },   // 1% - canary test
  { day: 1, traffic: 0.05 },   // 5% - early validation
  { day: 3, traffic: 0.10 },   // 10% - SRM check
  { day: 7, traffic: 0.50 },   // 50% - full experiment
  { day: 14, traffic: 1.00 }   // 100% - if winning
]

// Auto-pause if any stage shows issues
for (const stage of rolloutSchedule) {
  await setTraffic(experimentKey, stage.traffic)
  await wait(stage.day * 86400000) // milliseconds

  const health = await checkExperimentHealth(experimentKey)
  if (!health.passed) {
    await pauseExperiment(experimentKey)
    break
  }
}
```

**Conflict detection:**

```typescript
import { detectConflicts } from '@/lib/experiments/conflict-detector'

// Before launching
const conflicts = await detectConflicts({
  experimentKey: 'new_checkout_v2',
  targetUsers: 'all_users',
  targetPages: ['/checkout', '/payment']
})

if (conflicts.length > 0) {
  console.warn('Experiment conflicts detected:')
  conflicts.forEach(conflict => {
    console.log(`- ${conflict.experimentKey} targets same users/pages`)
  })

  // Options:
  // 1. Use non-overlapping user segments
  // 2. Sequence experiments (run one after another)
  // 3. Run on different pages
}
```

---

## Part 6: Q&A and Best Practices (30 min)

### Common Questions

#### "How long should I run my experiment?"

**Answer:**
Run until you reach your target sample size OR 2-4 weeks, whichever comes first.

**Calculation:**
```typescript
const duration = calculateExperimentDuration({
  sampleSizeNeeded: 10000,
  dailyTraffic: 1000,
  trafficAllocation: 0.5 // 50% in experiment
})
// duration = 20 days (10000 / (1000 × 0.5))
```

**Rules of thumb:**
- Minimum: 1 week (to capture weekly seasonality)
- Maximum: 4 weeks (diminishing returns, opportunity cost)
- Ideal: 2 weeks for most web experiments

#### "What if results are borderline significant?"

**Scenario:**
```
P-value: 0.06 (just above 0.05 threshold)
Effect: +8% improvement
Confidence interval: [-0.5%, +16.5%]
```

**Options:**

1. **Continue experiment**
   - Collect more data to reach significance
   - May converge to significant or inconclusive

2. **Use Bayesian analysis**
   ```typescript
   const bayesianResult = bayesianTest(control, treatment, {
     priorMean: 0,
     priorStdDev: 0.05
   })
   // Probability treatment is better: 87%
   ```

3. **Consider practical significance**
   - 8% improvement may be worth shipping even if p=0.06
   - Especially if low risk and easy to reverse

4. **Implement with guardrails**
   - Ship to 50% of users
   - Monitor closely for 1 week
   - Rollback if issues appear

**Recommendation:**
If p=0.05-0.10 AND large effect size (>10%), consider shipping with careful monitoring.

#### "How do I handle seasonality?"

**Problem:**
Results vary by day of week, holidays, etc.

**Solutions:**

1. **Run full weeks**
   ```typescript
   // BAD: Mon-Wed (3 days)
   // GOOD: Mon-Sun (7 days) or Mon-Mon (14 days)
   ```

2. **Stratify by time period**
   ```typescript
   // Analyze separately
   const weekdayResults = analyzeSegment({ dayOfWeek: [1,2,3,4,5] })
   const weekendResults = analyzeSegment({ dayOfWeek: [6,7] })
   ```

3. **Use CUPED (variance reduction)**
   ```typescript
   import { cupedAdjustment } from '@/lib/experiments/statistics'

   const adjusted = cupedAdjustment({
     treatment: treatmentData,
     control: controlData,
     covariate: historicalData // Pre-experiment behavior
   })
   // Reduces variance by 30-50%, smaller sample size needed
   ```

4. **Include seasonality in model**
   ```typescript
   // Regression with day-of-week fixed effects
   outcome ~ variant + dayOfWeek + variant × dayOfWeek
   ```

#### "Can I run multiple experiments at once?"

**Short answer:** Yes, with caveats.

**Interaction effects:**

Problem: Experiment A affects Experiment B's results

Example:
- Experiment A: Price discount (20% off)
- Experiment B: Checkout flow redesign
- Result: Discount users convert higher, making checkout redesign look better than it is

**Solutions:**

1. **Non-overlapping segments**
   ```typescript
   // Divide users into non-overlapping groups
   const segment = hashUserId(userId) % 4

   if (segment === 0) {
     assignToExperiment('price_discount')
   } else if (segment === 1) {
     assignToExperiment('checkout_redesign')
   } else {
     // Control: no experiments
   }
   ```

2. **Factorial design**
   ```typescript
   // Test all combinations
   const variants = [
     { priceDiscount: false, newCheckout: false }, // control
     { priceDiscount: true, newCheckout: false },
     { priceDiscount: false, newCheckout: true },
     { priceDiscount: true, newCheckout: true }
   ]
   // Requires 4x sample size but can detect interactions
   ```

3. **Orthogonal assignment**
   ```typescript
   // Independent hash functions ensure independence
   const experimentA = hashWithSeed(userId, 'experiment_a')
   const experimentB = hashWithSeed(userId, 'experiment_b')
   // Users randomly assigned to A and B independently
   ```

**Rule of thumb:**
- Same page/flow: 1 experiment at a time
- Different pages/flows: Multiple experiments OK
- Critical metrics (revenue): 1-2 experiments max

### Best Practices Checklist

Before launching any experiment, ensure:

**Statistical rigor:**
- [ ] Hypothesis is specific and measurable
- [ ] Sample size calculated (power ≥ 80%)
- [ ] Significance level decided (α = 0.05)
- [ ] Minimum detectable effect is practical (≥ 5%)
- [ ] Both primary and secondary metrics defined

**Implementation:**
- [ ] Randomization is truly random (hash-based)
- [ ] Variant assignment is sticky (stored in cookie/DB)
- [ ] Metrics tracking is instrumented correctly
- [ ] Guardrails are configured
- [ ] SRM check is automated

**Monitoring:**
- [ ] Dashboard shows real-time metrics
- [ ] Alerts configured for guardrail violations
- [ ] Daily SRM checks scheduled
- [ ] Weekly review meetings scheduled

**Decision framework:**
- [ ] Success criteria defined upfront
- [ ] Rollback plan documented
- [ ] Stakeholders aligned on decision process

**Documentation:**
- [ ] Hypothesis and rationale documented
- [ ] Implementation details recorded
- [ ] Analysis methodology specified
- [ ] Results and learnings will be shared

### Recommended Reading and Resources

**Books:**
- *Trustworthy Online Controlled Experiments* by Kohavi, Tang, Xu (the bible of A/B testing)
- *Experimentation Works* by Stefan Thomke
- *The Art of Statistics* by David Spiegelhalter

**Papers:**
- [Seven Rules of Thumb for Web Experimentation](https://exp-platform.com/Documents/2014%20experimentersRulesOfThumb.pdf) - Microsoft
- [Online Controlled Experiments at Large Scale](https://ai.stanford.edu/~ronnyk/2013%20controlledExperimentsAtScale.pdf) - Google, Amazon, Microsoft
- [Sample Ratio Mismatch](https://exp-platform.com/Documents/2019_KDDFabijanGupchupFuptaOmhoverVermeerDmitriev.pdf)

**Tools:**
- [Evan Miller's Sample Size Calculator](https://www.evanmiller.org/ab-testing/sample-size.html)
- [AB Testguide](https://abtestguide.com/)
- [Optimizely Stats Engine](https://www.optimizely.com/optimization-glossary/stats-engine/)

**Courses:**
- [Udacity A/B Testing by Google](https://www.udacity.com/course/ab-testing--ud257)
- [Coursera Experimentation for Improvement](https://www.coursera.org/learn/experimentation)

**Blogs:**
- [Netflix Tech Blog](https://netflixtechblog.com/tagged/ab-testing)
- [Booking.com Tech Blog](https://blog.booking.com/tags/experimentation.html)
- [Airbnb Engineering](https://medium.com/airbnb-engineering/tagged/experimentation)

### Certificate of Completion

Congratulations! You've completed the Production-Grade A/B Testing Workshop.

**You've learned:**
✅ Statistical foundations (p-values, confidence intervals, power analysis)
✅ How to design and launch experiments with rigor
✅ AI-specific metrics (TTFT, cost, quality)
✅ Multi-armed bandits for dynamic optimization
✅ Advanced topics (SRM, sequential testing, guardrails)
✅ Best practices for production experimentation

**Next steps:**
1. Launch your first experiment this week
2. Join the #experimentation Slack channel
3. Share your results in the next team meeting
4. Iterate and compound your learnings

**Resources:**
- Platform: http://localhost:3000/experiments
- Documentation: http://localhost:3000/docs/experiments
- Code: /src/lib/experiments/
- Support: #experimentation on Slack

---

**Workshop Word Count: 5,847 words**

**Feedback:**
Please share your feedback to help us improve future workshops:
- What was most valuable?
- What could be clearer?
- What topics should we cover next?
- Rate this workshop: ⭐⭐⭐⭐⭐

Thank you for participating! Now go forth and experiment with confidence! 🚀
