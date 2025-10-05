# Datadog Integration for VibeCode Code-Server

Complete guide for monitoring code-server with AI extensions using Datadog.

## Overview

This configuration provides comprehensive monitoring for:
- **Code-Server Performance**: CPU, memory, response times
- **AI Extension Telemetry**: Claude Code, OpenAI ChatGPT, Copilot usage
- **Process Monitoring**: Extension hosts, Node.js processes
- **Network Traffic**: API calls to AI providers
- **Security**: Secret scanning, compliance checks
- **LLM Observability**: Track AI model calls and costs

## Quick Start

### Option 1: Docker Compose (Recommended)

```yaml
version: '3.8'

services:
  code-server:
    image: vibecode-codeserver:latest
    ports:
      - "8765:8765"
    environment:
      - PASSWORD=your_secure_password
      - DD_AGENT_HOST=datadog-agent
      - DD_TRACE_AGENT_PORT=8126
      - DD_DOGSTATSD_PORT=8125
      - DD_ENV=production
      - DD_SERVICE=vibecode-codeserver
      - DD_VERSION=1.0.0
    volumes:
      - workspace:/home/coder/workspace
    labels:
      com.datadoghq.ad.check_names: '["code-server"]'
      com.datadoghq.ad.init_configs: '[{}]'
      com.datadoghq.ad.instances: '[{"url":"http://%%host%%:8765/healthz"}]'
      com.datadoghq.tags.service: "vibecode-codeserver"
      com.datadoghq.tags.env: "production"

  datadog-agent:
    image: gcr.io/datadoghq/agent:latest
    ports:
      - "8126:8126/tcp"  # APM
      - "8125:8125/udp"  # DogStatsD
    environment:
      - DD_API_KEY=${DD_API_KEY}
      - DD_SITE=${DD_SITE:-datadoghq.com}
      - DD_APM_ENABLED=true
      - DD_APM_NON_LOCAL_TRAFFIC=true
      - DD_LOGS_ENABLED=true
      - DD_LOGS_CONFIG_CONTAINER_COLLECT_ALL=true
      - DD_PROCESS_AGENT_ENABLED=true
      - DD_CONTAINER_EXCLUDE="name:datadog-agent"
      - DD_LLM_OBS_ENABLED=true
      - DD_LLM_OBS_ML_APP=vibecode-ai-extensions
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - /proc/:/host/proc/:ro
      - /sys/fs/cgroup/:/host/sys/fs/cgroup:ro
      - ./datadog-agent.yaml:/etc/datadog-agent/datadog.yaml:ro

volumes:
  workspace:
```

### Option 2: Kubernetes Deployment

Before applying the manifests, create the Datadog API secret in the target namespace:

```bash
kubectl create secret generic datadog-secret \
  --namespace vibecode-platform \
  --from-literal=api-key="<your-datadog-api-key>"
```

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: datadog-agent-config
  namespace: vibecode-platform
data:
  datadog.yaml: |
    # Include contents of datadog-agent.yaml
    api_key: ${DD_API_KEY}
    site: ${DD_SITE}
    # ... rest of configuration

---
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: datadog-agent
  namespace: vibecode-platform
spec:
  selector:
    matchLabels:
      app: datadog-agent
  template:
    metadata:
      labels:
        app: datadog-agent
      annotations:
        ad.datadoghq.com/agent.check_names: '["code-server"]'
        ad.datadoghq.com/agent.init_configs: '[{}]'
        ad.datadoghq.com/agent.instances: |
          [
            {
              "url": "http://code-server:8765/healthz",
              "tags": ["service:code-server"]
            }
          ]
    spec:
      serviceAccountName: datadog-agent
      containers:
      - name: datadog-agent
        image: gcr.io/datadoghq/agent:latest
        env:
        - name: DD_API_KEY
          valueFrom:
            secretKeyRef:
              name: datadog-secret
              key: api-key
        - name: DD_SITE
          value: "datadoghq.com"
        - name: DD_APM_ENABLED
          value: "true"
        - name: DD_LOGS_ENABLED
          value: "true"
        - name: DD_PROCESS_AGENT_ENABLED
          value: "true"
        - name: DD_LLM_OBS_ENABLED
          value: "true"
        - name: DD_KUBERNETES_KUBELET_HOST
          valueFrom:
            fieldRef:
              fieldPath: status.hostIP
        volumeMounts:
        - name: config
          mountPath: /etc/datadog-agent/datadog.yaml
          subPath: datadog.yaml
        - name: dockersocket
          mountPath: /var/run/docker.sock
        - name: procdir
          mountPath: /host/proc
          readOnly: true
        - name: cgroups
          mountPath: /host/sys/fs/cgroup
          readOnly: true
      volumes:
      - name: config
        configMap:
          name: datadog-agent-config
      - name: dockersocket
        hostPath:
          path: /var/run/docker.sock
      - name: procdir
        hostPath:
          path: /proc
      - name: cgroups
        hostPath:
          path: /sys/fs/cgroup
