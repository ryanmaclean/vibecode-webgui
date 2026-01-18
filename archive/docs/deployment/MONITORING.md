# Production Monitoring Guide

Comprehensive observability and monitoring configuration for VibeCode production environments.

## Monitoring Stack Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Monitoring Architecture                   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  Application │───▶│    Datadog   │───▶│  Dashboards  │  │
│  │     Logs     │    │    Agent     │    │   & Alerts   │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│                             │                                │
│  ┌──────────────┐           │            ┌──────────────┐  │
│  │  APM Traces  │───────────┤            │   Datadog    │  │
│  │   & Spans    │           ├───────────▶│   Platform   │  │
│  └──────────────┘           │            └──────────────┘  │
│                             │                                │
│  ┌──────────────┐           │            ┌──────────────┐  │
│  │   Database   │───────────┤            │   Runbooks   │  │
│  │  Monitoring  │           │            │  & Playbooks │  │
│  └──────────────┘           │            └──────────────┘  │
│                             │                                │
│  ┌──────────────┐    ┌──────────────┐                       │
│  │ Infrastructure│───▶│   Metrics    │                       │
│  │    Metrics   │    │  Collection  │                       │
│  └──────────────┘    └──────────────┘                       │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Datadog Configuration

### Agent Installation

#### Kubernetes

```yaml
# datadog-values.yaml
datadog:
  apiKey: ${DD_API_KEY}
  appKey: ${DD_APP_KEY}
  site: datadoghq.com

  logs:
    enabled: true
    containerCollectAll: true

  apm:
    portEnabled: true
    socketEnabled: true

  processAgent:
    enabled: true
    processCollection: true

  systemProbe:
    enabled: true

  networkMonitoring:
    enabled: true

  securityAgent:
    compliance:
      enabled: true
    runtime:
      enabled: true

  clusterAgent:
    enabled: true
    metricsProvider:
      enabled: true

  tags:
    - env:production
    - service:vibecode
    - version:1.0.0

  confd:
    postgres.yaml: |-
      ad_identifiers:
        - postgres
      init_config:
      instances:
        - host: "%%host%%"
          port: 5432
          username: datadog
          password: "%%env_DD_POSTGRES_PASSWORD%%"
          dbname: vibecode
          dbm: true
          query_metrics:
            enabled: true
          query_samples:
            enabled: true
          tags:
            - env:production
            - service:vibecode-database

agents:
  image:
    repository: datadog/docker-dd-agent
    tag: latest-alpine
    pullPolicy: IfNotPresent

  useHostNetwork: true

  resources:
    requests:
      cpu: 200m
      memory: 256Mi
    limits:
      cpu: 500m
      memory: 512Mi

clusterAgent:
  image:
    repository: gcr.io/datadoghq/cluster-agent
    tag: 7

  resources:
    requests:
      cpu: 100m
      memory: 128Mi
    limits:
      cpu: 200m
      memory: 256Mi
```

```bash
# Install Datadog using Helm
helm repo add datadog https://helm.datadoghq.com
helm repo update

helm install datadog-agent datadog/datadog \
  --namespace monitoring \
  --create-namespace \
  -f datadog-values.yaml
```

#### Docker

