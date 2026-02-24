# AI Operations Monitoring Setup

Complete guide to setting up and using VibeCode's AI operations monitoring dashboard with Datadog integration.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Setup Steps](#setup-steps)
5. [Accessing the Dashboard](#accessing-the-dashboard)
6. [Understanding the Metrics](#understanding-the-metrics)
7. [Using the API](#using-the-api)
8. [Dashboard Deployment](#dashboard-deployment)
9. [Troubleshooting](#troubleshooting)
10. [Best Practices](#best-practices)

## Overview

VibeCode's AI Operations Monitoring Dashboard provides real-time visibility into:

- **Token Usage** - Track token consumption per model and provider
- **Response Latency** - Monitor AI response times with p50, p95, p99 percentiles
- **Error Tracking** - Identify and drill down into AI operation failures
- **Cost Analysis** - Track AI costs by model, provider, and time period
- **Usage Patterns** - Understand which models and operations are most used

This monitoring system integrates seamlessly with VibeCode's existing Datadog/OpenTelemetry stack and provides both real-time Datadog dashboards and a JSON API for custom integrations.

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                    AI Request Flow                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  UnifiedAIClient  →  DatadogAIMetrics  →  Datadog Cloud    │
│         ↓                                                    │
│    Prisma Logger  →  Database (AIRequest table)             │
│                           ↓                                  │
│                    API Endpoint (/api/monitoring/ai-metrics)│
│                           ↓                                  │
│                    Frontend Dashboard                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Key Files

1. **Backend Metrics Collection**
   - `src/lib/unified-ai-client.ts` - AI client with metrics integration
   - `src/lib/monitoring/datadog-ai-metrics.ts` - Datadog metrics utility
   - `src/lib/prisma.ts` - Database logging with enhanced metrics

2. **API Layer**
   - `src/app/api/monitoring/ai-metrics/route.ts` - Metrics aggregation endpoint

3. **Infrastructure**
   - `config/datadog/ai-operations-dashboard.json` - Dashboard configuration
   - `scripts/deploy-datadog-dashboard.sh` - Deployment script

## Prerequisites

### Required

- **Datadog Account** - Free or paid account at [datadog.com](https://www.datadog.com)
- **API Keys** - Both API Key and Application Key from Datadog
- **Node.js** - v18+ for running the application
- **Database** - PostgreSQL with AIRequest table

### Optional

- **curl** and **jq** - For dashboard deployment script
- **Datadog Agent** - For enhanced metrics collection (agentless mode supported)

## Setup Steps

### Step 1: Get Datadog API Keys

1. Log in to your Datadog account at [app.datadoghq.com](https://app.datadoghq.com)

2. Get your API Key:
   - Click your avatar → **Organization Settings**
   - Select **API Keys** from left menu
   - Click **New API Key**
   - Name: "VibeCode AI Monitoring"
   - Copy the API Key

3. Get your Application Key:
   - In Organization Settings, select **Application Keys**
   - Click **New Application Key**
   - Name: "VibeCode AI Monitoring"
   - Copy the Application Key

### Step 2: Configure Environment Variables

Add these to your `.env.local` or shell profile:

```bash
# Datadog Configuration
DD_API_KEY="your-api-key-here"
DD_APP_KEY="your-application-key-here"
DD_SITE="datadoghq.com"  # or "datadoghq.eu" for EU region

# Optional: Enhanced Configuration
DD_ENV="production"  # or "development", "staging"
DD_SERVICE="vibecode-webgui"
DD_VERSION="1.0.0"

# Optional: Enable/Disable Features
DD_ENABLED="true"
SKIP_MONITORING="false"
```

**Security Note**: For production, use secure secret management (e.g., macOS Keychain, AWS Secrets Manager) instead of environment variables.

### Step 3: Verify Database Schema

Ensure your database has the AIRequest table with enhanced metrics:

```sql
-- Check if table exists
SELECT table_name
FROM information_schema.tables
WHERE table_name = 'AIRequest';

-- Verify columns for metrics tracking
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'AIRequest';
```

Required columns include:
- `requestType`, `model`, `provider` - For categorization
- `tokenCount`, `cost`, `latency` - For metrics
- `errorMessage`, `status` - For error tracking

### Step 4: Start the Application

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Or for production
npm run build
npm start
```

### Step 5: Verify Metrics Collection

Test that metrics are being collected:

```bash
# Make a test AI request
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, test request"}'

# Check metrics API
curl http://localhost:3000/api/monitoring/ai-metrics?period=1h
```

Expected response:
```json
{
  "period": "1h",
  "summary": {
    "total_requests": 1,
    "total_tokens": 150,
    "total_cost": 0.0023,
    "error_rate": 0,
    "avg_latency": 1234
  },
  "by_model": [...],
  "by_provider": [...],
  "latency_histogram": {...}
}
```

## Accessing the Dashboard

### Option 1: Deploy to Datadog (Recommended)

Use the automated deployment script:

```bash
# Dry run to validate configuration
./scripts/deploy-datadog-dashboard.sh --dry-run

# Deploy the dashboard
./scripts/deploy-datadog-dashboard.sh

# Update existing dashboard
./scripts/deploy-datadog-dashboard.sh --force
```

After deployment:
1. Go to [app.datadoghq.com/dashboard/lists](https://app.datadoghq.com/dashboard/lists)
2. Search for "VibeCode AI Operations Monitoring"
3. Click to open your dashboard

### Option 2: Manual Import

1. Go to Datadog → **Dashboards** → **New Dashboard**
2. Click the settings gear icon → **Import Dashboard JSON**
3. Copy contents from `config/datadog/ai-operations-dashboard.json`
4. Paste and click **Import**

### Option 3: Use the API Endpoint

Access metrics programmatically:

```bash
# Get 24-hour metrics
curl http://localhost:3000/api/monitoring/ai-metrics?period=24h

# Filter by model
curl http://localhost:3000/api/monitoring/ai-metrics?period=7d&model=gpt-4

# Filter by provider
curl http://localhost:3000/api/monitoring/ai-metrics?period=30d&provider=openai
```

## Understanding the Metrics

### Dashboard Widgets

#### 1. Total AI Requests (24h)
- **Metric**: `vibecode.ai.operation.count`
- **Type**: Counter
- **Purpose**: Track overall AI usage volume

#### 2. Total AI Cost (24h)
- **Metric**: `vibecode.ai.cost`
- **Type**: Gauge
- **Purpose**: Monitor AI spending
- **Unit**: USD ($)

#### 3. Error Rate
- **Metric**: `(vibecode.ai.errors / vibecode.ai.operation.count) * 100`
- **Type**: Calculated percentage
- **Purpose**: Track reliability
- **Thresholds**:
  - 🟢 Green: < 5% error rate
  - 🟡 Yellow: 5-10% error rate
  - 🔴 Red: > 10% error rate

#### 4. Response Latency (p95)
- **Metric**: `p95:vibecode.ai.operation.duration`
- **Type**: Histogram percentile
- **Purpose**: Monitor performance
- **Unit**: Milliseconds (ms)

#### 5. Token Usage by Model
- **Metric**: `sum:vibecode.ai.tokens{*} by {model}`
- **Type**: Timeseries
- **Purpose**: Track token consumption patterns

#### 6. Cost Breakdown
- **Metrics**:
  - By Model: `sum:vibecode.ai.cost{*} by {model}`
  - By Provider: `sum:vibecode.ai.cost{*} by {provider}`
- **Type**: Pie charts
- **Purpose**: Understand cost distribution

#### 7. Latency Distribution
- **Metrics**: `avg`, `p50`, `p95`, `p99:vibecode.ai.operation.duration`
- **Type**: Histogram
- **Purpose**: Identify performance outliers

#### 8. Error Tracking
- **Metric**: `sum:vibecode.ai.errors{*} by {error_type}`
- **Type**: Timeseries
- **Purpose**: Identify error patterns

### Metric Tags

All metrics include these tags for filtering:

| Tag | Description | Example Values |
|-----|-------------|----------------|
| `env` | Environment | `production`, `staging`, `development` |
| `service` | Service name | `vibecode-webgui` |
| `version` | Application version | `1.0.0` |
| `provider` | AI provider | `openai`, `anthropic`, `azure` |
| `model` | Model identifier | `gpt-4`, `claude-3`, `gpt-3.5-turbo` |
| `operation` | Operation type | `chat`, `completion`, `embedding`, `stream` |
| `status` | Operation status | `success`, `error` |
| `error_type` | Error category | `rate_limit`, `timeout`, `auth`, `invalid_request` |

## Using the API

### Endpoint Details

**URL**: `GET /api/monitoring/ai-metrics`

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `period` | string | `24h` | Time period: `1h`, `6h`, `12h`, `24h`, `7d`, `30d`, `90d` |
| `model` | string | - | Filter by specific model (optional) |
| `provider` | string | - | Filter by provider (optional) |
| `skip_cache` | boolean | `false` | Bypass cache for fresh data |

### Response Format

```json
{
  "period": "24h",
  "start_date": "2026-02-23T00:00:00Z",
  "end_date": "2026-02-24T00:00:00Z",
  "summary": {
    "total_requests": 1250,
    "total_tokens": 345000,
    "total_cost": 12.45,
    "avg_latency": 1234,
    "error_rate": 2.4,
    "success_rate": 97.6
  },
  "by_model": [
    {
      "model": "gpt-4",
      "requests": 500,
      "tokens": 200000,
      "cost": 8.00,
      "avg_latency": 1500,
      "error_rate": 1.2
    },
    {
      "model": "gpt-3.5-turbo",
      "requests": 750,
      "tokens": 145000,
      "cost": 4.45,
      "avg_latency": 980,
      "error_rate": 3.1
    }
  ],
  "by_provider": [
    {
      "provider": "openai",
      "requests": 1250,
      "tokens": 345000,
      "cost": 12.45,
      "error_rate": 2.4
    }
  ],
  "by_operation": [
    {
      "operation": "chat",
      "requests": 1100,
      "avg_latency": 1200
    },
    {
      "operation": "completion",
      "requests": 150,
      "avg_latency": 1500
    }
  ],
  "latency_histogram": {
    "p50": 1100,
    "p95": 2300,
    "p99": 3500,
    "max": 5200
  },
  "errors": [
    {
      "error_type": "rate_limit",
      "count": 15,
      "percentage": 50.0
    },
    {
      "error_type": "timeout",
      "count": 10,
      "percentage": 33.3
    },
    {
      "error_type": "invalid_request",
      "count": 5,
      "percentage": 16.7
    }
  ],
  "timeseries": [
    {
      "timestamp": "2026-02-23T00:00:00Z",
      "requests": 52,
      "tokens": 14400,
      "cost": 0.52,
      "errors": 1
    }
    // ... hourly buckets
  ]
}
```

### Example Usage

```javascript
// Fetch metrics for the last 7 days
async function getWeeklyMetrics() {
  const response = await fetch('/api/monitoring/ai-metrics?period=7d')
  const data = await response.json()

  console.log(`Total cost: $${data.summary.total_cost}`)
  console.log(`Error rate: ${data.summary.error_rate}%`)

  // Find most expensive model
  const mostExpensive = data.by_model.reduce((max, model) =>
    model.cost > max.cost ? model : max
  )
  console.log(`Most expensive model: ${mostExpensive.model} ($${mostExpensive.cost})`)
}

// Get real-time metrics (bypass cache)
async function getRealTimeMetrics() {
  const response = await fetch('/api/monitoring/ai-metrics?period=1h&skip_cache=true')
  const data = await response.json()
  return data
}
```

## Dashboard Deployment

### Deployment Script Features

The `deploy-datadog-dashboard.sh` script provides:

- ✅ **JSON Validation** - Ensures dashboard configuration is valid
- ✅ **Credential Validation** - Verifies API keys before deployment
- ✅ **Auto-detection** - Finds and updates existing dashboards by title
- ✅ **Backup Creation** - Saves previous version before updates
- ✅ **Rollback Support** - Restore from backup if needed
- ✅ **Dry Run Mode** - Test without making changes

### Deployment Commands

```bash
# Validate configuration without deploying
./scripts/deploy-datadog-dashboard.sh --dry-run

# Deploy new dashboard
export DD_API_KEY="your-api-key"
export DD_APP_KEY="your-app-key"
./scripts/deploy-datadog-dashboard.sh

# Update existing dashboard (will prompt for confirmation)
./scripts/deploy-datadog-dashboard.sh

# Force update without confirmation
./scripts/deploy-datadog-dashboard.sh --force

# Rollback to previous version
./scripts/deploy-datadog-dashboard.sh --rollback
```

### Backup Management

Backups are stored in `config/datadog/.backups/`:

```bash
# List available backups
ls -lh config/datadog/.backups/

# View backup contents
cat config/datadog/.backups/ai-operations-dashboard-backup-TIMESTAMP.json

# Restore from specific backup
cp config/datadog/.backups/ai-operations-dashboard-backup-TIMESTAMP.json \
   config/datadog/ai-operations-dashboard.json
./scripts/deploy-datadog-dashboard.sh --force
```

## Troubleshooting

### Issue: No metrics appearing in Datadog

**Symptoms**: Dashboard shows "No data" or all zeros

**Solutions**:

1. Verify environment variables are set:
   ```bash
   echo $DD_API_KEY
   echo $DD_APP_KEY
   ```

2. Check if monitoring is disabled:
   ```bash
   # These should NOT be set to true
   echo $SKIP_MONITORING
   echo $DD_ENABLED
   ```

3. Verify metrics are being sent:
   ```bash
   # Check application logs for Datadog metric sends
   grep -i "datadog.*metric" logs/application.log
   ```

4. Wait 2-3 minutes for metrics to propagate to Datadog

### Issue: API returns 401 Unauthorized

**Symptoms**: `/api/monitoring/ai-metrics` returns authentication error

**Solutions**:

1. Check authentication configuration in `src/lib/monitoring/auth.ts`
2. Verify API endpoint permissions
3. Check if authentication is required for monitoring endpoints

### Issue: Dashboard deployment fails

**Symptoms**: Script errors during deployment

**Solutions**:

1. Verify prerequisites are installed:
   ```bash
   curl --version
   jq --version
   ```

2. Validate JSON configuration:
   ```bash
   jq empty config/datadog/ai-operations-dashboard.json
   ```

3. Check API credentials have correct permissions:
   ```bash
   curl -H "DD-API-KEY: $DD_API_KEY" \
        -H "DD-APPLICATION-KEY: $DD_APP_KEY" \
        "https://api.datadoghq.com/api/v1/validate"
   ```

### Issue: High API costs

**Symptoms**: Datadog billing is higher than expected

**Solutions**:

1. Reduce metric flush frequency in `datadog-ai-metrics.ts`:
   ```typescript
   // Change from 10 seconds to 60 seconds
   private readonly flushIntervalMs: number = 60000
   ```

2. Increase buffer size to batch metrics:
   ```typescript
   // Increase from 100 to 500
   private readonly bufferSize: number = 500
   ```

3. Disable non-essential metrics for development:
   ```bash
   export SKIP_MONITORING="true"  # For local development
   ```

### Issue: Missing metrics in database

**Symptoms**: API returns data but some fields are null

**Solutions**:

1. Verify `logAIRequest` is being called:
   ```typescript
   // In unified-ai-client.ts, check for:
   await logAIRequest({
     requestType: 'chat',
     model: options.model,
     // ... other fields
   })
   ```

2. Check Prisma schema matches database:
   ```bash
   npx prisma db pull
   npx prisma generate
   ```

## Best Practices

### 1. Set Up Alerts

Create Datadog monitors for critical thresholds:

```yaml
# High Error Rate Alert
name: "VibeCode AI - High Error Rate"
metric: "(sum:vibecode.ai.errors{*}.as_count() / sum:vibecode.ai.operation.count{*}.as_count()) * 100"
threshold: 10  # Alert if >10% errors
time_window: "5m"
message: |
  AI error rate is above 10%
  Check error breakdown: {{error_type}}
  @slack-vibecode-alerts
```

### 2. Monitor Costs

Set up budget alerts:

```yaml
# Daily Cost Alert
name: "VibeCode AI - High Daily Cost"
metric: "sum:vibecode.ai.cost{*}"
threshold: 100  # Alert if daily cost >$100
time_window: "1d"
message: |
  Daily AI cost exceeded $100
  Current: ${{value}}
  Check cost breakdown by model
```

### 3. Track Performance Regressions

Monitor latency trends:

```yaml
# Latency Regression Alert
name: "VibeCode AI - Latency Regression"
metric: "p95:vibecode.ai.operation.duration{*}"
threshold: 3000  # Alert if p95 >3 seconds
comparison: "baseline * 1.5"  # 50% slower than baseline
message: "AI response time degraded by 50%"
```

### 4. Regular Dashboard Reviews

Schedule weekly reviews of:
- Cost trends by model/provider
- Error patterns and root causes
- Latency distribution changes
- Usage patterns and peak times

### 5. Use Time Period Filters

- **1h/6h** - Real-time monitoring and debugging
- **24h** - Daily operations review
- **7d** - Weekly trends analysis
- **30d/90d** - Long-term planning and budgeting

## Additional Resources

- [DATADOG_INTEGRATION_GUIDE.md](./DATADOG_INTEGRATION_GUIDE.md) - General Datadog setup
- [MONITORING_BEST_PRACTICES.md](./MONITORING_BEST_PRACTICES.md) - Monitoring strategies
- [Datadog API Documentation](https://docs.datadoghq.com/api/) - API reference
- [Datadog Custom Metrics](https://docs.datadoghq.com/metrics/custom_metrics/) - Metrics guide

---

**Last Updated**: 2026-02-24
**Version**: VibeCode v3.2.1
