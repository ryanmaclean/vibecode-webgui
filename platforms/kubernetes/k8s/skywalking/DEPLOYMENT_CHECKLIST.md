# SkyWalking Deployment Checklist

Use this checklist to ensure successful deployment and operation of Apache SkyWalking.

## Pre-Deployment

### Environment Setup
- [ ] Kubernetes cluster accessible (kubectl cluster-info works)
- [ ] Helm 3.0+ installed
- [ ] Cluster has 3+ nodes
- [ ] At least 5 CPU cores and 10GB RAM available
- [ ] Storage provisioner available (for PVCs)

### Credentials and Secrets
- [ ] Datadog API key obtained
- [ ] Datadog App key obtained (optional)
- [ ] Slack webhook URL configured
- [ ] PagerDuty routing key configured
- [ ] Environment variables exported

### Existing Infrastructure
- [ ] Datadog agent running (check: `kubectl get datadog -n default`)
- [ ] Prometheus Operator installed (optional)
- [ ] Ingress controller deployed (nginx recommended)
- [ ] cert-manager installed (for TLS)

## Deployment

### Core Components
- [ ] Namespaces created (skywalking, vibecode-platform)
- [ ] Helm repository added (apache/skywalking)
- [ ] Secrets created (datadog-secret, skywalking-integration-secrets)
- [ ] SkyWalking Helm chart deployed
- [ ] BanyanDB StatefulSet running (2/2 replicas)
- [ ] OAP Deployment running (2/2 replicas)
- [ ] UI Deployment running (1/1 replica)
- [ ] Rover DaemonSet running (N/N pods, one per node)

### AI/ML Configuration
- [ ] AI anomaly detection ConfigMap created
- [ ] Baseline training Job created
- [ ] CronJob for daily training scheduled
- [ ] Alert rules configured

### Datadog Integration
- [ ] OTLP Collector Deployment running (2/2 replicas)
- [ ] Integration ConfigMap created
- [ ] ServiceMonitor created (if Prometheus Operator available)

### Agent Instrumentation
- [ ] Node.js agent ConfigMap created
- [ ] Python agent ConfigMap created
- [ ] Custom span attributes defined
- [ ] Application deployments patched (or restart planned)

## Post-Deployment Verification

### Component Health
- [ ] OAP health check passes: `curl http://oap:12800/internal/l7check`
- [ ] BanyanDB connectivity verified
- [ ] UI accessible via port-forward or ingress
- [ ] Rover agents running on all nodes

### Trace Collection
- [ ] Traces visible in SkyWalking UI
- [ ] Services appear in topology view
- [ ] Distributed tracing working (cross-service spans)
- [ ] Trace sampling rate appropriate (100% initially)

### AI Anomaly Detection
- [ ] Initial baseline training completed
- [ ] Anomaly scores visible in UI
- [ ] Alert rules active
- [ ] CronJob schedule verified

### Datadog Integration
- [ ] OTLP collector healthy
- [ ] Traces forwarded to Datadog (check Datadog APM)
- [ ] `source:skywalking` tag visible in Datadog
- [ ] Unified dashboard accessible

