# Video Script: Multi-Armed Bandits (7 minutes)

**Target Audience:** Advanced developers, ML engineers, data scientists
**Goal:** Explain Thompson Sampling and show live convergence to best model
**Format:** Screen recording + animated visualizations + live demo
**Duration:** 7:00

---

## Scene 1: The A/B Test Problem (0:00-0:45)

**Visual:** Animation of traditional A/B test

**Narrator:**
"Imagine you're comparing four AI models: GPT-4, GPT-4 Turbo, Claude, and Gemini. With traditional A/B testing, you split traffic evenly—25% to each model—for two weeks. Then you analyze and pick the winner."

**On-screen animation:**
- 1000 requests split 25/25/25/25
- Show GPT-4: 250 requests, quality 0.65
- Show GPT-4 Turbo: 250 requests, quality 0.72
- Show Claude: 250 requests, quality 0.78 (best!)
- Show Gemini: 250 requests, quality 0.61

**Narrator:**
"Here's the problem: You just sent 250 requests to Gemini—the worst model. And another 250 to GPT-4, which is also suboptimal. That's 500 wasted requests out of 1000."

**Visual effect:**
- Highlight wasted requests in red
- Show "Regret: 50 quality points wasted"
- Fade to show opportunity cost

**On-screen text:**
```
Traditional A/B Test:
  ❌ Equal traffic to all variants
  ❌ Wastes traffic on bad models
  ❌ Can't adapt during experiment
  ❌ High regret
```

**Narrator:**
"Multi-armed bandits solve this by dynamically shifting traffic to better models as you learn. Let me show you how."

---

## Scene 2: The Casino Analogy (0:45-1:30)

**Visual:** Animated casino with 4 slot machines

**Narrator:**
"Multi-armed bandits get their name from slot machines, or 'one-armed bandits' in casinos. Imagine you have 100 coins to spend across four slot machines. Each has a different unknown payout rate."

**Animation:**
- Show 4 slot machines labeled A, B, C, D
- Unknown payout rates: 45%, 60%, 75%, 50%
- Player has 100 coins

**Narrator:**
"You have two conflicting goals: **exploration**—trying each machine to learn their rates—and **exploitation**—playing the best machine to maximize winnings."

**Visual split screen:**

**Left side - Pure Exploration:**
```
Strategy: Try each 25 times
  Machine A: 11 wins (44%)
  Machine B: 15 wins (60%)
  Machine C: 19 wins (76%)  ← Best
  Machine D: 13 wins (52%)

  Total wins: 58/100
  Regret: 17 coins (75 - 58)
```

**Right side - Pure Exploitation:**
```
Strategy: Try each once, then best
  Machine A: 0 wins (unlucky first try)
  Machine B: 0 wins (unlucky first try)
  Machine C: 0 wins (unlucky first try)
  Machine D: 1 win (lucky!) ← Chosen
  Machine D (96x): 48 wins

  Total wins: 49/100
  Regret: 26 coins (much worse!)
```

**Narrator:**
"Pure exploration learns the rates but wastes coins on bad machines. Pure exploitation commits too early based on lucky/unlucky first tries. Thompson Sampling balances both optimally."

---

## Scene 3: Thompson Sampling Explained (1:30-2:30)

**Visual:** Animated Beta distributions

**Narrator:**
"Thompson Sampling uses Bayesian inference. For each model, we maintain a Beta distribution representing our belief about its quality."

**Animation sequence:**

**Frame 1: Initial state**
```
All models start with Beta(1, 1)
  = Uniform distribution
  = "We know nothing"
```
- Show flat Beta(1,1) distribution for all 4 models
- All equally likely to be best

**Frame 2: After 10 requests**
```
Model 1: Beta(7, 4)  → 7 successes, 3 failures
Model 2: Beta(6, 5)  → 6 successes, 4 failures
Model 3: Beta(8, 3)  → 8 successes, 2 failures ← Best so far
Model 4: Beta(5, 6)  → 5 successes, 5 failures
```
- Show Beta distributions with different shapes
- Model 3 has highest peak
- But significant overlap

**Frame 3: After 100 requests**
```
Model 1: Beta(48, 53)  → Peaked at ~47%
Model 2: Beta(61, 40)  → Peaked at ~60%
Model 3: Beta(76, 25)  → Peaked at ~75% ← Clear winner
Model 4: Beta(50, 51)  → Peaked at ~50%
```
- Show narrow, well-separated distributions
- Model 3 clearly best
- Little overlap now

