# Apache SkyWalking Advanced Observability Deployment

Complete deployment of Apache SkyWalking with AI-powered anomaly detection and eBPF tracing, complementing existing Datadog monitoring for VibeCode platform.

## Overview

This deployment provides:
- **Zero-code eBPF instrumentation** via Rover agents
- **AI/ML anomaly detection** with real-time alerts
- **Cross-language distributed tracing** (Node.js + Python)
- **Datadog integration** via OTLP forwarding
- **Unified observability dashboard**

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    VibeCode Services                         │
│  ┌──────────────┐              ┌──────────────┐            │
│  │ Next.js App  │              │  AgentAPI    │            │
│  │  (Node.js)   │              │  (Python)    │            │
│  └──────┬───────┘              └──────┬───────┘            │
│         │ SW Agent                    │ SW Agent            │
│         │                             │                     │
└─────────┼─────────────────────────────┼─────────────────────┘
          │                             │
          │         ┌───────────────────┘
          │         │
┌─────────┼─────────┼───────────────────────────────────────┐
│         ▼         ▼                                        │
│  ┌────────────────────────┐    ┌─────────────────────┐   │
│  │  SkyWalking OAP        │◄───│  BanyanDB Storage   │   │
│  │  (Analysis Platform)   │    │  (APM Database)     │   │
│  └────────┬───────────────┘    └─────────────────────┘   │
│           │                                                │
│  ┌────────┼────────────────────────────────────────────┐ │
│  │        │    AI/ML Anomaly Detection                  │ │
│  │ ┌──────▼─────┐  ┌──────────────┐  ┌──────────────┐ │ │
│  │ │ Statistical│  │ Isolation    │  │ LSTM Time    │ │ │
│  │ │ Models     │  │ Forest       │  │ Series       │ │ │
│  │ │ (Z-Score,  │  │ (Outlier     │  │ (Prediction) │ │ │
│  │ │  IQR)      │  │  Detection)  │  │              │ │ │
│  │ └────────────┘  └──────────────┘  └──────────────┘ │ │
│  └───────────────────────┬────────────────────────────┘ │
│                          │ Anomaly Scores                │
│  ┌───────────────────────▼────────────────────────────┐ │
│  │  Alert Manager                                      │ │
│  │  ├─ PagerDuty (Critical)                           │ │
│  │  ├─ Slack (#alerts-anomaly)                        │ │
│  │  └─ Datadog Events                                 │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  eBPF Rover Agents (DaemonSet)                      │ │
│  │  - Network profiling                                │ │
│  │  - Process monitoring                               │ │
│  │  - Protocol detection (HTTP, gRPC, MySQL, etc)     │ │
│  └─────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────┘
          │
          │ OTLP
          ▼
┌─────────────────────────────────────────────────────────┐
│  OpenTelemetry Collector                                │
│  ├─ Transform SkyWalking → Datadog format              │
│  ├─ Forward traces to Datadog                          │
│  └─ Export metrics to Prometheus                       │
└─────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────┐
│  Datadog Platform                                       │
│  - Unified dashboard (SkyWalking + Datadog)            │
│  - Trace correlation                                    │
│  - Service map with anomaly overlay                    │
└─────────────────────────────────────────────────────────┘
```

## Components

### Core SkyWalking Components

1. **OAP (Observability Analysis Platform)**
   - 2 replicas for high availability
   - AI/ML anomaly detection engine
   - GraphQL API for queries
   - Prometheus metrics export

2. **BanyanDB**
   - Native APM database optimized for time-series data
   - 2 replicas with 20GB storage
   - 7-day retention policy
   - High-performance write throughput

3. **SkyWalking UI**
   - Web interface for visualization
   - Service topology and dependency maps
   - AI anomaly detection dashboard
   - Ingress-enabled for external access

4. **Rover eBPF Agents**
   - DaemonSet deployment (one per node)
   - Zero-code instrumentation
   - Network and process profiling
   - Protocol detection (HTTP, gRPC, MySQL, PostgreSQL, Redis)
   - <1% CPU overhead, <100MB memory

### AI/ML Anomaly Detection

#### Statistical Models
- **Z-Score**: Detects outliers based on standard deviation (threshold: 3.0)
- **IQR**: Interquartile range for error rate detection (multiplier: 1.5)
- **Moving Average**: Trend-based anomaly detection (window: 60 samples)

#### Machine Learning Models
- **Isolation Forest**: Outlier detection (contamination: 0.1)
- **LSTM**: Time-series prediction (sequence length: 50, horizon: 10)
- **Autoencoder**: Reconstruction error for complex patterns (encoding dim: 32)

#### Anomaly Scoring
- Composite weighted average: Statistical (30%) + ML (70%)
- Alert threshold: 0.8 (warning), 0.95 (critical)
- Context-aware adjustments for business hours, deployments

#### Metrics Monitored
- Response time (P50, P95, P99)
- Error rate and success rate
- Throughput and RPS
- Resource usage (CPU, memory, disk, network)
- Agent task metrics (duration, queue depth, success rate)

### Integration Layer

#### Datadog Integration
- **Trace Forwarding**: OTLP exporter sends traces to Datadog
- **Format Conversion**: SkyWalking → Datadog trace format
- **Unified Dashboard**: Combined view in Datadog UI
- **Event Correlation**: Anomaly events published to Datadog

#### Alert Routing
- **PagerDuty**: Critical anomalies (severity: critical)
- **Slack**: All anomalies (#alerts-anomaly, #alerts-agents)
- **Datadog Events**: All anomalies for correlation

#### Metrics Export
- **Prometheus**: Metrics exposed on port 1234
- **ServiceMonitor**: Auto-discovery by Prometheus Operator

## Deployment

### Prerequisites

```bash
# Required tools
- kubectl (1.24+)
- helm (3.0+)
- Kubernetes cluster (1.24+)

# Optional but recommended
- Datadog agent installed
- Prometheus Operator
- Ingress controller (nginx)
```

### Environment Variables

Create a `.env` file with required credentials:

```bash
# Datadog integration
DD_API_KEY=your_datadog_api_key
DD_APP_KEY=your_datadog_app_key

# Alert routing
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
PAGERDUTY_ROUTING_KEY=your_pagerduty_routing_key
```

### Quick Deployment

```bash
# 1. Set environment variables
export DD_API_KEY=your_key
export SLACK_WEBHOOK_URL=your_webhook
export PAGERDUTY_ROUTING_KEY=your_key

# 2. Run deployment script
cd k8s/skywalking
./deploy.sh
```

The script will:
1. Check prerequisites
2. Create namespaces
3. Add Helm repositories
4. Create secrets
5. Deploy SkyWalking components
6. Configure AI anomaly detection
7. Deploy Datadog integration
8. Instrument applications
9. Run initial model training
10. Verify deployment

### Manual Deployment

If you prefer manual control:

```bash
# 1. Create namespaces
kubectl create namespace skywalking
kubectl create namespace vibecode-platform

# 2. Add Helm repo
helm repo add skywalking https://apache.jfrog.io/artifactory/skywalking-helm
helm repo update

# 3. Create secrets
kubectl create secret generic datadog-secret \
  --from-literal=api-key=$DD_API_KEY \
  --namespace=skywalking

kubectl create secret generic skywalking-integration-secrets \
  --from-literal=slack-webhook-url=$SLACK_WEBHOOK_URL \
  --from-literal=pagerduty-routing-key=$PAGERDUTY_ROUTING_KEY \
  --namespace=skywalking

# 4. Deploy SkyWalking
helm install skywalking skywalking/skywalking \
  --namespace skywalking \
  --values values-skywalking.yaml \
  --wait

# 5. Deploy additional components
kubectl apply -f ai-anomaly-detection.yaml
kubectl apply -f integration-datadog.yaml
kubectl apply -f skywalking-agents.yaml

# 6. Verify deployment
kubectl get pods -n skywalking
```

## Accessing SkyWalking

### Web UI

```bash
# Port forward
kubectl port-forward -n skywalking svc/ui 8080:8080

# Access at: http://localhost:8080
```

Or via ingress: https://skywalking.vibecode.local

### GraphQL API

```bash
# Port forward
kubectl port-forward -n skywalking svc/oap 12800:12800

# Query example
curl -X POST http://localhost:12800/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query {
      getServices(duration: {
        start: \"2025-01-01 00:00:00\",
        end: \"2025-01-02 00:00:00\",
        step: MINUTE
      }) {
        id
        name
        group
        layers
      }
    }"
  }'
