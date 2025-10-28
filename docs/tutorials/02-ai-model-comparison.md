# AI Model Comparison: GPT-4 vs Claude

**Goal:** Compare two AI models scientifically and make a cost/quality decision
**Difficulty:** Intermediate
**Time:** 30-40 minutes
**Prerequisites:** Completed Tutorial 1, understanding of API calls, basic statistics

---

## What You'll Learn

By the end of this tutorial, you will:
- ✅ Design experiments for AI model comparison
- ✅ Define quality metrics for LLM outputs
- ✅ Track cost, latency, and quality simultaneously
- ✅ Use LLM-as-judge for quality evaluation
- ✅ Calculate ROI for model switching
- ✅ Make data-driven model selection decisions

## The Challenge

Your team uses GPT-4 for code explanations, costing $0.028 per request. You've heard Claude 3.5 Sonnet might provide similar quality at lower cost. Before switching, you need to validate this hypothesis with real data.

**Hypothesis:** "Claude 3.5 Sonnet provides ≥90% of GPT-4's quality at 60% lower cost, making it a better choice for code explanations."

**Business Impact:**
- Current: 100,000 requests/month × $0.028 = $2,800/month
- Potential: 100,000 requests/month × $0.011 = $1,100/month
- **Savings: $1,700/month ($20,400/year)**

## Step 1: Define Success Metrics (5 min)

Unlike simple button tests, AI experiments need multi-dimensional metrics:

```typescript
// experiments/model-comparison-config.ts

export const MODEL_COMPARISON_EXPERIMENT = {
  experimentKey: 'gpt4_vs_claude_code_explanation_v1',
  name: 'GPT-4 vs Claude 3.5 Sonnet - Code Explanations',
  hypothesis: 'Claude provides ≥90% quality at 60% cost savings',

  variants: {
    gpt4: {
      key: 'gpt4',
      model: 'gpt-4',
      provider: 'openai',
      name: 'GPT-4 (Control)',
      allocation: 0.5
    },
    claude: {
      key: 'claude',
      model: 'claude-3-5-sonnet-20241022',
      provider: 'anthropic',
      name: 'Claude 3.5 Sonnet (Treatment)',
      allocation: 0.5
    }
  },

  // Multi-dimensional metrics
  metrics: {
    primary: [
      {
        name: 'quality_score',
        type: 'continuous',
        description: 'LLM-as-judge quality rating (0-1)',
        target: '>= 0.90', // 90% of control quality
        weight: 0.5
      },
      {
        name: 'cost_per_request',
        type: 'continuous',
        description: 'USD cost per explanation',
        target: '<= 0.40', // 60% reduction
        weight: 0.3
      }
    ],
    secondary: [
      {
        name: 'ttft_ms',
        type: 'continuous',
        description: 'Time to First Token (milliseconds)',
        target: '<= 2000'
      },
      {
        name: 'total_tokens',
        type: 'continuous',
        description: 'Total tokens used'
      },
      {
        name: 'user_thumbs_up',
        type: 'conversion',
        description: 'User satisfaction (binary)'
      }
    ]
  },

  // Safety guardrails
  guardrails: [
    {
      metricName: 'quality_score',
      operator: '>',
      threshold: 0.70, // Never drop below 70% quality
      severity: 'critical'
    },
    {
      metricName: 'error_rate',
      operator: '<',
      threshold: 0.05,
      severity: 'critical'
    },
    {
      metricName: 'ttft_ms',
      operator: '<',
      threshold: 5000,
      severity: 'warning'
    }
  ],

  // Sample size for statistical power
  targetSampleSize: 500, // requests per variant
  maxDuration: '7 days'
}
```

**Why these metrics matter:**

1. **Quality Score** - Most important. Can't sacrifice user experience for cost.
2. **Cost Per Request** - The economic driver for this experiment.
3. **TTFT** - User experience metric (perceived responsiveness).
4. **User Thumbs Up** - Real user feedback validates our quality scores.

## Step 2: Implement Quality Evaluation (10 min)

AI quality is subjective. We'll use two approaches:

### Approach A: Heuristic Scoring (Fast, Cheap)