**Narrator:**
"As we collect data, the distributions become more concentrated. Good models get peaked at higher values. Bad models get peaked at lower values."

**Visual highlight:**
- Animate distributions narrowing over time
- Show "Uncertainty → Confidence" transformation

---

## Scene 4: The Algorithm (2:30-3:15)

**Visual:** Algorithm flowchart + code

**Narrator:**
"Here's how Thompson Sampling works on each request:"

**Animated flowchart:**
```
For each request:
  1. Sample from each model's Beta distribution
     Model 1: sample = 0.68
     Model 2: sample = 0.71
     Model 3: sample = 0.79  ← Highest!
     Model 4: sample = 0.65

  2. Choose model with highest sample
     → Select Model 3

  3. Execute request and observe quality
     → Quality = 0.82 (good!)

  4. Update Model 3's Beta distribution
     → Beta(76, 25) becomes Beta(77, 25)

  5. Repeat for next request
```

**Show code alongside:**
```typescript
function selectModel(models) {
  // Sample from each Beta distribution
  const samples = models.map(m =>
    sampleBeta(m.alpha, m.beta)
  )

  // Choose highest sample
  const bestIdx = argmax(samples)
  return models[bestIdx]
}

function updateModel(model, quality) {
  const success = quality > 0.7 ? 1 : 0

  return {
    ...model,
    alpha: model.alpha + success,
    beta: model.beta + (1 - success)
  }
}
```

**Narrator:**
"The beauty is that sampling is random, so even low-quality models get occasional tries. This ensures we don't miss a model that improves over time."

**Visual:**
- Highlight stochastic sampling
- Show occasional "exploration" picks
- Contrast with deterministic greedy approach

---

## Scene 5: Live Demo - Watching Convergence (3:15-4:45)

**Visual:** Terminal running Thompson Sampling simulation

**Narrator:**
"Let's run a live simulation comparing four models. Watch how traffic shifts to the best model over time."

**Terminal output (animated line-by-line):**
```bash
$ npm run experiments:bandit -- --rounds 1000

Starting Thompson Sampling simulation
Models: GPT-4, GPT-4 Turbo, Claude, Gemini
Rounds: 1000

After 100 rounds:
  GPT-4           ██████ 27.0% (true rate: 65%)
  GPT-4 Turbo     █████  24.0% (true rate: 72%)
  Claude          ██████ 26.0% (true rate: 78%) ← Best
  Gemini          █████  23.0% (true rate: 61%)

After 250 rounds:
  GPT-4           ████ 20.8%
  GPT-4 Turbo     ███████ 30.4%
  Claude          ████████ 35.2% ← Traffic shifting
  Gemini          ███ 13.6%

After 500 rounds:
  GPT-4           ████ 16.4%
  Claude          ██████████ 42.8% ← Converging
  GPT-4 Turbo     ████████ 32.6%
  Gemini          ██ 8.2%

After 1000 rounds:
  GPT-4           ████ 16.2%
  GPT-4 Turbo     ████████ 31.4%
  Claude          ███████████ 45.3% ← Winner!
  Gemini          ██ 7.1%

✓ Converged to Claude (45.3% traffic)
```

**Narrator:**
"Watch closely: Initially, traffic is roughly equal. By round 250, Claude is getting more traffic. By round 500, it's clearly favored. By round 1000, Claude gets 45% while the worst model, Gemini, gets only 7%."

**Visual animation:**
- Real-time bar chart updating
- Beta distributions animating
- Traffic allocation pie chart morphing
- Cumulative regret graph climbing slowly

---

## Scene 6: Regret Comparison (4:45-5:30)

**Visual:** Comparison charts

**Narrator:**
"Now let's compare regret between Thompson Sampling and traditional A/B testing."

**Side-by-side comparison:**

**Left side - Thompson Sampling:**
```
Traffic allocation (1000 rounds):
  Best model (Claude):    453 requests
  Good model (GPT-4T):    314 requests
  OK model (GPT-4):       162 requests
  Bad model (Gemini):      71 requests

Regret calculation:
  Best possible: 1000 × 0.78 = 780
  Actual: 453×0.78 + 314×0.72 + 162×0.65 + 71×0.61
        = 353 + 226 + 105 + 43 = 727

  Total regret: 53 quality points
  Avg regret: 0.053 per request
```