```yaml
# docker-compose.monitoring.yml
version: '3.8'

services:
  datadog-agent:
    image: datadog/docker-dd-agent:latest-alpine
    container_name: datadog-agent
    restart: unless-stopped

    environment:
      DD_API_KEY: ${DD_API_KEY}
      DD_SITE: ${DD_SITE}
      DD_HOSTNAME: ${DD_HOSTNAME}
      DD_TAGS: "env:production service:vibecode"

      # APM
      DD_APM_ENABLED: "true"
      DD_APM_NON_LOCAL_TRAFFIC: "true"
      DD_APM_RECEIVER_PORT: 8126

      # Logs
      DD_LOGS_ENABLED: "true"
      DD_LOGS_CONFIG_CONTAINER_COLLECT_ALL: "true"
      DD_LOGS_CONFIG_AUTO_MULTI_LINE_DETECTION: "true"

      # Database Monitoring
      DD_DBM_ENABLED: "true"

      # Process Monitoring
      DD_PROCESS_AGENT_ENABLED: "true"
      DD_SYSTEM_PROBE_ENABLED: "true"

      # Container Monitoring
      DD_CONTAINER_INCLUDE: "name:vibecode-.*"
      DD_CONTAINER_EXCLUDE: "name:datadog-agent"

    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - /proc/:/host/proc/:ro
      - /sys/fs/cgroup/:/host/sys/fs/cgroup:ro
      - /etc/passwd:/etc/passwd:ro
      - ./datadog/conf.d:/conf.d:ro

    ports:
      - "8126:8126/tcp"  # APM
      - "8125:8125/udp"  # StatsD

    networks:
      - monitoring

    cap_add:
      - SYS_ADMIN
      - SYS_RESOURCE
      - SYS_PTRACE
      - NET_ADMIN
      - NET_BROADCAST
      - NET_RAW
      - IPC_LOCK

    security_opt:
      - apparmor:unconfined

networks:
  monitoring:
    external: true
```

### Application Instrumentation

#### Node.js / Next.js

```typescript
// lib/datadog.ts
import tracer from 'dd-trace';

// Initialize tracer
if (process.env.NODE_ENV === 'production') {
  tracer.init({
    service: process.env.DD_SERVICE || 'vibecode-webgui',
    env: process.env.DD_ENV || 'production',
    version: process.env.DD_VERSION || '1.0.0',

    // APM
    logInjection: true,
    runtimeMetrics: true,
    profiling: true,

    // Sampling
    sampleRate: 1.0,  // 100% in production

    // Tags
    tags: {
      'team': 'platform',
      'component': 'webgui',
    },
  });
}

export default tracer;
```

```typescript
// pages/api/[...route].ts
import tracer from '@/lib/datadog';

export default async function handler(req, res) {
  const span = tracer.scope().active();

  if (span) {
    // Add custom tags
    span.setTag('user.id', req.user?.id);
    span.setTag('http.route', req.url);

    // Add custom metrics
    span.setTag('business.metric', calculateMetric());
  }

  try {
    // Your API logic here
    const result = await processRequest(req);

    res.status(200).json(result);
  } catch (error) {
    // Automatically tracked by Datadog
    span?.setTag('error', true);
    span?.setTag('error.message', error.message);

    res.status(500).json({ error: 'Internal server error' });
  }
}
```

#### Custom Metrics

```typescript
// lib/metrics.ts
import { StatsD } from 'hot-shots';

const statsd = new StatsD({
  host: process.env.DD_AGENT_HOST || 'localhost',
  port: 8125,
  prefix: 'vibecode.',
  globalTags: {
    env: process.env.DD_ENV,
    service: process.env.DD_SERVICE,
  },
});

export const metrics = {
  // Counter: Increments a metric
  increment: (metric: string, value = 1, tags?: Record<string, string>) => {
    statsd.increment(metric, value, Object.entries(tags || {}).map(([k, v]) => `${k}:${v}`));
  },

  // Gauge: Sets a value
  gauge: (metric: string, value: number, tags?: Record<string, string>) => {
    statsd.gauge(metric, value, Object.entries(tags || {}).map(([k, v]) => `${k}:${v}`));
  },

  // Histogram: Distribution of values
  histogram: (metric: string, value: number, tags?: Record<string, string>) => {
    statsd.histogram(metric, value, Object.entries(tags || {}).map(([k, v]) => `${k}:${v}`));
  },

  // Timing: Execution time
  timing: (metric: string, value: number, tags?: Record<string, string>) => {
    statsd.timing(metric, value, Object.entries(tags || {}).map(([k, v]) => `${k}:${v}`));
  },
};

// Usage examples
export const trackRequest = (endpoint: string, duration: number, statusCode: number) => {
  metrics.increment('api.requests', 1, { endpoint, status: statusCode.toString() });
  metrics.timing('api.duration', duration, { endpoint });
};

export const trackAIRequest = (provider: string, model: string, tokens: number, duration: number) => {
  metrics.increment('ai.requests', 1, { provider, model });
  metrics.histogram('ai.tokens', tokens, { provider, model });
  metrics.timing('ai.duration', duration, { provider, model });
};

export const trackDatabaseQuery = (operation: string, table: string, duration: number) => {
  metrics.increment('db.queries', 1, { operation, table });
  metrics.timing('db.query_duration', duration, { operation, table });
};
```