```

### Prometheus Metrics

```bash
# Port forward
kubectl port-forward -n skywalking svc/oap 1234:1234

# Access metrics
curl http://localhost:1234/metrics
```

## Performance Metrics

### Resource Overhead

| Component | CPU Request | CPU Limit | Memory Request | Memory Limit |
|-----------|-------------|-----------|----------------|--------------|
| OAP | 1000m | 2000m | 2Gi | 4Gi |
| BanyanDB | 500m | 1000m | 1Gi | 2Gi |
| UI | 100m | 200m | 256Mi | 512Mi |
| Rover (per node) | 100m | 500m | 200Mi | 500Mi |
| OTEL Collector | 200m | 500m | 256Mi | 512Mi |

**Total per node**: ~200m CPU, ~300MB memory (with Rover)

### Agent Overhead

- **Node.js Agent**: <50MB memory, <5% CPU
- **Python Agent**: <50MB memory, <5% CPU
- **eBPF Rover**: <100MB memory, <1% CPU

### Storage Requirements

- **BanyanDB**: 20GB per replica (7-day retention)
- **Growth rate**: ~500MB/day (depends on traffic)

## Anomaly Detection Tuning

### Sensitivity Levels

Edit `ai-anomaly-detection.yaml` to adjust sensitivity:

```yaml
# Low sensitivity (fewer alerts, only major anomalies)
sensitivity: low
alertThreshold: 0.95

