# API Reference - VibeCode Experimentation Platform

Complete API documentation for the experimentation platform.

**Version**: 1.0
**Last Updated**: October 24, 2025
**Base URL**: `https://your-domain.com/api`

---

## Table of Contents

1. [Authentication](#authentication)
2. [Warehouse API](#warehouse-api)
3. [Feature Flag API](#feature-flag-api)
4. [Experiment Management API](#experiment-management-api)
5. [Guardrails API](#guardrails-api)
6. [Analytics API](#analytics-api)
7. [Client SDKs](#client-sdks)
8. [Error Handling](#error-handling)
9. [Rate Limits](#rate-limits)
10. [Webhooks](#webhooks)

---

## Authentication

All API requests require authentication using Next-Auth session cookies or API keys.

### Session-Based Authentication

Used for browser-based requests:

```typescript
// Automatic with Next-Auth
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const session = await getServerSession(authOptions)
if (!session?.user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

### API Key Authentication

For server-side integrations:

```bash
curl -H "Authorization: Bearer sk-vibecode-..." \
  https://api.vibecode.com/experiments
```

### Permissions

| Role | Permissions |
|------|-------------|
| **Admin** | Full access to all experiments, create/update/delete |
| **Developer** | Read experiments, evaluate flags, track metrics |
| **Viewer** | Read-only access to experiments and results |

---

## Warehouse API

PostgreSQL-based assignment and metric logging.

### List All Experiments

```http
GET /api/experiments
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | string | No | Filter by status: `draft`, `running`, `completed`, `archived` |
| `page` | number | No | Page number (default: 1) |
| `limit` | number | No | Items per page (default: 20, max: 100) |

**Response:**

```json
{
  "success": true,
  "experiments": [
    {
      "id": "cuid123",
      "key": "ai_model_comparison",
      "name": "AI Model Comparison Experiment",
      "hypothesis": "Claude 3.5 provides better quality at lower cost",
      "status": "running",
      "config": {
        "variants": [
          {
            "key": "gpt4",
            "name": "GPT-4",
            "weight": 0.25
          },
          {
            "key": "claude",
            "name": "Claude 3.5 Sonnet",
            "weight": 0.25
          },
          {
            "key": "gemini",
            "name": "Gemini 1.5 Pro",
            "weight": 0.25
          },
          {
            "key": "llama",
            "name": "Llama 3.1 70B",
            "weight": 0.25
          }
        ],
        "metrics": [
          "response_quality",
          "latency_ms",
          "cost_per_request"
        ],
        "guardrails": [
          {
            "metric": "error_rate",
            "operator": "<",
            "threshold": 0.01
          }
        ]
      },
      "created_at": "2025-10-15T10:30:00Z",
      "updated_at": "2025-10-24T14:22:00Z",
      "started_at": "2025-10-15T11:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

### Get Experiment Details

```http
GET /api/experiments/{key}
```

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `key` | string | Yes | Experiment key (e.g., `ai_model_comparison`) |

**Response:**

```json
{
  "success": true,
  "experiment": {
    "id": "cuid123",
    "key": "ai_model_comparison",
    "name": "AI Model Comparison Experiment",
    "hypothesis": "Claude 3.5 provides better quality at lower cost",
    "status": "running",
    "config": { },
    "statistics": {
      "totalAssignments": 5234,
      "uniqueUsers": 4891,
      "variantDistribution": {
        "gpt4": 1308,
        "claude": 1297,
        "gemini": 1315,
        "llama": 1314
      },
      "sampleRatioCheck": {
        "isPassing": true,
        "chiSquare": 0.42,
        "pValue": 0.94
      }
    },
    "created_at": "2025-10-15T10:30:00Z",
    "updated_at": "2025-10-24T14:22:00Z",
    "started_at": "2025-10-15T11:00:00Z"
  }
}
```

### Create Experiment

```http
POST /api/experiments
```

**Request Body:**

```json
{
  "key": "button_color_test",
  "name": "Homepage CTA Button Color",
  "hypothesis": "Blue button increases conversions by 10%",
  "config": {
    "variants": [
      {
        "key": "control",
        "name": "Green Button",
        "weight": 0.5
      },
      {
        "key": "treatment",
        "name": "Blue Button",
        "weight": 0.5
      }
    ],
    "metrics": [
      {
        "name": "conversion_rate",
        "type": "binary",
        "target": "maximize"
      },
      {
        "name": "time_on_page",
        "type": "continuous",
        "target": "maximize"
      }
    ],
    "guardrails": [
      {
        "metric": "bounce_rate",
        "operator": "<",
        "threshold": 0.6,
        "severity": "warning"
      }
    ],
    "targetingRules": [
      {
        "attribute": "userTier",
        "operator": "in",
        "values": ["premium", "enterprise"]
      }
    ]
  },
  "sampleSize": 2000,
  "duration": "14 days"
}
```

**Response:**

```json
{
  "success": true,
  "experiment": {
    "id": "cuid456",
    "key": "button_color_test",
    "status": "draft",
    "created_at": "2025-10-24T15:00:00Z"
  },
  "message": "Experiment created successfully"
}
```

### Update Experiment

```http
PUT /api/experiments/{key}
```

**Request Body:** (partial update)

```json
{
  "status": "paused",
  "config": {
    "guardrails": [
      {
        "metric": "bounce_rate",
        "operator": "<",
        "threshold": 0.5,
        "severity": "critical"
      }
    ]
  }
}
```

**Response:**

```json
{
  "success": true,
  "message": "Experiment updated successfully"
}
```

### Delete Experiment

```http
DELETE /api/experiments/{key}
```

**Response:**

```json
{
  "success": true,
  "message": "Experiment deleted successfully"
}
```

---

## Feature Flag API

Evaluate feature flags and track metrics.

### Evaluate Flag

```http
POST /api/experiments
```

**Request Body:**

```json
{
  "action": "evaluate",
  "flagKey": "ai_assistant_v2",
  "context": {
    "userId": "user_123",
    "workspaceId": "ws_456",
    "customAttributes": {
      "userTier": "premium",
      "region": "us-east"
    }
  },
  "defaultValue": false
}
```

**Response:**

```json
{
  "success": true,
  "result": {
    "flagKey": "ai_assistant_v2",
    "variant": "enhanced",
    "isEnabled": true,
    "isExperiment": true,
    "reason": "experiment_allocation",
    "metadata": {
      "experimentId": "cuid123",
      "allocationPercentage": 0.5
    }
  }
}
```

### Evaluate Multiple Flags

```http
POST /api/experiments
```

**Request Body:**

```json
{
  "action": "evaluate_multiple",
  "flags": [
    {
      "key": "ai_assistant_v2",
      "defaultValue": false
    },
    {
      "key": "dark_theme_plus",
      "defaultValue": true
    }
  ],
  "context": {
    "userId": "user_123",
    "workspaceId": "ws_456"
  }
}
```

**Response:**

```json
{
  "success": true,
  "results": [
    {
      "flagKey": "ai_assistant_v2",
      "variant": "enhanced",
      "isEnabled": true,
      "isExperiment": true
    },
    {
      "flagKey": "dark_theme_plus",
      "variant": "enabled",
      "isEnabled": true,
      "isExperiment": false
    }
  ]
}
```

### Track Metric

```http
POST /api/experiments
```

**Request Body:**

```json
{
  "action": "track",
  "flagKey": "ai_assistant_v2",
  "metricName": "code_completion",
  "value": 1.0,
  "context": {
    "userId": "user_123",
    "workspaceId": "ws_456",
    "customAttributes": {
      "language": "typescript",
      "completionLength": 42
    }
  }
}
```

**Response:**

```json
{
  "success": true,
  "message": "Metric tracked successfully"
}
```

---

## Experiment Management API

Control experiment lifecycle.

### Start Experiment

```http
POST /api/experiments/{key}/start
```

**Response:**

```json
{
  "success": true,
  "message": "Experiment started successfully",
  "started_at": "2025-10-24T15:30:00Z"
}
```

**Requirements:**
- Experiment must be in `draft` status
- Must have at least 2 variants
- Must have at least 1 metric defined
- Admin permissions required

### Stop Experiment

```http
POST /api/experiments/{key}/stop
```

**Request Body:** (optional)

```json
{
  "reason": "Statistical significance achieved",
  "winningVariant": "treatment"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Experiment stopped successfully",
  "stopped_at": "2025-10-24T15:45:00Z",
  "status": "completed"
}
```

### Get Experiment Results

```http
GET /api/experiments?action=results&flagKey={key}
```

**Response:**

```json
{
  "success": true,
  "experiment": {
    "key": "button_color_test",
    "name": "Homepage CTA Button Color",
    "status": "running"
  },
  "variantDistribution": {
    "control": 1012,
    "treatment": 988
  },
  "metrics": {
    "conversion_rate": {
      "control": {
        "count": 1012,
        "mean": 0.142,
        "median": 0.0,
        "stdDev": 0.349,
        "p95": 1.0,
        "p99": 1.0
      },
      "treatment": {
        "count": 988,
        "mean": 0.158,
        "median": 0.0,
        "stdDev": 0.365,
        "p95": 1.0,
        "p99": 1.0
      },
      "analysis": {
        "lift": 0.016,
        "liftPercent": 11.27,
        "confidenceInterval": [0.002, 0.030],
        "pValue": 0.023,
        "isSignificant": true,
        "effectSize": 0.22,
        "powerAnalysis": {
          "observedPower": 0.87,
          "minSampleSize": 1842
        }
      }
    }
  },
  "sampleRatioCheck": {
    "isPassing": true,
    "chiSquare": 0.72,
    "pValue": 0.40,
    "expected": {
      "control": 1000,
      "treatment": 1000
    },
    "observed": {
      "control": 1012,
      "treatment": 988
    }
  }
}
```

---

## Guardrails API

Monitor and evaluate safety constraints.

### Get Guardrail Status

```http
GET /api/experiments/{key}/guardrails
```

**Response:**

```json
{
  "success": true,
  "experiment": "ai_model_comparison",
  "guardrails": [
    {
      "metric": "error_rate",
      "operator": "<",
      "threshold": 0.01,
      "severity": "critical",
      "status": "passing",
      "currentValue": 0.003,
      "variants": {
        "gpt4": {
          "value": 0.002,
          "status": "passing"
        },
        "claude": {
          "value": 0.003,
          "status": "passing"
        },
        "gemini": {
          "value": 0.004,
          "status": "passing"
        },
        "llama": {
          "value": 0.005,
          "status": "passing"
        }
      }
    },
    {
      "metric": "p95_latency_ms",
      "operator": "<",
      "threshold": 5000,
      "severity": "warning",
      "status": "warning",
      "currentValue": 4823,
      "variants": {
        "gpt4": {
          "value": 3234,
          "status": "passing"
        },
        "claude": {
          "value": 2891,
          "status": "passing"
        },
        "gemini": {
          "value": 4823,
          "status": "warning"
        },
        "llama": {
          "value": 2654,
          "status": "passing"
        }
      }
    }
  ],
  "hasViolations": false,
  "lastChecked": "2025-10-24T15:50:00Z"
}
```

### Check Guardrails

```http
POST /api/experiments/{key}/guardrails/check
```

Forces an immediate guardrail evaluation.

**Response:**

```json
{
  "success": true,
  "evaluation": {
    "hasViolations": false,
    "criticalViolations": [],
    "warnings": [
      {
        "metric": "p95_latency_ms",
        "variant": "gemini",
        "threshold": 5000,
        "currentValue": 4823,
        "severity": "warning"
      }
    ],
    "checkedAt": "2025-10-24T15:55:00Z"
  }
}
```

### Reset Guardrails

```http
POST /api/experiments/{key}/guardrails/reset
```

Clears guardrail violation history.

**Response:**

```json
{
  "success": true,
  "message": "Guardrails reset successfully"
}
```

---

## Analytics API

Query experiment data and generate insights.

### Get Time Series Data

```http
GET /api/experiments/{key}/timeseries
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `metric` | string | Yes | Metric name (e.g., `conversion_rate`) |
| `interval` | string | No | Aggregation interval: `hour`, `day`, `week` (default: `day`) |
| `start` | string | No | Start date (ISO 8601) |
| `end` | string | No | End date (ISO 8601) |

**Response:**

```json
{
  "success": true,
  "metric": "conversion_rate",
  "interval": "day",
  "timeSeries": [
    {
      "date": "2025-10-15",
      "control": {
        "count": 142,
        "mean": 0.141,
        "stdDev": 0.348
      },
      "treatment": {
        "count": 138,
        "mean": 0.152,
        "stdDev": 0.359
      }
    },
    {
      "date": "2025-10-16",
      "control": {
        "count": 156,
        "mean": 0.144,
        "stdDev": 0.351
      },
      "treatment": {
        "count": 151,
        "mean": 0.159,
        "stdDev": 0.366
      }
    }
  ]
}
```

### Get Retention Analysis

```http
GET /api/experiments/{key}/retention
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `activityMetric` | string | Yes | Metric indicating user activity |
| `cohortInterval` | string | No | Cohort grouping: `day`, `week` (default: `week`) |

**Response:**

```json
{
  "success": true,
  "cohorts": [
    {
      "cohortDate": "2025-10-15",
      "variant": "control",
      "users": 142,
      "retention": {
        "day0": 142,
        "day1": 104,
        "day7": 78,
        "day14": 62,
        "day30": 51
      }
    },
    {
      "cohortDate": "2025-10-15",
      "variant": "treatment",
      "users": 138,
      "retention": {
        "day0": 138,
        "day1": 109,
        "day7": 89,
        "day14": 74,
        "day30": 63
      }
    }
  ]
}
```

### Export Experiment Data

```http
GET /api/experiments/{key}/export
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `format` | string | No | Export format: `json`, `csv`, `parquet` (default: `json`) |
| `includeRawData` | boolean | No | Include raw assignments and metrics (default: `false`) |

**Response:**

Returns a downloadable file with experiment data.

For CSV:
```csv
variant,user_id,metric_name,value,timestamp
control,user_123,conversion_rate,1.0,2025-10-15T10:30:00Z
control,user_123,time_on_page,234.5,2025-10-15T10:30:00Z
treatment,user_456,conversion_rate,0.0,2025-10-15T10:31:00Z
...
```

---

## Client SDKs

### TypeScript/JavaScript

```typescript
import { VibeCodeExperiments } from '@vibecode/experiments-sdk'

const client = new VibeCodeExperiments({
  apiKey: 'sk-vibecode-...',
  baseUrl: 'https://api.vibecode.com'
})

// Evaluate flag
const variant = await client.evaluateFlag('ai_assistant_v2', {
  userId: 'user_123',
  workspaceId: 'ws_456'
})

console.log(variant.variant) // 'enhanced'

// Track metric
await client.trackMetric('ai_assistant_v2', 'code_completion', 1.0, {
  userId: 'user_123'
})
```

### React Hooks

```typescript
import { useFeatureFlag, useExperiment } from '@vibecode/experiments-react'

function MyComponent() {
  // Simple flag evaluation
  const { variant, isLoading } = useFeatureFlag('ai_assistant_v2')

  // Full experiment with metrics
  const { variant, trackMetric } = useExperiment('button_color_test')

  const handleClick = () => {
    trackMetric('conversion_rate', 1.0)
  }

  if (isLoading) return <Spinner />

  return (
    <button
      className={variant === 'treatment' ? 'blue' : 'green'}
      onClick={handleClick}
    >
      Sign Up
    </button>
  )
}
```

### Server-Side Usage

```typescript
import { experimentWarehouse } from '@/lib/experiments'

// In Next.js API route
export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id')

  // Evaluate and log assignment
  const variant = await experimentWarehouse.getOrAssignVariant(
    'ai_model_comparison',
    userId,
    { region: 'us-east' }
  )

  // Run AI request
  const response = await runAIRequest(variant)

  // Track metrics
  await experimentWarehouse.logMetric(
    'ai_model_comparison',
    userId,
    'latency_ms',
    response.latency
  )

  return NextResponse.json({ result: response.data })
}
```

---

## Error Handling

All errors follow a consistent format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "Additional context"
  }
}
```

### HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request succeeded |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Invalid request parameters |
| 401 | Unauthorized | Authentication required |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error occurred |

### Error Codes

| Code | Description | Resolution |
|------|-------------|------------|
| `INVALID_FLAG_KEY` | Flag key is invalid or missing | Provide valid flag key |
| `EXPERIMENT_NOT_FOUND` | Experiment does not exist | Check experiment key |
| `INVALID_VARIANT` | Variant key not defined in config | Use valid variant key |
| `DUPLICATE_EXPERIMENT` | Experiment with key already exists | Use unique key |
| `INSUFFICIENT_DATA` | Not enough data for analysis | Wait for more assignments |
| `SRM_DETECTED` | Sample ratio mismatch detected | Investigate randomization |
| `GUARDRAIL_VIOLATION` | Guardrail threshold exceeded | Review experiment safety |

### Example Error Response

```json
{
  "error": "Sample ratio mismatch detected",
  "code": "SRM_DETECTED",
  "details": {
    "experiment": "button_color_test",
    "expected": {
      "control": 0.5,
      "treatment": 0.5
    },
    "observed": {
      "control": 0.62,
      "treatment": 0.38
    },
    "chiSquare": 57.6,
    "pValue": 0.000001
  }
}
```

---

## Rate Limits

| Tier | Requests/Minute | Requests/Hour | Notes |
|------|-----------------|---------------|-------|
| **Free** | 60 | 1,000 | Suitable for development |
| **Pro** | 600 | 10,000 | Recommended for production |
| **Enterprise** | Unlimited | Unlimited | Custom limits available |

### Rate Limit Headers

All responses include rate limit information:

```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 42
X-RateLimit-Reset: 1698156000
```

### Handling Rate Limits

```typescript
const response = await fetch('/api/experiments', {
  method: 'POST',
  body: JSON.stringify(data)
})

if (response.status === 429) {
  const resetTime = response.headers.get('X-RateLimit-Reset')
  const waitSeconds = parseInt(resetTime) - Math.floor(Date.now() / 1000)

  console.log(`Rate limited. Retry after ${waitSeconds} seconds`)

  // Exponential backoff
  await sleep(waitSeconds * 1000)
  return retry()
}
```

---

## Webhooks

Receive real-time notifications for experiment events.

### Configure Webhook

```http
POST /api/webhooks
```

**Request Body:**

```json
{
  "url": "https://your-domain.com/webhooks/experiments",
  "events": [
    "experiment.started",
    "experiment.completed",
    "experiment.winner_detected",
    "guardrail.violation"
  ],
  "secret": "whsec_..."
}
```

### Webhook Events

#### experiment.started

```json
{
  "event": "experiment.started",
  "timestamp": "2025-10-24T15:30:00Z",
  "data": {
    "experiment": {
      "key": "button_color_test",
      "name": "Homepage CTA Button Color",
      "variants": ["control", "treatment"]
    }
  }
}
```

#### experiment.completed

```json
{
  "event": "experiment.completed",
  "timestamp": "2025-10-30T10:00:00Z",
  "data": {
    "experiment": {
      "key": "button_color_test"
    },
    "result": {
      "winner": "treatment",
      "lift": 0.112,
      "pValue": 0.001,
      "totalAssignments": 2543
    }
  }
}
```

#### guardrail.violation

```json
{
  "event": "guardrail.violation",
  "timestamp": "2025-10-25T14:22:00Z",
  "data": {
    "experiment": {
      "key": "ai_model_comparison"
    },
    "guardrail": {
      "metric": "error_rate",
      "threshold": 0.01,
      "currentValue": 0.023,
      "variant": "llama",
      "severity": "critical"
    },
    "action": "experiment_paused"
  }
}
```

### Verify Webhook Signatures

```typescript
import crypto from 'crypto'

function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
}

// In your webhook handler
export async function POST(request: NextRequest) {
  const payload = await request.text()
  const signature = request.headers.get('x-webhook-signature')

  if (!verifyWebhookSignature(payload, signature, process.env.WEBHOOK_SECRET)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const event = JSON.parse(payload)
  // Process event...
}
```

---

## Best Practices

### 1. Batch Metric Tracking

Instead of tracking metrics one at a time:

```typescript
// Bad - Multiple requests
await trackMetric('conversion_rate', 1.0)
await trackMetric('time_on_page', 234.5)
await trackMetric('satisfaction', 4.5)

// Good - Batch tracking
await trackMetricsBatch([
  { name: 'conversion_rate', value: 1.0 },
  { name: 'time_on_page', value: 234.5 },
  { name: 'satisfaction', value: 4.5 }
])
```

### 2. Cache Flag Evaluations

For high-traffic applications:

```typescript
import { cacheFlag } from '@vibecode/experiments-sdk'

const variant = await cacheFlag('ai_assistant_v2', userId, {
  ttl: 300000 // 5 minutes
})
```

### 3. Error Handling

Always handle errors gracefully:

```typescript
try {
  const variant = await evaluateFlag('new_feature', context)
} catch (error) {
  // Fall back to default variant
  const variant = 'control'
  logger.error('Flag evaluation failed', { error })
}
```

### 4. Use TypeScript Types

Leverage full type safety:

```typescript
import type {
  ExperimentConfig,
  VariantResult,
  MetricValue
} from '@vibecode/experiments-sdk'

const config: ExperimentConfig = {
  variants: [
    { key: 'control', weight: 0.5 },
    { key: 'treatment', weight: 0.5 }
  ]
}
```

---

**Version**: 1.0.0
**Last Updated**: October 24, 2025
**Support**: https://vibecode.com/support
