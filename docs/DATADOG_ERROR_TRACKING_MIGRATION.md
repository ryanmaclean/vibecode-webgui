# Datadog Error Tracking Migration Guide

This guide explains how to migrate from Sentry to Datadog Error Tracking for the VibeCode WebGUI platform.

## 🎯 Overview

Datadog Error Tracking provides comprehensive error monitoring capabilities that integrate seamlessly with your existing Datadog RUM, APM, and Logs infrastructure. This migration replaces any existing Sentry integration with a unified Datadog-based error tracking solution.

## 🔄 Migration Benefits

- **Unified Monitoring**: All observability data in one platform
- **Better Integration**: Seamless integration with existing Datadog RUM and APM
- **Cost Efficiency**: No separate Sentry subscription needed
- **Enhanced Context**: Rich error context from RUM sessions and APM traces
- **Advanced Analytics**: Better error grouping and analysis capabilities

## 📋 Migration Checklist

### ✅ Completed Tasks

- [x] Set up Datadog Error Tracking SDK configuration
- [x] Replace Sentry integration in AI analytics with Datadog Error Tracking
- [x] Create error tracking middleware for Next.js API routes
- [x] Update environment configuration for Datadog Error Tracking
- [x] Create utility functions for consistent error tracking across the app
- [x] Test error tracking integration and verify data appears in Datadog

### 🔧 Implementation Details

#### 1. Core Error Tracking Module
**File**: `src/lib/monitoring/error-tracking.ts`

This module provides the main Datadog Error Tracking functionality:
- Automatic error capture and context enrichment
- Integration with Datadog RUM and Logs
- Support for custom error types and contexts
- Performance issue tracking

#### 2. API Route Middleware
**File**: `src/middleware/error-tracking-middleware.ts`

Middleware for Next.js API routes that provides:
- Automatic error tracking for API endpoints
- Request/response context capture
- Custom error handlers
- Method-specific error tracking

#### 3. Utility Functions
**File**: `src/lib/monitoring/error-tracking-utils.ts`

Specialized error tracking utilities for:
- React components
- Database operations
- Authentication flows
- File operations
- AI operations
- External API calls
- Performance monitoring

#### 4. Updated AI Analytics
**File**: `src/lib/ai/analytics/index.ts`

Replaced Sentry integration with Datadog Error Tracking:
- Removed `ERROR_TRACKING_DSN` dependency
- Added direct integration with Datadog Error Tracking
- Maintained existing error event structure

## 🚀 Getting Started

### 1. Environment Configuration

Copy the environment configuration template:
```bash
cp docs/datadog-error-tracking-env.example .env.local
```

Update the following variables:
```bash
# Core Datadog Configuration
DD_API_KEY=your-datadog-api-key
DD_APP_KEY=your-datadog-app-key
DD_SERVICE=vibecode-webgui
DD_ENV=production
DD_VERSION=1.0.0

# Frontend Error Tracking
NEXT_PUBLIC_DD_APPLICATION_ID=your-application-id
NEXT_PUBLIC_DD_CLIENT_TOKEN=your-client-token
NEXT_PUBLIC_DD_SITE=datadoghq.com
```

### 2. Remove Sentry Configuration

Remove or comment out any Sentry-related environment variables:
```bash
# SENTRY_DSN=
# SENTRY_ORG=
# SENTRY_PROJECT=
# SENTRY_AUTH_TOKEN=
# ERROR_TRACKING_DSN=
```

### 3. Test the Integration

Run the error tracking test suite:
```bash
npm run test:error-tracking
```

Or run individual tests:
```typescript
import { runAllErrorTrackingTests } from './src/lib/monitoring/error-tracking-test';
runAllErrorTrackingTests();
```

## 📊 Usage Examples

### Basic Error Tracking

```typescript
import { trackError } from '@/lib/monitoring/error-tracking';

try {
  // Your code here
} catch (error) {
  trackError(error, {
    component: 'user-profile',
    action: 'update-profile',
    userId: user.id
  });
}
```

### API Route Error Tracking

```typescript
import { withErrorTracking } from '@/middleware/error-tracking-middleware';

export const POST = withErrorTracking(async (request: NextRequest) => {
  // Your API logic here
  // Errors will be automatically tracked
});
```

### Component Error Tracking

```typescript
import { createComponentErrorTracker } from '@/lib/monitoring/error-tracking-utils';

const errorTracker = createComponentErrorTracker('UserProfile');

try {
  // Component logic
} catch (error) {
  errorTracker.trackError(error, {
    userId: user.id,
    action: 'render'
  });
}
```

### Database Error Tracking

```typescript
import { DatabaseErrorTracker } from '@/lib/monitoring/error-tracking-utils';

try {
  await db.query('SELECT * FROM users');
} catch (error) {
  DatabaseErrorTracker.trackQueryError('SELECT * FROM users', error, {
    userId: user.id
  });
}
```

## 🔍 Monitoring and Alerting

