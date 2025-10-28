# Vector Database Error Monitoring Guide

This document describes how to configure and use the error monitoring dashboard for vector database adapters.

## Dashboard Overview

The Vector Database Error Monitoring Dashboard provides comprehensive visibility into errors occurring across all vector database adapters. It helps identify patterns, track error rates, and measure the effectiveness of retry mechanisms.

## Metrics Configuration

To enable the dashboard, ensure that your application is configured to emit the following metrics for each vector database error:

```typescript
// Example metrics emission in VectorDbErrorHandler
private recordErrorMetrics(error: VectorDbError): void {
  if (!this.enableMetrics) return;
  
  // Basic error count with tags
  metrics.increment('vector_db.errors', 1, {
    adapter: this.provider,
    error_type: error.type,
    operation: error.operation,
    retryable: error.retryable.toString(),
    severity: this.getErrorSeverity(error)
  });
  
  // Track by specific error types
  if (error.type === VectorDbErrorType.CONNECTION) {
    metrics.increment('vector_db.connection_errors', 1, {
      adapter: this.provider
    });
  }
  
  // Track retry information separately
  if (error.details?.retryAttempt !== undefined) {
    metrics.increment('vector_db.retry.attempts', 1, {
      adapter: this.provider,
      operation: error.operation
    });
  }
  
  if (error.details?.retrySuccess === true) {
    metrics.increment('vector_db.retry.success', 1, {
      adapter: this.provider,
      operation: error.operation
    });
  }
  
  // Track resolution time if available
  if (error.details?.resolutionTimeMs !== undefined) {
    metrics.histogram('vector_db.error.resolution_time', 
      error.details.resolutionTimeMs / 1000, // convert to seconds
      {
        adapter: this.provider,
        error_type: error.type
      }
    );
  }
}

// Helper to determine error severity
private getErrorSeverity(error: VectorDbError): string {
  // Critical errors
  if (
    error.type === VectorDbErrorType.AUTHENTICATION ||
    error.type === VectorDbErrorType.INITIALIZATION ||
    error.type === VectorDbErrorType.CONFIGURATION_ERROR
  ) {
    return 'critical';
  }
  
  // High severity errors
  if (
    error.type === VectorDbErrorType.CONNECTION ||
    error.type === VectorDbErrorType.SERVICE ||
    !error.retryable
  ) {
    return 'high';
  }
  
  // Medium severity errors
  if (
    error.type === VectorDbErrorType.TIMEOUT ||
    error.type === VectorDbErrorType.QUERY_FAILED
  ) {
    return 'medium';
  }
  
  // Low severity errors (retryable operational errors)
  return 'low';
}
```

## Logging Configuration

To populate the "Recent Errors" widget, configure your logger to include structured metadata with each error:

```typescript
// In VectorDbError class
private logError(): void {
  logger.error({
    message: this.message,
    errorType: this.type,
    operation: this.operation,
    provider: this.provider,
    details: this.details,
    timestamp: this.timestamp,
    retryable: this.retryable,
    type: 'vector_db' // Important tag for filtering
  });
}
```

## Alert Configuration

The following alerts are recommended for monitoring vector database errors:

1. **High Error Rate Alert**:
   - Monitor: `sum:vector_db.errors{*}.as_rate() > 0.5`
   - Notify: When error rate exceeds 0.5 errors per second over 5 minutes
   - Severity: Warning

2. **Critical Error Alert**:
   - Monitor: `sum:vector_db.errors{severity:critical}.as_count() > 0`
   - Notify: When any critical errors occur
   - Severity: Error

3. **Connection Failure Alert**:
   - Monitor: `sum:vector_db.connection_errors{*}.as_count() > 3`
   - Notify: When more than 3 connection errors occur within 5 minutes
   - Severity: Error

4. **Low Retry Success Rate Alert**:
   - Monitor: `sum:vector_db.retry.success{*}.as_count() / sum:vector_db.retry.attempts{*}.as_count() < 0.8`
   - Notify: When retry success rate falls below 80%
   - Severity: Warning

## Dashboard Access

The dashboard is available at:
- Development: http://monitoring.dev.example.com/dashboards/vector-db-errors
- Staging: http://monitoring.staging.example.com/dashboards/vector-db-errors
- Production: http://monitoring.example.com/dashboards/vector-db-errors

## Interpreting the Dashboard

### Error Rate by Adapter
Shows error frequency across different adapters over time. Look for sudden spikes or gradual increases.

### Error Type Distribution
Displays the distribution of errors by type. Helps identify which error categories are most common.

### Retry Success Rate
Shows the percentage of retried operations that eventually succeeded. A healthy system should maintain >95% success rate.

### Operation Error Heatmap
Visualizes which operations have the most errors across different adapters. Darker colors indicate higher error counts.

### Connection Errors by Provider
Focuses on connection-related errors, which often indicate infrastructure or configuration issues.

### Retryable vs Non-Retryable Errors
Compares the frequency of errors that can be automatically recovered vs. those requiring intervention.

## Troubleshooting Guide

### High Connection Error Rates
- Check database/service availability
- Verify connection string configuration
- Check for network issues between application and database
- Review recent infrastructure changes

### Low Retry Success Rate
- Review retry configuration (attempts, backoff)
- Check if errors are properly categorized as retryable
- Look for persistent underlying issues causing retries to fail

### Increased Query Errors
- Review recent code changes affecting queries
- Check for database schema changes
- Verify query parameters
- Check database load/performance

### Unexpected Error Types
- Ensure error categorization logic is correctly identifying error types
- Add specific handling for new error patterns
- Update error categorization logic as needed

## Maintenance and Updates

The dashboard configuration is stored in:
`/monitoring/dashboards/vector-db-error-monitoring-dashboard.json`

Update this file and apply changes when:
- Adding new error types
- Adding new vector database adapters
- Modifying metric names or tags
- Changing visualization preferences