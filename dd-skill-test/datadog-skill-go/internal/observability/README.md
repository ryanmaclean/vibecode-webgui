# Datadog Observability Library

Core observability library providing integrated Datadog tracing, logging, and metrics for the Go Datadog skill.

## Features

- **Distributed Tracing** - DD-Trace-Go integration with clean API
- **Structured Logging** - HTTP log intake with trace correlation
- **StatsD Metrics** - Full metrics support (gauges, counters, histograms)
- **Unified API** - Single entry point for all observability needs

## Installation

The library is automatically included in the Go Datadog skill project.

```bash
go get github.com/datadog/skill/internal/observability
```

## Quick Start

```go
package main

import (
    "github.com/datadog/skill/internal/observability"
)

func main() {
    // Initialize observability
    obs, err := observability.Init("my-service", "production")
    if err != nil {
        panic(err)
    }
    defer obs.Shutdown(0)

    // Log message
    obs.LogInfo("Application started")

    // Create a trace span
    span := obs.StartSpan("process.data")
    defer obs.FinishSpan(span)

    // Record metric
    obs.RecordMetric("data.processed", 100.0)
}
```

## API Reference

### Initialization

```go
// Initialize observability with service name and environment
obs, err := observability.Init("my-service", "production")
if err != nil {
    // handle error
}
defer obs.Shutdown(0)
```

### Tracing

```go
// Start a span
span := obs.StartSpan("operation.name")
defer obs.FinishSpan(span)

// Add tags
obs.GetTracer().SetTag(span, "user.id", "12345")
obs.GetTracer().SetTag(span, "request.path", "/api/users")

// Mark span as error
obs.GetTracer().SetError(span, err)

// Start span from context (for child spans)
span, ctx := obs.StartSpanFromContext(ctx, "child.operation")
defer obs.FinishSpan(span)
```

### Logging

```go
// Simple logging
obs.LogInfo("Processing request")
obs.LogWarning("Rate limit approaching")
obs.LogError("Failed to process request")

// Logging with attributes
obs.LogInfo("User logged in", map[string]interface{}{
    "user_id": "12345",
    "ip": "192.168.1.1",
})

// Correlated logging (includes trace_id and span_id)
obs.LogInfoWithTrace("Request completed", span, map[string]interface{}{
    "duration_ms": 123.45,
})
```

### Metrics

```go
metrics := obs.GetMetrics()

// Gauge - current value
metrics.Gauge("queue.size", 42.0)
metrics.Gauge("memory.usage", 1024.5, "host:server-01")

// Count - cumulative counter
metrics.Count("requests.total", 1)
metrics.Increment("cache.hits")
metrics.Decrement("connections.active")

// Histogram - statistical distribution
metrics.Histogram("response.time", 123.45)
metrics.Histogram("payload.size", 2048.0, "endpoint:/api/users")

// Timing - specialized histogram for durations
metrics.Timing("database.query", 45.2) // milliseconds

// Distribution - like histogram with percentiles
metrics.Distribution("request.size", 1024.0)
```

### High-Level Helpers

```go
// Track operation with automatic span and metrics
err := obs.TrackOperation(ctx, "process.payment", func(ctx context.Context, span tracer.Span) error {
    // Do work here
    return processPayment(ctx)
})

// Record API call with metrics and error logging
obs.RecordAPICall("/api/users", "GET", 200, 123.45, nil)
obs.RecordAPICall("/api/orders", "POST", 500, 234.56, errors.New("timeout"))
```

## Environment Variables

The library uses standard Datadog environment variables:

- `DD_API_KEY` - Datadog API key (required for logging)
- `DD_SITE` - Datadog site (default: datadoghq.com)
- `DD_ENV` - Environment name (default: production)
- `DD_AGENT_HOST` - Datadog agent hostname (default: localhost)
- `DD_DOGSTATSD_PORT` - StatsD port (default: 8125)

## Architecture

### tracer.go
Wraps `gopkg.in/DataDog/dd-trace-go.v1/ddtrace/tracer` with a clean, safe API:
- Thread-safe initialization
- Null-safe operations
- Automatic context propagation

### logger.go
Implements structured logging to Datadog HTTP log intake:
- Batched log sending for efficiency
- Automatic trace correlation (trace_id, span_id)
- Auto-flush every 5 seconds
- Never fails the application

### metrics.go
Wraps `github.com/DataDog/datadog-go/v5/statsd` for metrics:
- Pre-configured with service tags
- Support for all metric types
- Convenience methods for common patterns

### observability.go
Unified interface combining all three:
- Singleton pattern for global access
- Coordinated shutdown
- High-level helper methods

## Usage Patterns

### Simple Command Pattern

```go
func runCommand() error {
    obs, err := observability.Init("dd-cli", "production")
    if err != nil {
        return err
    }
    defer obs.Shutdown(0)

    obs.LogInfo("Command started", map[string]interface{}{
        "args": os.Args,
    })

    // Command logic here

    return nil
}
```

### HTTP Handler Pattern

```go
func handleRequest(w http.ResponseWriter, r *http.Request) {
    obs := observability.Get()

    span, ctx := obs.StartSpanFromContext(r.Context(), "http.request")
    defer obs.FinishSpan(span)

    obs.GetTracer().SetTag(span, "http.method", r.Method)
    obs.GetTracer().SetTag(span, "http.path", r.URL.Path)

    // Process request

    obs.LogInfoWithTrace("Request completed", span)
}
```

### Database Operation Pattern

```go
func queryDatabase(ctx context.Context, query string) error {
    obs := observability.Get()

    return obs.TrackOperation(ctx, "database.query", func(ctx context.Context, span tracer.Span) error {
        obs.GetTracer().SetTag(span, "db.query", query)

        start := time.Now()
        rows, err := db.QueryContext(ctx, query)
        duration := time.Since(start).Milliseconds()

        obs.GetMetrics().Histogram("db.query.duration", float64(duration))

        return err
    })
}
```

## Best Practices

1. Initialize observability early in main()
2. Always defer Shutdown() to flush data
3. Use TrackOperation() for automatic span management
4. Add meaningful tags to spans
5. Use correlated logging (LogInfoWithTrace) within spans
6. Record both success and error metrics
7. Use appropriate metric types (gauge vs counter vs histogram)

## Design Philosophy

Based on the Python implementation at `/python/lib/dd_observability.py`:

- Observability should never break the application
- Automatic batching and buffering for performance
- Trace correlation by default
- Clean, simple API that's easy to use
- Minimal configuration required
- Fails gracefully when API keys are missing
