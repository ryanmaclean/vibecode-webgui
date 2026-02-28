# VibeCode Observability Guide

> **📌 Canonical Observability Guide**: This is the official and authoritative guide for observability tooling in VibeCode. For all monitoring, tracing, and observability decisions, always refer to this guide.

This guide provides detailed guidance on VibeCode's dual observability approach, documenting how OpenTelemetry and Datadog (dd-trace) work together to provide comprehensive observability for both development and production environments.

## Overview

VibeCode uses a **dual observability approach** that combines vendor-neutral distributed tracing (OpenTelemetry) with production-grade APM (Datadog). This approach provides flexibility for different environments while maintaining comprehensive observability.

### Observability Stack

| Tool | Primary Use Case | Activation | Status |
|------|-----------------|------------|--------|
| **OpenTelemetry** | Distributed tracing, OTLP backends, Prometheus metrics | `OTEL_ENABLED=true` | ✅ Optional |
| **dd-trace** | Production APM, custom metrics, LLM observability | `DD_API_KEY` present | ✅ Default |

---

## OpenTelemetry (Manual Packages)

> **When to use:** Development environments, vendor-neutral tracing, OTLP-compatible backends, Prometheus metrics

### What is OpenTelemetry?

OpenTelemetry is an open-source observability framework for cloud-native software. It provides vendor-neutral APIs, SDKs, and tools to collect distributed traces, metrics, and logs.

### Implementation Approach

VibeCode uses **manual OpenTelemetry packages** with selective instrumentations for optimal bundle size and tree-shaking. This approach provides:

- **Vendor Neutrality:** Export traces to any OTLP-compatible backend (Jaeger, Zipkin, Datadog, etc.)
- **Standards-Based:** Built on OpenTelemetry standard, ensuring long-term compatibility
- **Optimized Bundle Size:** 40-60% reduction vs auto-instrumentations approach
- **Selective Instrumentation:** Only include instrumentations you actually need
- **Tree-Shaking Support:** Next.js optimizePackageImports enabled for smaller bundles

### Package Structure

VibeCode uses 8 carefully selected OpenTelemetry packages:

```json
{
  "dependencies": {
    "@opentelemetry/sdk-node": "^0.212.0",
    "@opentelemetry/exporter-trace-otlp-http": "^0.212.0",
    "@opentelemetry/exporter-prometheus": "^0.212.0",
    "@opentelemetry/instrumentation-http": "^0.212.0",
    "@opentelemetry/instrumentation-express": "^0.44.0",
    "@opentelemetry/instrumentation-fs": "^0.15.0",
    "@opentelemetry/instrumentation-dns": "^0.55.0",
    "@opentelemetry/instrumentation-net": "^0.56.0"
  }
}
```

**Key Design Decisions:**
- ❌ **NOT using @vercel/otel** - Manual packages provide better control and tree-shaking
- ❌ **NOT using auto-instrumentations-node** - Replaced with selective instrumentations (40-60% bundle size reduction)
- ✅ **Selective instrumentations** - Only HTTP, Express, FS, DNS, Net (the ones actually used)
- ✅ **Tree-shaking enabled** - Via Next.js experimental.optimizePackageImports

### When to Use OpenTelemetry

Use OpenTelemetry in these scenarios:

1. **Development and Testing**
   - Local development with Jaeger or Zipkin UI
   - Integration testing with trace validation
   - Testing distributed trace propagation

2. **Multi-Cloud Deployments**
   - Applications deployed across multiple cloud providers
   - Avoiding vendor lock-in
   - Exporting to multiple backends simultaneously

3. **OTLP-Compatible Backends**
   - Using Honeycomb, Lightstep, or New Relic
   - Custom observability platforms
   - Self-hosted Jaeger or Zipkin
   - Datadog (via OTLP endpoint)

4. **Prometheus Metrics**
   - Exposing metrics endpoint for Prometheus scraping
   - Custom metrics collection
   - Integration with existing Prometheus infrastructure

### Configuration

#### Environment Variables

```bash
# Enable OpenTelemetry
OTEL_ENABLED=true

# OTLP Exporter Configuration (optional)
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf

# Service Identification
OTEL_SERVICE_NAME=vibecode-webgui
OTEL_RESOURCE_ATTRIBUTES="deployment.environment=development"

# Prometheus Metrics (if not using OTLP)
OTEL_EXPORTER_PROMETHEUS_PORT=9090
```

