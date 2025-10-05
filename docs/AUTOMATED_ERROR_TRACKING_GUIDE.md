# 🤖 Automated Error Tracking Integration Guide

This guide explains how to use the comprehensive error tracking automation system that has been integrated across all scripts and code in the VibeCode WebGUI project.

## 🎯 Overview

The error tracking automation system provides:
- **Automatic Integration**: Error tracking is automatically added to all scripts
- **Comprehensive Coverage**: Shell scripts, Node.js scripts, Python scripts, and CI/CD pipelines
- **Real-time Monitoring**: Errors are tracked in real-time to Datadog
- **Performance Metrics**: Script execution times and performance data
- **Centralized Management**: Single point of control for all error tracking

## 🚀 Quick Start

### 1. Run Master Automation Script

```bash
# Make the script executable
chmod +x scripts/automate-error-tracking.sh

# Run the master automation script
./scripts/automate-error-tracking.sh
```

This will:
- Validate your environment
- Create error tracking infrastructure
- Integrate error tracking into all scripts
- Run tests to verify integration
- Generate a comprehensive report

### 2. Configure Environment Variables

```bash
# Required for error tracking to work
export DD_ERROR_TRACKING_ENABLED=true
export DD_API_KEY=your-datadog-api-key-here
export DD_SERVICE=vibecode-webgui
export DD_ENV=production  # or development, staging
export DD_VERSION=1.0.0
```

### 3. Verify Integration

```bash
# Test error tracking integration
npm run test:error-tracking

# Or run individual tests
npx tsx src/lib/monitoring/error-tracking-test.ts
```

## 📁 File Structure

```
scripts/
├── lib/
│   └── error-tracking.sh              # Shell error tracking module
├── automate-error-tracking.sh         # Master automation script
├── integrate-error-tracking.ts        # Script integration tool
├── deploy-with-error-tracking.sh      # Deployment with error tracking
├── monitor-with-error-tracking.sh     # Monitoring with error tracking
└── [all other scripts]                # All scripts now have error tracking

src/lib/
├── automation/
│   └── error-tracking-node.ts         # Node.js error tracking module
├── monitoring/
│   ├── error-tracking.ts              # Core error tracking functionality
│   ├── error-tracking-utils.ts        # Utility functions
│   └── error-tracking-test.ts         # Test suite
└── [other modules]                    # All modules can use error tracking

.github/workflows/
└── error-tracking-integration.yml     # CI/CD error tracking workflow
```

## 🔧 How It Works

### Shell Scripts

All shell scripts automatically include error tracking:

```bash
#!/bin/bash
# Source error tracking module
source "$(dirname "$0")/lib/error-tracking.sh"

# Initialize error tracking
init_error_tracking "component_name" "action_name"

# Your script code here
# Errors are automatically tracked
```

### Node.js Scripts

All Node.js scripts automatically include error tracking:

```typescript
import { createScriptErrorTracker } from '../src/lib/automation/error-tracking-node.js';

// Initialize error tracking
const errorTracker = createScriptErrorTracker('script-name', 'component', 'action');
errorTracker.init();

// Your script code here
// Errors are automatically tracked
```

### CI/CD Pipelines

The GitHub Actions workflow automatically:
- Validates error tracking configuration
- Integrates error tracking into scripts
- Tests the integration
- Monitors deployment errors
- Updates dashboards

## 📊 Error Tracking Features

### Automatic Error Capture

- **Uncaught Exceptions**: Automatically captured and sent to Datadog
- **Script Failures**: Exit codes and error messages tracked
- **Command Failures**: Failed command executions tracked
- **Network Errors**: API call failures tracked
- **Database Errors**: Database operation failures tracked

### Performance Monitoring

- **Execution Time**: Script execution duration tracked
- **Resource Usage**: CPU, memory, and disk usage monitored
- **Command Performance**: Individual command execution times
- **Deployment Metrics**: Deployment duration and success rates

### Context Enrichment