```typescript
// lib/experiments/quality-evaluation.ts

export function evaluateCodeExplanationHeuristic(
  code: string,
  explanation: string
): number {
  let score = 0

  // 1. Length check (optimal: 200-800 chars)
  const length = explanation.length
  if (length >= 200 && length <= 800) {
    score += 0.25
  } else if (length < 100 || length > 1500) {
    score += 0.0 // Too short or too verbose
  } else {
    score += 0.15
  }

  // 2. Structure quality
  const hasCodeBlock = explanation.includes('```')
  const hasBullets = /\n\s*[-*•]/.test(explanation)
  const hasNumbering = /\n\s*\d+\./.test(explanation)

  if (hasCodeBlock) score += 0.20 // Code examples = good
  if (hasBullets || hasNumbering) score += 0.15 // Structure = good

  // 3. Technical depth
  const technicalTerms = [
    'function', 'variable', 'parameter', 'return', 'type',
    'class', 'method', 'async', 'await', 'promise',
    'loop', 'iteration', 'condition', 'algorithm'
  ]
  const termsFound = technicalTerms.filter(term =>
    explanation.toLowerCase().includes(term)
  ).length
  score += Math.min(termsFound * 0.02, 0.20) // Up to 0.20 for technical terms

  // 4. Mentions specific code elements
  const codeLines = code.split('\n')
  const functionNames = code.match(/function\s+(\w+)/g) || []
  const mentionsCodeElements = functionNames.some(fn =>
    explanation.includes(fn.replace('function ', ''))
  )
  if (mentionsCodeElements) score += 0.10

  // 5. Penalize uncertainty
  const uncertainPhrases = [
    'i think', 'maybe', 'possibly', 'might be',
    'not sure', 'could be', 'probably'
  ]
  const hasUncertainty = uncertainPhrases.some(phrase =>
    explanation.toLowerCase().includes(phrase)
  )
  if (hasUncertainty) score -= 0.10

  // 6. Penalize disclaimers only (no actual explanation)
  if (explanation.toLowerCase().includes('as an ai') ||
      explanation.toLowerCase().includes("i don't have")) {
    score -= 0.15
  }

  return Math.max(0, Math.min(1, score))
}
```

**Pros:** Instant, free, consistent
**Cons:** Misses nuance, can be gamed

### Approach B: LLM-as-Judge (Slow, Expensive, Accurate)

```typescript
// lib/experiments/quality-evaluation.ts

export async function evaluateCodeExplanationLLM(
  code: string,
  language: string,
  explanation: string,
  judge: 'gpt-4' | 'claude-3-opus' = 'gpt-4'
): Promise<{
  score: number
  reasoning: string
  categories: {
    accuracy: number
    completeness: number
    clarity: number
    relevance: number
  }
}> {
  const prompt = `You are a code review expert evaluating explanations.

CODE (${language}):
\`\`\`${language}
${code}
\`\`\`

EXPLANATION PROVIDED:
${explanation}

TASK: Rate the explanation quality on these dimensions (0-1 scale):

1. ACCURACY: Is the explanation factually correct?
   - 1.0 = Completely accurate
   - 0.5 = Some errors
   - 0.0 = Mostly incorrect

2. COMPLETENESS: Does it cover all important aspects?
   - 1.0 = Covers everything important
   - 0.5 = Misses some key points
   - 0.0 = Severely incomplete

3. CLARITY: Is it easy to understand?
   - 1.0 = Crystal clear
   - 0.5 = Somewhat confusing
   - 0.0 = Very confusing

4. RELEVANCE: Does it focus on what matters?
   - 1.0 = Perfectly relevant
   - 0.5 = Some tangents
   - 0.0 = Mostly irrelevant

Respond in JSON:
{
  "accuracy": 0.0-1.0,
  "completeness": 0.0-1.0,
  "clarity": 0.0-1.0,
  "relevance": 0.0-1.0,
  "reasoning": "1-2 sentence explanation of scores"
}`

  const response = await callLLM(judge, prompt)
  const parsed = JSON.parse(response)

  // Overall score is weighted average
  const overallScore = (
    parsed.accuracy * 0.35 +
    parsed.completeness * 0.30 +
    parsed.clarity * 0.20 +
    parsed.relevance * 0.15
  )

  return {
    score: overallScore,
    reasoning: parsed.reasoning,
    categories: {
      accuracy: parsed.accuracy,
      completeness: parsed.completeness,
      clarity: parsed.clarity,
      relevance: parsed.relevance
    }
  }
}