## Database Monitoring

### PostgreSQL Configuration

```sql
-- Create monitoring user
CREATE USER datadog WITH PASSWORD 'secure-password';

-- Grant necessary permissions
GRANT pg_monitor TO datadog;
GRANT SELECT ON pg_stat_database TO datadog;
GRANT SELECT ON pg_stat_activity TO datadog;

-- Create monitoring functions
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

CREATE OR REPLACE FUNCTION datadog_monitoring_health()
RETURNS TABLE (
  metric TEXT,
  value NUMERIC,
  tags JSONB
) AS $$
BEGIN
  -- Active connections
  RETURN QUERY
  SELECT
    'postgresql.connections.active'::TEXT,
    COUNT(*)::NUMERIC,
    jsonb_build_object('state', state)
  FROM pg_stat_activity
  WHERE state != 'idle'
  GROUP BY state;

  -- Database size
  RETURN QUERY
  SELECT
    'postgresql.database.size'::TEXT,
    pg_database_size(datname)::NUMERIC,
    jsonb_build_object('database', datname)
  FROM pg_database
  WHERE datname = current_database();

  -- Table sizes
  RETURN QUERY
  SELECT
    'postgresql.table.size'::TEXT,
    pg_total_relation_size(schemaname || '.' || tablename)::NUMERIC,
    jsonb_build_object('table', tablename)
  FROM pg_tables
  WHERE schemaname = 'public';

  -- Slow queries
  RETURN QUERY
  SELECT
    'postgresql.slow_queries'::TEXT,
    COUNT(*)::NUMERIC,
    jsonb_build_object('threshold_ms', '1000')
  FROM pg_stat_statements
  WHERE mean_exec_time > 1000;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to monitoring user
GRANT EXECUTE ON FUNCTION datadog_monitoring_health() TO datadog;
```

### Database Monitoring Dashboard

```json
{
  "title": "VibeCode PostgreSQL Performance",
  "description": "PostgreSQL database performance metrics",
  "widgets": [
    {
      "definition": {
        "title": "Active Connections",
        "type": "timeseries",
        "requests": [
          {
            "q": "sum:postgresql.connections.active{service:vibecode-database}",
            "display_type": "line"
          }
        ]
      }
    },
    {
      "definition": {
        "title": "Query Performance (p95)",
        "type": "timeseries",
        "requests": [
          {
            "q": "p95:postgresql.query.duration{service:vibecode-database} by {query_signature}",
            "display_type": "line"
          }
        ]
      }
    },
    {
      "definition": {
        "title": "Slow Queries (>1s)",
        "type": "query_table",
        "requests": [
          {
            "q": "avg:postgresql.queries.slow{service:vibecode-database} by {query_signature}",
            "aggregator": "avg"
          }
        ]
      }
    },
    {
      "definition": {
        "title": "Cache Hit Ratio",
        "type": "query_value",
        "requests": [
          {
            "q": "(sum:postgresql.buffer.cache_hit{service:vibecode-database} / (sum:postgresql.buffer.cache_hit{service:vibecode-database} + sum:postgresql.buffer.cache_miss{service:vibecode-database})) * 100",
            "aggregator": "avg"
          }
        ],
        "precision": 2
      }
    },
    {
      "definition": {
        "title": "Transaction Throughput",
        "type": "timeseries",
        "requests": [
          {
            "q": "sum:postgresql.commits{service:vibecode-database}.as_rate()",
            "display_type": "bars"
          }
        ]
      }
    },
    {
      "definition": {
        "title": "Database Size Growth",
        "type": "timeseries",
        "requests": [
          {
            "q": "avg:postgresql.database.size{service:vibecode-database}",
            "display_type": "line"
          }
        ]
      }
    }
  ],
  "layout_type": "ordered"
}
```

## Application Performance Monitoring (APM)

### Key Metrics Dashboard

