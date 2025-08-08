# Enhanced Datadog Monitoring for VibeCode

This document describes the comprehensive Datadog monitoring implementation for the VibeCode platform, including AI terminal features, Claude Code CLI usage, and OpenRouter API monitoring.

## Overview

The enhanced monitoring system provides:
- **Real-time Health Monitoring**: Database, Redis, AI services
- **Advanced Dashboards**: AI Features, User Experience, Infrastructure Health
- **Critical Alerts**: AI failures, performance issues, security events
- **Custom Metrics**: Terminal sessions, AI usage, system performance
- **API Endpoints**: Monitoring data exposure for frontend integration

## Architecture

### Core Components

1. **Enhanced Datadog Integration** (`src/lib/monitoring/enhanced-datadog-integration.ts`)
   - Comprehensive APM tracing with dd-trace
   - Custom metrics via StatsD
   - AI-specific monitoring for Claude Code CLI and OpenRouter

2. **Dashboard Management** (`src/lib/monitoring/advanced-datadog-dashboards.ts`)
   - Three specialized dashboards
   - Automated dashboard creation via API
   - Widget configuration for key metrics

3. **Alerts Configuration** (`src/lib/monitoring/alerts-configuration.ts`)
   - Critical alerts for AI services, infrastructure, and user experience
   - Automated monitor creation
   - Escalation and notification management

4. **API Endpoints**
   - `/api/monitoring/dashboard` - Real-time health and metrics
   - `/api/monitoring/metrics` - Custom metric submission

## Quick Start

### 1. Environment Setup

```bash
# Required environment variables
export DATADOG_API_KEY="your-datadog-api-key"
export DATADOG_APP_KEY="your-datadog-app-key"
export DATADOG_SITE="datadoghq.com"  # Optional, defaults to datadoghq.com
export DATADOG_SERVICE="vibecode-webgui"
export DATADOG_VERSION="1.0.0"
export DD_ENV="production"  # or development

# Optional: Client-side RUM
export NEXT_PUBLIC_DATADOG_CLIENT_TOKEN="your-client-token"
export NEXT_PUBLIC_DATADOG_APP_ID="your-app-id"
```

### 2. Setup Dashboards and Alerts

```bash
# Install dependencies
npm install

# Create dashboards and alerts
npm run monitoring:setup

# Check health status
npm run monitoring:health
```

### 3. Access Monitoring

- **Frontend Dashboard**: `http://localhost:3000/monitoring` (Health tab)
- **Datadog Dashboards**: Check your Datadog account for new VibeCode dashboards
- **API Health**: `http://localhost:3000/api/monitoring/dashboard`

## Dashboards

### 1. AI Features Monitoring Dashboard

**Widgets:**
- AI Requests by Provider & Model (timeseries)
- AI Response Times by Provider (timeseries)  
- Total Tokens Used (24h) (query value)
- Claude CLI Success Rate (query value)
- Active Terminal Sessions (query value)
- Error Rate (query value)
- Terminal Command Usage Heatmap (heatmap)
- System Resource Usage (timeseries)

**Key Metrics:**
- `vibecode.ai.requests{provider,model}`
- `vibecode.ai.response_time{provider}`
- `vibecode.ai.tokens_used{*}`
- `vibecode.claude.cli.commands{success}`

### 2. User Experience Dashboard

**Widgets:**
- Page Load Times by Route (timeseries)
- Top User Actions (toplist)
- Average Session Duration (query value)
- AI Interactions per Session (query value)
- Session End Reasons (distribution)

**Key Metrics:**
- `vibecode.page.load_time{page}`
- `vibecode.user.actions{action}`
- `vibecode.terminal.session.duration{*}`
- `vibecode.terminal.sessions.ended{end_reason}`

### 3. Infrastructure Health Dashboard

**Widgets:**
- Service Health Checks (check status)
- Database Performance (timeseries)
- Memory Usage (timeseries)
- Redis Performance (timeseries)

**Key Metrics:**
- `vibecode.health.check`
- `postgresql.connections.active`
- `vibecode.system.memory.used`
- `redis.info.clients_connected`

## Alerts

### Critical Alerts

1. **High AI Request Failure Rate**
   - Threshold: >10% failure rate
   - Query: `avg(last_5m):( sum:vibecode.ai.requests{success:false}.as_count() / sum:vibecode.ai.requests{*}.as_count() ) * 100 > 10`

2. **Database Connection Issues**
   - Type: Service check
   - Query: `"postgres".over("*").last(3).count_by_status()`

3. **High Memory Usage**
   - Threshold: >1.5GB warning, >2GB critical
   - Query: `avg(last_5m):avg:vibecode.system.memory.used{*} > 1500`

### Warning Alerts

1. **AI Response Time Degradation**
   - Threshold: >15s warning, >30s critical
   - Query: `avg(last_10m):avg:vibecode.ai.response_time{*} > 15000`

2. **High Terminal Session Failure Rate**
   - Threshold: >20% warning, >30% critical
   - Query: `avg(last_10m):( sum:vibecode.terminal.sessions.ended{end_reason:error}.as_count() / sum:vibecode.terminal.sessions.ended{*}.as_count() ) * 100 > 20`

## Custom Metrics

### AI and Terminal Metrics

```typescript
// Track AI usage
datadogMonitoring.trackAIUsage(
  sessionId, 'chat', 'anthropic', 'claude-3-sonnet', 1500, 2000
)

// Track terminal commands
datadogMonitoring.trackTerminalCommand(sessionId, 'git status', 150)

// Track Claude CLI usage
datadogMonitoring.trackClaudeCodeCLI(sessionId, 'generate', true, 2000)

// Track session lifecycle
datadogMonitoring.trackTerminalSessionCreated(sessionId, workspaceId, userId)
datadogMonitoring.trackTerminalSessionEnded(sessionId, 'user_close')
```

