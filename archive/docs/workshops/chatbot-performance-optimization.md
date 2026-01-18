# Chatbot Performance Optimization Workshop

**Duration:** 2.5 hours
**Level:** Intermediate
**Prerequisites:** Basic understanding of A/B testing, statistics, and web performance

---

## Table of Contents

1. [Introduction to Chatbot Performance](#1-introduction-to-chatbot-performance)
2. [Experiment Design](#2-experiment-design)
3. [Hands-on Implementation](#3-hands-on-implementation)
4. [Performance Optimization Techniques](#4-performance-optimization-techniques)
5. [Statistical Analysis](#5-statistical-analysis)
6. [Best Practices](#6-best-practices)
7. [Exercises and Quiz](#7-exercises-and-quiz)

---

## 1. Introduction to Chatbot Performance (15 minutes)

### Why Performance Matters for Engagement

User engagement with chatbots is highly sensitive to performance. Research shows that:

- **100ms delay** can reduce engagement by 7%
- **1 second delay** can reduce conversions by 20%
- **3+ second wait** causes 53% of users to abandon the interaction

For AI-powered chatbots, performance considerations include:

1. **Cold Start Latency** - Time to initialize the model/service
2. **Time to First Token (TTFT)** - Time until the first response appears
3. **Total Response Time** - Complete time from question to full answer
4. **Streaming Quality** - How smoothly tokens appear

### Key Metrics

#### Time to First Token (TTFT)

The most critical metric for perceived responsiveness. Users notice delays over 200ms.

```typescript
// Measuring TTFT
const startTime = Date.now()
const stream = await chatbot.streamResponse(message)
const firstToken = await stream.next()
const ttft = Date.now() - startTime
console.log(`TTFT: ${ttft}ms`)
```

**Good targets:**
- Excellent: < 500ms
- Good: 500-1000ms
- Acceptable: 1000-2000ms
- Poor: > 2000ms

#### Cold Start Latency

The additional time required to initialize services on first use.

Common causes:
- Database connection pooling
- Model loading
- API authentication
- Cache warming

#### Session Duration & Messages Per Session

Indicators of user engagement:
- More messages = higher satisfaction
- Longer sessions (to a point) = better UX
- Repeat usage = successful chatbot

### The Performance-Engagement Trade-off

**The Central Question:**
Should we optimize for fast initial page load (lazy loading) or instant response (preloading)?

| Strategy | Pros | Cons |
|----------|------|------|
| **Lazy Load** | Faster page load, lower initial resource usage | Slower first response, cold start penalty |
| **Preload** | Instant first response, no cold start | Slower page load, higher resource usage |

This workshop will help you scientifically determine which strategy works best for YOUR users.

---

## 2. Experiment Design (20 minutes)

### Hypothesis Formulation

A good hypothesis is:
- **Specific:** Define exact metrics and expected change
- **Measurable:** Use quantifiable metrics
- **Directional:** State which variant should perform better
- **Realistic:** Based on prior research or data

**Example Hypothesis:**
> "Preloaded chatbot increases user engagement (messages per session) by 30% compared to lazy loading, despite slower initial load."

**Why this hypothesis works:**
- Specific metric: messages per session
- Quantifiable: 30% increase
- Directional: preload > lazy
- Acknowledges trade-off: slower initial load

### Variant Design

#### Variant A: Lazy Load (Control)

```typescript
// Initialize chatbot only when user sends first message
class LazyChatbot {
  private client: ChatClient | null = null

  async sendMessage(message: string) {
    if (!this.client) {
      const startTime = Date.now()
      this.client = await initializeChatClient()
      const coldStart = Date.now() - startTime
      console.log(`Cold start: ${coldStart}ms`)
    }

    return await this.client.chat(message)
  }
}
```

**Characteristics:**
- No initialization on page load
- First message incurs cold start penalty (typically 2-5 seconds)
- Subsequent messages are fast
- Lower resource usage

#### Variant B: Preload (Treatment)

```typescript
// Initialize chatbot on page load
class PreloadedChatbot {
  private client: ChatClient

  constructor() {
    // Pre-initialize during page load
    this.initializeAsync()
  }

  private async initializeAsync() {
    this.client = await initializeChatClient()
    console.log('Chatbot ready')
  }

  async sendMessage(message: string) {
    // No cold start - client already ready
    return await this.client.chat(message)
  }
}
```

**Characteristics:**
- Initialization happens immediately on page load
- No cold start penalty on first message
- All messages have consistent response times
- Higher initial resource usage

### Metrics Selection

Choose metrics that align with your business goals:

#### Primary Metrics (Decision Criteria)

1. **Messages Per Session**
   - Indicates engagement level
   - Higher = more engaged users
   - Sample size needed: 500+ sessions per variant

2. **Engagement Score** (Composite)
   ```typescript
   engagementScore = (
     messageCount * 0.4 +
     sessionDuration * 0.3 +
     responseSpeed * 0.2 +
     satisfaction * 0.1
   )
   ```

#### Secondary Metrics (Diagnostics)

1. **TTFT** - Diagnose response speed issues
2. **Cold Start** - Measure initialization overhead
3. **Session Duration** - Understand user behavior
4. **Bounce Rate** - Track early abandonment

#### Guardrail Metrics (Safety)

```typescript
const guardrails = [
  { metric: 'error_rate', operator: '<', threshold: 0.02 },
  { metric: 'ttft_ms', operator: '<', threshold: 3000 },
  { metric: 'user_satisfaction', operator: '>', threshold: 4.0 }
]
```

### Sample Size Calculation

Use statistical power analysis to determine required sample size:

```typescript
import { calculateMinimumSampleSize } from '@/lib/experiments/statistics'

// Parameters
const baselineMessagesPerSession = 2.5
const minimumDetectableEffect = 0.20 // 20% relative increase
const statisticalPower = 0.8 // 80% power
const alpha = 0.05 // 5% significance level

const sampleSize = calculateMinimumSampleSize(
  baselineMessagesPerSession,
  minimumDetectableEffect,
  statisticalPower,
  alpha
)

console.log(`Need ${sampleSize} sessions per variant`)
// Output: Need 393 sessions per variant
```

**Rule of thumb:**
- Small effect (5-10%): 2000+ sessions per variant
- Medium effect (10-30%): 400-800 sessions per variant
- Large effect (30%+): 100-400 sessions per variant

---

## 3. Hands-on Implementation (45 minutes)

### Step 1: Set Up Experiment Infrastructure

First, create the experiment configuration:

```typescript
// src/lib/experiments/scenarios/chatbot-speed.ts

export const CHATBOT_EXPERIMENT = {
  experimentKey: 'chatbot_performance_v1',
  name: 'Chatbot Performance Optimization',
  hypothesis: 'Preloaded chatbot increases engagement by 30%',
  variants: {
    lazy_load: {
      key: 'lazy_load',
      strategy: 'lazy',
      description: 'Initialize RAG on first message'
    },
    preload: {
      key: 'preload',
      strategy: 'eager',
      description: 'Pre-initialize RAG on page load'
    }
  },
  metrics: [
    { name: 'ttft_ms', description: 'Time to First Token' },
    { name: 'cold_start_ms', description: 'Cold start latency' },
    { name: 'session_message_count', description: 'Messages per session' },
    { name: 'engagement_score', description: 'Overall engagement (0-1)' }
  ]
}
```

### Step 2: Implement Variant Logic

Create the session management system:

```typescript
// Session creation with variant assignment
export async function createChatSession(
  userId: string,
  sessionId: string,
  variant?: 'lazy_load' | 'preload'
): Promise<SessionInfo> {
  // Assign variant (50/50 randomization)
  const variantKey = variant || assignVariant(userId, sessionId)
  const isPreloaded = variantKey === 'preload'

  // Log assignment to warehouse
  await experimentWarehouse.logAssignment(
    CHATBOT_EXPERIMENT.experimentKey,
    userId,
    variantKey,
    { sessionId }
  )

  // Create session
  const session: ChatSession = {
    sessionId,
    userId,
    variantKey,
    messages: [],
    startTime: new Date(),
    metadata: {
      isPreloaded,
      totalMessages: 0
    }
  }

  activeSessions.set(sessionId, session)

  // Preload if needed
  if (isPreloaded) {
    await preloadChatClient(sessionId)
  }

  return {
    sessionId,
    variantKey,
    strategy: isPreloaded ? 'eager' : 'lazy'
  }
}
```

### Step 3: Track Metrics

Implement comprehensive metric tracking:

```typescript
export async function sendChatMessage(
  request: ChatRequest
): Promise<ChatResponse> {
  const { userId, sessionId, message } = request
  const session = activeSessions.get(sessionId)!

  const isFirstMessage = session.messages.length === 0
  const isPreloaded = session.metadata.isPreloaded

  // Measure cold start for lazy load
  let coldStartMs = 0
  if (!isPreloaded && isFirstMessage) {
    const startTime = Date.now()
    await initializeChatClient(sessionId)
    coldStartMs = Date.now() - startTime
  }

  // Measure TTFT
  const startTime = Date.now()
  const response = await generateResponse(message, session)
  const ttftMs = Date.now() - startTime

  // Log metrics
  await experimentWarehouse.logMetric(
    CHATBOT_EXPERIMENT.experimentKey,
    userId,
    'ttft_ms',
    ttftMs,
    { sessionId, variantKey: session.variantKey }
  )

  if (coldStartMs > 0) {
    await experimentWarehouse.logMetric(
      CHATBOT_EXPERIMENT.experimentKey,
      userId,
      'cold_start_ms',
      coldStartMs,
      { sessionId, variantKey: session.variantKey }
    )
  }

  return {
    variantKey: session.variantKey,
    strategy: session.metadata.isPreloaded ? 'eager' : 'lazy',
    message: response,
    metrics: { ttftMs, coldStartMs, /* ... */ }
  }
}
```

### Step 4: Calculate Engagement Score

Implement the engagement scoring algorithm:

```typescript
export function calculateEngagementScore(session: {
  messageCount: number
  sessionDuration: number // milliseconds
  avgResponseTime: number // milliseconds
  userSatisfaction?: number // 1-5 rating
}): number {
  // Normalize message count (0-1 scale, max at 10 messages)
  const messageScore = Math.min(session.messageCount / 10, 1)

  // Normalize duration (0-1 scale, max at 5 minutes)
  const durationScore = Math.min(session.sessionDuration / 300000, 1)

  // Normalize response time (inverse, 0-1 scale, max penalty at 10s)
  const speedScore = 1 - Math.min(session.avgResponseTime / 10000, 1)

  // Normalize satisfaction (0-1 scale from 1-5 rating)
  const satisfactionScore = session.userSatisfaction
    ? (session.userSatisfaction - 1) / 4
    : 0.5 // Default to neutral if not provided

  // Weighted combination
  return (
    messageScore * 0.4 +      // 40% weight on messages
    durationScore * 0.3 +     // 30% weight on duration
    speedScore * 0.2 +        // 20% weight on speed
    satisfactionScore * 0.1   // 10% weight on satisfaction
  )
}
```

**Example calculation:**
```typescript
const score = calculateEngagementScore({
  messageCount: 5,           // 0.5 normalized
  sessionDuration: 180000,   // 3 min = 0.6 normalized
  avgResponseTime: 2000,     // 2s = 0.8 normalized
  userSatisfaction: 4        // 0.75 normalized
})
// score = 0.5*0.4 + 0.6*0.3 + 0.8*0.2 + 0.75*0.1 = 0.615
```

---

## 4. Performance Optimization Techniques (30 minutes)

### Model Caching Strategies

#### 1. In-Memory Cache with TTL

```typescript
class CachedChatClient {
  private cache = new Map<string, CachedResponse>()
  private readonly TTL_MS = 5 * 60 * 1000 // 5 minutes

  async chat(message: string): Promise<string> {
    const cacheKey = this.hashMessage(message)

    // Check cache
    const cached = this.cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < this.TTL_MS) {
      return cached.response
    }

    // Cache miss - call API
    const response = await this.callAPI(message)
    this.cache.set(cacheKey, {
      response,
      timestamp: Date.now()
    })

    return response
  }
}
```

**Benefits:**
- Reduces API calls by 30-50%
- Instant responses for common questions
- Lower costs and faster TTFT

**Trade-offs:**
- Memory usage increases
- Stale responses possible
- Cache invalidation complexity

#### 2. RAG Context Pre-fetching

```typescript
class PreloadedRAG {
  private contextCache: Map<string, RAGContext>

  async preloadCommonTopics() {
    const commonTopics = [
      'deployment',
      'authentication',
      'database setup'
    ]

    for (const topic of commonTopics) {
      const context = await this.buildRAGContext(topic)
      this.contextCache.set(topic, context)
    }
  }

  async chat(message: string): Promise<string> {
    // Check if message matches cached topic
    const topic = this.identifyTopic(message)
    const context = this.contextCache.get(topic) ||
                    await this.buildRAGContext(message)

    return await this.generateResponse(message, context)
  }
}
```

### Connection Pooling

Reuse database and API connections:

```typescript
class ConnectionPool {
  private pool: Connection[] = []
  private readonly MAX_CONNECTIONS = 10

  async getConnection(): Promise<Connection> {
    // Reuse existing idle connection
    const idle = this.pool.find(c => !c.inUse)
    if (idle) {
      idle.inUse = true
      return idle
    }

    // Create new if under limit
    if (this.pool.length < this.MAX_CONNECTIONS) {
      const conn = await this.createConnection()
      this.pool.push(conn)
      return conn
    }

    // Wait for available connection
    return await this.waitForConnection()
  }
}
```

**Performance Impact:**
- Reduces connection overhead by 80-95%
- First request: 200-500ms
- Subsequent requests: 10-50ms

### Streaming Responses

Improve perceived performance with streaming:

```typescript
async function* streamChatResponse(message: string) {
  const stream = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: message }],
    stream: true
  })

  let ttft: number | null = null
  const startTime = Date.now()

  for await (const chunk of stream) {
    const token = chunk.choices[0]?.delta?.content
    if (token) {
      if (ttft === null) {
        ttft = Date.now() - startTime
        console.log(`TTFT: ${ttft}ms`)
      }
      yield token
    }
  }
}
```

**User Experience:**
- Users see response start immediately
- Perceived speed increase of 3-5x
- Better for long responses

### Parallel Processing

Process independent operations concurrently:

```typescript
async function generateChatResponse(message: string) {
  // Run RAG search and initial processing in parallel
  const [ragContext, messageEmbedding, userProfile] = await Promise.all([
    buildRAGContext(message),
    embedMessage(message),
    fetchUserProfile(userId)
  ])

  // Generate response with all data
  return await generateWithContext(message, {
    ragContext,
    messageEmbedding,
    userProfile
  })
}
```

**Performance Gain:**
Sequential: 300ms + 200ms + 150ms = 650ms
Parallel: max(300ms, 200ms, 150ms) = 300ms
**Improvement: 54% faster**

---

## 5. Statistical Analysis (20 minutes)

### Interpreting P-Values

The p-value answers: "If there's actually no difference between variants, what's the probability of seeing results this extreme by chance?"

**Common Misconceptions:**
- p < 0.05 does NOT mean 95% probability the hypothesis is true
- p-value does NOT measure effect size
- Statistical significance ≠ practical significance

**Correct Interpretation:**
```typescript
const result = tTest(controlData, treatmentData)
// result.pValue = 0.023

// WRONG: "There's a 97.7% chance treatment is better"
// RIGHT: "If treatment had no effect, we'd see these results 2.3% of the time by chance"
```

### Understanding Confidence Intervals

Confidence intervals show the range where the true effect likely lies:

```typescript
const ci = confidenceInterval(treatmentData, 0.95)
console.log(`95% CI: [${ci.lower}, ${ci.upper}]`)
// Output: 95% CI: [2.8, 3.6] messages per session
```

**Interpretation:**
- We're 95% confident the true mean is between 2.8 and 3.6
- Wider intervals = more uncertainty
- Narrower intervals = more precise estimate

**Decision Making:**
```typescript
if (ci.lower > controlMean) {
  console.log('Treatment is conclusively better')
} else if (ci.upper < controlMean) {
  console.log('Treatment is conclusively worse')
} else {
  console.log('Results are inconclusive - need more data')
}
```

### Making Data-Driven Decisions

Use a decision framework:

#### 1. Check Statistical Significance

```typescript
const messagesTest = tTest(
  lazyLoadMessages,
  preloadMessages
)

if (!messagesTest.significant) {
  console.log('Not statistically significant - need more data')
  return 'continue_experiment'
}
```

#### 2. Evaluate Practical Significance

```typescript
const improvement = (preloadMean - lazyMean) / lazyMean * 100

if (improvement < 5) {
  console.log('Statistically significant but too small to matter')
  return 'no_change'
}
```

#### 3. Check Guardrails

```typescript
const guardrailsPassed = checkGuardrails({
  error_rate: 0.018,      // < 0.02 ✓
  ttft_ms: 850,           // < 3000 ✓
  user_satisfaction: 4.2  // > 4.0 ✓
})

if (!guardrailsPassed) {
  console.log('Guardrails violated - do not ship')
  return 'rollback'
}
```

#### 4. Consider Trade-offs

```typescript
const decision = {
  messagesPerSession: {
    improvement: +52%,  // Huge win
    pValue: 0.034       // Significant
  },
  coldStart: {
    eliminated: true,   // Major UX improvement
    cost: 'minimal'     // 50ms page load
  },
  recommendation: 'ship_preload'
}
```

### Effect Size Calculations

Measure the magnitude of difference:

```typescript
import { cohensD, relativeUplift } from '@/lib/experiments/statistics'

// Cohen's d (standardized effect size)
const d = cohensD(controlData, treatmentData)
// d = 0.35

// Interpretation:
// d < 0.2: small effect
// d = 0.5: medium effect
// d > 0.8: large effect

// Relative uplift (percentage change)
const uplift = relativeUplift(controlMean, treatmentMean)
// uplift = 28.5% increase
```

---

## 6. Best Practices (20 minutes)

### When to Optimize Startup vs Response Time

**Choose Lazy Load when:**
- Page load speed is critical (SEO, bounce rate)
- Chatbot usage rate is low (< 30% of visitors)
- Users typically don't use chatbot immediately
- Resource constraints (mobile, low-end devices)

**Choose Preload when:**
- User engagement is primary goal
- High chatbot usage rate (> 50% of visitors)
- Users expect instant responses
- Sufficient resources available

**Example Decision Matrix:**

| Scenario | Recommendation | Reason |
|----------|----------------|--------|
| E-commerce site, 15% chatbot usage | Lazy Load | Optimize for page speed, most users don't use chatbot |
| Support portal, 80% chatbot usage | Preload | Users expect instant help |
| Mobile app, limited bandwidth | Lazy Load | Conserve resources |
| Desktop SaaS, power users | Preload | Optimize for engagement |

### Balancing Performance and Cost

AI chatbots can be expensive. Optimize costs:

#### 1. Implement Smart Caching

```typescript
class CostOptimizedChat {
  private cache = new LRUCache<string, string>({ max: 1000 })

  async chat(message: string): Promise<string> {
    // Use cheaper model for cache lookup
    const similar = await this.findSimilar(message, 'text-embedding-3-small')

    if (similar && similar.score > 0.95) {
      return this.cache.get(similar.key)! // Cache hit - $0 cost
    }

    // Cache miss - use full model
    const response = await this.callAPI(message) // ~$0.01
    this.cache.set(message, response)

    return response
  }
}
```

**Cost Savings:**
- Cache hit rate: 40%
- Average cost reduction: 40%
- ROI: $400/month saved for 1000 daily users

#### 2. Use Tiered Models

```typescript
function selectModel(messageComplexity: number) {
  if (messageComplexity < 0.3) {
    return 'gpt-3.5-turbo' // $0.0005/1K tokens
  } else if (messageComplexity < 0.7) {
    return 'gpt-4-turbo' // $0.01/1K tokens
  } else {
    return 'gpt-4' // $0.03/1K tokens
  }
}
```

#### 3. Rate Limiting

```typescript
class RateLimitedChat {
  private userLimits = new Map<string, RateLimit>()

  async chat(userId: string, message: string): Promise<string> {
    const limit = this.userLimits.get(userId) || {
      count: 0,
      resetAt: Date.now() + 3600000 // 1 hour
    }

    if (limit.count >= 50) {
      throw new Error('Rate limit exceeded. Try again in 1 hour.')
    }

    limit.count++
    this.userLimits.set(userId, limit)

    return await this.callAPI(message)
  }
}
```

### Monitoring Production Experiments

Set up comprehensive monitoring:

#### 1. Real-time Metrics Dashboard

```typescript
// Track key metrics in real-time
const metrics = {
  ttft: new Histogram('chatbot_ttft_ms', [100, 500, 1000, 2000, 5000]),
  errors: new Counter('chatbot_errors_total'),
  sessions: new Counter('chatbot_sessions_total'),
  engagement: new Gauge('chatbot_engagement_score')
}

// Log every interaction
metrics.ttft.observe(ttftMs)
metrics.sessions.inc({ variant: variantKey })
metrics.engagement.set(engagementScore)
```

#### 2. Automated Alerts

```typescript
const alerts = [
  {
    name: 'High Error Rate',
    condition: 'error_rate > 0.05',
    action: 'pause_experiment'
  },
  {
    name: 'Poor Performance',
    condition: 'ttft_p95 > 5000',
    action: 'notify_team'
  },
  {
    name: 'Sample Ratio Mismatch',
    condition: 'srm_pvalue < 0.05',
    action: 'investigate'
  }
]
```

#### 3. Regular Analysis

Schedule automated analysis:

```typescript
// Run daily
async function dailyAnalysis() {
  const summary = await getChatbotExperimentSummary()

  // Check for early winning signal
  if (summary.totalSessions > 200) {
    if (summary.statisticalSignificance.engagement.significant) {
      await notifyTeam({
        message: 'Experiment showing significant results',
        recommendation: 'Consider early rollout',
        confidence: 'high'
      })
    }
  }

  // Generate report
  await generateReport(summary)
}
```

---

## 7. Exercises and Quiz

### Exercise 1: Calculate Sample Size (10 minutes)

You want to detect a 15% improvement in messages per session. Current baseline is 2.8 messages.

**Task:** Calculate the required sample size.

```typescript
// Your code here
const sampleSize = calculateMinimumSampleSize(
  // Fill in parameters
)
```

<details>
<summary>Solution</summary>

```typescript
const sampleSize = calculateMinimumSampleSize(
  2.8,      // baseline rate
  0.15,     // 15% minimum detectable effect
  0.8,      // 80% power
  0.05      // 5% alpha
)
// Result: ~620 sessions per variant
```
</details>

### Exercise 2: Engagement Score (10 minutes)

Calculate the engagement score for a session:
- 7 messages
- 4 minutes duration
- 1.8 second average response time
- User satisfaction: 4.5/5

<details>
<summary>Solution</summary>

```typescript
const score = calculateEngagementScore({
  messageCount: 7,           // 0.7 normalized
  sessionDuration: 240000,   // 4 min = 0.8 normalized
  avgResponseTime: 1800,     // 1.8s = 0.82 normalized
  userSatisfaction: 4.5      // 0.875 normalized
})

// score = 0.7*0.4 + 0.8*0.3 + 0.82*0.2 + 0.875*0.1
// score = 0.28 + 0.24 + 0.164 + 0.0875
// score = 0.7715 (77.15% engagement)
```
</details>

### Exercise 3: Interpret Results (15 minutes)

Experiment results after 1000 sessions:

```
Lazy Load:
- TTFT: 1150ms
- Messages/session: 2.6
- Engagement: 0.63
- Cold start: 3200ms

Preload:
- TTFT: 820ms
- Messages/session: 3.1
- Engagement: 0.71
- Cold start: 0ms

Statistical tests:
- Messages p-value: 0.042
- Engagement p-value: 0.038
```

**Questions:**
1. Is the result statistically significant?
2. What's the practical improvement?
3. Should you ship the preload variant?

<details>
<summary>Solution</summary>

1. **Statistical significance:** YES
   - Messages p-value (0.042) < 0.05 ✓
   - Engagement p-value (0.038) < 0.05 ✓

2. **Practical improvement:**
   - Messages: +19.2% ((3.1-2.6)/2.6)
   - Engagement: +12.7% ((0.71-0.63)/0.63)
   - TTFT: -28.7% improvement
   - Cold start: eliminated

3. **Decision:** SHIP PRELOAD
   - Statistically significant ✓
   - Practically significant (>10% improvement) ✓
   - Clear UX improvement (no cold start) ✓
   - Minimal downside (slightly slower page load) ✓
</details>

### Quiz Questions

**Q1:** What does a p-value of 0.03 mean?

a) There's a 97% chance the treatment is better
b) If there's no real difference, we'd see these results 3% of the time by chance
c) The treatment is 3% better than control
d) We're 97% confident in our results

<details>
<summary>Answer</summary>

**B** - The p-value is the probability of observing results this extreme (or more extreme) if the null hypothesis (no difference) is true.
</details>

**Q2:** When should you use lazy loading for a chatbot?

a) Always - it's faster
b) When page load speed is more important than instant chat
c) When you have unlimited resources
d) Never - preloading is always better