```json
{
  "title": "VibeCode Application Performance",
  "description": "Application-level performance metrics",
  "widgets": [
    {
      "definition": {
        "title": "Request Rate",
        "type": "timeseries",
        "requests": [
          {
            "q": "sum:trace.http.request.hits{service:vibecode-webgui}.as_rate()",
            "display_type": "bars"
          }
        ]
      }
    },
    {
      "definition": {
        "title": "Latency (p50, p95, p99)",
        "type": "timeseries",
        "requests": [
          {
            "q": "p50:trace.http.request.duration{service:vibecode-webgui}",
            "display_type": "line",
            "style": {
              "palette": "dog_classic",
              "line_type": "solid"
            }
          },
          {
            "q": "p95:trace.http.request.duration{service:vibecode-webgui}",
            "display_type": "line"
          },
          {
            "q": "p99:trace.http.request.duration{service:vibecode-webgui}",
            "display_type": "line"
          }
        ]
      }
    },
    {
      "definition": {
        "title": "Error Rate",
        "type": "timeseries",
        "requests": [
          {
            "q": "(sum:trace.http.request.errors{service:vibecode-webgui}.as_rate() / sum:trace.http.request.hits{service:vibecode-webgui}.as_rate()) * 100",
            "display_type": "line"
          }
        ]
      }
    },
    {
      "definition": {
        "title": "Apdex Score",
        "type": "query_value",
        "requests": [
          {
            "q": "avg:trace.http.request.apdex{service:vibecode-webgui}",
            "aggregator": "avg"
          }
        ],
        "precision": 2
      }
    },
    {
      "definition": {
        "title": "Top Endpoints by Latency",
        "type": "toplist",
        "requests": [
          {
            "q": "top(avg:trace.http.request.duration{service:vibecode-webgui} by {resource_name}, 10, 'mean', 'desc')"
          }
        ]
      }
    },
    {
      "definition": {
        "title": "Memory Usage",
        "type": "timeseries",
        "requests": [
          {
            "q": "avg:runtime.nodejs.mem.rss{service:vibecode-webgui}",
            "display_type": "line"
          }
        ]
      }
    }
  ]
}
```

### AI Gateway Monitoring

```json
{
  "title": "VibeCode AI Gateway Observability",
  "description": "AI service performance and usage metrics",
  "widgets": [
    {
      "definition": {
        "title": "AI Requests by Provider",
        "type": "timeseries",
        "requests": [
          {
            "q": "sum:vibecode.ai.requests{*} by {provider}.as_rate()",
            "display_type": "bars"
          }
        ]
      }
    },
    {
      "definition": {
        "title": "AI Response Time (p95)",
        "type": "timeseries",
        "requests": [
          {
            "q": "p95:vibecode.ai.duration{*} by {provider,model}",
            "display_type": "line"
          }
        ]
      }
    },
    {
      "definition": {
        "title": "Token Usage",
        "type": "timeseries",
        "requests": [
          {
            "q": "sum:vibecode.ai.tokens{*} by {provider,model}",
            "display_type": "area"
          }
        ]
      }
    },
    {
      "definition": {
        "title": "AI Error Rate",
        "type": "timeseries",
        "requests": [
          {
            "q": "sum:vibecode.ai.errors{*} by {provider,error_type}.as_rate()",
            "display_type": "bars"
          }
        ]
      }
    },
    {
      "definition": {
        "title": "Cost per Provider (estimated)",
        "type": "query_value",
        "requests": [
          {
            "q": "sum:vibecode.ai.cost{*} by {provider}",
            "aggregator": "sum"
          }
        ]
      }
    }
  ]
}
```

## Alerting Configuration

### Critical Alerts