#### Activation

OpenTelemetry is initialized in `src/instrument.ts`:

```typescript
// Initialize OpenTelemetry first for auto-instrumentation (if enabled)
if (process.env.OTEL_ENABLED === 'true' && process.env.NODE_ENV !== 'test') {
  initializeOpenTelemetry();
}
```

**Note:** OpenTelemetry must be initialized **before** other instrumentation to ensure proper auto-instrumentation of the application.

#### Implementation File

All OpenTelemetry setup is consolidated in `src/lib/monitoring/opentelemetry-setup.ts`, which includes:
- Selective instrumentations (HTTP, Express, FS, DNS, Net)
- OTLP trace exporter
- Prometheus metrics exporter
- Tail-based sampling
- Datadog integration
- Health check functionality

### Tree-Shaking Configuration

Bundle size optimization is enabled in `next.config.mjs`:

```javascript
experimental: {
  optimizePackageImports: [
    // ... other packages
    // OpenTelemetry packages - enable tree shaking
    '@opentelemetry/api',
    '@opentelemetry/core',
    '@opentelemetry/instrumentation',
    '@opentelemetry/resources',
    '@opentelemetry/semantic-conventions',
    '@opentelemetry/sdk-node',
    '@opentelemetry/exporter-otlp-http',
    '@opentelemetry/exporter-prometheus',
  ],
}
```

**Browser Builds:**
All OpenTelemetry server packages are stubbed for browser builds via webpack aliases in `next.config.mjs`, resulting in 0 KB browser bundle impact.

### Supported Backends

OpenTelemetry can export traces to any OTLP-compatible backend:

| Backend | Use Case | Setup Complexity |
|---------|----------|------------------|
| **Jaeger** | Local development | Low (Docker one-liner) |
| **Zipkin** | Local development | Low (Docker one-liner) |
| **Honeycomb** | Cloud observability | Medium |
| **Lightstep** | Enterprise tracing | Medium |
| **New Relic** | Full-stack observability | Medium |
| **Datadog** | Production APM | Medium |
| **Prometheus** | Metrics collection | Low |
| **Custom OTLP** | Self-hosted | High |

### Local Development with Jaeger

For local development, Jaeger provides an excellent UI for viewing traces:

```bash
# Start Jaeger with Docker
docker run -d --name jaeger \
  -e COLLECTOR_OTLP_ENABLED=true \
  -p 16686:16686 \
  -p 4318:4318 \
  jaegertracing/all-in-one:latest

# Enable OpenTelemetry in your app
export OTEL_ENABLED=true
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318

# Start your application
npm run dev

# View traces at http://localhost:16686
```

### Prometheus Metrics

OpenTelemetry can export metrics in Prometheus format:

```bash
# Enable OpenTelemetry with Prometheus exporter
export OTEL_ENABLED=true
export OTEL_EXPORTER_PROMETHEUS_PORT=9090

# Start your application
npm run dev

# Metrics available at http://localhost:9090/metrics
curl http://localhost:9090/metrics
```

---

## Datadog (dd-trace)

> **When to use:** Production environments, custom metrics, LLM observability, comprehensive APM

### What is Datadog?

Datadog is a comprehensive observability platform that provides APM (Application Performance Monitoring), infrastructure monitoring, log management, and custom metrics.

### Why dd-trace?

The `dd-trace` package is Datadog's official Node.js APM library that provides:

- **Production-Grade APM:** Full application performance monitoring with profiling
- **Custom Metrics:** Send custom application metrics and business KPIs
- **LLM Observability:** Specialized instrumentation for OpenAI, LangChain, and LLM applications
- **Error Tracking:** Automatic error capture and stack trace analysis
- **Database Monitoring:** Correlate DBM (Database Monitoring) with APM traces
- **Unified Platform:** Logs, metrics, traces, and profiling in one platform

### When to Use dd-trace

Use Datadog in these scenarios:

1. **Production Monitoring**
   - Full APM with profiling and error tracking
   - Production dashboards and alerts
   - SLA monitoring and uptime tracking