<details>
<summary>Answer</summary>

**B** - Use lazy loading when page load speed is critical and chatbot usage rate is low. It's a trade-off based on your priorities.
</details>

**Q3:** What's a good TTFT target for chatbots?

a) < 100ms
b) < 500ms
c) < 5000ms
d) Doesn't matter

<details>
<summary>Answer</summary>

**B** - Under 500ms is excellent for TTFT. Under 1000ms is good. Over 2000ms is poor and noticeably impacts engagement.
</details>

---

## Summary and Key Takeaways

### Main Learnings

1. **Performance drives engagement** - Every 100ms matters
2. **Measure what matters** - TTFT and engagement are key
3. **Scientific approach** - Use A/B testing to validate assumptions
4. **Trade-offs exist** - Balance startup speed vs response time
5. **Statistical rigor** - Understand p-values and confidence intervals
6. **Optimize iteratively** - Cache, pool connections, stream responses

### Next Steps

1. **Implement your own experiment**
   - Use the code samples as templates
   - Define clear hypothesis
   - Set up metrics tracking

2. **Run for adequate duration**
   - Wait for statistical significance
   - Check guardrails daily
   - Monitor for SRM

3. **Make data-driven decisions**
   - Combine statistical and practical significance
   - Consider business context
   - Document learnings

### Additional Resources

- [Statistical Power Calculator](https://www.stat.ubc.ca/~rollin/stats/ssize/n2.html)
- [A/B Testing Best Practices](https://exp-platform.com/papers/)
- [Chatbot UX Research](https://www.nngroup.com/articles/chatbot-usability/)
- [Performance Optimization Guide](https://web.dev/fast/)

---

## Workshop Feedback

Please share your feedback to help us improve:

1. What was most valuable?
2. What could be improved?
3. What topics should we cover next?

**Thank you for participating!**

---

**Word Count: ~3,847 words**
