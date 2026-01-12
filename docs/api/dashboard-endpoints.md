# Dashboard API Documentation

**Version:** 1.0.0  
**Created by:** AGENT 92 - Enhanced Monitoring Dashboards Foundation  
**Date:** 2026-01-11

## Overview

The Dashboard API provides endpoints for monitoring system health, performance metrics, and deployment status. These APIs form the foundation for the Enhanced Monitoring Dashboards feature.

## Base URL

All endpoints are relative to: `/api/dashboard`

## Authentication

Currently, these endpoints are accessible without authentication. In production, implement proper authentication middleware based on your security requirements.

---

## Endpoints

### 1. GET /api/dashboard/overview

Returns a comprehensive overview of system health and performance.

#### Request

```http
GET /api/dashboard/overview HTTP/1.1
Host: your-domain.com
```

#### Response

**Status Code:** `200 OK`

```json
{
  "timestamp": "2026-01-11T12:00:00.000Z",
  "health": {
    "database": "healthy",
    "cache": "healthy",
    "ai": "healthy",
    "overall": "healthy"
  },
  "performance": {
    "avgResponseTime": 120,
    "requestsPerMinute": 50
  },
  "system": {
    "uptime": 86400,
    "uptimeFormatted": "1d 0h 0m",
    "memory": {
      "used": 512,
      "total": 1024,
      "percentage": 50
    }
  }
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string (ISO 8601) | Time of the snapshot |
| `health.database` | string | Database health status: `healthy`, `warning`, or `error` |
| `health.cache` | string | Cache (Valkey) health status |
| `health.ai` | string | AI service health status |
| `health.overall` | string | Overall system health status |
| `performance.avgResponseTime` | number | Average API response time in milliseconds |
| `performance.requestsPerMinute` | number | Current requests per minute |
| `system.uptime` | number | System uptime in seconds |
| `system.uptimeFormatted` | string | Human-readable uptime (e.g., "1d 5h 30m") |
| `system.memory.used` | number | Used memory in MB |
| `system.memory.total` | number | Total memory in MB |
| `system.memory.percentage` | number | Memory usage percentage (0-100) |

#### Error Responses

**Status Code:** `500 Internal Server Error`

```json
{
  "error": "Failed to fetch dashboard overview",
  "message": "Database connection failed",
  "timestamp": "2026-01-11T12:00:00.000Z"
}
```

---

### 2. GET /api/dashboard/performance

Returns performance metrics over a configurable time range.

#### Request

```http
GET /api/dashboard/performance?range=1h HTTP/1.1
Host: your-domain.com
```

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `range` | string | No | `1h` | Time range: `1h`, `6h`, `24h`, or `7d` |

#### Response

**Status Code:** `200 OK`

```json
{
  "timeRange": "1h",
  "timestamp": "2026-01-11T12:00:00.000Z",
  "metrics": {
    "requests": 3000,
    "avgLatency": 150,
    "errorRate": 0.5,
    "p95Latency": 375,
    "p99Latency": 600
  },
  "dataPoints": [
    {
      "timestamp": "2026-01-11T11:55:00.000Z",
      "latency": 145,
      "requests": 52
    },
    {
      "timestamp": "2026-01-11T12:00:00.000Z",
      "latency": 132,
      "requests": 48
    }
  ]
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `timeRange` | string | Requested time range |
| `timestamp` | string (ISO 8601) | Time of the snapshot |
| `metrics.requests` | number | Total requests in time range |
| `metrics.avgLatency` | number | Average latency in milliseconds |
| `metrics.errorRate` | number | Error rate percentage (0-100) |
| `metrics.p95Latency` | number | 95th percentile latency in ms |
| `metrics.p99Latency` | number | 99th percentile latency in ms |
| `dataPoints` | array | Time series data for visualization |
| `dataPoints[].timestamp` | string | Data point timestamp |
| `dataPoints[].latency` | number | Latency at this point (ms) |
| `dataPoints[].requests` | number | Request count at this point |

#### Error Responses

**Status Code:** `400 Bad Request`

```json
{
  "error": "Invalid time range",
  "message": "Valid ranges are: 1h, 6h, 24h, 7d",
  "timestamp": "2026-01-11T12:00:00.000Z"
}
```

**Status Code:** `500 Internal Server Error`

```json
{
  "error": "Failed to fetch performance metrics",
  "message": "Performance monitoring unavailable",
  "timestamp": "2026-01-11T12:00:00.000Z"
}
```

---

### 3. GET /api/dashboard/status

Returns system status, version, and deployment information.

#### Request

```http
GET /api/dashboard/status HTTP/1.1
Host: your-domain.com
```

#### Response

**Status Code:** `200 OK`

```json
{
  "timestamp": "2026-01-11T12:00:00.000Z",
  "version": {
    "app": "1.0.0",
    "node": "v20.10.0",
    "platform": "linux"
  },
  "environment": "production",
  "deployment": {
    "platform": "Vercel",
    "region": "us-east-1"
  },
  "resources": {
    "memory": {
      "rss": 145,
      "heapTotal": 89,
      "heapUsed": 67,
      "external": 12,
      "arrayBuffers": 3
    },
    "cpu": {
      "count": 4,
      "loadAverage": [0.52, 0.48, 0.45],
      "model": "Intel(R) Xeon(R) CPU @ 2.80GHz"
    },
    "uptime": 86400
  }
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string (ISO 8601) | Time of the snapshot |
| `version.app` | string | Application version |
| `version.node` | string | Node.js version |
| `version.platform` | string | Operating system platform |
| `environment` | string | Deployment environment (development, production, etc.) |
| `deployment.platform` | string | Deployment platform (Vercel, AWS, Kubernetes, etc.) |
| `deployment.region` | string | Deployment region |
| `resources.memory.*` | number | Memory usage in MB |
| `resources.cpu.count` | number | Number of CPU cores |
| `resources.cpu.loadAverage` | array | 1, 5, 15 minute load averages |
| `resources.cpu.model` | string | CPU model name |
| `resources.uptime` | number | Process uptime in seconds |

#### Error Responses

**Status Code:** `500 Internal Server Error`

```json
{
  "error": "Failed to fetch system status",
  "message": "Resource information unavailable",
  "timestamp": "2026-01-11T12:00:00.000Z"
}
```

---

## Usage Examples

### JavaScript/TypeScript (Fetch API)

```typescript
// Get dashboard overview
async function getDashboardOverview() {
  const response = await fetch('/api/dashboard/overview')
  if (!response.ok) {
    throw new Error('Failed to fetch dashboard overview')
  }
  return await response.json()
}

// Get performance metrics for last 24 hours
async function getPerformanceMetrics() {
  const response = await fetch('/api/dashboard/performance?range=24h')
  if (!response.ok) {
    throw new Error('Failed to fetch performance metrics')
  }
  return await response.json()
}

// Get system status
async function getSystemStatus() {
  const response = await fetch('/api/dashboard/status')
  if (!response.ok) {
    throw new Error('Failed to fetch system status')
  }
  return await response.json()
}
```

### cURL

```bash
# Get dashboard overview
curl http://localhost:3000/api/dashboard/overview

# Get performance metrics for last 7 days
curl "http://localhost:3000/api/dashboard/performance?range=7d"

# Get system status
curl http://localhost:3000/api/dashboard/status
```

---

## Rate Limiting

Currently, no rate limiting is implemented. For production deployments, consider implementing:

- Rate limiting per IP address
- Authentication-based rate limiting
- Caching with appropriate TTL values

---

## Monitoring Best Practices

1. **Polling Frequency:** Poll the overview endpoint every 30-60 seconds for real-time updates
2. **Caching:** The API routes use internal caching where appropriate
3. **Error Handling:** Always implement error handling for API failures
4. **Health Checks:** Use the `/health` overall status for automated health checks

---

## Future Enhancements

Planned features for v2.0:

- WebSocket support for real-time streaming updates
- Historical data aggregation endpoints
- Custom metric queries
- Alert configuration endpoints
- User-specific dashboard preferences
- Export functionality (JSON, CSV)

---

## Support

For issues or questions:
- Check the implementation tests in `tests/unit/api/dashboard/`
- Review the demo page at `/dashboard/demo`
- Consult the main monitoring documentation

**Created by:** AGENT 92  
**Project:** VibeCode WebGUI Enhanced Monitoring Dashboards  
**License:** MIT