### Alert Routing
- [ ] PagerDuty integration tested (send test alert)
- [ ] Slack notifications working (test in #alerts-anomaly)
- [ ] Datadog Events appearing
- [ ] Alert severity routing correct

### Performance
- [ ] CPU overhead <1% for eBPF, <5% for agents
- [ ] Memory usage <100MB per agent
- [ ] Trace latency <5ms added
- [ ] Anomaly detection time <2 minutes

## Operations

### Daily Monitoring
- [ ] Check OAP health endpoint daily
- [ ] Review anomaly dashboard for unusual patterns
- [ ] Verify trace collection rate >90%
- [ ] Monitor BanyanDB storage usage
- [ ] Check alert routing (Slack, PagerDuty)
- [ ] Review resource usage trends

### Weekly Maintenance
- [ ] Review anomaly detection accuracy
- [ ] Tune sensitivity if false positives high
- [ ] Check baseline model performance
- [ ] Verify 7-day trace retention
- [ ] Review resource usage trends
- [ ] Update alert routing if needed

### Monthly Review
- [ ] Analyze anomaly patterns (services, times)
- [ ] Review and update anomaly thresholds
- [ ] Optimize model parameters
- [ ] Assess storage growth rate
- [ ] Plan capacity expansion if needed
- [ ] Update documentation and runbooks

## Troubleshooting Checklist

### No Traces Appearing
- [ ] Check OAP logs: `kubectl logs -n skywalking -l app.kubernetes.io/name=oap`
- [ ] Verify agent connectivity: `nc -zv oap.skywalking 11800`
- [ ] Check BanyanDB: `nc -zv banyandb 17912`
- [ ] Restart application pods to reinject agents
- [ ] Verify agent environment variables

### Anomaly Detection Issues
- [ ] Check AI pipeline enabled: `env | grep SW_AI`
- [ ] Verify baseline training completed
- [ ] Check anomaly scores in OAP GraphQL API
- [ ] Lower threshold temporarily for testing
- [ ] Manually trigger training if needed

### High Resource Usage
- [ ] Check resource usage: `kubectl top pods -n skywalking`
- [ ] Review OAP configuration
- [ ] Check trace ingestion rate
- [ ] Reduce sampling rate if needed
- [ ] Scale up resources if necessary

### Datadog Integration Broken
- [ ] Check OTLP collector logs
- [ ] Test Datadog API key validity
- [ ] Verify OTLP collector metrics
- [ ] Check network policies
- [ ] Restart OTLP collector

### Rover eBPF Not Working
- [ ] Check Rover pod status and logs
- [ ] Verify kernel version (need 4.15+)
- [ ] Check eBPF support in kernel
- [ ] Verify security context (privileged: true)
- [ ] Disable eBPF if kernel unsupported

## Scaling Checklist

### When to Scale
- [ ] OAP CPU >70% sustained
- [ ] OAP memory >80%
- [ ] BanyanDB storage >80%
- [ ] Trace ingestion lag >30s
- [ ] Alert processing lag >1 min

### How to Scale
- [ ] Scale OAP: `kubectl scale deployment oap --replicas=3`
- [ ] Scale BanyanDB: `kubectl scale statefulset banyandb --replicas=3`
- [ ] Scale OTLP Collector: `kubectl scale deployment skywalking-otel-collector --replicas=3`
- [ ] Increase resource limits in values file
- [ ] Update storage size if needed

## Rollback Checklist

### If Deployment Fails
- [ ] Save deployment logs for analysis
- [ ] Check Helm release history: `helm history skywalking -n skywalking`
- [ ] Rollback Helm: `helm rollback skywalking -n skywalking`
- [ ] Remove agent configurations from apps
- [ ] Restart application pods
- [ ] Notify team of rollback

### If Performance Degrades
- [ ] Identify problematic component
- [ ] Reduce sampling rate temporarily
- [ ] Scale up resources
- [ ] Disable AI anomaly detection if needed
- [ ] Revert to previous configuration

## Documentation Checklist

### Maintain Documentation
- [ ] Update README.md with any changes
- [ ] Document custom configurations
- [ ] Update troubleshooting guide with new issues
- [ ] Keep runbooks current
- [ ] Document operational procedures

### Training
- [ ] Train ops team on SkyWalking UI
- [ ] Document common workflows
- [ ] Share troubleshooting guide
- [ ] Conduct incident response drills
- [ ] Update on-call playbooks

## Compliance and Security

### Security Review
- [ ] Verify RBAC permissions (least privilege)
- [ ] Check secret management (rotate regularly)
- [ ] Review network policies
- [ ] Audit privileged containers (Rover)
- [ ] Enable TLS for production

### Audit Trail
- [ ] Document all configuration changes
- [ ] Log all manual interventions
- [ ] Track anomaly detection tuning
- [ ] Record scaling events
- [ ] Maintain incident reports

## Success Criteria

### Deployment Success
- [ ] All pods running and healthy
- [ ] Traces visible in UI within 5 minutes
- [ ] AI anomaly detection active
- [ ] Datadog integration working
- [ ] Alerts routing correctly

### Performance Success
- [ ] Overhead within targets (<1% eBPF, <5% agents)
- [ ] Anomaly detection accuracy >90%
- [ ] Detection time <2 minutes
- [ ] No application performance degradation

### Operational Success
- [ ] Team trained and confident
- [ ] Documentation complete and accessible
- [ ] Runbooks tested and validated
- [ ] On-call procedures updated
- [ ] Stakeholders informed

---

## Quick Commands Reference

```bash
# Deploy
cd k8s/skywalking && ./deploy.sh

# Verify
./verify-deployment.sh

# Access UI
kubectl port-forward -n skywalking svc/ui 8080:8080

# Check health
kubectl get pods -n skywalking
kubectl logs -n skywalking -l app.kubernetes.io/name=oap

# Scale
kubectl scale deployment oap -n skywalking --replicas=3

# Rollback
helm rollback skywalking -n skywalking

# Restart
kubectl rollout restart deployment oap -n skywalking
```

---

**Deployment Owner**: _______________
**Date Completed**: _______________
**Next Review**: _______________

**Sign-off**: _______________