**Right side - A/B Test:**
```
Traffic allocation (1000 rounds):
  Best model (Claude):    250 requests
  Good model (GPT-4T):    250 requests
  OK model (GPT-4):       250 requests
  Bad model (Gemini):     250 requests

Regret calculation:
  Best possible: 1000 × 0.78 = 780
  Actual: 250×0.78 + 250×0.72 + 250×0.65 + 250×0.61
        = 195 + 180 + 163 + 153 = 691

  Total regret: 89 quality points
  Avg regret: 0.089 per request
```

**Narrator:**
"Thompson Sampling achieves 40% less regret by adaptively shifting traffic to better models. Over a million requests, that's 36,000 higher-quality responses!"

**Visual:**
- Regret graphs side by side
- Thompson Sampling curve is lower
- Highlight 40% improvement
- Show cumulative value over time

---

## Scene 7: When to Use Bandits (5:30-6:15)

**Visual:** Decision matrix

**Narrator:**
"When should you use bandits instead of A/B tests?"

**Decision framework table:**
```
Use A/B Tests when:
✓ 2-3 variants only
✓ Need definitive statistical proof
✓ Stakeholders require fixed experiment
✓ Regulatory requirements (e.g., clinical trials)
✓ One-time decision (can't continuously adapt)

Use Bandits when:
✓ 4+ variants to compare
✓ High cost of exploration (expensive APIs)
✓ Environment changes over time
✓ Want continuous optimization
✓ Need to minimize regret
✓ Can tolerate some uncertainty
```

**Narrator:**
"Bandits excel when you have many options, exploration is expensive, and you want continuous optimization. A/B tests are better when you need definitive answers for 2-3 stable variants."

**Visual examples:**

**Good for Bandits:**
- "Which of 8 AI models is best for customer support?"
- "Optimize ad creative across 12 variations"
- "Select best pricing from 6 options"

**Good for A/B Tests:**
- "Should we add this feature? (Yes/No)"
- "Blue vs green button"
- "Old checkout vs new checkout"

---

## Scene 8: Implementation Tips (6:15-6:45)

**Visual:** Code snippets and configuration

**Narrator:**
"Here are three key tips for implementing Thompson Sampling in production."

**Tip 1: Set minimum pulls per arm**
```typescript
const MIN_PULLS_PER_ARM = 50

if (arm.pulls < MIN_PULLS_PER_ARM) {
  // Force exploration
  return selectUndersampled()
}
```
- Prevents premature convergence
- Ensures each model gets fair chance

**Tip 2: Add exploration rate**
```typescript
const EPSILON = 0.10

if (Math.random() < EPSILON) {
  // 10% random exploration
  return selectRandom()
}
```
- Hedges against changing conditions
- Discovers if "bad" model improves

**Tip 3: Use contextual information**
```typescript
// Route by request complexity
if (requestComplexity > 0.7) {
  return bandit.select(complexBandit)
} else {
  return bandit.select(simpleBandit)
}
```
- Different models for different contexts
- Improves overall performance

**Narrator:**
"These safeguards prevent common pitfalls while maintaining bandit advantages."

---

## Scene 9: Conclusion & Next Steps (6:45-7:00)

**Visual:** Results summary + resources

**Narrator:**
"You've just learned how Thompson Sampling minimizes regret by adaptively favoring better options while still exploring. This is the cutting edge of experimentation—used by Google, Meta, and Netflix for continuous optimization."

**On-screen summary:**
```
What You Learned:
✓ Exploration vs exploitation trade-off
✓ Beta distributions for Bayesian inference
✓ Thompson Sampling algorithm
✓ Regret minimization
✓ When to use bandits vs A/B tests

Impact:
  40% less regret than A/B testing
  Continuous optimization
  No waiting for significance
  Works with 4+ variants

Next Steps:
→ Tutorial: Multi-Armed Bandits
→ Read: Thompson Sampling paper
→ Implement: Your own bandit
→ Advanced: Contextual bandits
```

**Call to action:**
- Link to tutorial
- Link to academic paper
- Join community for questions

**Final visual:**
- Animated convergence graph
- "Minimize Regret. Maximize Learning."

---

## Animations to Create

### Animation 1: Beta Distribution Evolution
- Show Beta(1,1) → Beta(50,20) → Beta(100,30)
- Animate distribution narrowing
- Show peak shifting to true value
- Duration: 0:10

