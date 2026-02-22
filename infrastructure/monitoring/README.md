# Infrastructure Monitoring Stack

Production-ready observability stack for the VibeCode platform with comprehensive container resource monitoring, metrics collection, alerting, and distributed tracing.

## Overview

This directory contains configuration files for the complete monitoring and observability stack:

- **Prometheus** - Metrics collection and alerting
- **cAdvisor** - Container resource monitoring
- **Datadog Agent** - Full-stack observability and APM
- **AlertManager** - Alert routing and notification management
- **Vector** - High-performance observability data pipeline
- **OpenTelemetry Collector** - Telemetry data collection
- **Jaeger** - Distributed tracing
- **Loki** - Log aggregation
- **Grafana** - Metrics visualization (optional)

## Quick Start

### Prerequisites

- Docker and Docker Compose installed
- Datadog account (optional, for full observability)
- Kubernetes cluster (for K8s deployment)
- Minimum 4 GB RAM, 2 CPU cores for monitoring stack

### Local Development Setup

1. **Start the monitoring stack:**
   ```bash
   cd infrastructure/monitoring
   docker-compose -f docker-compose.monitoring.yml up -d
   ```

2. **Verify services are running:**
   ```bash
   docker ps | grep vibecode
   ```

3. **Access monitoring endpoints:**
   - Prometheus: http://localhost:9090
   - AlertManager: http://localhost:9093
   - cAdvisor: http://localhost:8080
   - Jaeger UI: http://localhost:16686
   - Grafana: http://localhost:3000

4. **Check health status:**
   ```bash
   curl http://localhost:9090/-/healthy  # Prometheus
   curl http://localhost:8080/healthz     # cAdvisor
   curl http://localhost:9093/-/healthy   # AlertManager
   ```

### Production Deployment

For Kubernetes deployment:

```bash
# Deploy Prometheus with Helm
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/prometheus \
  -f prometheus-helm-values.yml \
  -n monitoring --create-namespace

# Deploy Datadog Agent
kubectl apply -f datadog-agent/datadog-agent.yaml -n monitoring

# Deploy cAdvisor as DaemonSet
kubectl apply -f cadvisor-daemonset.yaml -n monitoring
```

## Container Resource Monitoring

### Overview

Container monitoring provides real-time visibility into Docker and Kubernetes container performance, tracking CPU, memory, network, and storage usage. This feature helps:

- Identify resource constraints before they impact performance
- Optimize container resource allocation
- Plan capacity based on historical trends
- Detect anomalies and performance degradation

### Architecture

```
Containers → cAdvisor → Prometheus → API/Datadog → Dashboard
                                   → AlertManager → Notifications
```

**Components:**
- **cAdvisor**: Collects container metrics from Docker/Kubernetes runtime
- **Prometheus**: Stores time-series metrics data with 30-day retention
- **Backend API**: Queries Prometheus and exposes metrics via REST endpoints
- **Frontend Dashboard**: React-based UI for real-time visualization
- **Datadog**: Unified observability with extended retention (13 months)
- **AlertManager**: Routes alerts to Slack, PagerDuty, and other channels

### cAdvisor Configuration

cAdvisor (Container Advisor) provides resource usage and performance metrics for running containers.

#### Docker Compose Setup

The `docker-compose.monitoring.yml` includes cAdvisor configuration:

```yaml
cadvisor:
  image: gcr.io/cadvisor/cadvisor:v0.47.2
  container_name: vibecode-cadvisor
  restart: unless-stopped
  ports:
    - "8080:8080"
  volumes:
    - /:/rootfs:ro
    - /var/run:/var/run:ro
    - /sys:/sys:ro
    - /var/lib/docker/:/var/lib/docker:ro
    - /dev/disk/:/dev/disk:ro
  privileged: true
  devices:
    - /dev/kmsg
```

**Important Notes:**
- Runs in privileged mode to access container runtime metrics
- Mounts host filesystem as read-only for metric collection
- Exposes metrics on port 8080 in Prometheus format
- Requires access to Docker socket and cgroup filesystem