async function callLLM(model: string, prompt: string): Promise<string> {
  if (model === 'gpt-4') {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1, // Low temp for consistency
      response_format: { type: 'json_object' }
    })
    return response.choices[0].message.content || ''
  } else {
    // Claude implementation
    const response = await anthropic.messages.create({
      model: 'claude-3-opus-20240229',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
      temperature: 0.1
    })
    return response.content[0].text
  }
}
```

**Pros:** Nuanced, human-like judgment
**Cons:** Costs ~$0.01 per evaluation, slower (2-3s)

**Hybrid Strategy:**
- Use heuristic for all requests (fast feedback)
- Use LLM-as-judge on 10% sample (validation)
- Compare correlation between methods

## Step 3: Track Cost and Latency (5 min)

```typescript
// app/api/ai/explain-code/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { experimentWarehouse } from '@/lib/experiments/warehouse'
import { evaluateCodeExplanationHeuristic } from '@/lib/experiments/quality-evaluation'

export async function POST(req: NextRequest) {
  const { userId, code, language } = await req.json()

  // Assign variant
  const variant = assignVariant(userId, 'gpt4_vs_claude_code_explanation_v1')
  const model = variant === 'gpt4' ? 'gpt-4' : 'claude-3-5-sonnet-20241022'

  // Track TTFT
  const startTime = Date.now()
  let ttft: number = 0
  let firstTokenReceived = false

  // Call model with streaming
  const stream = await callModelStreaming(model, code, language)

  let fullExplanation = ''
  for await (const chunk of stream) {
    if (!firstTokenReceived) {
      ttft = Date.now() - startTime
      firstTokenReceived = true
    }
    fullExplanation += chunk
  }

  const totalTime = Date.now() - startTime

  // Calculate cost
  const tokenUsage = await getTokenUsage(model, code, fullExplanation)
  const cost = calculateCost(model, tokenUsage.input, tokenUsage.output)

  // Evaluate quality (heuristic)
  const qualityScore = evaluateCodeExplanationHeuristic(code, fullExplanation)

  // Log all metrics
  await experimentWarehouse.logMetrics(
    'gpt4_vs_claude_code_explanation_v1',
    userId,
    {
      quality_score: qualityScore,
      cost_per_request: cost,
      ttft_ms: ttft,
      total_time_ms: totalTime,
      total_tokens: tokenUsage.input + tokenUsage.output,
      input_tokens: tokenUsage.input,
      output_tokens: tokenUsage.output
    },
    {
      variantKey: variant,
      model: model,
      language: language
    }
  )

  return NextResponse.json({
    explanation: fullExplanation,
    variant,
    metrics: {
      quality: qualityScore,
      cost,
      ttft
    }
  })
}

function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = {
    'gpt-4': {
      input: 0.03,   // per 1K tokens
      output: 0.06
    },
    'claude-3-5-sonnet-20241022': {
      input: 0.003,  // per 1K tokens
      output: 0.015
    }
  }

  const prices = pricing[model]
  return (
    (inputTokens / 1000) * prices.input +
    (outputTokens / 1000) * prices.output
  )
}

async function callModelStreaming(
  model: string,
  code: string,
  language: string
): AsyncGenerator<string> {
  const prompt = `Explain this ${language} code clearly and concisely:\n\n\`\`\`${language}\n${code}\n\`\`\``

  if (model === 'gpt-4') {
    const stream = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a code explanation expert. Provide clear, concise explanations.'
        },
        { role: 'user', content: prompt }
      ],
      stream: true
    })

    async function* generate() {
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content
        if (content) yield content
      }
    }

    return generate()
  } else {
    // Claude streaming implementation
    const stream = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
      stream: true
    })

    async function* generate() {
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta') {
          yield chunk.delta.text
        }
      }
    }

    return generate()
  }
}
```

## Step 4: Run Experiment (Deploy & Monitor)

```bash
# Deploy the experiment
npm run build
npm start

# Generate test requests
npm run experiments:generate-traffic -- \
  --experiment gpt4_vs_claude_code_explanation_v1 \
  --requests 1000

# Monitor in real-time
npm run experiments:monitor -- \
  --experiment gpt4_vs_claude_code_explanation_v1 \
  --interval 30s