2. **LLM and AI Applications**
   - OpenAI API call monitoring
   - LangChain chain execution tracing
   - Token usage and cost tracking
   - LLM performance analysis

3. **Custom Metrics and Business KPIs**
   - Custom application metrics (e.g., user signups, feature usage)
   - Business KPIs and dashboards
   - Real-time alerting on custom metrics

4. **Database Performance Monitoring**
   - Correlate database queries with APM traces
   - DBM (Database Monitoring) integration
   - Query performance analysis

5. **Comprehensive Observability**
   - Unified logs, metrics, and traces
   - Infrastructure monitoring
   - Security monitoring (Application Security Monitoring)

### Configuration

#### Environment Variables

```bash
# Datadog API Key (required for agentless mode)
DD_API_KEY=your-api-key-here

# Service Identification
DD_SERVICE=vibecode-webgui
DD_ENV=production
DD_VERSION=1.0.0

# Datadog Site (region)
DD_SITE=datadoghq.com  # US1
# DD_SITE=datadoghq.eu  # EU
# DD_SITE=us5.datadoghq.com  # US5

# LLM Observability (optional)
DD_LLMOBS_ENABLED=true
DD_LLMOBS_AGENTLESS_ENABLED=true
DD_LLMOBS_ML_APP=vibecode-ai

# Database Monitoring Integration
DD_DBM_PROPAGATION_MODE=full

# Profiling (recommended for production)
DD_PROFILING_ENABLED=true
DD_RUNTIME_METRICS_ENABLED=true
```

#### Activation

Datadog is automatically initialized in `src/instrument.ts` when `DD_API_KEY` is present:

```typescript
// Initialize the tracer with LLM observability support
tracer.init({
  logInjection: true,
  profiling: true,
  runtimeMetrics: true,
  site,
  env,
  service,
  version,
  // ... additional configuration
});
```

**Note:** Datadog initialization happens **after** OpenTelemetry to allow both to coexist.

### LLM Observability

VibeCode uses Datadog's specialized LLM Observability features for AI/ML monitoring:

**Supported Integrations:**
- **OpenAI:** API calls, token usage, latency, errors
- **LangChain:** Chain execution, agent tracing, tool calls
- **Custom LLM Providers:** Manual instrumentation for other providers

**Configuration:**

```typescript
// OpenAI instrumentation
tracer.use('openai', {
  service: 'vibecode-webgui-openai',
  mlApp: 'vibecode-ai',
});

// LangChain instrumentation
tracer.use('langchain', {
  service: 'vibecode-webgui-langchain',
  mlApp: 'vibecode-ai',
});
```

**What You Get:**
- Token usage and cost tracking
- Prompt and completion visibility
- Latency analysis
- Error rate monitoring
- Chain execution visualization

### Database Monitoring Integration

VibeCode correlates APM traces with database queries:

```bash
# Enable DBM propagation
DD_DBM_PROPAGATION_MODE=full
```

This adds SQL comments with service, environment, and trace information, allowing you to:
- Correlate slow queries with specific requests
- Identify database bottlenecks
- Analyze query performance in context

### Production Best Practices

1. **Always Enable Profiling**
   ```bash
   DD_PROFILING_ENABLED=true
   DD_RUNTIME_METRICS_ENABLED=true
   ```

2. **Use Agentless Mode for Serverless**
   ```bash
   DD_LLMOBS_AGENTLESS_ENABLED=true
   ```

3. **Tag All Traces**
   ```bash
   DD_TAGS="team:platform,component:api,deployment:production"
   ```

4. **Set Appropriate Sample Rates**
   - Production: 10% (`sampleRate: 0.1`)
   - Staging: 50% (`sampleRate: 0.5`)
   - Development: 100% (`sampleRate: 1.0`)

5. **Enable Log Injection**
   ```bash
   DD_LOGS_INJECTION=true
   ```

---

## How They Coexist

OpenTelemetry and Datadog can run **simultaneously without conflicts** when properly configured.

### Initialization Order

The initialization order in `src/instrument.ts` is critical:

```typescript
// 1. Initialize OpenTelemetry FIRST (if enabled)
if (process.env.OTEL_ENABLED === 'true' && process.env.NODE_ENV !== 'test') {
  initializeOpenTelemetry();
}

// 2. Initialize Datadog SECOND
tracer.init({
  // ... Datadog configuration
});
```