#### Kubernetes DaemonSet Deployment

For Kubernetes clusters, deploy cAdvisor as a DaemonSet to monitor all nodes:

```bash
# Create DaemonSet configuration
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: cadvisor
  namespace: monitoring
spec:
  selector:
    matchLabels:
      app: cadvisor
  template:
    metadata:
      labels:
        app: cadvisor
    spec:
      containers:
      - name: cadvisor
        image: gcr.io/cadvisor/cadvisor:v0.47.2
        ports:
        - containerPort: 8080
          name: http
        volumeMounts:
        - name: rootfs
          mountPath: /rootfs
          readOnly: true
        - name: var-run
          mountPath: /var/run
          readOnly: true
        - name: sys
          mountPath: /sys
          readOnly: true
        - name: docker
          mountPath: /var/lib/docker
          readOnly: true
        resources:
          requests:
            memory: 200Mi
            cpu: 200m
          limits:
            memory: 500Mi
            cpu: 500m
      volumes:
      - name: rootfs
        hostPath:
          path: /
      - name: var-run
        hostPath:
          path: /var/run
      - name: sys
        hostPath:
          path: /sys
      - name: docker
        hostPath:
          path: /var/lib/docker
EOF
```

#### Verify cAdvisor Installation

```bash
# Check cAdvisor is running
curl http://localhost:8080/healthz

# View available metrics
curl http://localhost:8080/metrics | grep container_

# Check specific container metrics
curl http://localhost:8080/metrics | grep container_cpu_usage_seconds_total
```

### Prometheus Scrape Configuration

Add cAdvisor as a scrape target in `prometheus.yml`:

```yaml
scrape_configs:
  # cAdvisor - Container metrics
  - job_name: 'cadvisor'
    static_configs:
      - targets: ['cadvisor:8080']
    scrape_interval: 30s
    scrape_timeout: 10s
    metrics_path: /metrics
    relabel_configs:
      # Filter out POD containers (Kubernetes pause containers)
      - source_labels: [container]
        regex: 'POD'
        action: drop
      # Add cluster label
      - target_label: cluster
        replacement: 'vibecode-platform'
```

**For Kubernetes with Service Discovery:**

```yaml
scrape_configs:
  # cAdvisor - Kubernetes service discovery
  - job_name: 'kubernetes-cadvisor'
    kubernetes_sd_configs:
      - role: node
    scheme: https
    tls_config:
      ca_file: /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
      insecure_skip_verify: true
    bearer_token_file: /var/run/secrets/kubernetes.io/serviceaccount/token
    relabel_configs:
      - action: labelmap
        regex: __meta_kubernetes_node_label_(.+)
      - target_label: __address__
        replacement: kubernetes.default.svc:443
      - source_labels: [__meta_kubernetes_node_name]
        regex: (.+)
        target_label: __metrics_path__
        replacement: /api/v1/nodes/${1}/proxy/metrics/cadvisor
      # Filter out POD containers
      - source_labels: [container]
        regex: 'POD'
        action: drop
```

**Reload Prometheus configuration:**

```bash
# Send SIGHUP to reload config
curl -X POST http://localhost:9090/-/reload

# Or restart Prometheus
docker restart vibecode-prometheus
```

**Verify scrape targets:**

```bash
# Check Prometheus targets page
curl http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | select(.labels.job == "cadvisor")'

# Query container metrics
curl 'http://localhost:9090/api/v1/query?query=container_cpu_usage_seconds_total'
```

### Container Alert Rules

Alert rules are defined in `alerts/container-resource-alerts.yml`:

#### Critical Alerts (P1)

- **ContainerCriticalCPUUsage**: CPU > 95% for 3 minutes
- **ContainerCriticalMemoryUsage**: Memory > 95% for 2 minutes (OOM risk)
- **ContainerDiskUsageHigh**: Disk > 90% for 5 minutes
- **ContainerOOMKilled**: Container killed by Out of Memory
- **ContainerNotRunning**: Container stopped or crashed

#### Warning Alerts (P2)

