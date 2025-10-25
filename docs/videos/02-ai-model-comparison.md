# Video Script: AI Model Comparison (5 minutes)

**Target Audience:** Developers working with AI/LLMs
**Goal:** Show how to scientifically compare AI models on quality, cost, and latency
**Format:** Screen recording with voiceover + code walkthrough
**Duration:** 5:00

---

## Scene 1: Introduction (0:00-0:30)

**Visual:** Split screen showing GPT-4 and Claude responses side by side

**Narrator:**
"Should you use GPT-4 or Claude for your application? Many teams guess based on vibes. But switching models could save you thousands of dollars per month while improving quality. Let's run a scientific comparison to find out which model is actually better."

**On-screen text:**
- GPT-4: $0.028 per request
- Claude 3.5 Sonnet: $0.011 per request
- Monthly cost (100K requests): $2,800 vs $1,100
- Potential savings: $1,700/month ($20,400/year)

**Visual effect:**
- Show cost counter spinning down
- Highlight "61% cost savings" in green

**Actions:**
- Both models answer same question
- Show response quality scores

---

## Scene 2: The Challenge (0:30-1:00)

**Visual:** Problem statement slide

**Narrator:**
"Here's the challenge: AI model comparison isn't like testing button colors. Quality is subjective. Latency varies. Cost per request differs. And you can't just count clicks."

**On-screen challenges:**
```
Challenge 1: How do you measure quality?
  - No simple conversion rate
  - Subjective evaluation
  - Different for each use case

Challenge 2: Trade-offs matter
  - Higher quality vs lower cost
  - Faster response vs better accuracy
  - How do you weigh these?

Challenge 3: Quality variance
  - Some requests are simple
  - Some requests are complex
  - One model may win for each
```

**Visual:**
- Show quality score distribution
- Plot latency vs quality scatter
- Show cost-quality frontier

**Narrator:**
"Our platform solves this with multi-dimensional metrics and composite scoring. Let me show you how."

---

## Scene 3: Setting Up the Experiment (1:00-2:00)

**Visual:** VS Code with experiment configuration

**Narrator:**
"First, we define our experiment configuration. We're comparing GPT-4 and Claude 3.5 Sonnet for code explanations."

**Show code:**
```typescript
// experiments/model-comparison.ts

export const MODEL_COMPARISON = {
  experimentKey: 'gpt4_vs_claude_code_v1',
  name: 'GPT-4 vs Claude - Code Explanations',

  variants: {
    gpt4: {
      model: 'gpt-4',
      provider: 'openai'
    },
    claude: {
      model: 'claude-3-5-sonnet-20241022',
      provider: 'anthropic'
    }
  },

  // Multi-dimensional metrics
  metrics: {
    primary: [
      { name: 'quality_score', weight: 0.5 },
      { name: 'cost_per_request', weight: 0.3 },
      { name: 'ttft_ms', weight: 0.2 }
    ]
  }
}
```

**Narrator:**
"Notice we're tracking three primary metrics: quality at 50% weight, cost at 30%, and latency at 20%. This lets us balance all three factors."

**On-screen annotation:**
- Highlight weights
- Show "Why these weights?" tooltip
- Explain composite scoring

---

## Scene 4: Quality Evaluation (2:00-2:45)

**Visual:** Split screen: Heuristic vs LLM-as-judge

**Narrator:**
"Quality evaluation is the hard part. We use two approaches: fast heuristics for all requests, and LLM-as-judge for validation."

**Left side - Heuristic scoring:**
```typescript
function evaluateQualityHeuristic(code, explanation) {
  let score = 0

  // Length check (200-800 chars optimal)
  if (length >= 200 && length <= 800) score += 0.25

  // Has code examples?
  if (explanation.includes('```')) score += 0.20

  // Has structure?
  if (hasBullets || hasNumbering) score += 0.15

  // Technical depth
  score += Math.min(technicalTerms * 0.02, 0.20)

  // Penalties
  if (hasUncertainty) score -= 0.10

  return score
}
```

**Right side - LLM-as-judge:**
```typescript
function evaluateQualityLLM(code, explanation) {
  const prompt = `Rate this explanation on:
    - Accuracy (0-1)
    - Completeness (0-1)
    - Clarity (0-1)
    - Relevance (0-1)
  Return JSON with scores.`

  const judgment = await gpt4(prompt)
  return weightedAverage(judgment)
}
```

**Narrator:**
"Heuristics are instant and free. LLM-as-judge is slow and costs money, but it's more accurate. We use both and compare correlation."

**Visual:**
- Show scatter plot of heuristic vs LLM-as-judge scores
- Highlight correlation coefficient: r = 0.82
- Show example evaluation for a code explanation

---

## Scene 5: Running the Experiment (2:45-3:30)

**Visual:** Terminal showing experiment running

**Narrator:**
"Let's run the experiment with 500 requests per model."

**Terminal output:**
```bash
$ npm run experiments:run -- --key gpt4_vs_claude_code_v1 --requests 1000