# Medium sensitivity (balanced, recommended)
sensitivity: medium
alertThreshold: 0.8

# High sensitivity (more alerts, early detection)
sensitivity: high
alertThreshold: 0.7
```

### Baseline Learning

By default, baselines are learned over 7 days:

```yaml
baseline:
  learningPeriod: 7d  # Adjust as needed (1d, 7d, 30d)
  minDataPoints: 1000
  confidenceInterval: 0.95
  updateInterval: 1h
```

### Model Weights

Adjust the balance between statistical and ML models:

```yaml
scoring:
  algorithm: weighted_average
  weights:
    statistical: 0.3  # Z-score, IQR, moving average
    machineLearning: 0.7  # Isolation forest, LSTM, autoencoder
```

## Troubleshooting

### OAP Not Starting

```bash
# Check logs
kubectl logs -n skywalking -l app.kubernetes.io/name=oap

# Common issues:
# 1. BanyanDB not ready
kubectl get pods -n skywalking -l app.kubernetes.io/name=banyandb

# 2. Storage configuration
kubectl exec -n skywalking <oap-pod> -- \
  curl http://banyandb:17912/api/v1/healthz
```

### Agents Not Sending Traces

```bash
# Check agent configuration
kubectl get configmap skywalking-nodejs-agent-config -n vibecode-platform -o yaml
kubectl get configmap skywalking-python-agent-config -n vibecode-platform -o yaml

# Verify connectivity
kubectl exec -n vibecode-platform <app-pod> -- \
  nc -zv oap.skywalking 11800

# Check OAP for incoming traces
kubectl exec -n skywalking <oap-pod> -- \
  curl -X POST http://localhost:12800/graphql \
  -d '{"query":"query {getTraces(condition:{},paging:{pageNum:1,pageSize:10}){total traces{key}}}"}'
```

### Anomaly Detection Not Working

```bash
# Check if AI pipeline is enabled
kubectl exec -n skywalking <oap-pod> -- env | grep SW_AI

# Verify baseline training job completed
kubectl get job skywalking-initial-training -n skywalking

# Check training logs
kubectl logs -n skywalking job/skywalking-initial-training

# Manually trigger baseline recalculation
kubectl exec -n skywalking <oap-pod> -- \
  curl -X POST http://localhost:12800/graphql \
  -d '{"query":"mutation {trainBaselineModels(period:\"7d\"){success message}}"}'
```

### Datadog Integration Issues

```bash
# Check OTLP collector logs
kubectl logs -n skywalking -l app=otel-collector

