# OpenTelemetry Integration

This document describes the OpenTelemetry integration in VibeCode, providing vendor-neutral observability alongside our existing Datadog monitoring.

## Overview

OpenTelemetry provides standardized observability through:
- **Distributed Tracing**: Track requests across services and components
- **Metrics Collection**: Gather performance and business metrics
- **Log Correlation**: Connect logs with traces and spans
- **Vendor Neutrality**: Export to any OTLP-compatible backend

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Client-Side   │───▶│   VibeCode API   │───▶│   Exporters     │
│  Instrumentation │    │   (Server-Side)  │    │                 │
└─────────────────┘    └──────────────────┘    │  • OTLP/HTTP    │
                                               │  • Prometheus   │
                                               │  • Datadog      │
                                               └─────────────────┘
```

## Setup

### 1. Install Dependencies

OpenTelemetry packages are already included in `package.json`:

```bash
npm install --legacy-peer-deps
```

### 2. Configure Environment

Create `.env.local` with OpenTelemetry settings:

```bash
# Enable OpenTelemetry
OTEL_ENABLED=true

# OTLP Exporter (for Datadog Agent or other OTLP backends)
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4318/v1/traces

# Prometheus Metrics
OTEL_PROMETHEUS_PORT=9090
OTEL_PROMETHEUS_ENDPOINT=/metrics

# Client-side tracking
NEXT_PUBLIC_OTEL_ENABLED=true
NEXT_PUBLIC_OTEL_EXPORTER_URL=/api/monitoring/traces

# Datadog integration (optional)
DD_API_KEY=your_datadog_api_key_here
```

### 3. Run Setup Script

```bash
npm run otel:setup
```

### 4. Start Application

```bash
npm run dev
```

## Architecture Components

### Server-Side Instrumentation

**File**: `src/lib/monitoring/opentelemetry.ts`

- **Auto-instrumentation**: HTTP, Express, FS operations
- **OTLP Exporter**: Sends traces to Datadog Agent or other backends
- **Prometheus Exporter**: Exposes metrics on `/metrics` endpoint
- **Custom Attributes**: Adds VibeCode-specific context to spans

**Key Features**:
- Automatic instrumentation of HTTP requests and database queries
- Custom resource attributes for service identification
- Integration with existing Datadog monitoring
- Development vs production instrumentation profiles

### Client-Side Instrumentation

**File**: `src/lib/monitoring/opentelemetry-client.ts`

- **Browser Tracing**: Tracks user interactions, page loads, API calls
- **Fetch/XHR Instrumentation**: Automatic API call tracking
- **User Interaction Tracking**: Click, submit, keydown events
- **Performance Timing**: Navigation and resource loading metrics

**Key Features**:
- Single Page Application (SPA) navigation tracking
- CORS-enabled trace propagation for API calls
- Performance timing integration
- Custom user interaction spans

### API Endpoints

#### 1. Trace Collection (`/api/monitoring/traces`)
- Receives OTLP trace data from client-side
- Processes and forwards traces to Datadog
- Converts client spans to Datadog metrics

#### 2. Configuration (`/api/monitoring/otel-config`)
- Provides OpenTelemetry configuration and status
- Health checks for exporters and instrumentation
- Connection testing for OTLP endpoints

## Usage Examples

### Custom Server-Side Tracing

```typescript
import { trace } from '@opentelemetry/api'

const tracer = trace.getTracer('vibecode-custom')

export async function processAIRequest(prompt: string) {
  const span = tracer.startSpan('ai.process_request', {
    attributes: {
      'ai.prompt.length': prompt.length,
      'ai.provider': 'openai',
      'vibecode.feature': 'ai_assistance'
    }
  })

  try {
    const result = await openai.chat.completions.create({...})
    
    span.setAttributes({
      'ai.response.tokens': result.usage?.total_tokens || 0,
      'ai.response.model': result.model
    })
    
    return result
  } catch (error) {
    span.recordException(error)
    span.setStatus({ code: SpanStatusCode.ERROR })
    throw error
  } finally {
    span.end()
  }
}
```

### Custom Client-Side Tracking

```typescript
import { createUserInteractionSpan, trackPageNavigation } from '@/lib/monitoring/opentelemetry-client'

// Track user interactions
function handleButtonClick() {
  const span = createUserInteractionSpan('user.ai_request', {
    'user.action': 'generate_code',
    'ai.provider': 'openai',
    'session.id': sessionId
  })

  // Your code here...

  span?.end()
}