```yaml
# alerts/critical.yaml

# High Error Rate
- name: "High Error Rate - VibeCode"
  type: metric alert
  query: |
    (sum(last_5m):sum:trace.http.request.errors{service:vibecode-webgui}.as_rate() /
    sum:trace.http.request.hits{service:vibecode-webgui}.as_rate()) * 100 > 5
  message: |
    {{#is_alert}}
    CRITICAL: Error rate is {{value}}% (threshold: 5%)

    Check the APM dashboard and error logs immediately.

    Runbook: https://docs.vibecode.com/runbooks/high-error-rate
    {{/is_alert}}

    @pagerduty-vibecode @slack-alerts
  tags:
    - service:vibecode-webgui
    - severity:critical
    - team:platform
  priority: 1

# Database Connection Pool Exhaustion
- name: "Database Connection Pool Exhausted"
  type: metric alert
  query: |
    avg(last_5m):avg:postgresql.connections.active{service:vibecode-database} > 180
  message: |
    {{#is_alert}}
    CRITICAL: Database connections at {{value}}/200 (threshold: 180)

    Connection pool nearing exhaustion. Investigate application connection leaks.

    Runbook: https://docs.vibecode.com/runbooks/db-connections
    {{/is_alert}}

    @pagerduty-vibecode @slack-alerts
  tags:
    - service:vibecode-database
    - severity:critical
  priority: 1

# High Latency
- name: "High API Latency - VibeCode"
  type: metric alert
  query: |
    avg(last_10m):p95:trace.http.request.duration{service:vibecode-webgui} > 3000
  message: |
    {{#is_alert}}
    WARNING: API p95 latency is {{value}}ms (threshold: 3000ms)

    Performance degradation detected. Check database queries and external API calls.

    Runbook: https://docs.vibecode.com/runbooks/high-latency
    {{/is_alert}}

    @slack-alerts
  tags:
    - service:vibecode-webgui
    - severity:warning
  priority: 2

# Memory Leak Detection
- name: "Memory Leak Detection - VibeCode"
  type: anomaly
  query: |
    avg(last_1h):avg:runtime.nodejs.mem.rss{service:vibecode-webgui}
  message: |
    {{#is_alert}}
    WARNING: Anomalous memory usage detected

    Memory usage pattern deviating from normal. Potential memory leak.

    Current: {{value}}MB

    Runbook: https://docs.vibecode.com/runbooks/memory-leak
    {{/is_alert}}

    @slack-alerts
  tags:
    - service:vibecode-webgui
    - severity:warning

# Disk Space
- name: "Low Disk Space - PostgreSQL"
  type: metric alert
  query: |
    avg(last_5m):(avg:system.disk.used{service:vibecode-database} /
    avg:system.disk.total{service:vibecode-database}) * 100 > 85
  message: |
    {{#is_alert}}
    CRITICAL: Disk usage at {{value}}% (threshold: 85%)

    PostgreSQL disk space critical. Clean up old data or expand storage.

    Runbook: https://docs.vibecode.com/runbooks/disk-space
    {{/is_alert}}

    @pagerduty-vibecode @slack-alerts
  tags:
    - service:vibecode-database
    - severity:critical
  priority: 1
```

### AI Service Alerts

```yaml
# alerts/ai-services.yaml

# AI Provider Errors
- name: "AI Provider Errors - {{provider.name}}"
  type: metric alert
  query: |
    sum(last_5m):sum:vibecode.ai.errors{*} by {provider}.as_rate() > 10
  message: |
    {{#is_alert}}
    WARNING: High error rate from {{provider.name}}: {{value}} errors/min

    Check provider status and API key validity.

    Runbook: https://docs.vibecode.com/runbooks/ai-provider-errors
    {{/is_alert}}

    @slack-alerts
  tags:
    - service:ai-gateway
    - severity:warning

# High AI Latency
- name: "High AI Response Time"
  type: metric alert
  query: |
    avg(last_10m):p95:vibecode.ai.duration{*} by {provider} > 10000
  message: |
    {{#is_alert}}
    WARNING: AI response time p95: {{value}}ms (threshold: 10s)

    Provider: {{provider.name}}

    Runbook: https://docs.vibecode.com/runbooks/ai-latency
    {{/is_alert}}

    @slack-alerts

# Token Usage Spike
- name: "Unusual Token Usage"
  type: anomaly
  query: |
    sum(last_1h):sum:vibecode.ai.tokens{*} by {provider}
  message: |
    {{#is_alert}}
    NOTICE: Anomalous token usage detected

    Provider: {{provider.name}}
    Current rate: {{value}} tokens/hour

    Possible API abuse or misconfiguration.
    {{/is_alert}}

    @slack-alerts
```