### System Performance

```typescript
// Automatic system monitoring (runs every 60 seconds)
datadogMonitoring.startSystemMonitoring()

// Manual performance tracking
datadogMonitoring.trackSystemPerformance()
```

### API Metric Submission

```bash
# Submit custom metrics via API
curl -X POST http://localhost:3000/api/monitoring/metrics \
  -H "Content-Type: application/json" \
  -d '{
    "type": "counter",
    "name": "user.login",
    "value": 1,
    "tags": ["method:oauth", "provider:github"]
  }'
```

## Health Monitoring

### Real-time Health Checks

The system performs active health checks for:

1. **Database (PostgreSQL)**
   - Connection testing with connection pooling
   - Query execution latency measurement
   - Connection timeout handling

2. **Redis Cache**
   - Connection and PING testing
   - Response time measurement
   - Graceful failure handling

3. **AI Service (OpenRouter)**
   - API connectivity testing
   - Model availability verification
   - Quota and rate limit monitoring

### Health API Response

```json
{
  "health": {
    "database": {
      "status": "healthy",
      "details": {
        "latency": "45ms",
        "connection": "active"
      }
    },
    "redis": {
      "status": "healthy", 
      "details": {
        "latency": "12ms",
        "response": "PONG"
      }
    },
    "aiService": {
      "status": "healthy",
      "details": {
        "connection": "active",
        "models_available": 150
      }
    },
    "overall": "healthy"
  }
}
```

## Frontend Integration

### Monitoring Dashboard Component

The `MonitoringDashboard` component (`src/components/monitoring/MonitoringDashboard.tsx`) provides:

- **Health Tab**: Real-time service health with visual indicators
- **Overview Tab**: Legacy system metrics overview
- **Metrics Tab**: Historical performance charts
- **Logs Tab**: System log viewer
- **Alerts Tab**: Active alert management

### Usage in Pages

```tsx
import MonitoringDashboard from '@/components/monitoring/MonitoringDashboard'

export default function MonitoringPage() {
  return (
    <div className="container mx-auto p-4">
      <MonitoringDashboard />
    </div>
  )
}
```

## Development & Testing

### Local Development

```bash
# Start development server with monitoring
npm run dev

# Check monitoring endpoints
npm run monitoring:health
npm run monitoring:metrics

# Setup Datadog (requires API keys)
npm run monitoring:setup
```

### Testing Health Endpoints

```bash
# Test dashboard endpoint
curl http://localhost:3000/api/monitoring/dashboard | jq

# Test metrics endpoint
curl http://localhost:3000/api/monitoring/metrics?config=true | jq

# Submit test metrics
curl -X POST http://localhost:3000/api/monitoring/metrics \
  -H "Content-Type: application/json" \
  -d '{"type": "gauge", "name": "test.metric", "value": 42}'
```

## Production Deployment

### Environment Configuration

```bash
# Production environment variables
DATADOG_API_KEY=your-production-api-key
DATADOG_APP_KEY=your-production-app-key  
DATADOG_SITE=datadoghq.com
DD_ENV=production
DD_SERVICE=vibecode-webgui
DD_VERSION=1.0.0

# Optional: StatsD configuration
DD_STATSD_HOST=localhost
DD_STATSD_PORT=8125

# Optional: RUM configuration
NEXT_PUBLIC_DATADOG_CLIENT_TOKEN=your-client-token
NEXT_PUBLIC_DATADOG_APP_ID=your-app-id
```

### Deployment Steps

1. Set environment variables
2. Deploy application
3. Run monitoring setup: `npm run monitoring:setup`
4. Verify dashboards and alerts in Datadog
5. Test health endpoints

## Troubleshooting

### Common Issues

1. **"Datadog API keys not configured"**
   - Set `DATADOG_API_KEY` and `DATADOG_APP_KEY` environment variables
   - Verify API key permissions include dashboards and monitors

2. **Health checks failing**
   - Check database and Redis connection strings
   - Verify OpenRouter API key configuration
   - Review network connectivity

3. **Metrics not appearing**
   - Verify StatsD configuration
   - Check metric naming conventions
   - Review Datadog ingestion logs

4. **Dashboard creation fails**
   - Verify API key has dashboard creation permissions
   - Check Datadog site configuration
   - Review network connectivity to Datadog API

### Debug Commands

```bash
# Check configuration
npm run monitoring:metrics

# Test health endpoints
curl -v http://localhost:3000/api/monitoring/dashboard

# Verify metric submission
curl -X POST http://localhost:3000/api/monitoring/metrics \
  -H "Content-Type: application/json" \
  -d '{"type": "event", "name": "Debug Test", "metadata": {"test": true}}'
```

## Security Considerations

- API keys should be stored in environment variables, never in code
- Health endpoints don't expose sensitive data
- Metric submission is rate-limited and validated
- Dashboard data is sanitized for client consumption

## Performance Impact

- Health checks run on-demand with caching
- Metrics submission is asynchronous
- Dashboard updates every 30 seconds
- System monitoring runs every 60 seconds
- Minimal overhead with proper configuration

## Support

For issues related to:
- **Monitoring setup**: Check environment variables and API permissions
- **Health checks**: Review service configurations and connectivity  
- **Custom metrics**: Verify metric naming and tag conventions
- **Dashboard issues**: Check Datadog dashboard permissions and API limits