- **Script Metadata**: Script name, path, arguments
- **Environment Info**: Hostname, user, working directory
- **System Info**: Node version, platform, process info
- **Custom Context**: Component, action, and custom metadata

## 🎛️ Configuration Options

### Environment Variables

```bash
# Core Configuration
DD_ERROR_TRACKING_ENABLED=true          # Enable/disable error tracking
DD_API_KEY=your-api-key                 # Datadog API key
DD_SERVICE=vibecode-webgui              # Service name
DD_ENV=production                       # Environment
DD_VERSION=1.0.0                        # Version

# Sampling Configuration
DD_ERROR_TRACKING_SAMPLE_RATE=1.0       # Error sampling rate (0.0-1.0)
DD_ERROR_TRACKING_SESSION_SAMPLE_RATE=1.0 # Session sampling rate

# Privacy Configuration
DD_ERROR_TRACKING_PRIVACY_LEVEL=mask-user-input # Privacy level
DD_ERROR_TRACKING_MASK_TEXT_SELECTORS=[] # Additional text selectors to mask
DD_ERROR_TRACKING_MASK_INPUT_SELECTORS=[] # Additional input selectors to mask

# Debug Configuration
DD_ERROR_TRACKING_DEBUG=false           # Enable debug logging
DD_ERROR_TRACKING_VERBOSE_LOGGING=false # Enable verbose logging
```

### Script-Specific Configuration

```bash
# For shell scripts
export DD_ERROR_TRACKING_ENABLED=true
export DD_API_KEY=your-api-key

# For Node.js scripts
process.env.DD_ERROR_TRACKING_ENABLED = 'true';
process.env.DD_API_KEY = 'your-api-key';
```

## 🧪 Testing Error Tracking

### Run All Tests

```bash
# Run comprehensive error tracking tests
npm run test:error-tracking

# Or run the test script directly
npx tsx src/lib/monitoring/error-tracking-test.ts
```

### Test Individual Components

```bash
# Test shell script error tracking
./scripts/lib/error-tracking.sh

# Test Node.js error tracking
node -e "import('./src/lib/automation/error-tracking-node.js').then(m => console.log('Node.js error tracking loaded'))"

# Test deployment with error tracking
./scripts/deploy-with-error-tracking.sh --dry-run

# Test monitoring with error tracking
./scripts/monitor-with-error-tracking.sh --help
```

### Manual Testing

```bash
# Test error tracking by intentionally causing errors
./scripts/deploy-with-error-tracking.sh invalid-deployment-type

# Check Datadog dashboard for tracked errors
# Look for errors tagged with service:vibecode-webgui
```

## 📈 Monitoring and Dashboards

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

### Key Metrics to Monitor

- **Error Rate**: Percentage of failed operations
- **Error Count**: Total number of errors per time period
- **Script Performance**: Execution times and resource usage
- **Deployment Success Rate**: Successful vs failed deployments
- **Health Check Status**: Application and infrastructure health

## 🚨 Alerting Configuration

### Recommended Alerts

1. **High Error Rate**:
   - Alert when error rate > 5% over 5 minutes
   - Tag: `service:vibecode-webgui`

2. **New Error Types**:
   - Alert when new error patterns detected
   - Tag: `service:vibecode-webgui`

3. **Script Failures**:
   - Alert when critical scripts fail
   - Tag: `error_type:script_execution`

4. **Deployment Failures**:
   - Alert when deployments fail
   - Tag: `component:deployment`

5. **Performance Degradation**:
   - Alert when script execution times increase significantly
   - Tag: `event_type:performance_metric`

## 🔧 Troubleshooting

### Common Issues

1. **Errors not appearing in Datadog**:
   - Check `DD_API_KEY` is valid
   - Verify `DD_SERVICE` matches your service name
   - Ensure error tracking is enabled

2. **Scripts not integrating error tracking**:
   - Run `./scripts/automate-error-tracking.sh` to integrate
   - Check that `scripts/lib/error-tracking.sh` exists
   - Verify scripts have execute permissions

3. **Node.js scripts not tracking errors**:
   - Check that `src/lib/automation/error-tracking-node.ts` exists
   - Verify import paths are correct
   - Check Node.js version compatibility