Starting experiment: gpt4_vs_claude_code_v1
Target: 500 requests per variant

[1/1000] GPT-4     | Quality: 0.84 | Cost: $0.029 | TTFT: 1847ms
[2/1000] Claude    | Quality: 0.79 | Cost: $0.011 | TTFT: 1203ms
[3/1000] GPT-4     | Quality: 0.81 | Cost: $0.027 | TTFT: 1965ms
...
[998/1000] Claude  | Quality: 0.77 | Cost: $0.010 | TTFT: 1189ms
[999/1000] GPT-4   | Quality: 0.83 | Cost: $0.028 | TTFT: 1824ms
[1000/1000] Claude | Quality: 0.80 | Cost: $0.011 | TTFT: 1274ms

✓ Experiment complete
```

**Visual effect:**
- Progress bar fills
- Live metrics update
- Show distribution charts building in real-time

**Narrator:**
"Each request tracks quality, cost, and latency. The platform automatically logs everything to the data warehouse for analysis."

---

## Scene 6: Analyzing Results (3:30-4:15)

**Visual:** Analysis script output

**Narrator:**
"Now let's analyze the results with statistical rigor."

**Terminal output:**
```bash
$ npm run experiments:analyze -- --key gpt4_vs_claude_code_v1

=== Model Comparison Analysis ===

QUALITY:
  GPT-4:  0.823 ± 0.078
  Claude: 0.791 ± 0.085
  Ratio:  96.1% of GPT-4 quality
  P-value: 0.042 (SIGNIFICANT)

COST:
  GPT-4:  $0.0284 per request
  Claude: $0.0108 per request
  Savings: 62.0%
  Annual savings: $21,120

LATENCY (TTFT):
  GPT-4:  1847ms (P95: 2654ms)
  Claude: 1203ms (P95: 1789ms)
  Difference: -34.9% (Claude is FASTER!)

COMPOSITE SCORE:
  GPT-4:  0.683
  Claude: 0.781
  Winner: CLAUDE (+14.4%)
```

**Narrator:**
"Claude provides 96% of GPT-4's quality at 62% lower cost, and it's 35% faster. The composite score clearly favors Claude."

**Visual:**
- Show quality box plots
- Show cost comparison bar chart
- Show latency histogram
- Highlight statistical significance

---

## Scene 7: ROI Calculation (4:15-4:35)

**Visual:** ROI dashboard

**Narrator:**
"Let's calculate the ROI of switching to Claude."

**On-screen calculation:**
```
Current (GPT-4):
  Monthly cost: $2,840
  Annual cost:  $34,080

New (Claude):
  Monthly cost: $1,080
  Annual cost:  $12,960

Savings:
  Raw annual:   $21,120
  Quality penalty (4%): -$1,056
  UX improvement value: +$500

  NET ANNUAL SAVINGS: $20,564

5-Year Value: $102,820
Payback: Immediate
```

**Narrator:**
"Even accounting for the small quality difference, you save over $20,000 per year. And Claude is faster, which improves user experience."

**Visual effect:**
- Counter shows savings accumulating
- ROI meter fills to 95%
- "STRONG YES" recommendation appears

---

## Scene 8: Decision & Rollout (4:35-4:50)

**Visual:** Decision panel

**Narrator:**
"The platform recommends switching to Claude with high confidence. Click 'Ship Treatment' for a gradual rollout."

**Show rollout strategy:**
```
Hybrid Approach:
✓ Use Claude for most requests (95%)
✓ Use GPT-4 for complex code (5%)
✓ Continue monitoring quality
✓ Maintain guardrails:
  - Quality > 70%
  - Error rate < 2%
  - TTFT < 5s