- **ContainerHighCPUUsage**: CPU > 80% for 5 minutes
- **ContainerHighMemoryUsage**: Memory > 85% for 3 minutes
- **ContainerDiskUsageWarning**: Disk > 80% for 10 minutes
- **ContainerNetworkSaturation**: Network > 100 MB/s for 5 minutes
- **ContainerRestartingFrequently**: > 3 restarts in 10 minutes
- **ContainerCPUThrottling**: CPU throttled > 25% of the time
- **ContainerNetworkErrors**: Network errors > 10/s

#### Enable Alert Rules

```bash
# Validate alert rules syntax
promtool check rules alerts/container-resource-alerts.yml

# Update Prometheus configuration to load rules
# Ensure prometheus.yml includes:
rule_files:
  - "alerts/*.yml"

# Reload Prometheus
curl -X POST http://localhost:9090/-/reload

# Verify rules are loaded
curl http://localhost:9090/api/v1/rules | jq '.data.groups[] | select(.name == "vibecode.container.resources")'
```

#### Alert Routing Configuration

AlertManager routes container alerts to appropriate channels. Configuration in `alertmanager.yml`:

```yaml
route:
  routes:
    # Critical container alerts → Immediate notification
    - match:
        severity: critical
        component: containers
      receiver: container-alerts
      group_wait: 10s
      group_interval: 5m
      repeat_interval: 3h
      continue: true

    # Warning container alerts → Standard notification
    - match:
        severity: warning
        component: containers
      receiver: container-alerts
      group_wait: 30s
      group_interval: 10m
      repeat_interval: 12h

receivers:
  - name: container-alerts
    slack_configs:
      - api_url: ${SLACK_WEBHOOK_URL}
        channel: '#infrastructure'
        title: 'Container Alert: {{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
        send_resolved: true
```

**Test alert routing:**

```bash
# Send test alert to AlertManager
curl -X POST http://localhost:9093/api/v1/alerts \
  -H 'Content-Type: application/json' \
  -d '[{
    "labels": {
      "alertname": "TestContainerAlert",
      "severity": "warning",
      "component": "containers"
    },
    "annotations": {
      "description": "Test container alert from AlertManager"
    }
  }]'

# Check AlertManager UI
open http://localhost:9093
```

### Datadog Integration

Container metrics are automatically forwarded to Datadog for unified observability.

#### Datadog Agent Configuration

The Datadog Agent is configured to collect container metrics via Docker socket:

```yaml
datadog-agent:
  environment:
    - DD_API_KEY=${DD_API_KEY}
    - DD_SITE=datadoghq.com
    - DD_LOGS_ENABLED=true
    - DD_LOGS_CONFIG_CONTAINER_COLLECT_ALL=true
    - DD_PROCESS_AGENT_ENABLED=true
    - DD_APM_ENABLED=true
    - DD_DOCKER_LABELS_AS_TAGS=true
    - DD_ORCHESTRATOR_EXPLORER_ENABLED=true
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock:ro
    - /proc/:/host/proc/:ro
    - /sys/fs/cgroup/:/host/sys/fs/cgroup:ro
```

#### Deploy Datadog Dashboard

Pre-built container metrics dashboard available in `datadog/dashboards/container-metrics-dashboard.json`.

```bash
# Set Datadog credentials
export DD_API_KEY=your_api_key
export DD_APP_KEY=your_app_key

# Deploy dashboard via API
./scripts/deploy-datadog-container-dashboard.sh

# Verify dashboard deployment
curl -X GET "https://api.datadoghq.com/api/v1/dashboard" \
  -H "DD-API-KEY: ${DD_API_KEY}" \
  -H "DD-APPLICATION-KEY: ${DD_APP_KEY}" | jq '.dashboards[] | select(.title == "Container Resource Monitoring")'
```

**Dashboard URL:** https://app.datadoghq.com/dashboard/container-metrics

#### Deploy Datadog Monitors

Automated monitors with anomaly detection in `datadog/monitors/container-resource-monitors.json`:

