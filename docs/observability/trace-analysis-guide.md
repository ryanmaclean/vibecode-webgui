# Trace Analysis Guide

Comprehensive guide to analyzing distributed traces in VibeCode for performance optimization, debugging, and system understanding.

## Table of Contents

1. [Overview](#overview)
2. [Accessing Traces](#accessing-traces)
3. [Understanding Trace Structure](#understanding-trace-structure)
4. [Performance Analysis](#performance-analysis)
5. [Debugging with Traces](#debugging-with-traces)
6. [AI Request Analysis](#ai-request-analysis)
7. [Database Query Optimization](#database-query-optimization)
8. [Cross-Service Tracing](#cross-service-tracing)
9. [Common Patterns and Anti-Patterns](#common-patterns-and-anti-patterns)
10. [Example Scenarios](#example-scenarios)

---

## Overview

Distributed tracing provides end-to-end visibility into request flows across VibeCode's full stack:

**What You Can See:**
- Complete request lifecycle from browser to backend to database
- AI operation latency and token usage
- Database query performance and N+1 patterns
- Service dependencies and call graphs
- Error propagation across services
- Cache hit/miss rates and performance

**Key Metrics:**
- **Latency**: Time spent in each component
- **Throughput**: Request rate and concurrency
- **Error Rate**: Failed requests and exceptions
- **Resource Utilization**: Token usage, query counts, cache efficiency

---

## Accessing Traces

### Trace Visualization Dashboard

Navigate to: `http://localhost:3000/monitoring/traces`

**Dashboard Features:**
- **Real-time trace list**: Most recent traces with status and duration
- **Service map**: Visualize service dependencies
- **Trace timeline**: Waterfall view of spans
- **Filtering**: By service, status, operation, time range
- **Search**: Find specific trace IDs or operations

### API Endpoints

**Get Traces:**
```bash
curl http://localhost:3000/api/monitoring/traces | jq '.'
```

**Filter by Service:**
```bash
curl 'http://localhost:3000/api/monitoring/traces?service=vibecode-webgui' | jq '.traces'
```

**Export Traces (OTLP format):**
```bash
curl 'http://localhost:3000/api/monitoring/traces?format=otlp' > traces.json
```

### CLI Tools

**Using OTEL Collector logs:**
```bash
# View all traces in real-time
docker-compose logs -f otel-collector | grep -i trace

# Filter specific trace ID
docker-compose logs otel-collector | grep "trace-abc-123"
```

---

## Understanding Trace Structure

### Trace Anatomy

```
Trace
├── Root Span: GET /api/chat
│   ├── Child Span: ai.chat-completion
│   │   └── Child Span: http.post (to AI provider)
│   ├── Child Span: db.select
│   │   └── Child Span: postgresql.query
│   └── Child Span: cache.get
│       └── Child Span: redis.get
```

### Span Attributes

**Standard Attributes (OpenTelemetry Semantic Conventions):**
```json
{
  "http.method": "POST",
  "http.url": "/api/chat",
  "http.status_code": 200,
  "http.route": "/api/chat",
  "db.system": "postgresql",
  "db.operation": "SELECT",
  "db.statement": "SELECT * FROM users WHERE id = $1"
}
```

**Custom Attributes (VibeCode-specific):**
```json
{
  "vibecode.request.user_agent": "Mozilla/5.0...",
  "ai.provider": "openai",
  "ai.model": "gpt-4",
  "ai.usage.input_tokens": 150,
  "ai.usage.output_tokens": 450,
  "ai.usage.total_tokens": 600,
  "db.query_time_ms": 12.5
}
```

### Trace Context (W3C)

```
traceparent: 00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01
             │  │                                │                  │
             │  └─ Trace ID (32 hex chars)      │                  └─ Trace Flags (sampled)
             │                                   └─ Parent Span ID (16 hex chars)
             └─ Version (00)
```

**Extracting Trace Context:**
```bash
# From API response headers
curl -v http://localhost:3000/api/health 2>&1 | grep -i x-trace-id
# X-Trace-Id: 0af7651916cd43dd8448eb211c80319c
# X-Span-Id: b7ad6b7169203331
```

---

## Performance Analysis

### Identifying Bottlenecks

**1. Sort by Duration in Dashboard**

Look for traces with high latency and examine span waterfall:
```
Total: 2,450ms
├── HTTP Request Handling: 50ms
├── AI Chat Completion: 2,300ms ← BOTTLENECK
└── Database Save: 100ms
```

**Action**: Optimize AI request (use streaming, reduce context, cache)

**2. Compare Spans Across Traces**

```bash
# Get average AI latency
curl http://localhost:3000/api/monitoring/traces | \
  jq '[.traces[].spans[] | select(.name | startswith("ai.")) | .duration_ms] | add / length'
```

**3. Find Slow Database Queries**

```bash
# Get slowest database operations
curl http://localhost:3000/api/monitoring/traces | \
  jq '.traces[].spans[] | select(.name | startswith("db.")) | {name, duration: .duration_ms, query: .tags["db.statement"]}' | \
  jq -s 'sort_by(.duration) | reverse | .[0:10]'
```

### Latency Breakdown

**Target Latencies:**
- **API Gateway**: < 10ms
- **Database Queries**: < 50ms (simple), < 200ms (complex)
- **Cache Operations**: < 5ms
- **AI Requests**: 500ms - 5s (depends on model and tokens)
- **End-to-End**: < 3s (with AI), < 500ms (without AI)

**Warning Signs:**
- API overhead > 100ms → Check middleware, authentication
- Database queries > 500ms → Add indexes, optimize queries
- Cache operations > 50ms → Network issues or cache server overload
- AI latency > 10s → Model timeout or rate limiting

### Throughput Analysis

**Concurrent Request Handling:**
```bash
# Count concurrent traces in 1-second windows
curl http://localhost:3000/api/monitoring/traces | \
  jq '[.traces[] | .timestamp] | group_by(.[0:19]) | map(length) | max'
```

**Rate Limiting Detection:**

Look for spans with status `error` and tags containing "rate limit" or "429":
```bash
curl http://localhost:3000/api/monitoring/traces | \
  jq '.traces[].spans[] | select(.status == "error" and (.tags | tostring | contains("rate")))'
```

---

## Debugging with Traces

### Error Tracking

**Find Failed Requests:**
```bash
# Filter traces by error status
curl 'http://localhost:3000/api/monitoring/traces?status=error' | jq '.traces'
```

**Example Error Trace:**
```json
{
  "trace_id": "error-trace-123",
  "status": "error",
  "spans": [
    {
      "name": "POST /api/chat",
      "status": "error",
      "tags": {
        "error.type": "DatabaseError",
        "error.message": "Connection timeout",
        "error.stack": "..."
      }
    }
  ]
}
```

### Exception Propagation

Trace how errors propagate across services:

```
Browser (404 Not Found)
  ↓
Next.js API (Error handling)
  ↓
Database Query (Connection failed)
  ↓
PostgreSQL (Connection timeout)
```

**Analysis:**
1. **Root Span**: Shows user-facing error (404)
2. **Intermediate Spans**: Show error handling and retry logic
3. **Leaf Span**: Shows actual failure point (DB timeout)

### Correlation with Logs

**Extract Trace ID from logs:**
```bash
# Add trace ID to log context
import { getCurrentTraceContext } from '@/lib/monitoring/trace-context'

const { traceId } = getCurrentTraceContext()
logger.error('Database query failed', { traceId, query })
```

**Search logs by trace ID:**
```bash
docker-compose logs | grep "traceId=0af7651916cd43dd"
```

---

## AI Request Analysis

### AI Span Attributes

**Required Attributes:**
- `ai.operation.type`: chat-completion, embedding, completion
- `ai.provider`: openai, anthropic, azure-openai
- `ai.model`: gpt-4, gpt-3.5-turbo, claude-3

**Performance Attributes:**
- `ai.usage.input_tokens`: Prompt tokens
- `ai.usage.output_tokens`: Completion tokens
- `ai.usage.total_tokens`: Sum of input + output
- `ai.latency.ms`: Total request time
- `ai.latency.time_to_first_byte_ms`: Streaming TTFB

**Cost Tracking:**
```bash
# Calculate total token usage for billing
curl http://localhost:3000/api/monitoring/traces | \
  jq '[.traces[].spans[] | select(.tags["ai.usage.total_tokens"]) | .tags["ai.usage.total_tokens"] | tonumber] | add'
```

### Optimization Patterns

**1. High Token Usage**

```
ai.usage.input_tokens: 8,000 ← TOO HIGH
ai.usage.output_tokens: 2,000
ai.latency.ms: 12,000ms
```

**Actions:**
- Reduce context window
- Implement prompt caching
- Use RAG to focus context
- Consider smaller model (gpt-3.5-turbo)

**2. Slow AI Responses**

```
ai.latency.ms: 15,000ms
ai.latency.time_to_first_byte_ms: 3,000ms
```

**Actions:**
- Use streaming (`ai.request.stream: true`)
- Check provider rate limits
- Consider model fallback strategy

**3. AI Request Failures**

```
status: error
ai.error.type: "RateLimitError"
ai.error.message: "Rate limit exceeded"
```

**Actions:**
- Implement exponential backoff
- Add request queuing
- Use multiple API keys for load distribution

---

## Database Query Optimization

### Identifying N+1 Queries

**Trace Pattern:**
```
GET /api/users/123/posts
├── db.select (users)         ← 1 query
├── db.select (posts[0])      ← N queries
├── db.select (posts[1])
├── db.select (posts[2])
└── ... (repeated)
```

**Solution:**
```sql
-- Instead of N+1
SELECT * FROM users WHERE id = $1;
SELECT * FROM posts WHERE user_id = $1; -- repeated N times

-- Use JOIN or IN clause
SELECT u.*, p.* FROM users u
LEFT JOIN posts p ON p.user_id = u.id
WHERE u.id = $1;
```

### Query Performance

**Slow Query Detection:**
```bash
# Find queries > 100ms
curl http://localhost:3000/api/monitoring/traces | \
  jq '.traces[].spans[] | select(.name | startswith("db.") and .duration_ms > 100) | {query: .tags["db.statement"], duration: .duration_ms}'
```

**Example Analysis:**
```json
{
  "query": "SELECT * FROM documents WHERE embedding IS NOT NULL",
  "duration": 458.2,
  "db.table": "documents",
  "db.result_count": 10000
}
```

**Actions:**
1. Add index on `embedding` column
2. Add pagination (LIMIT/OFFSET)
3. Consider materialized view

### Cache Effectiveness

**Cache Hit Rate:**
```bash
# Calculate cache hit rate
curl http://localhost:3000/api/monitoring/traces | \
  jq '[.traces[].spans[] | select(.name | startswith("cache.")) | .tags["cache.hit"]] | group_by(.) | map({hit: .[0], count: length}) | map(select(.hit == "true").count / (.count) * 100)'
```

**Cache Miss Analysis:**
```
cache.get (miss) → 5ms
  ↓
db.select → 85ms
  ↓
cache.set → 3ms
Total: 93ms
```

**Optimization:**
- Increase cache TTL for stable data
- Pre-warm cache during deployment
- Implement cache-aside pattern

---

## Cross-Service Tracing

### W3C Trace Context Propagation

**Verify Context Propagation:**
```bash
# Send request with traceparent header
curl -H "traceparent: 00-test-trace-123456789abcdef0-0000000000000001-01" \
     http://localhost:3000/api/health | \
     jq '.trace_context'
```

**Expected Output:**
```json
{
  "trace_id": "test-trace-123456789abcdef0",
  "span_id": "...",
  "trace_flags": "01"
}
```

### Service Dependency Map

**Visualize Dependencies:**

Navigate to: `http://localhost:3000/monitoring/traces`

**Service Map Shows:**
```
Browser → Next.js API → AgentAPI (Python)
             ↓              ↓
          PostgreSQL     Redis
```

**Metrics per Edge:**
- Call count
- Average latency
- Error rate

### End-to-End Trace Example

**Request Flow:**
```
1. Browser: user.click                          (0ms)
   └─ traceparent: 00-abc-001-01

2. Next.js API: POST /api/chat                  (+50ms)
   ├─ Extract: traceparent header
   ├─ Create span with parent: trace=abc, span=001
   └─ Propagate to downstream

3. AgentAPI: POST /agent/process                (+100ms)
   ├─ Extract: traceparent from request
   └─ Same trace ID: abc

4. Database: SELECT FROM conversations          (+150ms)
   └─ Same trace ID: abc

5. AI Provider: POST /v1/chat/completions       (+2000ms)
   └─ Same trace ID: abc (if provider supports OTEL)

Total: 2,300ms with trace correlation
```

---

## Common Patterns and Anti-Patterns

### ✅ Good Patterns

**1. Early Context Extraction**
```typescript
// Extract trace context at API boundary
const { traceContext } = extractAndInjectTraceContext(request.headers)

// Use throughout request lifecycle
await createAISpan('chat', { trace_id: traceContext.trace_id }, ...)
```

**2. Comprehensive Span Attributes**
```typescript
span.setAttributes({
  [AISpanAttributes.AI_PROVIDER]: 'openai',
  [AISpanAttributes.AI_MODEL]: model,
  [AISpanAttributes.AI_INPUT_TOKENS]: usage.prompt_tokens,
  [AISpanAttributes.AI_OUTPUT_TOKENS]: usage.completion_tokens,
  'custom.user_id': userId,
  'custom.feature_flag': featureEnabled,
})
```

**3. Error Recording**
```typescript
try {
  // Operation
} catch (error) {
  span.recordException(error)
  span.setStatus({ code: SpanStatusCode.ERROR, message: error.message })
  throw error
}
```

### ❌ Anti-Patterns

**1. Missing Span End**
```typescript
// BAD: Span never ends
const span = tracer.startSpan('operation')
await doWork()
// Missing: span.end()
```

**2. Overly Verbose Spans**
```typescript
// BAD: Too granular
tracer.startSpan('parse-json-line-1')
tracer.startSpan('parse-json-line-2')
// Better: Single span for entire parsing
```

**3. Sensitive Data in Spans**
```typescript
// BAD: Exposes PII
span.setAttribute('user.email', 'user@example.com')
span.setAttribute('user.password', password)

// GOOD: Use IDs only
span.setAttribute('user.id', userId)
```

**4. Ignoring Trace Context**
```typescript
// BAD: Creates new trace instead of continuing
const newSpan = tracer.startSpan('operation')

// GOOD: Continue existing trace
const newSpan = tracer.startActiveSpan('operation', (span) => {
  // Automatically inherits parent context
})
```

---

## Example Scenarios

### Scenario 1: Slow AI Chat Response

**Symptom:**
Users report chat responses taking > 10 seconds

**Investigation:**
```bash
# Find slow chat traces
curl http://localhost:3000/api/monitoring/traces | \
  jq '.traces[] | select(.operation == "POST /api/chat" and .duration_ms > 10000)'
```

**Trace Analysis:**
```
POST /api/chat: 12,450ms
├── Authentication: 50ms
├── Rate Limiting: 10ms
├── Load Context (db.select): 380ms      ← High
├── AI Chat Completion: 11,800ms          ← Very High
│   ├── ai.usage.input_tokens: 12,000    ← Problem!
│   └── ai.usage.output_tokens: 1,500
└── Save Response (db.insert): 210ms
```

**Root Cause:**
Input tokens = 12,000 (very large context)

**Solution:**
1. Implement context pruning (max 4,000 tokens)
2. Use RAG for focused retrieval
3. Add streaming for faster TTFB
4. Consider caching AI responses

### Scenario 2: Database Query Timeout

**Symptom:**
Intermittent 500 errors on `/api/documents`

**Investigation:**
```bash
# Find error traces
curl 'http://localhost:3000/api/monitoring/traces?status=error&operation=/api/documents'
```

**Trace Analysis:**
```
GET /api/documents: 30,050ms (ERROR)
└── db.select: 30,000ms (TIMEOUT)
    ├── db.statement: "SELECT * FROM documents WHERE..."
    ├── db.result_count: 0 (query timed out)
    └── error.message: "Query timeout exceeded"
```

**Root Cause:**
Missing index on `WHERE` clause column

**Solution:**
```sql
-- Add index
CREATE INDEX idx_documents_status ON documents(status);

-- Verify performance
EXPLAIN ANALYZE SELECT * FROM documents WHERE status = 'active';
```

**Verification:**
```bash
# Check query time after fix
curl http://localhost:3000/api/monitoring/traces | \
  jq '.traces[] | select(.operation == "GET /api/documents") | .duration_ms'
# Before: 30,000ms
# After: 85ms ✓
```

### Scenario 3: Cache Miss Storm

**Symptom:**
Sudden spike in database load after deployment

**Investigation:**
```bash
# Check cache hit rate
curl http://localhost:3000/api/monitoring/traces | \
  jq '[.traces[].spans[] | select(.name | startswith("cache.get"))] | group_by(.tags["cache.hit"]) | map({hit: .[0].tags["cache.hit"], count: length})'
```

**Result:**
```json
[
  {"hit": "false", "count": 1250},
  {"hit": "true", "count": 50}
]
```

**Hit rate:** 50 / 1300 = 3.8% ← Problem!

**Root Cause:**
Cache was cleared during deployment

**Solution:**
1. Implement cache warming on startup
2. Use staged deployment (blue/green)
3. Set `stale-while-revalidate` cache strategy

---

## Next Steps

- **[OpenTelemetry Setup Guide](./opentelemetry-setup.md)**: Configure tracing infrastructure
- **[Monitoring Best Practices](../MONITORING_BEST_PRACTICES.md)**: General observability patterns
- **[Performance Optimization](../performance/optimization-guide.md)**: System-wide performance tuning

---

## Tools and Resources

### Recommended Tools

- **Jaeger UI**: Trace visualization and analysis
- **Grafana Tempo**: Long-term trace storage
- **Datadog APM**: Full observability platform
- **Lightstep**: Advanced trace analysis

### Learning Resources

- [OpenTelemetry Best Practices](https://opentelemetry.io/docs/concepts/best-practices/)
- [Distributed Tracing Patterns](https://www.oreilly.com/library/view/distributed-tracing-in/9781492056621/)
- [W3C Trace Context](https://www.w3.org/TR/trace-context/)
- [Google Dapper Paper](https://research.google/pubs/pub36356/) (foundational research)
