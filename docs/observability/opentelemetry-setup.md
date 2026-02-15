# OpenTelemetry Setup Guide

Complete guide to setting up distributed tracing with OpenTelemetry in VibeCode.

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Environment Configuration](#environment-configuration)
4. [Backend Instrumentation](#backend-instrumentation)
5. [Frontend Instrumentation](#frontend-instrumentation)
6. [Database Tracing](#database-tracing)
7. [Container Deployment](#container-deployment)
8. [OTLP Collector Setup](#otlp-collector-setup)
9. [Exporter Configuration](#exporter-configuration)
10. [Troubleshooting](#troubleshooting)

---

## Overview

VibeCode implements full-stack distributed tracing using OpenTelemetry (OTEL), providing visibility into:

- **AI Request Flows**: Track AI operations from frontend through to completion
- **Database Queries**: Monitor PostgreSQL, Redis, and cache operations
- **API Performance**: Measure latency and identify bottlenecks
- **Cross-Service Tracing**: Correlate requests across services using W3C Trace Context
- **Container Workloads**: Integrate Docker container metrics and traces

### Architecture

```
Browser → Next.js API → AgentAPI (Python) → Database
   ↓           ↓              ↓                ↓
Browser      OTLP           OTLP            OTLP
Telemetry    Exporter       Exporter        Spans
   ↓           ↓              ↓                ↓
   └───────────┴──────────────┴────────────────┘
                      ↓
              OTLP Collector (Port 4318)
                      ↓
            Datadog / Jaeger / Tempo
```

---

## Quick Start

### Level 1: Enable Tracing (5 minutes)

1. **Enable OpenTelemetry in environment**:

```bash
# Edit .env file
cp .env.example .env

# Enable OpenTelemetry
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_SERVICE_NAME=vibecode-webgui
NEXT_PUBLIC_OTEL_ENABLED=true
```

2. **Start the OTLP Collector** (see [Container Deployment](#container-deployment)):

```bash
cd platforms/docker/docker
docker-compose up -d otel-collector
```

3. **Verify tracing is active**:

```bash
# Check configuration endpoint
curl http://localhost:3000/api/monitoring/traces | jq '.configuration'

# Expected output:
{
  "enabled": true,
  "service_name": "vibecode-webgui",
  "service_version": "0.1.0",
  "environment": "development"
}
```

### Level 2: View Traces (10 minutes)

Navigate to the trace visualization dashboard:

```
http://localhost:3000/monitoring/traces
```

Features:
- Real-time trace timeline
- Service dependency map
- Span breakdown and analysis
- Error and performance filtering

---

## Environment Configuration

### Required Variables

```bash
# ===========================================
# OpenTelemetry Configuration
# ===========================================

# Enable/disable OpenTelemetry instrumentation
OTEL_ENABLED=true

# OTLP Exporter endpoint (HTTP)
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318

# Optional: OTLP headers (for authentication)
OTEL_EXPORTER_OTLP_HEADERS=

# Service identification
OTEL_SERVICE_NAME=vibecode-webgui

# Resource attributes (key=value pairs, comma-separated)
OTEL_RESOURCE_ATTRIBUTES=deployment.environment=development,service.namespace=vibecode

# Prometheus metrics endpoint configuration
OTEL_PROMETHEUS_PORT=9090
OTEL_PROMETHEUS_ENDPOINT=/metrics
```

### Browser Telemetry

```bash
# Enable browser-side tracing
NEXT_PUBLIC_OTEL_ENABLED=true

# Browser trace collection endpoint
NEXT_PUBLIC_OTEL_EXPORTER_URL=/api/monitoring/traces
```

### Datadog Integration (Optional)

```bash
# Datadog API key for OTLP ingestion
DD_API_KEY=your-datadog-api-key

# Datadog site (e.g., datadoghq.com, datadoghq.eu)
DD_SITE=datadoghq.com

# Datadog-specific OTLP endpoint
OTEL_EXPORTER_OTLP_ENDPOINT=https://trace.agent.datadoghq.com
```

---

## Backend Instrumentation

### Node.js (Next.js API)

The OpenTelemetry SDK is initialized in `src/lib/monitoring/opentelemetry.ts` and automatically instruments:

- **HTTP/HTTPS requests** (incoming and outgoing)
- **Express.js middleware**
- **PostgreSQL queries** (via `pg` instrumentation)
- **File system operations** (production only)

#### Automatic Instrumentation

No code changes required for basic HTTP and database tracing. The SDK uses auto-instrumentation:

```typescript
import { initializeOpenTelemetry } from '@/lib/monitoring/opentelemetry'

// In src/instrument.ts or app startup
initializeOpenTelemetry()
```

#### Manual Instrumentation

For AI operations or custom business logic:

```typescript
import { createAISpan, AISpanAttributes } from '@/lib/monitoring/trace-context'

// Trace an AI request
const result = await createAISpan('chat-completion', {
  [AISpanAttributes.AI_PROVIDER]: 'openai',
  [AISpanAttributes.AI_MODEL]: 'gpt-4',
  [AISpanAttributes.AI_TEMPERATURE]: 0.7,
}, async (span) => {
  const startTime = Date.now()

  // Your AI request logic
  const response = await openai.chat.completions.create({...})

  // Set result attributes
  span.setAttributes({
    [AISpanAttributes.AI_INPUT_TOKENS]: response.usage.prompt_tokens,
    [AISpanAttributes.AI_OUTPUT_TOKENS]: response.usage.completion_tokens,
    [AISpanAttributes.AI_LATENCY_MS]: Date.now() - startTime,
  })

  return response
})
```

### Python (AgentAPI Service)

OpenTelemetry instrumentation in `platforms/docker/docker/agentapi/telemetry.py`:

#### Initialization

```python
from telemetry import init_telemetry

# In server.py startup
init_telemetry()
```

#### Trace Context Extraction

```python
from telemetry import get_trace_context

# In API endpoints
@app.get("/health")
async def health_check():
    trace_ctx = get_trace_context()
    return {
        "status": "healthy",
        "trace_context": trace_ctx  # Returns trace_id, span_id, trace_flags
    }
```

---

## Frontend Instrumentation

### Browser Telemetry Setup

Browser telemetry is initialized in `src/app/layout.tsx` via the `BrowserTelemetryInit` component:

```typescript
import BrowserTelemetryInit from '@/components/monitoring/BrowserTelemetryInit'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {/* Initialize browser telemetry on mount */}
        <BrowserTelemetryInit />
        {children}
      </body>
    </html>
  )
}
```

### Browser Instrumentation Features

Automatically captures:
- **User interactions**: Clicks, form submissions
- **Navigation events**: Page loads, route changes
- **Performance marks**: LCP, FID, CLS
- **XHR/Fetch requests**: API calls with trace propagation
- **Errors and exceptions**: Client-side error tracking

### Custom Browser Spans

```typescript
// In browser components
if (window.__OTEL_BROWSER__) {
  const tracer = window.__OTEL_BROWSER__.getTracer('my-component')

  tracer.startActiveSpan('custom-operation', (span) => {
    try {
      // Your operation
      span.setAttributes({
        'component.name': 'MyComponent',
        'operation.type': 'user-action'
      })
    } finally {
      span.end()
    }
  })
}
```

---

## Database Tracing

### PostgreSQL Instrumentation

Configured in `src/lib/monitoring/database-instrumentation.ts`:

```typescript
import { createPgInstrumentation } from '@/lib/monitoring/database-instrumentation'

const pgInstrumentation = createPgInstrumentation()
```

**Captured Attributes**:
- `db.system`: "postgresql"
- `db.name`: Database name from env
- `db.operation`: Query type (SELECT, INSERT, UPDATE, DELETE)
- `db.sql.table`: Extracted table name
- `db.statement`: Sanitized SQL query
- `db.query_time_ms`: Query execution time

### Redis/Cache Instrumentation

Redis operations are traced using custom spans:

```typescript
import { traceRedisOperation } from '@/lib/monitoring/database-instrumentation'

// Automatically wraps cache operations
const value = await cache.get('my-key')  // Auto-traced
await cache.set('my-key', value, 60)     // Auto-traced
```

**Captured Attributes**:
- `db.system`: "redis"
- `db.operation`: get, set, del, etc.
- `db.redis.key`: Cache key
- `db.redis.ttl`: Time-to-live (for set operations)
- `cache.client_type`: upstash or ioredis

### Manual Database Spans

```typescript
import { createDBSpan, DBSpanAttributes } from '@/lib/monitoring/trace-context'

const results = await createDBSpan('custom-query', {
  [DBSpanAttributes.DB_SYSTEM]: 'postgresql',
  [DBSpanAttributes.DB_OPERATION]: 'SELECT',
  [DBSpanAttributes.DB_TABLE]: 'users',
}, async (span) => {
  const results = await db.query('SELECT * FROM users WHERE active = true')

  span.setAttribute('db.result_count', results.rows.length)

  return results
})
```

---

## Container Deployment

### Docker Compose Setup

The OTLP Collector is defined in `platforms/docker/docker/docker-compose.yml`:

```yaml
services:
  otel-collector:
    image: otel/opentelemetry-collector:latest
    container_name: vibecode-otel-collector
    command: ["--config=/etc/otel-collector-config.yaml"]
    volumes:
      - ./otel-collector-config.yaml:/etc/otel-collector-config.yaml:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
    ports:
      - "4317:4317"  # OTLP gRPC
      - "4318:4318"  # OTLP HTTP
    networks:
      - vibecode
    restart: unless-stopped
    labels:
      com.vibecode.service: "otel-collector"
      com.vibecode.tier: "observability"
```

### Start Services with Tracing

```bash
cd platforms/docker/docker

# Start all services including OTLP collector
docker-compose up -d

# Verify collector is running
docker-compose ps | grep otel-collector

# Check collector logs
docker-compose logs -f otel-collector
```

### Container Resource Attributes

All services automatically include container metadata:
- `container.name`
- `container.id`
- `service.name`
- `service.tier`
- `deployment.environment`

---

## OTLP Collector Setup

### Configuration File

The collector configuration is in `platforms/docker/docker/otel-collector-config.yaml`:

```yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch:
    timeout: 10s
    send_batch_size: 1024
  memory_limiter:
    check_interval: 1s
    limit_mib: 512
  resourcedetection:
    detectors: [env, docker, system]
    timeout: 5s
    override: false

exporters:
  logging:
    loglevel: info
  otlp:
    endpoint: ${OTEL_EXPORTER_OTLP_ENDPOINT:-localhost:4317}
    tls:
      insecure: true

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [resourcedetection, memory_limiter, batch]
      exporters: [logging, otlp]
    metrics:
      receivers: [otlp]
      processors: [resourcedetection, memory_limiter, batch]
      exporters: [logging, otlp]
    logs:
      receivers: [otlp]
      processors: [resourcedetection, memory_limiter, batch]
      exporters: [logging, otlp]
```

### Pipeline Components

- **Receivers**: Accept OTLP data via gRPC (4317) and HTTP (4318)
- **Processors**:
  - `batch`: Batches telemetry for efficient export
  - `memory_limiter`: Prevents OOM issues
  - `resourcedetection`: Adds container/environment metadata
- **Exporters**:
  - `logging`: Console output (development)
  - `otlp`: Forward to backend (Datadog, Jaeger, Tempo)

---

## Exporter Configuration

### Datadog

```yaml
exporters:
  datadog:
    api:
      site: datadoghq.com
      key: ${DD_API_KEY}

service:
  pipelines:
    traces:
      exporters: [datadog]
```

Environment:
```bash
DD_API_KEY=your-api-key
OTEL_EXPORTER_OTLP_ENDPOINT=https://trace.agent.datadoghq.com
```

### Jaeger

```yaml
exporters:
  jaeger:
    endpoint: jaeger-collector:14250
    tls:
      insecure: true

service:
  pipelines:
    traces:
      exporters: [jaeger]
```

### Grafana Tempo

```yaml
exporters:
  otlp/tempo:
    endpoint: tempo:4317
    tls:
      insecure: true

service:
  pipelines:
    traces:
      exporters: [otlp/tempo]
```

---

## Troubleshooting

### Traces Not Appearing

**Check 1**: Verify OTLP Collector is running
```bash
curl http://localhost:4318/v1/traces
# Should return 200 or 405 (method not allowed)
```

**Check 2**: Verify OpenTelemetry is enabled
```bash
curl http://localhost:3000/api/monitoring/traces | jq '.configuration.enabled'
# Should return: true
```

**Check 3**: Check collector logs
```bash
docker-compose logs otel-collector | grep -i error
```

### No Database Spans

**Check**: PostgreSQL instrumentation is enabled
```bash
curl http://localhost:3000/api/monitoring/traces | jq '.configuration.database_instrumentation'
```

Expected:
```json
{
  "enabled": true,
  "enhanced_reporting": true,
  "query_sanitization": true,
  "span_correlation": true
}
```

### Browser Telemetry Not Working

**Check 1**: Verify environment variable
```bash
echo $NEXT_PUBLIC_OTEL_ENABLED
# Should return: true
```

**Check 2**: Check browser console
```javascript
// In browser DevTools console
window.__OTEL_BROWSER__
// Should return: object with tracer methods
```

**Check 3**: Verify endpoint is reachable
```bash
curl -X POST http://localhost:3000/api/monitoring/traces \
  -H "Content-Type: application/json" \
  -d '{"spans":[{"name":"test"}]}'
```

### High Memory Usage

**Solution**: Adjust collector memory limits

```yaml
processors:
  memory_limiter:
    check_interval: 1s
    limit_mib: 256  # Reduce from 512
  batch:
    timeout: 5s     # Reduce from 10s
    send_batch_size: 512  # Reduce from 1024
```

### Trace Context Not Propagating

**Check**: W3C Trace Context headers in requests
```bash
curl -v http://localhost:3000/api/health \
  -H "traceparent: 00-test-trace-id-0000000000000001-01"

# Check response headers for X-Trace-Id
```

**Debug**: Enable trace context logging (development only)
```typescript
import { extractTraceContext } from '@/lib/monitoring/trace-context'

const traceCtx = extractTraceContext(request.headers)
console.log('Trace context:', traceCtx)
```

---

## Next Steps

- **[Trace Analysis Guide](./trace-analysis-guide.md)**: Learn how to analyze and optimize using traces
- **[Monitoring Best Practices](../MONITORING_BEST_PRACTICES.md)**: General observability patterns
- **[Datadog Integration](../DATADOG_INTEGRATION_GUIDE.md)**: Connect to Datadog APM

---

## References

- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [W3C Trace Context Specification](https://www.w3.org/TR/trace-context/)
- [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/)
- [OTLP Protocol Specification](https://opentelemetry.io/docs/specs/otlp/)