- **Container CPU Anomaly Detection**: Machine learning-based anomaly detection
- **Container Memory Leak Detection**: 30%+ memory increase over 30 minutes
- **Container High Restart Rate**: > 3 restarts in 10 minutes
- **Container OOM Kill Detection**: Out of Memory event alerts

```bash
# Deploy monitors (requires DD_API_KEY and DD_APP_KEY)
cd scripts
./deploy-datadog-monitors.sh container-resource-monitors

# Or manually via API
curl -X POST "https://api.datadoghq.com/api/v1/monitor" \
  -H "Content-Type: application/json" \
  -H "DD-API-KEY: ${DD_API_KEY}" \
  -H "DD-APPLICATION-KEY: ${DD_APP_KEY}" \
  -d @../infrastructure/datadog/monitors/container-resource-monitors.json
```

### Backend API Endpoints

The platform exposes REST API endpoints for querying container metrics:

#### Get Real-Time Container Metrics

```bash
# Get all containers
curl -H "Authorization: Bearer $TOKEN" \
  https://api.vibecode.app/api/monitoring/containers

# Filter by container name
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.vibecode.app/api/monitoring/containers?container=vibecode-app"

# Skip cache for fresh data
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.vibecode.app/api/monitoring/containers?skip_cache=true"
```

#### Get Historical Container Metrics

```bash
# CPU history for last hour
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.vibecode.app/api/monitoring/containers/history?container=vibecode-app&metric=cpu&duration=1h"

# Memory history for last 24 hours
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.vibecode.app/api/monitoring/containers/history?container=postgres-db&metric=memory&duration=24h"

# Network RX history with custom step interval
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.vibecode.app/api/monitoring/containers/history?container=api-server&metric=network_rx&duration=6h&step=5m"
```

**Supported Metrics:**
- `cpu` - CPU usage percentage
- `memory` - Memory usage percentage
- `network_rx` - Network receive bytes/second
- `network_tx` - Network transmit bytes/second
- `storage` - Storage usage percentage

**Supported Durations:**
- `30m`, `1h`, `6h`, `24h`, `7d`

### Frontend Dashboard

Access the container monitoring dashboard at:

```
https://vibecode.app/monitoring/containers
```

**Dashboard Features:**
- **System Overview**: Total containers, running containers, aggregate CPU/memory
- **Active Alerts**: Real-time alerts with severity indicators
- **Container Selection**: Filter and select containers to monitor
- **Resource Gauges**: Real-time circular progress indicators
- **Time-Series Charts**: Historical CPU, memory, network, storage trends
- **Auto-Refresh**: Automatic updates every 30 seconds

## Key Configuration Files

### Metrics Collection

- `prometheus.yml` - Prometheus configuration with scrape targets
- `prometheus-helm-values.yml` - Helm chart values for Kubernetes
- `prometheus-apple-silicon.yml` - Apple Silicon compatibility config

### Alert Rules

- `alerts/container-resource-alerts.yml` - Container CPU, memory, disk, network alerts
- `alerts/application.yml` - Application-level alerts
- `alertmanager.yml` - Alert routing and notification configuration

### Dashboards

- `datadog/dashboards/container-metrics-dashboard.json` - Datadog container dashboard
- `datadog/dashboards/ai-gateway-observability.json` - AI Gateway metrics
- `grafana/` - Grafana dashboard JSON files

### Monitors

- `datadog/monitors/container-resource-monitors.json` - Container resource monitors
- `datadog/monitors/` - Other Datadog monitor configurations

### Data Pipelines

- `vector.toml` - Vector log and metrics pipeline configuration
- `otel-collector.yaml` - OpenTelemetry Collector configuration
- `loki.yml` - Loki log aggregation configuration

### Recording Rules

- `recording_rules/` - Prometheus recording rules for query optimization

### Runbooks

- `runbooks/container-resource-alerts.md` - Container alert response procedures
- `runbooks/` - Other operational runbooks

## Environment Variables

### Required Variables