# Verify Datadog secret
kubectl get secret datadog-secret -n skywalking

# Test OTLP endpoint
kubectl exec -n skywalking <otel-collector-pod> -- \
  curl -v https://http-intake.logs.datadoghq.com \
  -H "DD-API-KEY: $DD_API_KEY"

# Check if traces are reaching Datadog
# In Datadog UI: APM → Traces → Filter by source:skywalking
```

### Rover eBPF Agents Not Running

```bash
# Check DaemonSet status
kubectl get daemonset skywalking-rover -n skywalking

# Common issues:
# 1. Kernel version too old (need 4.15+)
uname -r

# 2. eBPF not enabled
zgrep CONFIG_BPF /proc/config.gz

# 3. Insufficient permissions
kubectl get pods -n skywalking -l app.kubernetes.io/name=rover -o yaml | \
  grep -A 10 securityContext
```

## Maintenance

### Baseline Model Retraining

Baselines are automatically retrained daily at 2 AM. To trigger manually:

```bash
kubectl create job skywalking-manual-training \
  --from=cronjob/skywalking-baseline-training \
  -n skywalking
```

### Storage Management

Monitor BanyanDB storage:

```bash
# Check storage usage
kubectl exec -n skywalking <banyandb-pod> -- df -h /data

# Adjust retention if needed
kubectl edit configmap skywalking-ai-config -n skywalking
# Change: BANYANDB_TTL: 168h (7 days)
```

### Scaling

Scale OAP for higher load:

```bash
kubectl scale deployment oap -n skywalking --replicas=3
```

Scale BanyanDB (requires StatefulSet):

```bash
kubectl scale statefulset banyandb -n skywalking --replicas=3
```

## Integration with Existing Monitoring

### Datadog Dashboard

Access the unified dashboard in Datadog:
1. Go to Dashboards → Dashboard List
2. Search for "Unified Observability Dashboard"
3. Or create custom dashboard using `source:skywalking` tag

### Prometheus

SkyWalking metrics are available in Prometheus:

```promql
# Anomaly scores
skywalking_anomaly_score

# Service metrics
skywalking_service_response_time_p99
skywalking_service_error_rate
skywalking_service_throughput

# Agent metrics
skywalking_agent_task_duration
skywalking_agent_task_success_rate
```

### Grafana

Import the provided dashboard:
1. Go to Dashboards → Import
2. Upload `dashboard.json` from AI anomaly config
3. Select Prometheus data source

## Best Practices

1. **Baseline Learning**: Allow 7 days for accurate baselines
2. **Sensitivity Tuning**: Start with medium, adjust based on alert volume
3. **Resource Monitoring**: Watch OAP memory usage, scale if needed
4. **Alert Routing**: Configure appropriate channels for your team
5. **Regular Reviews**: Review anomaly detection accuracy weekly
6. **Model Updates**: Retrain baselines after major traffic pattern changes
7. **Correlation Analysis**: Use correlated anomalies for root cause analysis

## Security Considerations

1. **Network Policies**: Applied to limit ingress/egress
2. **RBAC**: Least privilege access to SkyWalking components
3. **Secret Management**: Use external secret managers in production
4. **TLS**: Enable for OAP, UI, and OTLP collector in production
5. **eBPF Security**: Rover runs privileged but isolated per node

## Advantages Over Datadog Alone

1. **AI Anomaly Detection**: ML models trained on your specific traffic patterns
2. **Zero-code eBPF**: No application restarts or code changes required
3. **Cost Efficiency**: Complementary, not replacement (selective forwarding)
4. **Custom Metrics**: Agent task metrics and VibeCode-specific observability
5. **Multi-vendor**: Avoid vendor lock-in with open-source solution
6. **Real-time Anomalies**: <2 min detection time with streaming analysis

## Support and Documentation

- **SkyWalking Docs**: https://skywalking.apache.org/docs/
- **eBPF Rover**: https://skywalking.apache.org/docs/skywalking-rover/
- **BanyanDB**: https://skywalking.apache.org/docs/skywalking-banyandb/
- **Community**: https://skywalking.apache.org/community/

## License

Apache SkyWalking is licensed under Apache License 2.0.
This deployment configuration is MIT licensed.