```

**Monitor these dashboards:**

1. **Traffic Distribution**
   ```
   GPT-4:   500 requests (50.0%)
   Claude:  500 requests (50.0%)
   SRM: ✅ No mismatch detected (p=0.98)
   ```

2. **Cost Comparison**
   ```
   GPT-4:   $0.028 ± $0.005 per request
   Claude:  $0.011 ± $0.003 per request
   Savings: 60.7% reduction
   ```

3. **Quality Comparison**
   ```
   GPT-4:   0.82 ± 0.08 quality score
   Claude:  0.79 ± 0.09 quality score
   Difference: -3.7%
   ```

## Step 5: Statistical Analysis (10 min)

After 500+ requests per variant:

```typescript
// scripts/analyze-model-comparison.ts

import { tTest, cohensD, calculateMean } from '@/lib/experiments/statistics'
import { experimentWarehouse } from '@/lib/experiments/warehouse'

async function analyzeModelComparison() {
  // Fetch data
  const gpt4Data = await getExperimentData('gpt4')
  const claudeData = await getExperimentData('claude')

  console.log('=== Model Comparison Analysis ===\n')

  // 1. Quality Analysis
  const qualityTest = tTest(
    gpt4Data.quality_scores,
    claudeData.quality_scores,
    0.05
  )

  const gpt4Quality = calculateMean(gpt4Data.quality_scores)
  const claudeQuality = calculateMean(claudeData.quality_scores)
  const qualityRatio = claudeQuality / gpt4Quality

  console.log('QUALITY:')
  console.log(`  GPT-4:  ${gpt4Quality.toFixed(3)} (SD: ${calculateSD(gpt4Data.quality_scores).toFixed(3)})`)
  console.log(`  Claude: ${claudeQuality.toFixed(3)} (SD: ${calculateSD(claudeData.quality_scores).toFixed(3)})`)
  console.log(`  Ratio:  ${(qualityRatio * 100).toFixed(1)}% of GPT-4 quality`)
  console.log(`  P-value: ${qualityTest.pValue.toFixed(4)}`)
  console.log(`  Significant: ${qualityTest.significant ? 'YES' : 'NO'}`)
  console.log(`  Cohen's d: ${cohensD(gpt4Data.quality_scores, claudeData.quality_scores).toFixed(3)}`)

  // 2. Cost Analysis
  const gpt4Cost = calculateMean(gpt4Data.costs)
  const claudeCost = calculateMean(claudeData.costs)
  const costSavings = (gpt4Cost - claudeCost) / gpt4Cost

  console.log('\nCOST:')
  console.log(`  GPT-4:  $${gpt4Cost.toFixed(4)} per request`)
  console.log(`  Claude: $${claudeCost.toFixed(4)} per request`)
  console.log(`  Savings: ${(costSavings * 100).toFixed(1)}%`)
  console.log(`  Annual savings (100K requests/month): $${((gpt4Cost - claudeCost) * 100000 * 12).toFixed(0)}`)

  // 3. Latency Analysis
  const gpt4TTFT = calculateMean(gpt4Data.ttft_ms)
  const claudeTTFT = calculateMean(claudeData.ttft_ms)

  console.log('\nLATENCY (TTFT):')
  console.log(`  GPT-4:  ${gpt4TTFT.toFixed(0)}ms (P95: ${calculateP95(gpt4Data.ttft_ms).toFixed(0)}ms)`)
  console.log(`  Claude: ${claudeTTFT.toFixed(0)}ms (P95: ${calculateP95(claudeData.ttft_ms).toFixed(0)}ms)`)
  console.log(`  Difference: ${((claudeTTFT - gpt4TTFT) / gpt4TTFT * 100).toFixed(1)}%`)

  // 4. User Satisfaction
  const gpt4ThumbsUp = calculateMean(gpt4Data.thumbs_up)
  const claudeThumbsUp = calculateMean(claudeData.thumbs_up)

  console.log('\nUSER SATISFACTION:')
  console.log(`  GPT-4:  ${(gpt4ThumbsUp * 100).toFixed(1)}% thumbs up`)
  console.log(`  Claude: ${(claudeThumbsUp * 100).toFixed(1)}% thumbs up`)

  // 5. Decision Framework
  console.log('\n=== DECISION FRAMEWORK ===\n')

  const decision = makeModelDecision({
    qualityRatio,
    qualitySignificant: qualityTest.significant,
    costSavings,
    ttftDelta: claudeTTFT - gpt4TTFT,
    satisfactionDelta: claudeThumbsUp - gpt4ThumbsUp
  })

  console.log(decision.recommendation)
  console.log(`\nConfidence: ${decision.confidence}`)
  console.log(`Rationale: ${decision.rationale}`)

  return decision
}

