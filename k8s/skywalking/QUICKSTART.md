# SkyWalking Quick Start Guide

Get Apache SkyWalking with AI anomaly detection up and running in 10 minutes.

## Prerequisites

```bash
# Required
kubectl (1.24+)
helm (3.0+)
Kubernetes cluster with 3+ nodes

# Optional
Datadog agent (for integration)
```

## 1. Set Environment Variables

```bash
export DD_API_KEY=your_datadog_api_key
export SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
export PAGERDUTY_ROUTING_KEY=your_pagerduty_routing_key
```

## 2. Deploy

```bash
cd k8s/skywalking
./deploy.sh
```

Expected output:
```
[INFO] Checking prerequisites...
[SUCCESS] Prerequisites check passed
[INFO] Creating namespaces...
[SUCCESS] Namespaces created
[INFO] Adding SkyWalking Helm repository...
[SUCCESS] Helm repository added
[INFO] Deploying SkyWalking core components...
[SUCCESS] SkyWalking core components deployed
[INFO] Deploying AI anomaly detection configuration...
[SUCCESS] AI anomaly detection configured
[INFO] Deploying Datadog integration...
[SUCCESS] Datadog integration deployed
[INFO] Deploying SkyWalking agents...
[SUCCESS] Agent configurations deployed
[INFO] Waiting for components to be ready...
[SUCCESS] All components are ready
[SUCCESS] SkyWalking deployment complete!
```

## 3. Verify

```bash
./verify-deployment.sh
```

Expected: 10+ tests passed

## 4. Access UI

```bash
kubectl port-forward -n skywalking svc/ui 8080:8080
```

Open: http://localhost:8080

## 5. Check Traces

In SkyWalking UI:
1. Go to "Services"
2. Select "vibecode-webgui" or "agentapi"
3. View "Trace" tab
4. See distributed traces

## 6. Check Anomaly Detection

In SkyWalking UI:
1. Go to "AI Anomalies"
2. View real-time anomaly scores
3. Check alert history

## 7. Check Datadog Integration

In Datadog:
1. Go to APM → Traces
2. Filter by: `source:skywalking`
3. View SkyWalking traces in Datadog

## Troubleshooting

**No traces appearing?**
```bash
# Restart application pods
kubectl rollout restart deployment vibecode-webgui -n vibecode-platform
kubectl rollout restart deployment agentapi -n vibecode-platform

# Wait 2-3 minutes, then check again
```

**Agents not injected?**
```bash
# Verify agent configs exist
kubectl get configmap -n vibecode-platform | grep skywalking

# Check agent environment
kubectl get pod <app-pod> -n vibecode-platform -o yaml | grep SW_AGENT
```

**Anomaly detection not working?**
```bash
# Check baseline training
kubectl get job skywalking-initial-training -n skywalking

# Allow 7 days for accurate baselines
# Or manually trigger training:
kubectl create job skywalking-manual-training \
  --from=cronjob/skywalking-baseline-training -n skywalking
```

## Performance Targets

| Metric | Target | How to Check |
|--------|--------|--------------|
| CPU Overhead | <1% | `kubectl top pods -n skywalking` |
| Memory per Agent | <100MB | `kubectl top pods -n vibecode-platform` |
| Anomaly Detection | <2 min | SkyWalking UI → AI Anomalies |
| Trace Collection | >90% | SkyWalking UI → Dashboard → Trace Rate |

## Key Commands

```bash
# View logs
kubectl logs -n skywalking -l app.kubernetes.io/name=oap
kubectl logs -n skywalking -l app.kubernetes.io/name=rover

# Scale components
kubectl scale deployment oap -n skywalking --replicas=3
kubectl scale statefulset banyandb -n skywalking --replicas=3

# Restart components
kubectl rollout restart deployment oap -n skywalking
kubectl rollout restart deployment ui -n skywalking

# Check metrics
kubectl port-forward -n skywalking svc/oap 1234:1234
curl http://localhost:1234/metrics
```

## Next Steps

1. **Tune Anomaly Detection**: Edit `ai-anomaly-detection.yaml`, adjust thresholds
2. **Add Custom Metrics**: Extend span attributes in `skywalking-agents.yaml`
3. **Configure Alerts**: Update alert routing in `integration-datadog.yaml`
4. **Review Documentation**: See `README.md` for comprehensive guide

## Getting Help

- **Full Documentation**: See `README.md`
- **Deployment Report**: See `claudedocs/AGENT17_SKYWALKING_DEPLOYMENT_REPORT.md`
- **SkyWalking Docs**: https://skywalking.apache.org/docs/
- **Run Verification**: `./verify-deployment.sh`

## Architecture at a Glance

```
Applications (Node.js + Python)
         ↓ (agents)
    SkyWalking OAP
         ↓ (storage)
      BanyanDB
         ↓ (AI/ML)
  Anomaly Detection
         ↓ (alerts)
  Slack + PagerDuty
         ↓ (integration)
       Datadog
```

**Mission**: Complementary observability with AI-powered insights 🎯
