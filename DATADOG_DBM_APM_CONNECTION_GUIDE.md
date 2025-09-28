# Datadog DBM-APM Connection Configuration

This document outlines the complete setup for connecting Datadog Database Monitoring (DBM) with Application Performance Monitoring (APM) across DEV, staging, and production environments, following the [official Datadog documentation](https://docs.datadoghq.com/database_monitoring/connect_dbm_and_apm/?tab=go).

## Overview

The DBM-APM connection allows you to:
- Attribute active database connections to calling APM services
- Filter database hosts by APM services that call them
- View associated traces for query samples
- Visualize downstream database hosts of APM services
- Identify potential optimizations using explain plans

## Configuration Summary

### Environment Variables

All environments now include these critical variables:

```bash
# Core DBM-APM Connection Settings
DD_DBM_PROPAGATION_MODE=full          # Enable full propagation
DD_DBM_TRACE_INJECTION=true           # Enable trace injection
DD_SERVICE=vibecode-webgui            # Service name
DD_ENV=development|staging|production  # Environment
DD_VERSION=0.1.0-dev|0.1.0-staging|1.0.0  # Version
```

### Application Instrumentation

#### Node.js/TypeScript Applications

**Files Updated:**
- `src/instrument.ts` - Main TypeScript instrumentation
- `src/instrument.cjs` - CommonJS instrumentation

**Key Changes:**
```typescript
// Enable DBM propagation per documentation
dbmPropagationMode: process.env.DD_DBM_PROPAGATION_MODE || 'full',

// PostgreSQL plugin configuration
plugins: {
  pg: {
    enabled: true,
    dbmPropagationMode: process.env.DD_DBM_PROPAGATION_MODE || 'full',
    service: 'vibecode-postgres'
  }
}
```

#### Go Applications

**Files Updated:**
- `go.mod` - Added Datadog Go tracer dependency
- `cmd/vibecode-demo/main.go` - Added tracer initialization

**Key Changes:**
```go
import "gopkg.in/DataDog/dd-trace-go.v1/ddtrace/tracer"

// Initialize Datadog tracer for DBM-APM connection
tracer.Start(
    tracer.WithService("vibecode-demo"),
    tracer.WithEnv(getEnv("DD_ENV", "development")),
    tracer.WithVersion(getEnv("DD_VERSION", "0.1.0-dev")),
    // ... additional configuration
)
defer tracer.Stop()
```

### Docker Compose Configurations

**Files Updated:**
- `docker-compose.dev.yml` - Development environment
- `docker-compose.yml` - Staging environment  
- `docker-compose.production.yml` - Production environment

**Environment Variables Added:**
```yaml
environment:
  - DD_DBM_PROPAGATION_MODE=full
  - DD_SERVICE=vibecode-webgui
  - DD_ENV=development|staging|production
  - DD_VERSION=0.1.0-dev|0.1.0-staging|1.0.0
```

### Kubernetes Configurations

**Files Updated:**
- `k8s/datadog-values.yaml` - Main Kubernetes configuration
- `datadog-values.yaml` - Helm chart values

**Environment Variables Added:**
```yaml
env:
  - name: DD_DBM_PROPAGATION_MODE
    value: "full"
  - name: DD_DBM_TRACE_INJECTION
    value: "true"
  - name: DD_SERVICE
    value: "vibecode-webgui"
  - name: DD_ENV
    value: "production"
  - name: DD_VERSION
    value: "1.0.0"
```

## Environment-Specific Configurations

### Development Environment

**File:** `env.development.example`

**Key Settings:**
- `DD_DBM_PROPAGATION_MODE=full`
- `DD_TRACE_SAMPLE_RATE=1.0` (100% sampling for debugging)
- `DD_TRACE_DEBUG=true` (verbose logging)
- `DD_ENV=development`

### Staging Environment

**File:** `env.staging.example`

**Key Settings:**
- `DD_DBM_PROPAGATION_MODE=full`
- `DD_TRACE_SAMPLE_RATE=0.5` (50% sampling for testing)
- `DD_ENV=staging`

### Production Environment

**File:** `env.production.example`

**Key Settings:**
- `DD_DBM_PROPAGATION_MODE=full`
- `DD_TRACE_SAMPLE_RATE=0.1` (10% sampling for performance)
- `DD_ENV=production`
- Enhanced security settings

## Dependencies

### Node.js Dependencies

Ensure these are installed:
```json
{
  "dd-trace": "^3.17.0"
}
```

### Go Dependencies

Ensure this is in `go.mod`:
```go
require (
    gopkg.in/DataDog/dd-trace-go.v1 v1.60.0
)
```

## Validation Commands

### Test DBM-APM Connection

```bash
# Validate Datadog API key
curl -X GET "https://api.datadoghq.com/api/v1/validate" \
  -H "DD-API-KEY: $DD_API_KEY"

# Check database connectivity
psql $DATABASE_URL -c "SELECT version();"

# Test Redis connectivity
redis-cli -u $REDIS_URL ping
```

### Kubernetes Validation

```bash
# Check Datadog agent status
kubectl get pods -n datadog

# Verify environment variables
kubectl describe pod <pod-name> -n <namespace>

# Check logs for DBM propagation
kubectl logs <pod-name> -n <namespace> | grep -i "dbm"
```

## Troubleshooting

### Common Issues

1. **DBM Propagation Not Working**
   - Verify `DD_DBM_PROPAGATION_MODE=full` is set
   - Check that `DD_API_KEY` is valid
   - Ensure database connection is working

2. **Missing Traces**
   - Verify `DD_TRACE_ENABLED=true`
   - Check sampling rates are appropriate
   - Ensure service names are consistent

3. **Go Application Not Instrumented**
   - Verify `gopkg.in/DataDog/dd-trace-go.v1` is imported
   - Check tracer.Start() is called early in main()
   - Ensure environment variables are set

### Debug Commands

```bash
# Check Datadog agent configuration
kubectl exec -it <datadog-agent-pod> -- agent status

# View application logs
kubectl logs <app-pod> -f

# Test database queries
kubectl exec -it <postgres-pod> -- psql -U vibecode -d vibecode -c "SELECT * FROM pg_stat_activity;"
```

## Monitoring and Alerts

### Key Metrics to Monitor

- Database connection counts by service
- Query performance by APM service
- Trace sampling rates
- DBM propagation success rates

### Recommended Alerts

- High database connection counts
- Slow query performance
- Missing DBM traces
- APM service errors

## Security Considerations

### Production Security

- Use different API keys per environment
- Rotate keys regularly
- Monitor for exposed keys in logs
- Use Kubernetes secrets for sensitive data

### Data Privacy

- Configure appropriate sampling rates
- Mask sensitive data in traces
- Review data retention policies
- Ensure compliance with data protection regulations

## Next Steps

1. **Deploy Changes**: Apply the updated configurations to each environment
2. **Validate Setup**: Run validation commands to ensure DBM-APM connection is working
3. **Monitor Performance**: Watch for any performance impacts from increased tracing
4. **Set Up Alerts**: Configure monitoring and alerting for DBM-APM metrics
5. **Document Runbooks**: Create operational runbooks for troubleshooting

## References

- [Datadog DBM-APM Connection Documentation](https://docs.datadoghq.com/database_monitoring/connect_dbm_and_apm/?tab=go)
- [Datadog Go Tracer Documentation](https://docs.datadoghq.com/tracing/setup_overview/open_standards/go/)
- [Datadog Node.js Tracer Documentation](https://docs.datadoghq.com/tracing/setup_overview/open_standards/nodejs/)
- [Datadog Database Monitoring Documentation](https://docs.datadoghq.com/database_monitoring/)