### Animation 2: Sampling Process
- Sample 4 values from 4 distributions
- Highlight maximum sample
- Show selection with arrow
- Duration: 0:05 (loop 3x)

### Animation 3: Traffic Allocation Over Time
- Animated stacked area chart
- Shows traffic % for each model
- Converges from 25/25/25/25 to 45/32/16/7
- Duration: 0:15

### Animation 4: Regret Accumulation
- Two lines: Bandit vs A/B Test
- Bandit line climbs slower
- Final values: 53 vs 89
- Duration: 0:10

---

## Data Files for Visualizations

**File: `bandit-simulation-data.json`**
```json
{
  "rounds": 1000,
  "models": [
    {"name": "GPT-4", "trueRate": 0.65},
    {"name": "GPT-4 Turbo", "trueRate": 0.72},
    {"name": "Claude", "trueRate": 0.78},
    {"name": "Gemini", "trueRate": 0.61}
  ],
  "snapshots": [
    {"round": 100, "allocation": [0.27, 0.24, 0.26, 0.23]},
    {"round": 250, "allocation": [0.21, 0.30, 0.35, 0.14]},
    {"round": 500, "allocation": [0.16, 0.33, 0.43, 0.08]},
    {"round": 1000, "allocation": [0.16, 0.31, 0.45, 0.07]}
  ]
}
```

---

## Production Notes

### Visual Complexity
- Higher production value than previous videos
- Multiple animated charts
- Mathematical notation (keep simple)
- Color-coded models throughout

### Color Scheme for Models
- GPT-4: Blue (#0066CC)
- GPT-4 Turbo: Light Blue (#66B2FF)
- Claude: Green (#28A745)
- Gemini: Orange (#FF6B35)

### Mathematical Notation
- Use simple symbols
- Avoid Greek letters if possible
- Show formulas briefly (3 seconds max)
- Prefer visual representations

### Pace
- Slower for algorithm section (2:30-3:15)
- Faster for demo (3:15-4:45) - exciting!
- Normal pace elsewhere

---

## Voiceover Script (Text Only)

Imagine you're comparing four AI models: GPT-4, GPT-4 Turbo, Claude, and Gemini. With traditional A/B testing, you split traffic evenly—25% to each model—for two weeks. Then you analyze and pick the winner. Here's the problem: You just sent 250 requests to Gemini—the worst model. And another 250 to GPT-4, which is also suboptimal. That's 500 wasted requests out of 1000. Multi-armed bandits solve this by dynamically shifting traffic to better models as you learn. Let me show you how.

Multi-armed bandits get their name from slot machines, or 'one-armed bandits' in casinos. Imagine you have 100 coins to spend across four slot machines. Each has a different unknown payout rate. You have two conflicting goals: exploration—trying each machine to learn their rates—and exploitation—playing the best machine to maximize winnings.

Pure exploration learns the rates but wastes coins on bad machines. Pure exploitation commits too early based on lucky or unlucky first tries. Thompson Sampling balances both optimally.

Thompson Sampling uses Bayesian inference. For each model, we maintain a Beta distribution representing our belief about its quality. As we collect data, the distributions become more concentrated. Good models get peaked at higher values. Bad models get peaked at lower values.

Here's how Thompson Sampling works on each request. The beauty is that sampling is random, so even low-quality models get occasional tries. This ensures we don't miss a model that improves over time.

Let's run a live simulation comparing four models. Watch how traffic shifts to the best model over time. Watch closely: Initially, traffic is roughly equal. By round 250, Claude is getting more traffic. By round 500, it's clearly favored. By round 1000, Claude gets 45% while the worst model, Gemini, gets only 7%.

Now let's compare regret between Thompson Sampling and traditional A/B testing. Thompson Sampling achieves 40% less regret by adaptively shifting traffic to better models. Over a million requests, that's 36,000 higher-quality responses!

When should you use bandits instead of A/B tests? Bandits excel when you have many options, exploration is expensive, and you want continuous optimization. A/B tests are better when you need definitive answers for 2-3 stable variants.

Here are three key tips for implementing Thompson Sampling in production. These safeguards prevent common pitfalls while maintaining bandit advantages.

You've just learned how Thompson Sampling minimizes regret by adaptively favoring better options while still exploring. This is the cutting edge of experimentation—used by Google, Meta, and Netflix for continuous optimization.

---

**Total word count:** 1,689 words
**Estimated narration time:** 6:15 (allows 45 seconds for pauses, animations, and math visualization)