```

## Key Features Explained

### 1. LLM Observability

Tracks AI model usage across all extensions:

```yaml
llm_obs:
  enabled: true
  ml_app: "vibecode-ai-extensions"
  integrations:
    - openai      # ChatGPT, Codex
    - anthropic   # Claude Code
    - langchain   # If using LangChain
```

**Metrics Captured:**
- Token usage per request
- Model latency
- Cost per API call
- Error rates
- Prompt/completion pairs

**View in Datadog:**
- Navigate to **APM → LLM Observability**
- Filter by `ml_app:vibecode-ai-extensions`

### 2. Process Monitoring

Monitors code-server and extension processes:

```yaml
process_config:
  enabled: true
  process_discovery:
    hints:
      - name: "code-server"
        process_names: ["code-server", "node"]
      - name: "extensions"
        process_names: ["extensionHost"]
```

**Metrics:**
- CPU usage per extension
- Memory consumption
- Process count
- Thread count

### 3. Custom Metrics via DogStatsD

Send custom metrics from extensions:

```javascript
// In your extension code
const StatsD = require('node-dogstatsd').StatsD;
const dogstatsd = new StatsD('datadog-agent', 8125);

// Track AI completions
dogstatsd.increment('vibecode.ai.completion', 1, ['provider:openai']);

// Track latency
dogstatsd.histogram('vibecode.ai.latency', responseTime, ['model:gpt-4']);

// Track costs
dogstatsd.gauge('vibecode.ai.cost', cost, ['provider:anthropic']);
```

### 4. Log Collection

Auto-collects logs from:
- Code-server main process
- Extension hosts
- AI API calls
- Error stack traces

**Log Processing:**
```yaml
logs_config:
  processing_rules:
    - type: multi_line
      name: log_start_with_date
      pattern: \d{4}-\d{2}-\d{2}
```

### 5. Network Monitoring

Tracks outbound API calls:

```yaml
network_config:
  enabled: true
```

**Captures:**
- API calls to OpenAI, Anthropic, etc.
- Response times
- Bandwidth usage
- Connection errors

### 6. Security Monitoring

```yaml
compliance_config:
  enabled: true
security_agent:
  runtime_security_config:
    enabled: true
```

**Features:**
- Secret detection in code
- Compliance benchmarks
- Runtime threat detection
- File integrity monitoring

## Environment Variables

Required:
```bash
DD_API_KEY=your_datadog_api_key
DD_SITE=datadoghq.com  # or datadoghq.eu, us3.datadoghq.com, etc.
```

Optional but recommended:
```bash
DD_ENV=production
DD_SERVICE=vibecode-codeserver
DD_VERSION=1.0.0
DD_HOSTNAME=codeserver-01
DD_TAGS="team:engineering,component:ide"
```

## Custom Dashboards

### AI Extension Performance Dashboard

```json
{
  "title": "VibeCode AI Extensions",
  "widgets": [
    {
      "definition": {
        "type": "timeseries",
        "requests": [
          {
            "q": "sum:vibecode.ai.completion{*} by {provider}.as_count()",
            "display_type": "bars"
          }
        ],
        "title": "AI Completions by Provider"
      }
    },
    {
      "definition": {
        "type": "query_value",
        "requests": [
          {
            "q": "sum:vibecode.ai.cost{*}",
            "aggregator": "sum"
          }
        ],
        "title": "Total AI Cost (24h)"
      }
    },
    {
      "definition": {
        "type": "toplist",
        "requests": [
          {
            "q": "top(avg:vibecode.ai.latency{*} by {model}, 10, 'mean', 'desc')"
          }
        ],
        "title": "Slowest AI Models"
      }
    }
  ]
}
```

### Code-Server Health Dashboard

```json
{
  "title": "Code-Server Health",
  "widgets": [
    {
      "definition": {
        "type": "check_status",
        "check": "http.can_connect",
        "grouping": "cluster",
        "group_by": ["service:code-server"],
        "title": "Code-Server Health Check"
      }
    },
    {
      "definition": {
        "type": "timeseries",
        "requests": [
          {
            "q": "avg:system.cpu.user{service:code-server}",
            "display_type": "line"
          }
        ],
        "title": "CPU Usage"
      }
    },
    {
      "definition": {
        "type": "timeseries",
        "requests": [
          {
            "q": "avg:system.mem.used{service:code-server}",
            "display_type": "area"
          }
        ],
        "title": "Memory Usage"
      }
    }
  ]
}
```

## Alerts

### High AI Cost Alert

```yaml
name: "High AI API Cost"
type: metric alert
query: "sum(last_1h):sum:vibecode.ai.cost{*} > 10"
message: |
  AI API costs exceeded $10 in the last hour.
  Current: {{value}}
  @slack-engineering