**Why This Order Matters:**
- OpenTelemetry's auto-instrumentation must run first to hook into Node.js internals
- Datadog can then layer on top of OpenTelemetry's instrumentation
- Both will capture traces independently without interfering

### Conditional Activation

Both tools are **conditionally activated** based on environment variables:

| Tool | Activation Condition | Default |
|------|---------------------|---------|
| **OpenTelemetry** | `OTEL_ENABLED=true` | Disabled |
| **Datadog** | `DD_API_KEY` present | Enabled (if key present) |

This allows you to:
- **Development:** Enable only OpenTelemetry for local tracing
- **Staging:** Enable both for validation
- **Production:** Enable only Datadog (or both if needed)

### Typical Environment Configurations

#### Development (Local)

```bash
# Option 1: OpenTelemetry only (with Jaeger)
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318

# Option 2: No monitoring
# (both disabled by default)
```

#### Staging

```bash
# Both enabled for validation
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=https://staging-otel.example.com
DD_API_KEY=your-api-key
DD_ENV=staging
DD_SERVICE=vibecode-webgui
```

#### Production

```bash
# Datadog only (recommended)
DD_API_KEY=your-api-key
DD_ENV=production
DD_SERVICE=vibecode-webgui
DD_VERSION=1.2.3
DD_PROFILING_ENABLED=true
DD_RUNTIME_METRICS_ENABLED=true
DD_LLMOBS_ENABLED=true
DD_LLMOBS_AGENTLESS_ENABLED=true
```

### No Conflicts

Both tools are designed to coexist:

- **Separate Backends:** OpenTelemetry exports to OTLP, Datadog exports to Datadog
- **Independent Context:** Each maintains its own trace context
- **No Shared State:** No global state conflicts
- **Minimal Overhead:** Combined overhead is ~2-5ms per request

### Performance Considerations

Running both tools simultaneously adds overhead:

- **Memory:** ~10-20 MB additional heap usage per tool
- **CPU:** ~1-3% additional CPU usage per tool
- **Latency:** ~2-5ms additional latency per request

**Recommendation:** In production, choose **one tool** based on your needs:
- **Datadog only:** Most common for comprehensive APM
- **OpenTelemetry only:** If you need vendor neutrality
- **Both:** Only if you need simultaneous export to multiple backends

---

## Bypass Conditions

Monitoring is **automatically disabled** in these scenarios (see `src/instrument.ts`):

```typescript
const isMonitoringDisabled = (
  process.env.NEXT_PHASE === 'phase-production-build' ||  // Next.js build
  process.argv.some(a => a.includes('next') && a.includes('build')) ||
  process.env.DOCKER_BUILD === 'true' ||                   // Docker builds
  process.env.SKIP_MONITORING === 'true' ||                // Manual override
  process.env.CI === 'true' ||                             // CI environments
  process.env.GITHUB_ACTIONS === 'true' ||                 // GitHub Actions
  process.env.OTEL_ENABLED === 'false' ||                  // Explicit disable
  process.env.DD_ENABLED === 'false' ||                    // Explicit disable
  process.env.PLAYWRIGHT_TEST === 'true' ||                // E2E tests
  !process.env.DD_API_KEY                                  // No API key
);
```

**Why Disable Monitoring?**
1. **Build Phase:** Prevents ERR_INVALID_URL errors during static builds
2. **CI/CD:** Avoids unnecessary network calls and API key requirements
3. **Testing:** Ensures tests run in isolation without external dependencies
4. **Docker Builds:** Prevents build failures due to missing credentials

---

## Decision Matrix

Use this matrix to decide which tool to use:

| Scenario | Use OpenTelemetry | Use dd-trace | Use Both |
|----------|------------------|--------------|----------|
| **Local Development** | ✅ (with Jaeger) | ❌ | ❌ |
| **Integration Tests** | ✅ | ❌ | ❌ |
| **Staging Environment** | ❌ | ✅ | Optional |
| **Production (Datadog customer)** | ❌ | ✅ | ❌ |
| **Production (Multi-cloud)** | ✅ | ❌ | Optional |
| **LLM/AI Applications** | ❌ | ✅ | ❌ |
| **Custom Metrics** | ❌ | ✅ | ❌ |
| **Vendor Neutrality** | ✅ | ❌ | ❌ |
| **Database Monitoring** | ❌ | ✅ | ❌ |
| **Full APM Suite** | ❌ | ✅ | ❌ |
| **Prometheus Metrics** | ✅ | ❌ | ❌ |