```bash
# Datadog (optional but recommended)
export DD_API_KEY=your_datadog_api_key
export DD_APP_KEY=your_datadog_app_key
export DD_SITE=datadoghq.com

# Slack (for AlertManager notifications)
export SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Prometheus
export PROMETHEUS_URL=http://localhost:9090
export PROMETHEUS_TIMEOUT=10000

# Monitoring Configuration
export MONITORING_ENABLED=true
export CONTAINER_METRICS_CACHE_TTL=30000
```

### Optional Variables

```bash
# Honeycomb (for OpenTelemetry)
export HONEYCOMB_API_KEY=your_honeycomb_api_key

# PagerDuty (for critical alerts)
export PAGERDUTY_INTEGRATION_KEY=your_pagerduty_key

# Custom alert thresholds
export CONTAINER_CPU_WARNING_THRESHOLD=80
export CONTAINER_CPU_CRITICAL_THRESHOLD=95
export CONTAINER_MEMORY_WARNING_THRESHOLD=85
export CONTAINER_MEMORY_CRITICAL_THRESHOLD=95
```

## Testing and Validation

### Validate Prometheus Configuration

```bash
# Check Prometheus config syntax
promtool check config prometheus.yml

# Check alert rules syntax
promtool check rules alerts/container-resource-alerts.yml

# Test Prometheus queries
promtool query instant http://localhost:9090 'up'
```

### Validate AlertManager Configuration

```bash
# Check AlertManager config syntax
amtool check-config alertmanager.yml

# Test alert routing
amtool config routes test --config.file=alertmanager.yml \
  --tree \
  alertname=ContainerHighCPUUsage severity=warning component=containers
```

### Run Prometheus Alert Rule Tests

```bash
# Run unit tests for alert rules
promtool test rules tests/infrastructure/prometheus-container-alerts.test.yml

# Expected output: SUCCESS
```

### Simulate Container Resource Issues

```bash
# Create CPU stress test container
docker run --rm -it --name cpu-stress \
  --cpus="0.5" \
  progrium/stress --cpu 2 --timeout 300s

# Create memory stress test container
docker run --rm -it --name memory-stress \
  --memory="512m" \
  progrium/stress --vm 1 --vm-bytes 400M --timeout 300s

# Monitor alerts in Prometheus
open http://localhost:9090/alerts

# Check AlertManager for triggered alerts
open http://localhost:9093
```

## Troubleshooting

### cAdvisor Issues

**Problem:** cAdvisor not showing container metrics

**Solutions:**
```bash
# Check cAdvisor logs
docker logs vibecode-cadvisor

# Verify Docker socket access
docker exec vibecode-cadvisor ls -la /var/run/docker.sock

# Restart cAdvisor
docker restart vibecode-cadvisor

# Check cAdvisor metrics endpoint
curl http://localhost:8080/metrics | head -20
```

### Prometheus Scraping Issues

**Problem:** Prometheus not scraping cAdvisor metrics

**Solutions:**
```bash
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | select(.labels.job == "cadvisor")'

# Check Prometheus logs
docker logs vibecode-prometheus

# Verify network connectivity
docker exec vibecode-prometheus wget -O- http://cadvisor:8080/healthz

# Reload Prometheus config
curl -X POST http://localhost:9090/-/reload
```

### Alert Not Triggering

**Problem:** Container metrics exceed thresholds but no alerts

**Solutions:**
```bash
# Check if alert rules are loaded
curl http://localhost:9090/api/v1/rules | jq '.data.groups[].name'

# Check pending/firing alerts
curl http://localhost:9090/api/v1/alerts

# Verify AlertManager connectivity
curl http://localhost:9093/-/healthy

# Check AlertManager logs
docker logs vibecode-alertmanager

# Test alert manually
curl -X POST http://localhost:9093/api/v1/alerts -d '[{"labels":{"alertname":"test"}}]'
```

### Datadog Agent Issues

**Problem:** Container metrics not appearing in Datadog