4. **CI/CD integration not working**:
   - Verify `.github/workflows/error-tracking-integration.yml` exists
   - Check GitHub Actions secrets are configured
   - Ensure workflow has proper permissions

### Debug Commands

```bash
# Check error tracking configuration
echo "DD_ERROR_TRACKING_ENABLED: $DD_ERROR_TRACKING_ENABLED"
echo "DD_API_KEY: ${DD_API_KEY:0:8}..." # Show first 8 chars only
echo "DD_SERVICE: $DD_SERVICE"

# Test Datadog API connectivity
curl -X GET "https://api.datadoghq.com/api/v1/validate" \
  -H "DD-API-KEY: $DD_API_KEY" \
  -H "DD-APPLICATION-KEY: $DD_APP_KEY"

# Check script integration status
find scripts -name "*.sh" -exec grep -l "error-tracking.sh" {} \;
find scripts -name "*.js" -o -name "*.ts" -exec grep -l "error-tracking-node" {} \;
```

### Debug Mode

Enable debug logging:

```bash
# For shell scripts
export DD_ERROR_TRACKING_DEBUG=true
export DD_ERROR_TRACKING_VERBOSE_LOGGING=true

# For Node.js scripts
process.env.DD_ERROR_TRACKING_DEBUG = 'true';
process.env.DD_ERROR_TRACKING_VERBOSE_LOGGING = 'true';
```

## 📚 Advanced Usage

### Custom Error Tracking

```typescript
// In Node.js scripts
import { trackError, trackApiError, trackDatabaseError } from '../src/lib/monitoring/error-tracking';

// Track custom errors
trackError(new Error('Custom error'), {
  component: 'my-component',
  action: 'custom-action',
  metadata: { customData: 'value' }
});

// Track API errors
trackApiError('/api/endpoint', 500, error, {
  userId: 'user-123',
  requestId: 'req-456'
});

// Track database errors
trackDatabaseError('SELECT * FROM users', error, {
  queryType: 'SELECT',
  tableName: 'users'
});
```

### Shell Script Custom Tracking

```bash
# In shell scripts
source "$(dirname "$0")/lib/error-tracking.sh"

# Track custom errors
log_error_to_datadog "Custom error message" "1" "my-component" "custom-action" "additional_context"

# Track performance metrics
track_performance_metric "custom_metric" "123" "my-component" "ms"

# Track command execution
safe_execute "my-command" "my-component" "custom-action"
```

### Integration with Existing Monitoring

```typescript
// Integrate with existing monitoring systems
import { getErrorTracker } from '../src/lib/monitoring/error-tracking';

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

## 🔄 Maintenance

### Regular Tasks

1. **Monitor Error Tracking Status**:
   - Check Datadog dashboard weekly
   - Review error trends and patterns
   - Update alerting thresholds as needed

2. **Update Integration**:
   - Run `./scripts/automate-error-tracking.sh` after adding new scripts
   - Verify new scripts have error tracking integrated
   - Test integration with new deployment methods

3. **Review Performance**:
   - Monitor script execution times
   - Identify performance bottlenecks
   - Optimize slow-running scripts

4. **Update Configuration**:
   - Review environment variables
   - Update service names and versions
   - Adjust sampling rates based on volume

### Automated Maintenance

The system includes automated maintenance through:
- **CI/CD Integration**: Automatic testing and validation
- **Health Checks**: Regular monitoring of error tracking status
- **Performance Monitoring**: Automatic detection of performance issues
- **Alert Management**: Automatic alerting for critical issues

## 🆘 Support

For issues with the error tracking automation:

1. **Check the troubleshooting section above**
2. **Review the automation report** generated by `./scripts/automate-error-tracking.sh`
3. **Check Datadog Error Tracking documentation**
4. **Contact the platform team for assistance**
5. **Check error tracking test results** for configuration issues

---

**Last Updated**: January 2025  
**Next Review**: After production deployment  
**Owner**: Platform Team