### Datadog Dashboard Setup

1. **Error Tracking Dashboard**:
   - Navigate to Datadog → Error Tracking
   - Create custom dashboard for your service
   - Add error rate, error count, and error trends widgets

2. **RUM Integration**:
   - Errors automatically appear in RUM sessions
   - Session replay shows user actions leading to errors
   - Performance correlation with error occurrences

3. **APM Integration**:
   - Errors linked to APM traces
   - Database and external service error correlation
   - Performance impact analysis

### Alert Configuration

Set up alerts for:
- **High Error Rate**: Error rate > 5% over 5 minutes
- **New Error Types**: New error patterns detected
- **Error Spikes**: Sudden increase in error volume
- **Critical Errors**: Errors affecting core functionality

## 🛠️ Advanced Configuration

### Custom Error Context

```typescript
import { getErrorTracker } from '@/lib/monitoring/error-tracking';

const errorTracker = getErrorTracker();

// Add global context
errorTracker.addGlobalContext('deployment', 'production-v1.2.3');
errorTracker.addGlobalContext('region', 'us-east-1');

// Set user context
errorTracker.setUser({
  id: 'user-123',
  name: 'John Doe',
  email: 'john@example.com'
});
```

### Performance Integration

```typescript
import { trackPerformanceIssue } from '@/lib/monitoring/error-tracking';

// Track slow operations as errors
trackPerformanceIssue('Slow database query', {
  duration: 5000,
  threshold: 1000,
  queryComplexity: 'high'
}, {
  component: 'database',
  operation: 'user-lookup'
});
```

### Privacy and Security

Configure privacy settings:
```bash
# Mask user input in session replays
DD_ERROR_TRACKING_PRIVACY_LEVEL=mask-user-input

# Additional masking rules
DD_ERROR_TRACKING_MASK_TEXT_SELECTORS=["#password", "#ssn"]
DD_ERROR_TRACKING_MASK_INPUT_SELECTORS=["input[type='password']"]
```

## 🔧 Troubleshooting

### Common Issues

1. **Errors not appearing in Datadog**:
   - Check `DD_API_KEY` is valid
   - Verify `DD_SERVICE` matches your service name
   - Ensure error tracking is enabled

2. **Frontend errors not tracked**:
   - Verify `NEXT_PUBLIC_DD_CLIENT_TOKEN` is set
   - Check browser console for initialization errors
   - Ensure RUM is properly initialized

3. **Missing error context**:
   - Verify user context is set
   - Check global context configuration
   - Ensure error tracking utilities are used correctly

### Debug Commands

```bash
# Test Datadog API connectivity
curl -X GET "https://api.datadoghq.com/api/v1/validate" \
  -H "DD-API-KEY: $DD_API_KEY" \
  -H "DD-APPLICATION-KEY: $DD_APP_KEY"

# Check error tracking configuration
curl -X GET "https://api.datadoghq.com/api/v1/logs/config" \
  -H "DD-API-KEY: $DD_API_KEY"
```

### Debug Mode

Enable debug logging:
```bash
DD_ERROR_TRACKING_DEBUG=true
DD_ERROR_TRACKING_VERBOSE_LOGGING=true
```

## 📈 Performance Considerations

### Sampling Configuration

```bash
# Development (100% sampling)
DD_ERROR_TRACKING_SAMPLE_RATE=1.0
DD_ERROR_TRACKING_SESSION_SAMPLE_RATE=1.0

# Production (10% sampling)
DD_ERROR_TRACKING_SAMPLE_RATE=0.1
DD_ERROR_TRACKING_SESSION_SAMPLE_RATE=0.1
```

### Resource Usage

- Error tracking adds minimal overhead (~1-2ms per error)
- Session replay uses more bandwidth (configure sampling accordingly)
- Database monitoring adds query overhead (use DBM propagation mode)

## 🔒 Security Best Practices

1. **API Key Management**:
   - Never commit API keys to version control
   - Use different keys for each environment
   - Rotate keys regularly

2. **Data Privacy**:
   - Configure appropriate privacy levels
   - Mask sensitive data in error context
   - Review error data for PII exposure

3. **Access Control**:
   - Limit Datadog dashboard access
   - Use read-only accounts for monitoring
   - Audit error tracking configuration changes

## 📚 Additional Resources

- [Datadog Error Tracking Documentation](https://docs.datadoghq.com/error_tracking/)
- [Datadog RUM Documentation](https://docs.datadoghq.com/real_user_monitoring/)
- [Datadog APM Documentation](https://docs.datadoghq.com/tracing/)
- [Error Tracking Best Practices](https://docs.datadoghq.com/error_tracking/guide/)

## 🆘 Support

For issues with the error tracking implementation:
1. Check the troubleshooting section above
2. Review Datadog Error Tracking documentation
3. Contact the platform team for assistance
4. Check error tracking test results for configuration issues

---

**Last Updated**: January 2025  
**Next Review**: After production deployment  
**Owner**: Platform Team