**Solutions:**
```bash
# Check Datadog Agent status
docker exec vibecode-datadog-agent-apm agent status

# Verify API key
docker exec vibecode-datadog-agent-apm agent config | grep api_key

# Check Docker socket access
docker exec vibecode-datadog-agent-apm ls -la /var/run/docker.sock

# Restart Datadog Agent
docker restart vibecode-datadog-agent-apm

# Check Datadog Agent logs
docker logs vibecode-datadog-agent-apm --tail 100
```

## Performance Considerations

### Resource Usage

The monitoring stack requires:

- **Prometheus**: 500 MB - 2 GB RAM (depends on scrape targets)
- **cAdvisor**: 50-100 MB RAM, < 2% CPU per node
- **Datadog Agent**: 100-200 MB RAM, 1-2% CPU
- **AlertManager**: 50-100 MB RAM
- **Vector**: 100-200 MB RAM
- **OTEL Collector**: 100-300 MB RAM

**Total:** ~1-3 GB RAM for full stack

### Optimization Tips

1. **Reduce Prometheus retention:**
   ```yaml
   --storage.tsdb.retention.time=15d  # Reduce from 30d
   ```

2. **Increase scrape intervals:**
   ```yaml
   scrape_interval: 60s  # Increase from 30s for less critical metrics
   ```

3. **Use recording rules:**
   ```yaml
   # Pre-calculate expensive queries
   - record: container:cpu_usage:rate5m
     expr: rate(container_cpu_usage_seconds_total[5m])
   ```

4. **Filter unnecessary metrics:**
   ```yaml
   metric_relabel_configs:
     - source_labels: [__name__]
       regex: 'container_(blkio|hugetlb).*'
       action: drop
   ```

## Security Considerations

### Network Security

- Prometheus metrics endpoints are **internal only** (not exposed externally)
- cAdvisor runs in privileged mode (required for container metrics)
- Datadog Agent has read-only access to Docker socket
- AlertManager webhook URLs stored as environment variables (not in config files)

### Access Control

- Dashboard requires authentication (admin/ops role)
- API endpoints protected by JWT authentication and RBAC
- Prometheus/AlertManager UIs should be behind VPN or authentication proxy in production

### Secrets Management

```bash
# Use environment variables for secrets
export DD_API_KEY=$(cat /path/to/secret)
export SLACK_WEBHOOK_URL=$(cat /path/to/webhook)

# Or use Kubernetes secrets
kubectl create secret generic datadog-secret \
  --from-literal=api-key=$DD_API_KEY \
  -n monitoring
```

## Documentation

### Internal Documentation

- [Container Monitoring User Guide](../../docs/monitoring/container-monitoring.md) - End-user documentation
- [Container Alert Runbook](./runbooks/container-resource-alerts.md) - Alert response procedures
- Alert rule files include inline documentation with runbook URLs

### External Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [cAdvisor Documentation](https://github.com/google/cadvisor)
- [Datadog Container Monitoring](https://docs.datadoghq.com/containers/)
- [AlertManager Configuration](https://prometheus.io/docs/alerting/latest/configuration/)

## Support

For issues with the monitoring stack:

1. **Check service health**: Verify all containers are running and healthy
2. **Review logs**: Check container logs for errors
3. **Consult runbooks**: See `runbooks/` directory for alert-specific guidance
4. **Contact team**: Reach out via `#infrastructure` Slack channel

## Maintenance

### Regular Tasks

- **Weekly**: Review alert thresholds and tune based on observed patterns
- **Monthly**: Review Prometheus retention and storage usage
- **Quarterly**: Update monitoring stack versions and security patches

### Upgrade Procedure

```bash
# Backup Prometheus data
docker run --rm -v prometheus-data:/data -v $(pwd):/backup alpine tar czf /backup/prometheus-backup.tar.gz /data

# Pull new images
docker-compose -f docker-compose.monitoring.yml pull

# Restart services
docker-compose -f docker-compose.monitoring.yml up -d

# Verify health
curl http://localhost:9090/-/healthy
curl http://localhost:8080/healthz
```

---

**Last Updated:** 2026-02-19
**Version:** 1.0.0
**Maintained By:** Platform Team