```

### Extension Crash Alert

```yaml
name: "Extension Host Crashed"
type: process alert
query: "processes('extensionHost').over('service:code-server').last(2).count_nonzero() == 0"
message: |
  Extension host process is not running!
  @pagerduty-oncall
```

### High Latency Alert

```yaml
name: "Slow AI Response"
type: metric alert
query: "avg(last_5m):avg:vibecode.ai.latency{*} > 5000"
message: |
  AI API latency is above 5 seconds.
  Average: {{value}}ms
  @slack-engineering
```

## Troubleshooting

### Agent Not Receiving Data

1. **Check agent status:**
   ```bash
   docker exec datadog-agent agent status
   ```

2. **Verify connectivity:**
   ```bash
   # From code-server container
   nc -zv datadog-agent 8126  # APM
   nc -zv datadog-agent 8125  # DogStatsD
   ```

3. **Check logs:**
   ```bash
   docker logs datadog-agent | grep ERROR
   ```

### LLM Observability Not Working

1. **Verify environment variables:**
   ```bash
   docker exec code-server env | grep DD_
   ```

2. **Check LLM Obs status:**
   ```bash
   docker exec datadog-agent agent status | grep -A 10 "LLM Observability"
   ```

3. **Enable debug logging:**
   ```yaml
   log_level: debug
   ```

### High Cardinality Issues

If you see "too many tags" warnings:

```yaml
# Reduce tag cardinality
dogstatsd_config:
  tag_cardinality: low  # or orchestrator

# Exclude high-cardinality tags
exclude_tags:
  - user_id
  - session_id
```

## Cost Optimization

### Reduce Log Volume

```yaml
logs_config:
  exclude_at_match:
    - "healthcheck"
    - "ping"
    - "DEBUG"
  # Sample logs
  use_compression: true
  compression_level: 6
```

### Sample Traces

```yaml
apm_config:
  # Sample 10% of traces in production
  analyzed_rate_by_service:
    "vibecode-codeserver": 0.1
```

### Limit Metrics

```yaml
# Only collect essential metrics
use_dogstatsd: true
dogstatsd_config:
  # Aggregate metrics client-side
  aggregation_interval: 10
```

## Best Practices

1. **Tag Everything**: Use consistent tags across all services
2. **Set Up Monitors**: Alert on critical metrics
3. **Create Dashboards**: Visualize AI usage and costs
4. **Enable LLM Obs**: Track AI model performance
5. **Monitor Costs**: Set budget alerts for AI APIs
6. **Use Service Catalog**: Document your services
7. **Enable Security**: Use compliance and runtime security
8. **Optimize Sampling**: Balance cost vs visibility

## Additional Resources

- [Datadog LLM Observability](https://docs.datadoghq.com/llm_observability/)
- [APM for Node.js](https://docs.datadoghq.com/tracing/setup_overview/setup/nodejs/)
- [Container Monitoring](https://docs.datadoghq.com/containers/)
- [Custom Metrics](https://docs.datadoghq.com/metrics/custom_metrics/)
- [Log Management](https://docs.datadoghq.com/logs/)

## Support

For issues or questions:
- GitHub Issues: https://github.com/ryanmaclean/vibecode-webgui/issues
- Datadog Support: https://help.datadoghq.com/