function makeModelDecision(data: {
  qualityRatio: number
  qualitySignificant: boolean
  costSavings: number
  ttftDelta: number
  satisfactionDelta: number
}): {
  recommendation: string
  confidence: 'high' | 'medium' | 'low'
  rationale: string
} {
  // Quality threshold: Must be ≥90% of GPT-4
  if (data.qualityRatio < 0.90) {
    return {
      recommendation: '❌ KEEP GPT-4',
      confidence: 'high',
      rationale: `Claude quality (${(data.qualityRatio * 100).toFixed(1)}%) falls below 90% threshold. Quality degradation is too significant.`
    }
  }

  // Quality is acceptable (≥90%), check if significant drop
  if (data.qualitySignificant && data.qualityRatio < 0.95) {
    return {
      recommendation: '🤔 HYBRID APPROACH',
      confidence: 'medium',
      rationale: `Claude is ${(data.qualityRatio * 100).toFixed(1)}% of GPT-4 quality (statistically significant drop). Consider using Claude for simple queries, GPT-4 for complex ones.`
    }
  }

  // Quality is good (≥95% or not significantly different)
  if (data.costSavings > 0.50) {
    return {
      recommendation: '✅ SWITCH TO CLAUDE',
      confidence: 'high',
      rationale: `Claude provides ${(data.qualityRatio * 100).toFixed(1)}% of GPT-4 quality with ${(data.costSavings * 100).toFixed(1)}% cost savings. Clear win.`
    }
  }

  // Borderline case
  return {
    recommendation: '⏸️ CONTINUE MONITORING',
    confidence: 'low',
    rationale: `Results are promising but need more data. Quality: ${(data.qualityRatio * 100).toFixed(1)}%, Savings: ${(data.costSavings * 100).toFixed(1)}%`
  }
}

function calculateSD(arr: number[]): number {
  const mean = calculateMean(arr)
  const squaredDiffs = arr.map(x => Math.pow(x - mean, 2))
  return Math.sqrt(calculateMean(squaredDiffs))
}

function calculateP95(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b)
  const index = Math.floor(sorted.length * 0.95)
  return sorted[index]
}

async function getExperimentData(variant: string) {
  const metrics = await experimentWarehouse.getMetrics(
    'gpt4_vs_claude_code_explanation_v1',
    variant
  )

  return {
    quality_scores: metrics.filter(m => m.name === 'quality_score').map(m => m.value),
    costs: metrics.filter(m => m.name === 'cost_per_request').map(m => m.value),
    ttft_ms: metrics.filter(m => m.name === 'ttft_ms').map(m => m.value),
    thumbs_up: metrics.filter(m => m.name === 'user_thumbs_up').map(m => m.value)
  }
}

// Run analysis
analyzeModelComparison()
```

**Example Output:**

```
=== Model Comparison Analysis ===

QUALITY:
  GPT-4:  0.823 (SD: 0.078)
  Claude: 0.791 (SD: 0.085)
  Ratio:  96.1% of GPT-4 quality
  P-value: 0.0423
  Significant: YES
  Cohen's d: 0.395 (small-medium effect)

COST:
  GPT-4:  $0.0284 per request
  Claude: $0.0108 per request
  Savings: 62.0%
  Annual savings (100K requests/month): $21,120

LATENCY (TTFT):
  GPT-4:  1847ms (P95: 2654ms)
  Claude: 1203ms (P95: 1789ms)
  Difference: -34.9% (Claude is faster!)

USER SATISFACTION:
  GPT-4:  78.3% thumbs up
  Claude: 76.1% thumbs up

=== DECISION FRAMEWORK ===

✅ SWITCH TO CLAUDE

