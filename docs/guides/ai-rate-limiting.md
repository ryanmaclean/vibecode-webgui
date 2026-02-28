# AI Rate Limiting and Cost Optimization Guide

A comprehensive guide to implementing rate limiting, retry logic, and cost optimization strategies for AI model usage in VibeCode WebGUI.

## 📚 Table of Contents

- [Overview](#-overview)
- [Rate Limiting Implementation](#-rate-limiting-implementation)
- [Retry Logic with Exponential Backoff](#-retry-logic-with-exponential-backoff)
- [Handling 429 Errors](#-handling-429-errors)
- [Cost Optimization Strategies](#-cost-optimization-strategies)
- [Response Caching](#-response-caching)
- [Request Batching](#-request-batching)
- [Model Selection for Cost Savings](#-model-selection-for-cost-savings)
- [Monitoring and Analytics](#-monitoring-and-analytics)
- [Best Practices](#-best-practices)
- [Troubleshooting](#-troubleshooting)

## 🎯 Overview

VibeCode WebGUI implements sophisticated rate limiting and cost optimization for AI model usage to ensure reliable service and control expenses. This guide covers:

- **Rate Limit Handling** - Automatic retry logic with exponential backoff
- **429 Error Recovery** - Graceful handling of rate limit responses
- **Cost Optimization** - Strategies to minimize AI API costs
- **Response Caching** - Intelligent caching for repeated requests
- **Request Batching** - Efficient bulk processing
- **Budget Controls** - Cost tracking and limits

### Key Features

| Feature | Implementation | Benefit |
|---------|----------------|---------|
| **Exponential Backoff** | 1s, 2s, 4s delays with jitter | Prevents thundering herd |
| **Retry-After Support** | Honors API retry headers | Optimal retry timing |
| **Response Caching** | Redis/Valkey with TTL | Reduces redundant calls |
| **Cost Tracking** | Real-time usage monitoring | Budget control |
| **Model Fallback** | Automatic cheaper alternatives | Cost savings |

### Configuration

```typescript
// Retry configuration (from src/lib/openrouter-client.ts)
const RETRY_CONFIG = {
  maxRetries: 3,              // Maximum retry attempts
  baseDelayMs: 1000,          // Initial delay (1 second)
  maxDelayMs: 30000,          // Maximum delay (30 seconds)
};
```

## ⚡ Rate Limiting Implementation

### Understanding Rate Limits

OpenRouter and other AI providers enforce rate limits to ensure fair usage:

| Provider | Rate Limit | Window | Notes |
|----------|-----------|--------|-------|
| **OpenRouter** | 200 requests | 1 minute | Per API key |
| **Anthropic** | 50 requests | 1 minute | Direct API |
| **OpenAI** | 60 requests | 1 minute | Tier-based |

### Rate Limit Headers

All AI API responses include rate limit information:

```typescript
// Check rate limit headers
const response = await fetch('/api/ai/chat', {
  method: 'POST',
  body: JSON.stringify({ message: 'Hello', model: 'anthropic/claude-3-haiku' })
});

// Extract rate limit information
const limit = response.headers.get('X-RateLimit-Limit');
const remaining = response.headers.get('X-RateLimit-Remaining');
const reset = response.headers.get('X-RateLimit-Reset');

console.log(`Rate Limit: ${remaining}/${limit} requests remaining`);
console.log(`Resets at: ${new Date(parseInt(reset) * 1000)}`);
```

### Client-Side Rate Limiting

Implement client-side rate limiting to prevent hitting API limits:

```typescript
class RateLimiter {
  private requests: number[] = [];
  private limit: number;
  private windowMs: number;

  constructor(limit: number, windowMs: number) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  async acquire(): Promise<void> {
    const now = Date.now();

    // Remove old requests outside the window
    this.requests = this.requests.filter(
      time => now - time < this.windowMs
    );

    if (this.requests.length >= this.limit) {
      // Calculate wait time
      const oldestRequest = this.requests[0];
      const waitTime = this.windowMs - (now - oldestRequest);

      console.log(`Rate limit reached, waiting ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));

      // Retry acquire
      return this.acquire();
    }

    this.requests.push(now);
  }

  reset() {
    this.requests = [];
  }
}

// Usage
const limiter = new RateLimiter(200, 60000); // 200 requests per minute

async function makeAIRequest(message: string) {
  await limiter.acquire();

  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    body: JSON.stringify({ message, model: 'anthropic/claude-3-haiku' })
  });

  return response.json();
}
```

### Token Bucket Algorithm

For more sophisticated rate limiting:

```typescript
class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private capacity: number;
  private refillRate: number; // tokens per second

  constructor(capacity: number, refillRate: number) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.refillRate = refillRate;
    this.lastRefill = Date.now();
  }

  private refill() {
    const now = Date.now();
    const timePassed = (now - this.lastRefill) / 1000;
    const tokensToAdd = timePassed * this.refillRate;

    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  async consume(tokens: number = 1): Promise<void> {
    this.refill();

    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return;
    }

    // Calculate wait time
    const tokensNeeded = tokens - this.tokens;
    const waitTime = (tokensNeeded / this.refillRate) * 1000;

    console.log(`Waiting ${Math.ceil(waitTime)}ms for tokens...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));

    return this.consume(tokens);
  }
}

// Usage - 200 requests per minute = 3.33 per second
const bucket = new TokenBucket(200, 3.33);

async function makeRequest(message: string, estimatedCost: number = 1) {
  await bucket.consume(estimatedCost);

  return fetch('/api/ai/chat', {
    method: 'POST',
    body: JSON.stringify({ message, model: 'anthropic/claude-3-haiku' })
  });
}
```

## 🔄 Retry Logic with Exponential Backoff

### Implementation Details

The OpenRouter client implements automatic retry with exponential backoff for transient errors:

```typescript
/**
 * Exponential backoff with jitter
 * Based on src/lib/openrouter-client.ts implementation
 */
function getBackoffDelay(attempt: number, retryAfterMs?: number): number {
  if (retryAfterMs) {
    // Honor server's retry-after header
    return Math.min(retryAfterMs, 30000);
  }

  // Exponential backoff: 1s, 2s, 4s, 8s...
  const exponentialDelay = 1000 * Math.pow(2, attempt);

  // Add jitter (±10%) to prevent thundering herd
  const jitter = exponentialDelay * 0.1 * (Math.random() * 2 - 1);

  return Math.min(exponentialDelay + jitter, 30000);
}

// Sleep helper
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Extract retry-after from headers
function getRetryAfterFromHeaders(headers: Headers): number | undefined {
  const retryAfter = headers.get('retry-after');
  if (retryAfter) {
    const seconds = parseInt(retryAfter, 10);
    if (!isNaN(seconds)) {
      return seconds * 1000;
    }
  }
  return undefined;
}
```

### Complete Retry Implementation

```typescript
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
};

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  config = RETRY_CONFIG
): Promise<Response> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Handle rate limiting (429) with retry
      if (response.status === 429) {
        if (attempt < config.maxRetries) {
          const retryAfterMs = getRetryAfterFromHeaders(response.headers);
          const delayMs = getBackoffDelay(attempt, retryAfterMs);

          console.warn(
            `[Retry] Rate limited (429), ` +
            `retrying in ${Math.round(delayMs / 1000)}s ` +
            `(attempt ${attempt + 1}/${config.maxRetries})`
          );

          await sleep(delayMs);
          continue;
        }

        throw new Error(
          `Rate limited (429) after ${config.maxRetries} retries`
        );
      }

      // Success
      if (response.ok) {
        return response;
      }

      // Non-retryable errors
      if (response.status >= 400 && response.status < 500) {
        throw new Error(`Client error: ${response.status}`);
      }

      // Server errors - retry
      if (response.status >= 500) {
        if (attempt < config.maxRetries) {
          const delayMs = getBackoffDelay(attempt);
          console.warn(
            `[Retry] Server error ${response.status}, ` +
            `retrying in ${Math.round(delayMs / 1000)}s`
          );
          await sleep(delayMs);
          continue;
        }
      }

      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if transient network error
      const isTransient = lastError.message.includes('fetch') ||
                         lastError.message.includes('network') ||
                         lastError.message.includes('ECONNRESET');

      if (isTransient && attempt < config.maxRetries) {
        const delayMs = getBackoffDelay(attempt);
        console.warn(
          `[Retry] Network error, ` +
          `retrying in ${Math.round(delayMs / 1000)}s: ${lastError.message}`
        );
        await sleep(delayMs);
        continue;
      }

      // Non-transient or exhausted retries
      break;
    }
  }

  throw lastError || new Error('Request failed');
}

// Usage
try {
  const response = await fetchWithRetry('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Generate code...',
      model: 'anthropic/claude-3-haiku'
    })
  });

  const data = await response.json();
  console.log('Success:', data);
} catch (error) {
  console.error('Failed after retries:', error);
}
```

### Retry with Circuit Breaker

Prevent cascade failures with circuit breaker pattern:

```typescript
class CircuitBreaker {
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private failureThreshold: number = 5,
    private resetTimeout: number = 60000 // 1 minute
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      const timeSinceFailure = Date.now() - this.lastFailureTime;

      if (timeSinceFailure < this.resetTimeout) {
        throw new Error('Circuit breaker is OPEN - too many failures');
      }

      // Try half-open
      this.state = 'half-open';
    }

    try {
      const result = await fn();

      // Success - reset
      this.failures = 0;
      this.state = 'closed';

      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();

      if (this.failures >= this.failureThreshold) {
        this.state = 'open';
        console.error(
          `Circuit breaker OPEN after ${this.failures} failures`
        );
      }

      throw error;
    }
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailure: new Date(this.lastFailureTime)
    };
  }

  reset() {
    this.failures = 0;
    this.state = 'closed';
  }
}

// Usage
const breaker = new CircuitBreaker(5, 60000);

async function makeAIRequest(message: string) {
  return breaker.execute(async () => {
    const response = await fetchWithRetry('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ message, model: 'anthropic/claude-3-haiku' })
    });
    return response.json();
  });
}
```

## 🚨 Handling 429 Errors

### Understanding 429 Responses

HTTP 429 "Too Many Requests" indicates you've hit a rate limit:

```typescript
// 429 response structure
{
  "error": {
    "message": "Rate limit exceeded",
    "type": "rate_limit_error",
    "code": "rate_limit_exceeded"
  }
}

// Response headers
Headers: {
  "retry-after": "60",              // Seconds to wait
  "x-ratelimit-limit": "200",       // Total limit
  "x-ratelimit-remaining": "0",     // Remaining requests
  "x-ratelimit-reset": "1234567890" // Unix timestamp
}
```

### Graceful 429 Handling

```typescript
async function handleRateLimitError(
  response: Response,
  attempt: number,
  maxRetries: number
): Promise<number> {
  if (attempt >= maxRetries) {
    throw new Error(
      `Rate limit exceeded after ${maxRetries} retry attempts. ` +
      `Please reduce request frequency or upgrade your plan.`
    );
  }

  // Get retry-after from header (seconds)
  const retryAfterHeader = response.headers.get('retry-after');
  const resetHeader = response.headers.get('x-ratelimit-reset');

  let waitSeconds: number;

  if (retryAfterHeader) {
    // Use retry-after if provided
    waitSeconds = parseInt(retryAfterHeader, 10);
  } else if (resetHeader) {
    // Calculate from reset timestamp
    const resetTime = parseInt(resetHeader, 10) * 1000;
    const now = Date.now();
    waitSeconds = Math.ceil((resetTime - now) / 1000);
  } else {
    // Default exponential backoff
    waitSeconds = Math.pow(2, attempt);
  }

  // Cap at 5 minutes
  waitSeconds = Math.min(waitSeconds, 300);

  console.warn(
    `Rate limit hit (429). Waiting ${waitSeconds}s before retry ` +
    `(attempt ${attempt + 1}/${maxRetries})`
  );

  return waitSeconds * 1000; // Return milliseconds
}

// Usage in request function
async function makeRequestWith429Handling(message: string) {
  const maxRetries = 3;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ message, model: 'anthropic/claude-3-haiku' })
    });

    if (response.status === 429) {
      const waitMs = await handleRateLimitError(
        response,
        attempt,
        maxRetries
      );
      await sleep(waitMs);
      continue;
    }

    if (response.ok) {
      return response.json();
    }

    throw new Error(`Request failed: ${response.status}`);
  }
}
```

### User-Friendly Rate Limit UI

```typescript
class RateLimitNotifier {
  showRateLimitNotification(retryAfterSeconds: number) {
    const minutes = Math.ceil(retryAfterSeconds / 60);

    // Show user notification
    const message = retryAfterSeconds < 60
      ? `Rate limit reached. Retrying in ${retryAfterSeconds} seconds...`
      : `Rate limit reached. Retrying in ${minutes} minute${minutes > 1 ? 's' : ''}...`;

    console.log(message);

    // Update UI (pseudo-code)
    // showToast({
    //   type: 'warning',
    //   title: 'Rate Limit Reached',
    //   message,
    //   duration: retryAfterSeconds * 1000
    // });
  }

  showRateLimitProgress(current: number, total: number) {
    const percentage = Math.round((current / total) * 100);

    console.log(`Rate limit: ${current}/${total} requests used (${percentage}%)`);

    // Update UI progress bar
    // updateProgressBar({ value: percentage, max: 100 });
  }
}
```

## 💰 Cost Optimization Strategies

### 1. Model Selection Based on Task Complexity

Choose the right model for the task to minimize costs:

```typescript
interface TaskRequirements {
  complexity: 'simple' | 'medium' | 'complex';
  requiresReasoning: boolean;
  expectedOutputLength: 'short' | 'medium' | 'long';
}

function selectCostOptimalModel(requirements: TaskRequirements): string {
  // Simple tasks - use cheapest models
  if (requirements.complexity === 'simple' && !requirements.requiresReasoning) {
    return 'anthropic/claude-3-haiku'; // $0.25/1M input tokens
  }

  // Medium complexity - balance cost and quality
  if (requirements.complexity === 'medium') {
    return 'anthropic/claude-3.5-sonnet'; // $3.00/1M input tokens
  }

  // Complex tasks - use best model
  return 'anthropic/claude-3-opus'; // $15.00/1M input tokens
}

// Usage
const model = selectCostOptimalModel({
  complexity: 'simple',
  requiresReasoning: false,
  expectedOutputLength: 'short'
});

console.log(`Selected cost-optimal model: ${model}`);
```

### 2. Token Usage Optimization

Minimize token usage to reduce costs:

```typescript
class TokenOptimizer {
  // Truncate context to fit budget
  optimizeContext(
    messages: Array<{ role: string; content: string }>,
    maxTokens: number
  ): Array<{ role: string; content: string }> {
    // Rough estimate: 4 characters ≈ 1 token
    const estimateTokens = (text: string) => Math.ceil(text.length / 4);

    let totalTokens = 0;
    const optimized: Array<{ role: string; content: string }> = [];

    // Always keep system message and last user message
    const systemMsg = messages.find(m => m.role === 'system');
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');

    if (systemMsg) {
      totalTokens += estimateTokens(systemMsg.content);
      optimized.push(systemMsg);
    }

    // Add recent messages until we hit the limit
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];

      if (msg.role === 'system') continue;
      if (msg === lastUserMsg && optimized.some(m => m === lastUserMsg)) continue;

      const msgTokens = estimateTokens(msg.content);

      if (totalTokens + msgTokens > maxTokens) {
        break;
      }

      totalTokens += msgTokens;
      optimized.unshift(msg);
    }

    console.log(`Optimized context: ${totalTokens} tokens (max: ${maxTokens})`);
    return optimized;
  }

  // Compress repeated information
  compressContext(text: string): string {
    // Remove excessive whitespace
    let compressed = text.replace(/\s+/g, ' ').trim();

    // Remove code comments for non-code tasks
    compressed = compressed.replace(/\/\/.*$/gm, '');
    compressed = compressed.replace(/\/\*[\s\S]*?\*\//g, '');

    // Truncate long strings
    compressed = compressed.replace(
      /"([^"]{100,})"/g,
      (_, str) => `"${str.substring(0, 100)}..."`
    );

    return compressed;
  }

  // Estimate cost before making request
  estimateCost(
    inputTokens: number,
    outputTokens: number,
    modelPricing: { inputCostPer1M: number; outputCostPer1M: number }
  ): number {
    const inputCost = (inputTokens / 1_000_000) * modelPricing.inputCostPer1M;
    const outputCost = (outputTokens / 1_000_000) * modelPricing.outputCostPer1M;

    return inputCost + outputCost;
  }
}

// Usage
const optimizer = new TokenOptimizer();

const messages = [
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user', content: 'Hello' },
  { role: 'assistant', content: 'Hi there!' },
  { role: 'user', content: 'What is React?' }
];

const optimized = optimizer.optimizeContext(messages, 1000);

const cost = optimizer.estimateCost(1000, 500, {
  inputCostPer1M: 3.0,
  outputCostPer1M: 15.0
});

console.log(`Estimated cost: $${cost.toFixed(4)}`);
```

### 3. Request Deduplication

Avoid duplicate requests:

```typescript
class RequestDeduplicator {
  private pending = new Map<string, Promise<any>>();

  async deduplicate<T>(
    key: string,
    fn: () => Promise<T>
  ): Promise<T> {
    // Check if request is already pending
    if (this.pending.has(key)) {
      console.log(`Deduplicating request: ${key}`);
      return this.pending.get(key)!;
    }

    // Execute and cache promise
    const promise = fn();
    this.pending.set(key, promise);

    try {
      const result = await promise;
      return result;
    } finally {
      // Clean up after completion
      this.pending.delete(key);
    }
  }

  clear() {
    this.pending.clear();
  }
}

// Usage
const deduplicator = new RequestDeduplicator();

async function makeAIRequest(message: string, model: string) {
  const cacheKey = `${model}:${message}`;

  return deduplicator.deduplicate(cacheKey, async () => {
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ message, model })
    });
    return response.json();
  });
}

// Multiple identical requests - only one API call made
const [result1, result2, result3] = await Promise.all([
  makeAIRequest('Hello', 'anthropic/claude-3-haiku'),
  makeAIRequest('Hello', 'anthropic/claude-3-haiku'),
  makeAIRequest('Hello', 'anthropic/claude-3-haiku')
]);
```

### 4. Budget Enforcement

Enforce spending limits:

```typescript
class BudgetEnforcer {
  private dailySpend: number = 0;
  private monthlySpend: number = 0;
  private lastReset: Date = new Date();

  constructor(
    private dailyLimit: number,
    private monthlyLimit: number
  ) {}

  async checkBudget(estimatedCost: number): Promise<void> {
    this.resetIfNeeded();

    if (this.dailySpend + estimatedCost > this.dailyLimit) {
      throw new Error(
        `Daily budget exceeded: $${this.dailySpend.toFixed(2)}/$${this.dailyLimit} ` +
        `(estimated cost: $${estimatedCost.toFixed(4)})`
      );
    }

    if (this.monthlySpend + estimatedCost > this.monthlyLimit) {
      throw new Error(
        `Monthly budget exceeded: $${this.monthlySpend.toFixed(2)}/$${this.monthlyLimit}`
      );
    }
  }

  recordSpend(actualCost: number) {
    this.dailySpend += actualCost;
    this.monthlySpend += actualCost;

    console.log(
      `Budget status: Daily $${this.dailySpend.toFixed(2)}/$${this.dailyLimit}, ` +
      `Monthly $${this.monthlySpend.toFixed(2)}/$${this.monthlyLimit}`
    );
  }

  private resetIfNeeded() {
    const now = new Date();

    // Reset daily if new day
    if (now.getDate() !== this.lastReset.getDate()) {
      this.dailySpend = 0;
    }

    // Reset monthly if new month
    if (now.getMonth() !== this.lastReset.getMonth()) {
      this.monthlySpend = 0;
    }

    this.lastReset = now;
  }

  getStatus() {
    return {
      daily: {
        spent: this.dailySpend,
        limit: this.dailyLimit,
        remaining: this.dailyLimit - this.dailySpend,
        percentage: (this.dailySpend / this.dailyLimit) * 100
      },
      monthly: {
        spent: this.monthlySpend,
        limit: this.monthlyLimit,
        remaining: this.monthlyLimit - this.monthlySpend,
        percentage: (this.monthlySpend / this.monthlyLimit) * 100
      }
    };
  }
}

// Usage
const budget = new BudgetEnforcer(10.0, 200.0); // $10/day, $200/month

async function makeRequestWithBudget(message: string) {
  const estimatedCost = 0.005; // Estimate based on token count

  // Check budget before request
  await budget.checkBudget(estimatedCost);

  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    body: JSON.stringify({ message, model: 'anthropic/claude-3-haiku' })
  });

  const data = await response.json();

  // Record actual cost
  const actualCost = data.usage
    ? (data.usage.input_tokens / 1_000_000) * 0.25 +
      (data.usage.output_tokens / 1_000_000) * 1.25
    : estimatedCost;

  budget.recordSpend(actualCost);

  return data;
}
```

## 🗄️ Response Caching

### Caching for Low-Temperature Requests

Cache deterministic responses (temperature = 0):

```typescript
interface CacheEntry {
  response: any;
  timestamp: number;
  hits: number;
}

class ResponseCache {
  private cache = new Map<string, CacheEntry>();
  private ttl: number;

  constructor(ttlMinutes: number = 60) {
    this.ttl = ttlMinutes * 60 * 1000;
  }

  getCacheKey(
    message: string,
    model: string,
    temperature: number
  ): string {
    // Only cache deterministic responses (temp = 0)
    if (temperature > 0) {
      return '';
    }

    return `${model}:${temperature}:${message}`;
  }

  get(key: string): any | null {
    if (!key) return null;

    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    // Update hit counter
    entry.hits++;

    console.log(`Cache HIT: ${key.substring(0, 50)}... (${entry.hits} hits)`);
    return entry.response;
  }

  set(key: string, response: any): void {
    if (!key) return;

    this.cache.set(key, {
      response,
      timestamp: Date.now(),
      hits: 0
    });

    console.log(`Cache SET: ${key.substring(0, 50)}...`);
  }

  clear() {
    console.log(`Cleared ${this.cache.size} cache entries`);
    this.cache.clear();
  }

  getStats() {
    const entries = Array.from(this.cache.values());
    const totalHits = entries.reduce((sum, e) => sum + e.hits, 0);

    return {
      size: this.cache.size,
      totalHits,
      hitRate: entries.length > 0 ? totalHits / entries.length : 0,
      oldestEntry: Math.min(...entries.map(e => e.timestamp)),
      newestEntry: Math.max(...entries.map(e => e.timestamp))
    };
  }
}

// Usage
const cache = new ResponseCache(60); // 60 minute TTL

async function makeRequestWithCache(
  message: string,
  model: string,
  temperature: number = 0
) {
  const cacheKey = cache.getCacheKey(message, model, temperature);

  // Try cache first
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Make request
  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    body: JSON.stringify({ message, model, temperature })
  });

  const data = await response.json();

  // Cache if deterministic
  cache.set(cacheKey, data);

  return data;
}

// Example: Repeated deterministic requests hit cache
const result1 = await makeRequestWithCache(
  'What is 2+2?',
  'anthropic/claude-3-haiku',
  0 // temperature = 0 (deterministic)
);

const result2 = await makeRequestWithCache(
  'What is 2+2?',
  'anthropic/claude-3-haiku',
  0 // Cached! No API call made
);

console.log(cache.getStats());
```

### Redis-Based Caching

For production, use Redis/Valkey:

```typescript
import { Redis } from '@upstash/redis';

class RedisCacheService {
  private redis: Redis;
  private ttl: number;

  constructor(ttlSeconds: number = 3600) {
    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!
    });
    this.ttl = ttlSeconds;
  }

  private getCacheKey(message: string, model: string, temperature: number): string {
    if (temperature > 0) return '';

    const hash = this.hashString(message);
    return `ai:cache:${model}:${temperature}:${hash}`;
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  async get(message: string, model: string, temperature: number): Promise<any | null> {
    const key = this.getCacheKey(message, model, temperature);
    if (!key) return null;

    try {
      const cached = await this.redis.get(key);

      if (cached) {
        console.log(`Redis cache HIT: ${key}`);
        // Increment hit counter
        await this.redis.incr(`${key}:hits`);
      }

      return cached;
    } catch (error) {
      console.error('Redis cache get error:', error);
      return null;
    }
  }

  async set(message: string, model: string, temperature: number, response: any): Promise<void> {
    const key = this.getCacheKey(message, model, temperature);
    if (!key) return;

    try {
      await this.redis.setex(key, this.ttl, JSON.stringify(response));
      console.log(`Redis cache SET: ${key} (TTL: ${this.ttl}s)`);
    } catch (error) {
      console.error('Redis cache set error:', error);
    }
  }

  async clear(pattern: string = 'ai:cache:*'): Promise<number> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length === 0) return 0;

      await this.redis.del(...keys);
      console.log(`Cleared ${keys.length} cache entries`);
      return keys.length;
    } catch (error) {
      console.error('Redis cache clear error:', error);
      return 0;
    }
  }

  async getStats(): Promise<any> {
    try {
      const keys = await this.redis.keys('ai:cache:*');
      const hitKeys = await this.redis.keys('ai:cache:*:hits');

      let totalHits = 0;
      for (const key of hitKeys) {
        const hits = await this.redis.get(key);
        totalHits += Number(hits) || 0;
      }

      return {
        totalEntries: keys.length,
        totalHits,
        averageHitsPerEntry: keys.length > 0 ? totalHits / keys.length : 0
      };
    } catch (error) {
      console.error('Redis stats error:', error);
      return null;
    }
  }
}
```

## 📦 Request Batching

Batch multiple requests to reduce overhead:

```typescript
class RequestBatcher<T> {
  private queue: Array<{
    request: any;
    resolve: (value: T) => void;
    reject: (error: any) => void;
  }> = [];
  private batchSize: number;
  private batchDelay: number;
  private timer: NodeJS.Timeout | null = null;

  constructor(batchSize: number = 10, batchDelayMs: number = 100) {
    this.batchSize = batchSize;
    this.batchDelay = batchDelayMs;
  }

  async add(request: any): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ request, resolve, reject });

      // Process immediately if batch is full
      if (this.queue.length >= this.batchSize) {
        this.processBatch();
      } else if (!this.timer) {
        // Otherwise wait for more requests
        this.timer = setTimeout(() => this.processBatch(), this.batchDelay);
      }
    });
  }

  private async processBatch() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    const batch = this.queue.splice(0, this.batchSize);
    if (batch.length === 0) return;

    console.log(`Processing batch of ${batch.length} requests`);

    try {
      // Send batch request
      const response = await fetch('/api/ai/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: batch.map(b => b.request)
        })
      });

      const results = await response.json();

      // Resolve individual promises
      batch.forEach((item, index) => {
        const result = results.responses[index];
        if (result.error) {
          item.reject(new Error(result.error));
        } else {
          item.resolve(result.data);
        }
      });
    } catch (error) {
      // Reject all on batch failure
      batch.forEach(item => item.reject(error));
    }
  }

  async flush(): Promise<void> {
    if (this.queue.length > 0) {
      await this.processBatch();
    }
  }
}

// Usage
const batcher = new RequestBatcher(10, 100); // Batch up to 10, wait 100ms

// Queue multiple requests
const promises = [
  batcher.add({ message: 'Request 1', model: 'anthropic/claude-3-haiku' }),
  batcher.add({ message: 'Request 2', model: 'anthropic/claude-3-haiku' }),
  batcher.add({ message: 'Request 3', model: 'anthropic/claude-3-haiku' }),
  // ... more requests
];

// All batched into single API call
const results = await Promise.all(promises);
```

## 🎯 Model Selection for Cost Savings

### Automatic Model Downgrade

Use cheaper models when appropriate:

```typescript
class CostAwareModelSelector {
  private modelPricing = {
    'anthropic/claude-3-opus': { input: 15.0, output: 75.0 },
    'anthropic/claude-3.5-sonnet': { input: 3.0, output: 15.0 },
    'anthropic/claude-3-haiku': { input: 0.25, output: 1.25 }
  };

  selectModel(
    message: string,
    preferredModel: string,
    budgetPerRequest: number
  ): string {
    // Estimate token count (rough: 4 chars = 1 token)
    const estimatedInputTokens = Math.ceil(message.length / 4);
    const estimatedOutputTokens = 500; // Assume 500 token response

    // Calculate cost for preferred model
    const pricing = this.modelPricing[preferredModel];
    const estimatedCost =
      (estimatedInputTokens / 1_000_000) * pricing.input +
      (estimatedOutputTokens / 1_000_000) * pricing.output;

    // If within budget, use preferred model
    if (estimatedCost <= budgetPerRequest) {
      console.log(`Using preferred model: ${preferredModel} ($${estimatedCost.toFixed(4)})`);
      return preferredModel;
    }

    // Find cheaper alternative
    const alternatives = Object.entries(this.modelPricing)
      .map(([model, price]) => ({
        model,
        cost: (estimatedInputTokens / 1_000_000) * price.input +
              (estimatedOutputTokens / 1_000_000) * price.output
      }))
      .filter(alt => alt.cost <= budgetPerRequest)
      .sort((a, b) => b.cost - a.cost); // Prefer most expensive within budget

    if (alternatives.length > 0) {
      const selected = alternatives[0];
      console.log(
        `Budget exceeded, downgrading to ${selected.model} ` +
        `($${selected.cost.toFixed(4)} vs $${estimatedCost.toFixed(4)})`
      );
      return selected.model;
    }

    throw new Error(
      `No model available within budget $${budgetPerRequest} ` +
      `(estimated cost: $${estimatedCost.toFixed(4)})`
    );
  }
}

// Usage
const selector = new CostAwareModelSelector();

const model = selector.selectModel(
  'Short simple question',
  'anthropic/claude-3-opus', // Preferred
  0.001 // Budget: $0.001 per request
);
// Output: "Budget exceeded, downgrading to anthropic/claude-3-haiku"
```

## 📊 Monitoring and Analytics

### Cost Tracking Dashboard

```typescript
interface UsageMetrics {
  timestamp: Date;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  cached: boolean;
}

class CostAnalytics {
  private metrics: UsageMetrics[] = [];

  track(metric: UsageMetrics) {
    this.metrics.push(metric);
  }

  getDailyCost(date: Date = new Date()): number {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return this.metrics
      .filter(m => m.timestamp >= startOfDay && m.timestamp <= endOfDay)
      .reduce((sum, m) => sum + m.cost, 0);
  }

  getMonthlyCost(year: number, month: number): number {
    return this.metrics
      .filter(m =>
        m.timestamp.getFullYear() === year &&
        m.timestamp.getMonth() === month
      )
      .reduce((sum, m) => sum + m.cost, 0);
  }

  getCostByModel(): Record<string, number> {
    const byModel: Record<string, number> = {};

    this.metrics.forEach(m => {
      byModel[m.model] = (byModel[m.model] || 0) + m.cost;
    });

    return byModel;
  }

  getCacheHitRate(): number {
    if (this.metrics.length === 0) return 0;

    const cacheHits = this.metrics.filter(m => m.cached).length;
    return (cacheHits / this.metrics.length) * 100;
  }

  getSavingsFromCache(): number {
    return this.metrics
      .filter(m => m.cached)
      .reduce((sum, m) => sum + m.cost, 0);
  }

  generateReport(): string {
    const dailyCost = this.getDailyCost();
    const cacheHitRate = this.getCacheHitRate();
    const cacheSavings = this.getSavingsFromCache();
    const byModel = this.getCostByModel();

    return `
📊 Cost Analytics Report

Daily Cost: $${dailyCost.toFixed(2)}
Cache Hit Rate: ${cacheHitRate.toFixed(1)}%
Cache Savings: $${cacheSavings.toFixed(2)}

Cost by Model:
${Object.entries(byModel)
  .sort((a, b) => b[1] - a[1])
  .map(([model, cost]) => `  ${model}: $${cost.toFixed(2)}`)
  .join('\n')}

Total Requests: ${this.metrics.length}
Cached Requests: ${this.metrics.filter(m => m.cached).length}
    `.trim();
  }
}

// Usage
const analytics = new CostAnalytics();

// Track each request
analytics.track({
  timestamp: new Date(),
  model: 'anthropic/claude-3-haiku',
  inputTokens: 1000,
  outputTokens: 500,
  cost: 0.00088,
  cached: false
});

// Generate report
console.log(analytics.generateReport());
```

## ✅ Best Practices

### 1. Always Implement Retry Logic

```typescript
// ✅ Good: Retry with exponential backoff
async function reliableRequest(message: string) {
  return fetchWithRetry('/api/ai/chat', {
    method: 'POST',
    body: JSON.stringify({ message, model: 'anthropic/claude-3-haiku' })
  });
}

// ❌ Bad: No retry handling
async function unreliableRequest(message: string) {
  return fetch('/api/ai/chat', {
    method: 'POST',
    body: JSON.stringify({ message, model: 'anthropic/claude-3-haiku' })
  });
}
```

### 2. Cache Deterministic Responses

```typescript
// ✅ Good: Cache temperature=0 responses
const result = await makeRequestWithCache(
  'What is React?',
  'anthropic/claude-3-haiku',
  0 // Deterministic
);

// ❌ Bad: Not caching deterministic responses
const result = await fetch('/api/ai/chat', {
  method: 'POST',
  body: JSON.stringify({
    message: 'What is React?',
    model: 'anthropic/claude-3-haiku',
    temperature: 0
  })
});
```

### 3. Set Budget Limits

```typescript
// ✅ Good: Enforce budget limits
const budget = new BudgetEnforcer(10.0, 200.0);
await budget.checkBudget(estimatedCost);

// ❌ Bad: No budget control
// Unlimited spending risk
```

### 4. Monitor Rate Limit Headers

```typescript
// ✅ Good: Track rate limits
const remaining = response.headers.get('x-ratelimit-remaining');
if (Number(remaining) < 10) {
  console.warn('Approaching rate limit');
}

// ❌ Bad: Ignoring rate limit headers
// Will hit 429 errors unexpectedly
```

### 5. Use Appropriate Models

```typescript
// ✅ Good: Match model to task
const model = selectCostOptimalModel({
  complexity: 'simple',
  requiresReasoning: false,
  expectedOutputLength: 'short'
});

// ❌ Bad: Always using expensive models
const model = 'anthropic/claude-3-opus'; // Overkill for simple tasks
```

## 🐛 Troubleshooting

### Rate Limit Errors Not Retrying

**Problem:** 429 errors not being retried automatically.

**Solution:**
```typescript
// Ensure retry logic is implemented
const response = await fetchWithRetry('/api/ai/chat', options);

// Check retry configuration
console.log('Max retries:', RETRY_CONFIG.maxRetries);
console.log('Base delay:', RETRY_CONFIG.baseDelayMs);
```

### Cache Not Working

**Problem:** Responses not being cached.

**Solution:**
```typescript
// Ensure temperature is 0 for caching
const temperature = 0; // Must be exactly 0

// Check cache key generation
const key = cache.getCacheKey(message, model, temperature);
console.log('Cache key:', key);

// Verify TTL not expired
const stats = cache.getStats();
console.log('Cache stats:', stats);
```

### High Costs Despite Optimization

**Problem:** Costs higher than expected.

**Solution:**
```typescript
// Audit token usage
const analytics = new CostAnalytics();
console.log(analytics.generateReport());

// Check model selection
console.log('Models used:', analytics.getCostByModel());

// Verify cache hit rate
console.log('Cache hit rate:', analytics.getCacheHitRate());

// Consider switching to cheaper models
const model = selector.selectModel(message, preferredModel, 0.001);
```

### Exponential Backoff Too Aggressive

**Problem:** Retry delays too long.

**Solution:**
```typescript
// Adjust retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 500,    // Reduce from 1000ms
  maxDelayMs: 10000,   // Reduce from 30000ms
};

// Or implement custom backoff
function getCustomBackoff(attempt: number): number {
  return Math.min(500 * Math.pow(1.5, attempt), 5000);
}
```

## 📚 Related Documentation

- [AI Model Selection Guide](./ai-model-selection.md) - Model comparison and selection
- [API Documentation](../api/README.md) - Complete API reference
- [Security Guide](../security/implementation.md) - Security best practices
- [Rate Limiting](../security/rate-limiting.md) - Application-level rate limiting

---

**Last Updated**: 2026-02-28
**Maintained By**: Documentation Team