// Track navigation
router.events.on('routeChangeComplete', (url) => {
  trackPageNavigation(router.asPath, url)
})
```

## Metrics and Dashboards

### Available Metrics

**Server-Side**:
- `vibecode.api.response_time` - API endpoint response times
- `vibecode.database.query_time` - Database query performance
- `vibecode.ai.requests` - AI service request counts and timing
- `vibecode.load_test.*` - Performance test results
- `vibecode.lighthouse.*` - Performance audit results

**Client-Side**:
- `vibecode.client.span.duration` - Client-side operation timing
- `vibecode.client.user_interactions.count` - User interaction events
- `vibecode.client.api_calls.*` - Client API call metrics
- `vibecode.web_vitals.*` - Core Web Vitals (FCP, LCP, CLS, etc.)

### Prometheus Integration

Metrics are available at `http://localhost:9090/metrics`:

```bash
# View all metrics
npm run otel:metrics

# Check specific metrics
curl -s http://localhost:9090/metrics | grep vibecode
```

### Datadog Integration

When `DD_API_KEY` is configured:
- Traces sent via OTLP to Datadog Agent
- Automatic correlation with existing Datadog metrics
- Custom dashboards for OpenTelemetry data
- Unified observability with dd-trace integration

## Configuration Commands

```bash
# View OpenTelemetry configuration
npm run otel:config

# Check health status
npm run otel:health

# View detailed status
npm run otel:test

# View Prometheus metrics
npm run otel:metrics

# Run setup script
npm run otel:setup
```

## Integration with Existing Monitoring

### Datadog Correlation

OpenTelemetry traces are correlated with Datadog monitoring:

1. **Trace Correlation**: OpenTelemetry trace IDs link to Datadog traces
2. **Metric Alignment**: Similar metrics from both systems for validation
3. **Unified Dashboards**: Combined OpenTelemetry and Datadog metrics
4. **Alert Integration**: Alerts can use data from both sources

### Performance Testing Integration

OpenTelemetry metrics are integrated with performance testing:

- K6 load test results include OpenTelemetry trace data
- Lighthouse audits correlate with client-side OpenTelemetry metrics
- Performance budgets validated against OpenTelemetry data

## Troubleshooting

### Common Issues

1. **OTLP Endpoint Connection**:
   ```bash
   # Test OTLP endpoint
   curl -X POST http://localhost:4318/v1/traces \
     -H "Content-Type: application/json" \
     -d '{"test": "connection"}'
   ```

2. **Prometheus Metrics Not Available**:
   - Check port 9090 is not in use: `lsof -i :9090`
   - Verify `OTEL_ENABLED=true` in environment
   - Check application logs for initialization errors

3. **Client-Side Traces Not Received**:
   - Verify `NEXT_PUBLIC_OTEL_ENABLED=true`
   - Check browser console for CORS errors
   - Confirm `/api/monitoring/traces` endpoint is accessible

### Debug Commands

```bash
# Check OpenTelemetry status
curl -s http://localhost:3000/api/monitoring/otel-config?action=status | jq

# View trace collection endpoint
curl -s http://localhost:3000/api/monitoring/traces

# Test OTLP connection
npm run otel:config | jq '.datadog_integration'
```

## Production Considerations

### Performance Impact

- **Server-Side**: ~2-5ms overhead per instrumented operation
- **Client-Side**: ~1-2ms overhead per user interaction
- **Memory**: ~10-50MB additional memory usage
- **Network**: Additional HTTP requests for trace export

### Security

- **API Keys**: Store in environment variables, never in code
- **Trace Data**: May contain sensitive information - configure sampling
- **CORS**: Client-side traces limited to same-origin by default
- **Rate Limiting**: Consider rate limits on trace collection endpoint

### Scaling

- **Sampling**: Configure sampling rates for high-traffic environments
- **Batch Export**: Adjust batch sizes for network conditions
- **Resource Limits**: Monitor memory usage of trace buffers
- **Backend Capacity**: Ensure OTLP backend can handle trace volume

## Next Steps

1. **Custom Instrumentation**: Add domain-specific tracing
2. **Advanced Sampling**: Implement intelligent sampling strategies
3. **Log Correlation**: Connect OpenTelemetry traces with application logs
4. **Service Map**: Build service dependency visualization
5. **Anomaly Detection**: Use trace data for automated anomaly detection

For more information:
- [OpenTelemetry JavaScript Documentation](https://opentelemetry.io/docs/languages/js/)
- [OTLP Specification](https://opentelemetry.io/docs/specs/otlp/)
- [Datadog OpenTelemetry Integration](https://docs.datadoghq.com/opentelemetry/)