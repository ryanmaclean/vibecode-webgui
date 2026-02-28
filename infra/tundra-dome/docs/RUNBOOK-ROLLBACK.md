# Tundra Dome Multi-Cluster Rollback Runbook

**Version**: 1.0.0
**Last Updated**: 2026-02-24
**Owner**: Platform Engineering Team
**Criticality**: HIGH - Use for production incidents

---

## Table of Contents

- [Overview](#overview)
- [When to Rollback](#when-to-rollback)
- [Pre-Rollback Checklist](#pre-rollback-checklist)
- [Rollback Procedures](#rollback-procedures)
  - [Quick Rollback (Emergency)](#quick-rollback-emergency)
  - [Phase 5: Cloud Resources (Terraform)](#phase-5-cloud-resources-terraform)
  - [Phase 4: Airflow DAGs](#phase-4-airflow-dags)
  - [Phase 3: Federation Controller](#phase-3-federation-controller)
  - [Phase 2: Observability Pipeline](#phase-2-observability-pipeline)
  - [Phase 1: Local Clusters](#phase-1-local-clusters)
- [Verification](#verification)
- [Data Preservation](#data-preservation)
- [Post-Rollback](#post-rollback)
- [Troubleshooting](#troubleshooting)

---

## Overview

This runbook provides procedures for rolling back the Tundra Dome multi-cluster deployment in case of:

- **Critical Failures**: Service outages, data corruption, security incidents
- **Performance Degradation**: Unacceptable latency or resource consumption
- **Failed Deployment**: Unable to complete deployment successfully
- **Incompatibility Issues**: Breaking changes with existing services

### Rollback Timeline

- **Quick Rollback**: 5-10 minutes (delete problematic components)
- **Full Rollback**: 15-30 minutes (all phases)
- **Cloud Rollback**: 30-60 minutes (includes Terraform destroy)

### Risk Assessment

| Risk Level | Impact | Examples |
|------------|--------|----------|
| **Critical** | Service outage, data loss | Federation controller corrupting beads |
| **High** | Major functionality broken | Cross-cluster sync failing |
| **Medium** | Partial functionality impacted | Monitoring DAGs not running |
| **Low** | Minor issues, workarounds available | Log collection delayed |

---

## When to Rollback

### Immediate Rollback Required

Execute rollback **immediately** if you observe:

- [ ] Federation controller is deleting or corrupting beads
- [ ] Observability pipeline is dropping critical logs
- [ ] Cluster-wide resource exhaustion (OOM, CPU spike)
- [ ] Security vulnerability actively being exploited
- [ ] Data corruption or consistency issues
- [ ] Unable to access critical services (Airflow, PostgreSQL, Kafka)

### Planned Rollback

Schedule rollback if you observe:

- [ ] Persistent pod crashes (>5 restarts in 10 minutes)
- [ ] Deployment verification tests failing
- [ ] Performance degradation >30% compared to baseline
- [ ] Multiple non-critical errors in logs
- [ ] Incompatibility with existing workloads

### Do NOT Rollback

Avoid rollback for:

- [ ] Minor log noise without functional impact
- [ ] Single pod restart (normal Kubernetes behavior)
- [ ] Expected resource increase within capacity limits
- [ ] Configuration tweaks needed (fix-forward instead)

---

## Pre-Rollback Checklist

Before initiating rollback:

### Incident Response

```bash
# Declare incident (if applicable)
# Notify stakeholders via Slack #incidents
# Start incident timeline documentation

# Capture current state for post-mortem
INCIDENT_ID="INC-$(date +%Y%m%d-%H%M%S)"
mkdir -p /tmp/rollback-${INCIDENT_ID}
cd /tmp/rollback-${INCIDENT_ID}

# Export current state
kubectl get all -n tundra-dome -o yaml > before-rollback-tundra-dome.yaml
kubectl get all -n datadog -o yaml > before-rollback-datadog.yaml
kubectl get beads -A -o yaml > before-rollback-beads.yaml || true

# Capture logs
kubectl logs -n tundra-dome -l app=federation-controller --tail=500 > federation-controller.log
kubectl logs -n datadog -l app.kubernetes.io/name=observability-pipelines-worker --tail=500 > opw.log
kubectl logs -n tundra-dome -l app=airflow-scheduler --tail=200 > airflow-scheduler.log

# Screenshot monitoring dashboards
# (Manual step: capture Datadog, Grafana, etc.)
```

### Backup Critical Data

```bash
# Export custom resources
kubectl get beads -A -o yaml > backup-beads-$(date +%Y%m%d-%H%M%S).yaml
kubectl get configmaps -n tundra-dome -o yaml > backup-configmaps-$(date +%Y%m%d-%H%M%S).yaml

# Export Airflow state (if applicable)
kubectl exec -n tundra-dome deployment/airflow-scheduler -- \
  airflow dags list > backup-airflow-dags.txt

# Copy to safe location
cp backup-*.yaml ~/backups/
```

### Verify Rollback Authority

- [ ] Incident commander identified
- [ ] Stakeholders notified (platform team, SRE, dev teams)
- [ ] Change approval obtained (for production)
- [ ] Backup person standing by

---

## Rollback Procedures

### Quick Rollback (Emergency)

**Use Case**: Critical incident, need to stop bleeding immediately

**Duration**: 5-10 minutes

```bash
# Stop all new deployments
kubectl scale deployment federation-controller -n tundra-dome --replicas=0
kubectl scale deployment observability-pipelines-worker -n datadog --replicas=0

# Disable Airflow DAGs
kubectl exec -n tundra-dome deployment/airflow-scheduler -- \
  airflow dags pause tundra_github_sync
kubectl exec -n tundra-dome deployment/airflow-scheduler -- \
  airflow dags pause tundra_lane_health
kubectl exec -n tundra-dome deployment/airflow-scheduler -- \
  airflow dags pause tundra_polecat_scaler
kubectl exec -n tundra-dome deployment/airflow-scheduler -- \
  airflow dags pause tundra_sla_monitor

# Verify everything is stopped
kubectl get pods -n tundra-dome | grep -E "(federation|openlineage)"
kubectl get pods -n datadog | grep observability

echo "✓ Quick rollback complete. Problematic components stopped."
echo "→ Follow detailed rollback phases to complete removal."
```

**Note**: This stops the bleeding but doesn't remove components. Continue with detailed rollback phases.

---

### Phase 5: Cloud Resources (Terraform)

**Duration**: 30-60 minutes
**Risk**: High (destroys cloud resources)
**Prerequisites**: Backup all data, confirm no production workloads

⚠️ **WARNING**: This will destroy cloud infrastructure and is **irreversible**.

#### Step 5.1: Verify No Production Workloads

```bash
# For EKS
cd infra/tundra-dome/terraform/eks
kubectl config use-context <eks-context>
kubectl get pods -A

# Confirm no critical workloads running
echo "Confirm: Are there any production workloads? (yes/no)"
read -r response
if [ "$response" != "no" ]; then
    echo "ABORT: Production workloads detected. Migrate first."
    exit 1
fi
```

#### Step 5.2: Destroy Cloud Clusters

```bash
# Destroy EKS (AWS)
cd infra/tundra-dome/terraform/eks
terraform plan -destroy -out=destroy.tfplan
terraform apply destroy.tfplan

# Destroy GKE (GCP)
cd ../gke
terraform plan -destroy -out=destroy.tfplan
terraform apply destroy.tfplan

# Destroy AKS (Azure)
cd ../aks
terraform plan -destroy -out=destroy.tfplan
terraform apply destroy.tfplan

# Verify destruction
aws eks list-clusters  # Should not include tundra-dome cluster
gcloud container clusters list  # Should not include tundra-dome cluster
az aks list  # Should not include tundra-dome cluster
```

**Checkpoint**: Cloud resources destroyed, no remaining billable infrastructure.

---

### Phase 4: Airflow DAGs

**Duration**: 5 minutes
**Risk**: Low
**Prerequisites**: None

#### Step 4.1: Disable and Remove DAGs

```bash
# Pause all Tundra DAGs
kubectl exec -n tundra-dome deployment/airflow-scheduler -- \
  airflow dags pause tundra_github_sync
kubectl exec -n tundra-dome deployment/airflow-scheduler -- \
  airflow dags pause tundra_lane_health
kubectl exec -n tundra-dome deployment/airflow-scheduler -- \
  airflow dags pause tundra_polecat_scaler
kubectl exec -n tundra-dome deployment/airflow-scheduler -- \
  airflow dags pause tundra_sla_monitor

# Wait for running tasks to complete (max 5 minutes)
for i in {1..10}; do
    running=$(kubectl exec -n tundra-dome deployment/airflow-scheduler -- \
        airflow tasks states-for-dag-run tundra_github_sync | grep -c running || echo 0)
    if [ "$running" -eq 0 ]; then
        break
    fi
    echo "Waiting for tasks to complete... ($i/10)"
    sleep 30
done

# Remove DAG ConfigMap
kubectl delete configmap airflow-dags -n tundra-dome || true

# Restart Airflow scheduler to clear DAGs
kubectl rollout restart deployment airflow-scheduler -n tundra-dome
kubectl rollout status deployment airflow-scheduler -n tundra-dome
```

#### Step 4.2: Verify DAGs Removed

```bash
# Check Airflow UI or CLI
kubectl exec -n tundra-dome deployment/airflow-scheduler -- \
  airflow dags list | grep -E "(github_sync|lane_health|polecat_scaler|sla_monitor)"

# Expected: No output (DAGs removed)
```

**Checkpoint**: Airflow DAGs are disabled and removed.

---

### Phase 3: Federation Controller

**Duration**: 5 minutes
**Risk**: Medium (affects cross-cluster sync)
**Prerequisites**: Ensure no active bead sync operations

#### Step 3.1: Scale Down Federation Controller

```bash
# Scale to zero replicas
kubectl scale deployment federation-controller -n tundra-dome --replicas=0

# Wait for pod termination
kubectl wait --for=delete pod -l app=federation-controller -n tundra-dome --timeout=60s

# Verify stopped
kubectl get pods -n tundra-dome -l app=federation-controller
```

#### Step 3.2: Remove Federation Resources

```bash
# Delete federation controller deployment
kubectl delete deployment federation-controller -n tundra-dome

# Delete ConfigMaps
kubectl delete configmap bead-sync-controller-code -n tundra-dome || true

# Delete RBAC resources
kubectl delete clusterrolebinding tundra-dome-federation
kubectl delete clusterrole tundra-dome-federation
kubectl delete serviceaccount tundra-dome-federation -n tundra-dome

# Verify removal
kubectl get all -n tundra-dome -l app=federation-controller
# Expected: No resources found
```

**Checkpoint**: Federation controller removed, cross-cluster sync stopped.

---

### Phase 2: Observability Pipeline

**Duration**: 5-10 minutes
**Risk**: Low (stops log collection)
**Prerequisites**: Ensure alternative logging if needed

#### Step 2.1: Remove OpenLineage Bridge

```bash
# Delete bridge deployment
kubectl delete deployment openlineage-bead -n tundra-dome || true

# Delete bridge ConfigMap
kubectl delete configmap openlineage-bead-code -n tundra-dome || true

# Verify removal
kubectl get pods -n tundra-dome -l app=openlineage-bead
# Expected: No resources found
```

#### Step 2.2: Uninstall Datadog Observability Pipelines Worker

```bash
# Uninstall Helm release
helm uninstall observability-pipelines-worker -n datadog

# Wait for cleanup
kubectl wait --for=delete pod -l app.kubernetes.io/name=observability-pipelines-worker \
  -n datadog --timeout=60s

# Delete Datadog secrets (optional, keep if other Datadog components exist)
kubectl delete secret datadog-secret -n datadog || true

# Verify removal
kubectl get all -n datadog
```

#### Step 2.3: Cleanup Datadog Namespace (Optional)

```bash
# Only if no other Datadog components exist
kubectl get all -n datadog

# If empty, delete namespace
kubectl delete namespace datadog
```

**Checkpoint**: Observability pipeline removed, logs no longer forwarded to Datadog.

---

### Phase 1: Local Clusters

**Duration**: 5 minutes
**Risk**: High (destroys local development environment)
**Prerequisites**: Backup any important data

⚠️ **WARNING**: This will delete all local KIND clusters. Ensure no important data is stored.

#### Step 1.1: Delete Additional Clusters

```bash
# Delete vibecode-local cluster
kind delete cluster --name vibecode-local

# Delete gastown cluster
kind delete cluster --name gastown

# Verify deletion
kind get clusters
```

#### Step 1.2: Delete Main Cluster (Optional)

```bash
# Only delete main cluster if full rollback needed
kind delete cluster --name tundra-dome

# Verify all clusters deleted
kind get clusters
docker ps | grep kindest/node
```

#### Step 1.3: Cleanup Cluster Registry

```bash
# Remove cluster registry file
rm -f infra/tundra-dome/clusters/registry.yaml.applied || true

# Cleanup kubectl contexts
kubectl config delete-context kind-tundra-dome || true
kubectl config delete-context kind-gastown || true
kubectl config delete-context kind-vibecode-local || true
```

**Checkpoint**: All local clusters removed.

---

## Verification

### Rollback Verification Checks

```bash
# Check no federation components exist
kubectl get all -n tundra-dome -l app=federation-controller
kubectl get clusterrole tundra-dome-federation
# Expected: No resources found

# Check no observability pipeline
kubectl get all -n datadog
# Expected: No resources found (or only other Datadog components)

# Check no Tundra DAGs in Airflow
kubectl exec -n tundra-dome deployment/airflow-scheduler -- \
  airflow dags list | grep tundra
# Expected: No output

# Check clusters
kind get clusters
# Expected: Only clusters you want to keep

# Check cloud resources
aws eks list-clusters | grep tundra
gcloud container clusters list | grep tundra
az aks list | grep tundra
# Expected: No output
```

### Service Health Checks

```bash
# Verify core services still working (if not full rollback)
kubectl get pods -n tundra-dome | grep -E "(airflow|kafka|postgresql)"

# Check Airflow is accessible
kubectl port-forward svc/airflow-webserver 8080:8080 -n tundra-dome &
curl -I http://localhost:8080/health

# Check Kafka is healthy
kubectl exec -n tundra-dome deployment/kafka-broker -- \
  kafka-broker-api-versions --bootstrap-server localhost:9092

# Check PostgreSQL is accessible
kubectl exec -n tundra-dome deployment/postgresql -- \
  psql -U postgres -c "SELECT 1"
```

---

## Data Preservation

### Beads Backup

```bash
# Export all beads before rollback
kubectl get beads -A -o yaml > beads-backup-$(date +%Y%m%d-%H%M%S).yaml

# Restore after rollback (if needed)
kubectl apply -f beads-backup-<timestamp>.yaml
```

### Airflow State Backup

```bash
# Export Airflow DAG run history
kubectl exec -n tundra-dome deployment/airflow-scheduler -- \
  airflow dags list-runs > airflow-runs-backup.txt

# Export XCom data (if critical)
kubectl exec -n tundra-dome deployment/airflow-scheduler -- \
  airflow db shell -c "SELECT * FROM xcom WHERE dag_id LIKE 'tundra%'" \
  > airflow-xcom-backup.txt
```

### Logs Backup

```bash
# Export all logs before rollback
kubectl logs -n tundra-dome --all-containers=true --prefix=true --timestamps=true \
  > tundra-dome-logs-$(date +%Y%m%d-%H%M%S).log

kubectl logs -n datadog --all-containers=true --prefix=true --timestamps=true \
  > datadog-logs-$(date +%Y%m%d-%H%M%S).log
```

---

## Post-Rollback

### Documentation

```bash
# Document rollback details
cat >> rollback-log.txt <<EOF
Rollback Date: $(date)
Rolled Back By: $USER
Reason: <describe reason>
Phases Rolled Back: <list phases>
Data Preserved: <yes/no and what>
Incident ID: ${INCIDENT_ID}
Notes: <additional notes>
EOF

# Commit rollback log
git add rollback-log.txt
git commit -m "ops: rollback multi-cluster deployment - ${INCIDENT_ID}"
```

### Incident Post-Mortem

Schedule post-mortem meeting within 24 hours to:

1. Review timeline of events
2. Identify root cause
3. Determine preventive measures
4. Update runbooks based on learnings

### Cleanup

```bash
# Remove temporary backup files (after confirming not needed)
cd /tmp/rollback-${INCIDENT_ID}
tar -czf rollback-${INCIDENT_ID}-archive.tar.gz .
mv rollback-${INCIDENT_ID}-archive.tar.gz ~/archives/
cd ~
rm -rf /tmp/rollback-${INCIDENT_ID}
```

### Communication

Send rollback notification:

**Subject**: ⚠️ Tundra Dome Multi-Cluster Rollback Complete

**Body**:
```
The Tundra Dome multi-cluster deployment has been rolled back due to:
<Reason for rollback>

Components Rolled Back:
- [ ] Cloud clusters (EKS/GKE/AKS)
- [ ] Airflow DAGs
- [ ] Federation controller
- [ ] Observability pipeline
- [ ] Local clusters

Impact:
<Describe impact on users and services>

Data Preservation:
<Describe what data was preserved>

Next Steps:
1. Post-mortem scheduled for <date/time>
2. Root cause analysis in progress
3. Fix-forward plan to be developed

Contact: Platform Engineering Team
Incident ID: ${INCIDENT_ID}
```

---

## Troubleshooting

### Issue: Rollback Stuck on Resource Deletion

**Symptoms**: `kubectl delete` hangs indefinitely

**Resolution**:
```bash
# Check for finalizers
kubectl get <resource> <name> -n <namespace> -o yaml | grep finalizers

# Force delete by removing finalizers
kubectl patch <resource> <name> -n <namespace> \
  -p '{"metadata":{"finalizers":[]}}' --type=merge

# If still stuck, force delete
kubectl delete <resource> <name> -n <namespace> --grace-period=0 --force
```

---

### Issue: Helm Uninstall Fails

**Symptoms**: `helm uninstall` errors out

**Resolution**:
```bash
# Check Helm release status
helm list -n datadog

# Try uninstall with cleanup
helm uninstall observability-pipelines-worker -n datadog --wait

# If still fails, manual cleanup
kubectl delete all -l app.kubernetes.io/instance=observability-pipelines-worker -n datadog
helm delete observability-pipelines-worker -n datadog --no-hooks
```

---

### Issue: Terraform Destroy Fails

**Symptoms**: `terraform destroy` errors with dependency issues

**Resolution**:
```bash
# Refresh state
terraform refresh

# Target specific resources
terraform destroy -target=module.eks

# If completely stuck, manual cleanup
# WARNING: Last resort only
terraform state rm <resource>
# Then manually delete in cloud console
```

---

### Issue: Cluster Contexts Not Cleaned

**Symptoms**: `kubectl config get-contexts` shows removed clusters

**Resolution**:
```bash
# List all contexts
kubectl config get-contexts

# Delete specific context
kubectl config delete-context kind-tundra-dome
kubectl config delete-context kind-gastown
kubectl config delete-context kind-vibecode-local

# Or edit kubeconfig directly
vim ~/.kube/config
# Remove contexts, clusters, and users sections for removed clusters
```

---

### Issue: Data Loss During Rollback

**Symptoms**: Critical beads or configuration missing after rollback

**Resolution**:
```bash
# Restore from backup
cd ~/backups/
kubectl apply -f backup-beads-<timestamp>.yaml
kubectl apply -f backup-configmaps-<timestamp>.yaml

# Verify restoration
kubectl get beads -A
kubectl get configmaps -n tundra-dome

# If backup not available, check version control
cd infra/tundra-dome
git log --oneline -- clusters/registry.yaml
git checkout <commit> -- clusters/registry.yaml
kubectl apply -f clusters/registry.yaml
```

---

## Emergency Contacts

### Escalation Path

1. **Platform Engineering Team** - Primary contact for rollback execution
2. **SRE Team** - For infrastructure and monitoring support
3. **On-Call Manager** - For critical production issues
4. **VP Engineering** - For business impact decisions

### Contact Information

- **Slack**: #incidents (critical), #platform-engineering (general)
- **PagerDuty**: Platform Engineering on-call rotation
- **Email**: platform-team@example.com
- **Phone**: <emergency hotline>

---

## Related Documentation

- [Multi-Cluster Architecture](./MULTI-CLUSTER-ARCHITECTURE.md)
- [Rollforward Runbook](./RUNBOOK-ROLLFORWARD.md)
- [Incident Response Playbook](../../../docs/INCIDENT_RESPONSE.md)
- [Disaster Recovery Plan](../../../docs/DISASTER_RECOVERY.md)

---

**End of Rollback Runbook**
