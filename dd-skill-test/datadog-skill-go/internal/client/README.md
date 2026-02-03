# Datadog API Client

A clean, idiomatic Go client for the Datadog API with authentication, retries, and common query patterns.

## Features

- Environment-based configuration (DD_API_KEY, DD_APP_KEY, DD_SITE)
- Automatic retry logic with exponential backoff
- Rate limit handling
- Comprehensive error parsing
- Support for multiple Datadog sites (US, EU, etc.)
- Type-safe API methods

## Installation

```go
import "github.com/datadog/skill/internal/client"
```

## Configuration

Set the following environment variables:

```bash
export DD_API_KEY="your_api_key"
export DD_APP_KEY="your_app_key"
export DD_SITE="datadoghq.com"  # Optional, defaults to datadoghq.com
```

## Usage

### Create a Client

```go
client, err := client.NewClient()
if err != nil {
    log.Fatalf("Failed to create Datadog client: %v", err)
}
```

### Query APM Traces

```go
from := time.Now().Add(-1 * time.Hour)
to := time.Now()

// Query all traces for a service
data, err := client.QueryAPM("my-service", from, to, "")

// Query error traces only
data, err := client.QueryAPM("my-service", from, to, "status:error")
```

### Search Logs

```go
from := time.Now().Add(-1 * time.Hour)
to := time.Now()

data, err := client.SearchLogs("service:my-service ERROR", from, to, 100)
if err != nil {
    log.Fatalf("Failed to search logs: %v", err)
}
```

### Query Metrics

```go
from := time.Now().Add(-1 * time.Hour)
to := time.Now()

data, err := client.QueryMetrics("avg:system.cpu.user{*}", from, to)
if err != nil {
    log.Fatalf("Failed to query metrics: %v", err)
}
```

### Get Service Catalog

```go
data, err := client.GetServiceCatalog()
if err != nil {
    log.Fatalf("Failed to get service catalog: %v", err)
}
```

### Get Security Signals

```go
from := time.Now().Add(-24 * time.Hour)
to := time.Now()

// All signals
data, err := client.GetSecuritySignals(from, to, "")

// Signals for a specific service
data, err := client.GetSecuritySignals(from, to, "my-service")
```

### Work with SLOs

```go
// Get all SLOs
data, err := client.GetSLOs(nil)

// Get SLOs filtered by tags
data, err := client.GetSLOs([]string{"team:backend", "env:production"})

// Get SLO history for error budget
from := time.Now().Add(-7 * 24 * time.Hour)
to := time.Now()
data, err := client.GetSLOHistory("slo_id_here", from, to)
```

### Get Monitors

```go
// Get all monitors
data, err := client.GetMonitors(nil, nil)

// Get monitors filtered by tags
data, err := client.GetMonitors(
    []string{"env:production"},
    []string{"service:my-service"},
)
```

### Create Incident

```go
fields := map[string]interface{}{
    "severity": "SEV-1",
    "services": []string{"my-service"},
}

data, err := client.CreateIncident(
    "High error rate detected",
    true,  // customer_impacted
    fields,
)
```

## Error Handling

The client returns typed errors that include the HTTP status code and detailed error messages:

```go
data, err := client.QueryAPM("my-service", from, to, "")
if err != nil {
    if ddErr, ok := err.(*client.DatadogError); ok {
        fmt.Printf("Datadog API error: status=%d, message=%s\n",
            ddErr.StatusCode, ddErr.Message)
        fmt.Printf("Errors: %v\n", ddErr.Errors)
    } else {
        fmt.Printf("Request error: %v\n", err)
    }
    return
}
```

## Response Format

All methods return raw JSON bytes that can be parsed by the calling code:

```go
data, err := client.QueryAPM("my-service", from, to, "")
if err != nil {
    return err
}

var result map[string]interface{}
if err := json.Unmarshal(data, &result); err != nil {
    return fmt.Errorf("failed to parse response: %w", err)
}

// Work with the parsed data
fmt.Printf("Response: %+v\n", result)
```

## Retry Behavior

The client automatically retries failed requests with exponential backoff:

- Maximum 3 attempts per request
- Retries on rate limits (429)
- Retries on server errors (5xx)
- Retries on network timeouts
- Exponential backoff: 1s, 2s, 3s

## Supported Datadog Sites

The client supports all Datadog sites via the DD_SITE environment variable:

- `datadoghq.com` (US1 - default)
- `us3.datadoghq.com` (US3)
- `us5.datadoghq.com` (US5)
- `datadoghq.eu` (EU1)
- `ddog-gov.com` (US1-FED)

## API Methods

### APM & Traces
- `QueryAPM(service, from, to, filter)` - Query APM trace analytics

### Logs
- `SearchLogs(query, from, to, limit)` - Search logs

### Metrics
- `QueryMetrics(query, from, to)` - Query metrics

### Service Catalog
- `GetServiceCatalog()` - Get service definitions

### Security
- `GetSecuritySignals(from, to, service)` - Get security monitoring signals

### SLOs
- `GetSLOs(tags)` - Get SLOs with optional tag filtering
- `GetSLOHistory(sloID, from, to)` - Get SLO history

### Monitors
- `GetMonitors(tags, monitorTags)` - Get monitors with optional filtering

### Incidents
- `CreateIncident(title, customerImpacted, fields)` - Create incident

## Testing

Run the test suite:

```bash
go test ./internal/client -v
```

Run tests with coverage:

```bash
go test ./internal/client -cover
```

## Design Decisions

1. **Raw JSON Responses**: Methods return `[]byte` instead of typed structs to allow flexibility in response parsing and avoid tight coupling to Datadog API response schemas.

2. **Environment-Based Config**: Following the 12-factor app methodology, configuration comes from environment variables.

3. **Retry Logic**: Built-in retry logic handles transient failures automatically without requiring caller intervention.

4. **Error Types**: Custom error types provide detailed information about API failures for better debugging.

5. **Minimal Dependencies**: Uses only Go standard library to minimize dependency overhead.
