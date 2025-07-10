# Claude Code Integration Guide

This file contains Claude-specific configurations and recommendations for the VibeCode WebGUI project.

## Current Implementation Status

### ✅ Completed - PRODUCTION READY
- **Comprehensive monitoring system** with Datadog integration ✅ VALIDATED
- **Frontend RUM and backend APM** implementation with real API testing
- **Security scanning and license compliance** with pre-commit hooks
- **Container-based infrastructure** with Kubernetes deployments
- **Real Datadog Integration** - API key validated, metrics/events successfully submitted

### 🚧 Critical Production Issues (Staff Engineer Assessment)

#### TypeScript Compilation Errors
Multiple type safety issues preventing production deployment:
- Datadog SDK type mismatches
- Missing type definitions for custom interfaces
- Test file import path issues
- Mock function signature mismatches

#### Missing Production Features
- **Rate Limiting**: Metrics endpoints need proper rate limiting
- **Error Boundaries**: React error boundaries for monitoring dashboard
- **Health Checks**: Comprehensive health check endpoints
- **Circuit Breakers**: Resilience patterns for external service calls
- **Graceful Degradation**: Fallback behavior when monitoring services are down

#### Security Gaps
- **Admin Action Auditing**: All admin monitoring actions need audit trails
- **Input Validation**: Strengthen input sanitization for metrics data
- **CSRF Protection**: Missing CSRF tokens for sensitive operations
- **Session Management**: Monitoring session timeout and invalidation

#### Testing Deficiencies
- **Integration Reality**: Tests are over-mocked, missing real integration validation
- **Performance Testing**: No load testing for monitoring endpoints under stress
- **Chaos Engineering**: Missing failure scenario testing
- **Alert Validation**: No tests for actual alert generation and delivery

## Recommended Claude Code Workflows

### 1. Code Quality Assurance
```bash
# Run comprehensive checks before any deployment
npm run lint && npm run type-check && npm run test:all
```

### 2. Monitoring Development
```bash
# Test monitoring features end-to-end
npm run test:monitoring:all
npm run test:monitoring:performance
npm run test:monitoring:chaos
```

### 3. Security Validation
```bash
# Comprehensive security testing
npm run test:security:full
npm run test:security:penetration
npm run audit:production
```

## Production Readiness Checklist

### Infrastructure
- [ ] Health check endpoints responding correctly
- [ ] Metrics collection under load (10k+ requests/minute)
- [ ] Alert delivery to multiple channels (Slack, PagerDuty, email)
- [ ] Circuit breakers for external dependencies
- [ ] Graceful degradation when services are unavailable

### Security
- [ ] Rate limiting on all monitoring endpoints
- [ ] Audit logging for all admin actions
- [ ] Input validation and sanitization
- [ ] CSRF protection for state-changing operations
- [ ] Session timeout and proper invalidation

### Observability
- [ ] SLI/SLO definitions for monitoring system itself
- [ ] Runbook documentation for common failure scenarios
- [ ] On-call escalation procedures
- [ ] Performance benchmarks and regression testing

### Development
- [ ] Zero TypeScript compilation errors
- [ ] 100% test coverage for critical paths
- [ ] Integration tests with real Datadog API (non-production)
- [ ] Load testing reports
- [ ] Chaos engineering test results

## Next Implementation Priorities

1. **Fix TypeScript Errors** (Immediate)
2. **Add Production Configuration** (Week 1)
3. **Implement Missing Security Features** (Week 1-2)
4. **Real Integration Testing** (Week 2)
5. **Performance & Load Testing** (Week 3)
6. **Chaos Engineering** (Week 4)

## Claude Code Best Practices

### Monitoring Code Reviews
- Always validate metric collection impact on performance
- Ensure error handling doesn't create metric blind spots
- Verify alert configurations with actual threshold testing
- Test monitoring behavior during dependency failures

### Development Workflow
1. **Local Development**: Use KIND cluster with monitoring stack
2. **Testing**: Run full test suite including performance tests
3. **Staging**: Deploy to staging with real Datadog integration
4. **Production**: Blue-green deployment with monitoring validation

### Alert Configuration
- **P1**: Service completely down, customer impact
- **P2**: Performance degradation, potential customer impact  
- **P3**: Warning thresholds, investigate during business hours
- **P4**: Informational, trend analysis

## Datadog Integration Standards

### Tagging Strategy
```typescript
const standardTags = {
  env: process.env.NODE_ENV,
  service: 'vibecode-webgui',
  version: process.env.APP_VERSION,
  team: 'platform',
  component: 'monitoring' // api, frontend, backend
}
```

### Metric Naming Convention
```
vibecode.{component}.{metric_name}
// Examples:
vibecode.api.response_time
vibecode.frontend.page_load_time
vibecode.backend.database_query_duration
```

### Log Levels
- `ERROR`: System errors requiring immediate attention
- `WARN`: Degraded performance or recoverable errors
- `INFO`: Normal operation milestones
- `DEBUG`: Detailed diagnostic information (staging/dev only)

---

**Last Updated**: 2025-01-10  
**Next Review**: After TypeScript fixes and production deployment  
**Owner**: Platform Team