Confidence: high
Rationale: Claude provides 96.1% of GPT-4 quality with 62.0% cost savings. Clear win.
```

## Step 6: Calculate ROI

```typescript
function calculateROI(data: {
  currentModel: string
  newModel: string
  monthlyRequests: number
  qualityRatio: number
  costSavings: number
  ttftImprovement: number
}) {
  const currentCost = 0.0284 * data.monthlyRequests
  const newCost = 0.0108 * data.monthlyRequests
  const monthlySavings = currentCost - newCost
  const annualSavings = monthlySavings * 12

  // Quality-adjusted savings
  const qualityPenalty = 1 - data.qualityRatio
  const adjustedSavings = annualSavings * (1 - qualityPenalty * 0.5) // 50% penalty for quality loss

  // UX improvement from faster TTFT
  const uxValue = data.ttftImprovement * 0.000001 * data.monthlyRequests * 12 // Rough estimate

  console.log('=== ROI CALCULATION ===\n')
  console.log(`Current Cost (${data.currentModel}):`)
  console.log(`  Monthly: $${currentCost.toFixed(2)}`)
  console.log(`  Annual:  $${(currentCost * 12).toFixed(2)}`)

  console.log(`\nNew Cost (${data.newModel}):`)
  console.log(`  Monthly: $${newCost.toFixed(2)}`)
  console.log(`  Annual:  $${(newCost * 12).toFixed(2)}`)

  console.log(`\nSavings:`)
  console.log(`  Raw annual savings: $${annualSavings.toFixed(2)}`)
  console.log(`  Quality penalty (${(qualityPenalty * 100).toFixed(1)}%): -$${(annualSavings * qualityPenalty * 0.5).toFixed(2)}`)
  console.log(`  UX improvement value: +$${uxValue.toFixed(2)}`)
  console.log(`  NET ANNUAL SAVINGS: $${(adjustedSavings + uxValue).toFixed(2)}`)

  console.log(`\nPayback Period: Immediate (no switching costs)`)
  console.log(`5-Year Value: $${((adjustedSavings + uxValue) * 5).toFixed(2)}`)

  return {
    annualSavings: adjustedSavings + uxValue,
    recommendation: adjustedSavings > 10000 ? 'STRONG YES' : adjustedSavings > 5000 ? 'YES' : 'BORDERLINE'
  }
}

// Example usage
calculateROI({
  currentModel: 'GPT-4',
  newModel: 'Claude 3.5 Sonnet',
  monthlyRequests: 100000,
  qualityRatio: 0.961,
  costSavings: 0.62,
  ttftImprovement: -644 // ms improvement
})
```

## Common Pitfalls

### Pitfall 1: Ignoring Quality Variance

**Problem:** Models vary in quality across different types of requests.

**Solution:** Segment analysis
```typescript
// Analyze by code complexity
const simpleCode = results.filter(r => r.codeLength < 100)
const complexCode = results.filter(r => r.codeLength > 500)

console.log('Simple code quality:', analyzeQuality(simpleCode))
console.log('Complex code quality:', analyzeQuality(complexCode))
```

### Pitfall 2: Cost Calculation Errors

**Problem:** Forgetting to include system prompts in token count.

**Solution:**
```typescript
function getTokenUsage(model: string, code: string, explanation: string) {
  const systemPrompt = "You are a code explanation expert..."

  return {
    input: countTokens(systemPrompt + code),
    output: countTokens(explanation)
  }
}
```

### Pitfall 3: Latency Measurement Issues

**Problem:** Including network overhead in TTFT.

**Solution:** Measure from API call start, not request start.

## Next Steps

Congratulations! You've scientifically compared AI models. 🎉

**What you learned:**
- ✅ Multi-dimensional AI metrics (quality, cost, latency)
- ✅ LLM-as-judge evaluation
- ✅ ROI calculations
- ✅ Statistical model comparison

**Next tutorials:**
- [Multi-Armed Bandits](./03-multi-armed-bandits.md) - Automatically find the best model
- [Experiment Guardrails](./04-experiment-guardrails.md) - Prevent quality disasters

**Challenges:**
1. Add a third model (GPT-4 Turbo)
2. Implement A/A test to validate quality scoring
3. Create complexity classifier (route simple → Claude, complex → GPT-4)
4. Set up automated weekly model comparisons

---

**Tutorial word count:** 3,247 words