---

## Quick Reference

### Enable OpenTelemetry

```bash
# Set environment variable
export OTEL_ENABLED=true

# Optional: Configure OTLP endpoint
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318

# Start application
npm run dev
```

### Enable Datadog

```bash
# Set API key
export DD_API_KEY=your-api-key-here

# Set environment
export DD_ENV=production
export DD_SERVICE=vibecode-webgui
export DD_VERSION=1.0.0

# Start application
npm run dev
```

### Disable All Monitoring

```bash
# Option 1: Explicit disable
export OTEL_ENABLED=false
export DD_ENABLED=false

# Option 2: Skip monitoring
export SKIP_MONITORING=true

# Option 3: Remove API key
unset DD_API_KEY
```

### Verify Configuration

```bash
# Check environment variables
env | grep -E '(OTEL|DD_)'

# Check instrumentation in logs
npm run dev | grep -E '(OpenTelemetry|Datadog|LLM Observability)'
```

---

## Troubleshooting

### Common Issues

#### Issue: ERR_INVALID_URL during build

**Cause:** Monitoring trying to initialize during Next.js build

**Solution:**
```bash
export SKIP_MONITORING=true
npm run build
```

#### Issue: No traces appearing in Jaeger

**Cause:** OTLP endpoint not configured or Jaeger not running

**Solution:**
```bash
# Start Jaeger
docker run -d --name jaeger \
  -e COLLECTOR_OTLP_ENABLED=true \
  -p 16686:16686 \
  -p 4318:4318 \
  jaegertracing/all-in-one:latest

# Configure endpoint
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

#### Issue: Datadog traces not appearing

**Cause:** Missing API key or incorrect site configuration

**Solution:**
```bash
# Verify API key
echo $DD_API_KEY

# Verify site (must match your Datadog account region)
export DD_SITE=datadoghq.com  # or datadoghq.eu, us5.datadoghq.com, etc.
```

#### Issue: LLM Observability not working

**Cause:** LLM observability not enabled or missing API key

**Solution:**
```bash
export DD_API_KEY=your-api-key
export DD_LLMOBS_ENABLED=true
export DD_LLMOBS_AGENTLESS_ENABLED=true
export DD_LLMOBS_ML_APP=vibecode-ai
```

### Debugging

Enable debug logging:

```bash
# OpenTelemetry debug
export OTEL_LOG_LEVEL=debug

# Datadog debug
export DD_TRACE_DEBUG=true

# Start application and check logs
npm run dev 2>&1 | tee debug.log
```

---

## Summary

**Key Takeaways:**

1. **OpenTelemetry (manual packages)** is used for development, testing, vendor-neutral distributed tracing, and Prometheus metrics
2. **dd-trace** is used for production APM, custom metrics, and LLM observability
3. Both tools **can coexist** without conflicts when properly configured
4. VibeCode uses **8 selective OpenTelemetry packages** (not @vercel/otel or auto-instrumentations-node)
5. **Tree-shaking is enabled** via Next.js optimizePackageImports for reduced bundle size (40-60% reduction)
6. Monitoring is **automatically disabled** during builds and in CI/CD

**Default Recommendation:**
- **Development:** OpenTelemetry with Jaeger (`OTEL_ENABLED=true`)
- **Production:** Datadog with full APM (`DD_API_KEY` + profiling enabled)
- **LLM Applications:** Datadog with LLM Observability enabled
- **Prometheus Metrics:** OpenTelemetry with Prometheus exporter on port 9090

For questions or issues with observability configuration, refer to:
- **OpenTelemetry:** https://opentelemetry.io/docs/
- **Datadog APM:** https://docs.datadoghq.com/tracing/
- **Datadog LLM Observability:** https://docs.datadoghq.com/llm_observability/

---

**Last Updated:** February 2026
**Maintained By:** VibeCode Platform Team
**Review Cycle:** Quarterly or when observability strategy changes