```

**Narrator:**
"For extra safety, you can implement a hybrid approach: Claude for simple requests, GPT-4 for complex ones."

**Visual:**
- Show decision tree classifier
- Complexity score threshold
- Automatic routing logic

---

## Scene 9: Conclusion (4:50-5:00)

**Visual:** Results summary slide

**Narrator:**
"You've just compared two AI models scientifically. Quality, cost, and latency all measured. Statistical significance confirmed. ROI calculated. Ready to ship with confidence."

**On-screen summary:**
```
What You Learned:
✓ Multi-dimensional AI metrics
✓ Quality evaluation methods
✓ Statistical comparison
✓ ROI calculation
✓ Data-driven model selection

Next Steps:
→ Tutorial: AI Model Comparison
→ Try with your own models
→ Implement contextual routing
```

**Call to action:**
- Link to full tutorial
- Link to documentation
- Join community Slack

---

## Code Snippets for B-Roll

### Snippet 1: Quality Evaluation
```typescript
// Show this code typing out
const quality = await evaluateQuality(
  code,
  explanation,
  'heuristic'
)
// quality = 0.84
```

### Snippet 2: Cost Calculation
```typescript
const cost = calculateCost(
  'gpt-4',
  inputTokens: 850,
  outputTokens: 320
)
// cost = $0.0284
```

### Snippet 3: Decision Logic
```typescript
if (qualityRatio >= 0.90 && costSavings > 0.50) {
  return '✅ SWITCH TO CLAUDE'
}
```

---

## Production Notes

### Visual Style
- Dark mode VS Code
- Use Fira Code font with ligatures
- Syntax highlighting: Monokai Pro
- Terminal: iTerm2 with custom theme

### Screen Layout
- Main window: 1280×720 (centered)
- Side panels for metrics (when needed)
- Picture-in-picture for narrator (bottom-right, optional)

### Pacing
- Slower pace for code sections
- Pause 3-4 seconds when showing results
- Give time to read metric comparisons

### Data Visualization
- Use consistent color scheme:
  - GPT-4: Blue (#0066CC)
  - Claude: Green (#28A745)
- Animated transitions for charts
- Highlight significant differences

### Code Highlighting
- Use arrows to point to important lines
- Zoom in on key calculations
- Slow-motion typing for complex logic

---

## Voiceover Script (Text Only)

Should you use GPT-4 or Claude for your application? Many teams guess based on vibes. But switching models could save you thousands of dollars per month while improving quality. Let's run a scientific comparison to find out which model is actually better.

Here's the challenge: AI model comparison isn't like testing button colors. Quality is subjective. Latency varies. Cost per request differs. And you can't just count clicks. Our platform solves this with multi-dimensional metrics and composite scoring. Let me show you how.

First, we define our experiment configuration. We're comparing GPT-4 and Claude 3.5 Sonnet for code explanations. Notice we're tracking three primary metrics: quality at 50% weight, cost at 30%, and latency at 20%. This lets us balance all three factors.

Quality evaluation is the hard part. We use two approaches: fast heuristics for all requests, and LLM-as-judge for validation. Heuristics are instant and free. LLM-as-judge is slow and costs money, but it's more accurate. We use both and compare correlation.

Let's run the experiment with 500 requests per model. Each request tracks quality, cost, and latency. The platform automatically logs everything to the data warehouse for analysis.

Now let's analyze the results with statistical rigor. Claude provides 96% of GPT-4's quality at 62% lower cost, and it's 35% faster. The composite score clearly favors Claude.

Let's calculate the ROI of switching to Claude. Even accounting for the small quality difference, you save over $20,000 per year. And Claude is faster, which improves user experience.

The platform recommends switching to Claude with high confidence. Click 'Ship Treatment' for a gradual rollout. For extra safety, you can implement a hybrid approach: Claude for simple requests, GPT-4 for complex ones.

You've just compared two AI models scientifically. Quality, cost, and latency all measured. Statistical significance confirmed. ROI calculated. Ready to ship with confidence.

---

**Total word count:** 1,247 words
**Estimated narration time:** 4:35 (allows 25 seconds for pauses and code reading)