## Log Management

### Log Collection Configuration

```yaml
# Log pipeline configuration
logs:
  - type: file
    path: /var/log/vibecode/*.log
    service: vibecode-webgui
    source: nodejs

  - type: docker
    image: vibecode/webgui
    service: vibecode-webgui
    source: docker

  - type: docker
    image: postgres
    service: vibecode-database
    source: postgresql
```

### Log Parsing Rules

```json
{
  "name": "VibeCode Application Logs",
  "filter": {
    "query": "service:vibecode-webgui"
  },
  "processors": [
    {
      "type": "grok-parser",
      "grok": {
        "supportRules": "",
        "matchRules": "%{date(\"yyyy-MM-dd'T'HH:mm:ss.SSSZ\"):timestamp} %{word:level} %{data:message}"
      }
    },
    {
      "type": "status-remapper",
      "sources": ["level"]
    },
    {
      "type": "message-remapper",
      "sources": ["message"]
    },
    {
      "type": "attribute-remapper",
      "sources": ["user.id"],
      "target": "usr.id"
    }
  ]
}
```

## SLIs and SLOs

### Service Level Indicators

```yaml
# slis.yaml
slis:
  - name: "API Availability"
    description: "Percentage of successful API requests"
    query: |
      (sum:trace.http.request.hits{service:vibecode-webgui,http.status_code:2xx} /
      sum:trace.http.request.hits{service:vibecode-webgui}) * 100
    target: 99.9

  - name: "API Latency"
    description: "95th percentile API response time"
    query: "p95:trace.http.request.duration{service:vibecode-webgui}"
    target: 500  # milliseconds

  - name: "Database Query Performance"
    description: "95th percentile database query time"
    query: "p95:postgresql.query.duration{service:vibecode-database}"
    target: 100  # milliseconds

  - name: "AI Service Availability"
    description: "Percentage of successful AI requests"
    query: |
      (sum:vibecode.ai.requests{*} - sum:vibecode.ai.errors{*}) /
      sum:vibecode.ai.requests{*} * 100
    target: 99.5
```

### Service Level Objectives

```yaml
# slos.yaml
slos:
  - name: "Monthly API Availability SLO"
    description: "API should be available 99.9% of the time per month"
    type: monitor
    thresholds:
      timeframe: "30d"
      target: 99.9
      warning: 99.95
    monitor_ids:
      - 12345  # High error rate monitor
      - 67890  # High latency monitor

  - name: "Weekly AI Service Performance SLO"
    description: "AI services should respond within 10s for 95% of requests"
    type: metric
    thresholds:
      timeframe: "7d"
      target: 95
      warning: 97
    query: |
      sum(last_7d):count_not_null(vibecode.ai.duration{*} < 10000) /
      count_not_null(vibecode.ai.duration{*}) * 100
```

## Cost Monitoring

### Infrastructure Cost Tracking

```typescript
// lib/cost-tracking.ts
import { metrics } from './metrics';

export const trackInfrastructureCost = () => {
  // Track AI provider costs
  const aiCosts = {
    openai: calculateOpenAICost(),
    anthropic: calculateAnthropicCost(),
    google: calculateGoogleAICost(),
  };

  Object.entries(aiCosts).forEach(([provider, cost]) => {
    metrics.gauge('infrastructure.cost.ai', cost, { provider });
  });

  // Track database costs
  const dbCost = calculateDatabaseCost();
  metrics.gauge('infrastructure.cost.database', dbCost);

  // Track compute costs
  const computeCost = calculateComputeCost();
  metrics.gauge('infrastructure.cost.compute', computeCost);
};

// Run hourly
setInterval(trackInfrastructureCost, 60 * 60 * 1000);
```

## Next Steps

- [Security Hardening](./SECURITY_HARDENING.md)
- [Disaster Recovery](./DISASTER_RECOVERY.md)
- [Production Checklist](./PRODUCTION_CHECKLIST.md)
- [Kubernetes Production](./KUBERNETES_PRODUCTION.md)
