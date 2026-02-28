# Tundra Dome Multi-Cluster Deployment Runbook

**Version**: 1.0.0
**Last Updated**: 2026-02-24
**Owner**: Platform Engineering Team
**Status**: Production Ready

---

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Pre-Deployment Checklist](#pre-deployment-checklist)
- [Deployment Procedures](#deployment-procedures)
  - [Phase 1: Local Development Clusters](#phase-1-local-development-clusters)
  - [Phase 2: Observability Pipeline](#phase-2-observability-pipeline)
  - [Phase 3: Federation Controller](#phase-3-federation-controller)
  - [Phase 4: Airflow DAGs](#phase-4-airflow-dags)
  - [Phase 5: Cloud Provisioning (Optional)](#phase-5-cloud-provisioning-optional)
- [Verification](#verification)
- [Post-Deployment](#post-deployment)
- [Troubleshooting](#troubleshooting)
- [Communication Plan](#communication-plan)

---

## Overview

This runbook guides you through deploying the Tundra Dome multi-cluster infrastructure, which includes:

- **Local Development Clusters**: KIND-based Kubernetes clusters for local development
- **Observability Pipeline**: Datadog Observability Pipelines Worker for log aggregation
- **Federation Controller**: Cross-cluster bead synchronization for distributed processing
- **Airflow DAGs**: Monitoring and orchestration workflows
- **Cloud Provisioning**: Terraform templates for EKS, GKE, and AKS (production)

### Deployment Timeline

- **Estimated Duration**: 60-90 minutes (local) / 4-6 hours (production cloud)
- **Risk Level**: Medium
- **Rollback Time**: 15-30 minutes
- **Required Personnel**: 1 platform engineer + 1 SRE (standby)

---

## Prerequisites

### Required Tools

```bash
# Verify installation
kind --version           # >= 0.20.0
kubectl version --client # >= 1.28.0
docker --version         # >= 24.0.0
helm version             # >= 3.12.0 (for observability)

# Optional for cloud deployments
terraform --version      # >= 1.6.0
aws --version           # >= 2.13.0 (for EKS)
gcloud version          # >= 450.0.0 (for GKE)
az version              # >= 2.50.0 (for AKS)
```

### Access Requirements

- [ ] Docker daemon running
- [ ] kubectl configured with admin access
- [ ] Datadog API key (for observability pipeline)
- [ ] Cloud provider credentials (for production deployments)
- [ ] GitHub access for webhook integration

### Environment Variables

```bash
# Required for observability
export DD_API_KEY="<your-datadog-api-key>"
export DD_APP_KEY="<your-datadog-app-key>"

# Optional cluster configuration
export TUNDRA_CLUSTER_NAME="tundra-dome"  # Default
export TUNDRA_NAMESPACE="tundra-dome"     # Default
export TUNDRA_ENV="development"           # development|staging|production
```

---

## Pre-Deployment Checklist

Before proceeding, verify:

### Infrastructure Readiness

- [ ] Docker daemon is running and healthy
- [ ] Sufficient disk space (10GB for local, 100GB+ for production)
- [ ] Network connectivity to Docker Hub and artifact registries
- [ ] No port conflicts (8081-8082, 5433-5434 for multi-cluster)

### Code Verification

```bash
# Navigate to repository root
cd ~/path/to/vibecode-webgui

# Verify branch
git branch --show-current  # Should be on main or release branch

# Verify files exist
ls -l infra/tundra-dome/scripts/bootstrap.sh
ls -l infra/tundra-dome/scripts/deploy.sh
ls -l infra/tundra-dome/clusters/registry.yaml
ls -l infra/tundra-dome/terraform/eks/main.tf
```

### Backup Existing State (If Applicable)

```bash
# Export existing cluster state
kubectl get all -n tundra-dome -o yaml > backup-$(date +%Y%m%d-%H%M%S).yaml

# Export cluster registry (if exists)
kubectl get configmap cluster-registry -n tundra-dome -o yaml > cluster-registry-backup.yaml || true
```

---

## Deployment Procedures

### Phase 1: Local Development Clusters

**Duration**: 10-15 minutes
**Risk**: Low
**Rollback**: Delete cluster with `kind delete cluster`

#### Step 1.1: Bootstrap Main Cluster

```bash
cd infra/tundra-dome

# Run prerequisite checks
./scripts/bootstrap.sh --check

# Create main tundra-dome cluster
./scripts/bootstrap.sh

# Verify cluster creation
kubectl cluster-info --context kind-tundra-dome
kubectl get nodes
```

**Expected Output**:
```
✓ All prerequisites satisfied
✓ Creating cluster tundra-dome
✓ Cluster tundra-dome created
✓ Namespace tundra-dome created
```

#### Step 1.2: Create Additional Clusters (Optional)

```bash
# Create gastown development cluster
kind create cluster --name gastown --config clusters/gastown/kind-config.yaml

# Verify gastown cluster
kubectl cluster-info --context kind-gastown
kubectl get nodes --context kind-gastown

# Create vibecode-local cluster
kind create cluster --name vibecode-local --config clusters/vibecode-local/kind-config.yaml

# Verify vibecode-local cluster
kubectl cluster-info --context kind-vibecode-local
kubectl get nodes --context kind-vibecode-local
```

#### Step 1.3: Verify Cluster Registry

```bash
# Apply cluster registry
kubectl apply -f clusters/registry.yaml

# Verify registry
kubectl get configmap -n tundra-dome | grep registry
```

**Checkpoint**: All clusters are running and accessible via kubectl.

---

### Phase 2: Observability Pipeline

**Duration**: 10-15 minutes
**Risk**: Low
**Rollback**: Delete namespace or helm release

#### Step 2.1: Install Datadog Observability Pipelines Worker

```bash
# Add Datadog Helm repository
helm repo add datadog https://helm.datadoghq.com
helm repo update

# Create namespace if not exists
kubectl create namespace datadog || true

# Create Datadog secret
kubectl -n datadog create secret generic datadog-secret \
  --from-literal=DD_API_KEY="${DD_API_KEY}" \
  --from-literal=DD_APP_KEY="${DD_APP_KEY}" \
  --dry-run=client -o yaml | kubectl apply -f -

# Install Observability Pipelines Worker
helm install observability-pipelines-worker \
  datadog/observability-pipelines-worker \
  --namespace datadog \
  --values observability/opw-values.yaml \
  --wait --timeout 5m

# Verify deployment
kubectl get pods -n datadog
kubectl logs -n datadog -l app.kubernetes.io/name=observability-pipelines-worker
```

**Expected Output**:
```
NAME                                          READY   STATUS    RESTARTS   AGE
observability-pipelines-worker-xxxxx-xxxxx    1/1     Running   0          30s
```

#### Step 2.2: Deploy OpenLineage Bridge

```bash
# Apply bridge ConfigMap
kubectl create configmap openlineage-bead-code \
  --from-file=index.js=bridges/openlineage-bead/index.js \
  --from-file=package.json=bridges/openlineage-bead/package.json \
  -n tundra-dome \
  --dry-run=client -o yaml | kubectl apply -f -

# Deploy bridge service
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: openlineage-bead
  namespace: tundra-dome
  labels:
    app: openlineage-bead
spec:
  replicas: 1
  selector:
    matchLabels:
      app: openlineage-bead
  template:
    metadata:
      labels:
        app: openlineage-bead
    spec:
      containers:
      - name: bridge
        image: node:20-alpine
        command: ["sh", "-c", "cp -r /app/* /work/ && cd /work && npm install && node index.js"]
        volumeMounts:
        - name: code
          mountPath: /app
        env:
        - name: OPENLINEAGE_ENDPOINT
          value: "http://localhost:5000"
      volumes:
      - name: code
        configMap:
          name: openlineage-bead-code
EOF

# Verify bridge
kubectl get pods -n tundra-dome -l app=openlineage-bead
kubectl logs -n tundra-dome -l app=openlineage-bead
```

**Checkpoint**: Observability pipeline is receiving and forwarding logs.

---

### Phase 3: Federation Controller

**Duration**: 5-10 minutes
**Risk**: Medium (affects cross-cluster sync)
**Rollback**: Delete deployment

#### Step 3.1: Deploy Federation Controller

```bash
# Apply federation controller manifest
kubectl apply -f federation/federation-controller.yaml

# Verify RBAC
kubectl get serviceaccount tundra-dome-federation -n tundra-dome
kubectl get clusterrole tundra-dome-federation
kubectl get clusterrolebinding tundra-dome-federation

# Verify deployment
kubectl get deployment federation-controller -n tundra-dome
kubectl get pods -n tundra-dome -l app=federation-controller
```

**Expected Output**:
```
NAME                                    READY   STATUS    RESTARTS   AGE
federation-controller-xxxxx-xxxxx       1/1     Running   0          30s
```

#### Step 3.2: Verify Federation Sync

```bash
# Check controller logs
kubectl logs -n tundra-dome -l app=federation-controller --tail=50

# Create test bead to verify sync
kubectl apply -f - <<EOF
apiVersion: tundra.dome/v1
kind: Bead
metadata:
  name: test-bead
  namespace: tundra-dome
spec:
  lane: test-lane
  data: "hello-federation"
EOF

# Wait and verify federation event
sleep 5
kubectl logs -n tundra-dome -l app=federation-controller --tail=20 | grep "test-bead"
```

**Checkpoint**: Federation controller is watching beads and syncing across clusters.

---

### Phase 4: Airflow DAGs

**Duration**: 10-15 minutes
**Risk**: Low (monitoring only)
**Rollback**: Remove DAG files

#### Step 4.1: Deploy DAGs to Airflow

```bash
# Verify Airflow is running
kubectl get pods -n tundra-dome | grep airflow

# Copy DAGs to Airflow DAG folder (method varies by setup)
# Option 1: Using ConfigMap
kubectl create configmap airflow-dags \
  --from-file=dags/ \
  -n tundra-dome \
  --dry-run=client -o yaml | kubectl apply -f -

# Patch Airflow scheduler to use ConfigMap
kubectl patch deployment airflow-scheduler -n tundra-dome -p '
{
  "spec": {
    "template": {
      "spec": {
        "volumes": [{
          "name": "dags",
          "configMap": {"name": "airflow-dags"}
        }],
        "containers": [{
          "name": "scheduler",
          "volumeMounts": [{
            "name": "dags",
            "mountPath": "/opt/airflow/dags"
          }]
        }]
      }
    }
  }
}'

# Restart Airflow scheduler
kubectl rollout restart deployment airflow-scheduler -n tundra-dome
kubectl rollout status deployment airflow-scheduler -n tundra-dome
```

#### Step 4.2: Verify DAGs are Loaded

```bash
# Port-forward to Airflow UI
kubectl port-forward svc/airflow-webserver 8080:8080 -n tundra-dome &

# Check Airflow UI (browser)
# Navigate to http://localhost:8080
# Login with default credentials
# Verify DAGs appear: github_sync, lane_health, polecat_scaler, sla_monitor

# Enable DAGs via CLI (if available)
kubectl exec -n tundra-dome deployment/airflow-scheduler -- \
  airflow dags list | grep -E "(github_sync|lane_health|polecat_scaler|sla_monitor)"
```

**Expected DAGs**:
- `tundra_github_sync` - Syncs GitHub issues/PRs to lane beads
- `tundra_lane_health` - Monitors lane health metrics
- `tundra_polecat_scaler` - Autoscales polecat worker pools
- `tundra_sla_monitor` - Monitors SLA compliance

**Checkpoint**: All DAGs are visible in Airflow UI and parsing without errors.

---

### Phase 5: Cloud Provisioning (Optional)

**Duration**: 2-4 hours
**Risk**: High (creates cloud resources)
**Rollback**: `terraform destroy`

⚠️ **WARNING**: This section creates billable cloud resources. Review cost estimates before proceeding.

#### Step 5.1: Provision EKS Cluster (AWS)

```bash
cd infra/tundra-dome/terraform/eks

# Initialize Terraform
terraform init

# Review plan
terraform plan \
  -var="region=us-west-2" \
  -var="environment=staging" \
  -var="cluster_prefix=tundra-dome" \
  -out=tfplan

# Apply (requires confirmation)
terraform apply tfplan

# Configure kubectl
aws eks update-kubeconfig \
  --region us-west-2 \
  --name $(terraform output -raw cluster_name)

# Verify cluster
kubectl get nodes
```

#### Step 5.2: Provision GKE Cluster (GCP)

```bash
cd infra/tundra-dome/terraform/gke

# Initialize and plan
terraform init
terraform plan \
  -var="project_id=your-gcp-project" \
  -var="region=us-central1" \
  -var="environment=staging" \
  -out=tfplan

# Apply
terraform apply tfplan

# Configure kubectl
gcloud container clusters get-credentials \
  $(terraform output -raw cluster_name) \
  --region us-central1

# Verify cluster
kubectl get nodes
```

#### Step 5.3: Provision AKS Cluster (Azure)

```bash
cd infra/tundra-dome/terraform/aks

# Initialize and plan
terraform init
terraform plan \
  -var="resource_group_name=tundra-dome-rg" \
  -var="location=eastus" \
  -var="environment=staging" \
  -out=tfplan

# Apply
terraform apply tfplan

# Configure kubectl
az aks get-credentials \
  --resource-group $(terraform output -raw resource_group_name) \
  --name $(terraform output -raw cluster_name)

# Verify cluster
kubectl get nodes
```

**Checkpoint**: Cloud cluster is provisioned and accessible via kubectl.

---

## Verification

### Health Checks

Run these checks after each phase:

```bash
# Cluster connectivity
kubectl cluster-info
kubectl get nodes

# Namespace resources
kubectl get all -n tundra-dome

# Pod status
kubectl get pods -n tundra-dome -o wide
kubectl get pods -n datadog -o wide

# Custom resources
kubectl get beads -n tundra-dome
kubectl get configmaps -n tundra-dome | grep -E "(registry|bead-sync)"

# Logs (check for errors)
kubectl logs -n tundra-dome -l app=federation-controller --tail=50
kubectl logs -n datadog -l app.kubernetes.io/name=observability-pipelines-worker --tail=50
```

### Functional Tests

```bash
# Test federation controller
kubectl apply -f - <<EOF
apiVersion: tundra.dome/v1
kind: Bead
metadata:
  name: functional-test-bead
  namespace: tundra-dome
spec:
  lane: test-lane
  data: "functional-test"
  timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
EOF

# Wait and verify in logs
sleep 5
kubectl logs -n tundra-dome -l app=federation-controller --tail=20 | grep "functional-test-bead"

# Cleanup test bead
kubectl delete bead functional-test-bead -n tundra-dome
```

### Monitoring Dashboard

```bash
# Port-forward to relevant services
kubectl port-forward svc/airflow-webserver 8080:8080 -n tundra-dome &
kubectl port-forward svc/datadog-agent 8125:8125 -n datadog &

# Check endpoints
curl -I http://localhost:8080/health        # Airflow
curl -I http://localhost:8125/health        # Datadog (if exposed)
```

---

## Post-Deployment

### Update Documentation

```bash
# Record deployment details
cat >> deployment-log.txt <<EOF
Deployment Date: $(date)
Deployed By: $USER
Clusters: tundra-dome, gastown, vibecode-local
Version: 1.0.0
Notes: Initial multi-cluster deployment
EOF

# Commit deployment log
git add deployment-log.txt
git commit -m "docs: record multi-cluster deployment $(date +%Y%m%d)"
```

### Enable Monitoring Alerts

```bash
# Configure Datadog monitors (via UI or API)
# - Federation controller health
# - Observability pipeline throughput
# - Airflow DAG failures
# - Cluster resource utilization
```

### Communication

Send deployment notification:

**Subject**: ✅ Tundra Dome Multi-Cluster Deployment Complete

**Body**:
```
The Tundra Dome multi-cluster infrastructure has been successfully deployed:

✓ Local clusters: tundra-dome, gastown, vibecode-local
✓ Observability pipeline: Datadog OPW deployed
✓ Federation controller: Cross-cluster sync active
✓ Airflow DAGs: 4 monitoring workflows enabled

Access:
- Airflow UI: http://localhost:8080 (port-forward)
- Cluster registry: kubectl get cm cluster-registry -n tundra-dome
- Documentation: infra/tundra-dome/docs/

Rollback procedure: See RUNBOOK-ROLLBACK.md

Contact: Platform Engineering Team
```

---

## Troubleshooting

### Issue: Cluster Creation Fails

**Symptoms**: `kind create cluster` hangs or fails

**Resolution**:
```bash
# Check Docker daemon
docker info

# Check for port conflicts
lsof -i :6443 -i :8081 -i :8082

# Delete and retry
kind delete cluster --name tundra-dome
./scripts/bootstrap.sh --clean
./scripts/bootstrap.sh
```

---

### Issue: Federation Controller CrashLoopBackOff

**Symptoms**: Pod restarting repeatedly

**Resolution**:
```bash
# Check logs
kubectl logs -n tundra-dome -l app=federation-controller --previous

# Common issues:
# 1. Missing RBAC permissions
kubectl get clusterrolebinding tundra-dome-federation

# 2. Invalid kubeconfig
kubectl exec -n tundra-dome deployment/federation-controller -- env | grep KUBERNETES

# 3. Code error
kubectl describe pod -n tundra-dome -l app=federation-controller
```

---

### Issue: Airflow DAGs Not Appearing

**Symptoms**: DAGs not visible in Airflow UI

**Resolution**:
```bash
# Check DAG files are mounted
kubectl exec -n tundra-dome deployment/airflow-scheduler -- ls -la /opt/airflow/dags/

# Check for parsing errors
kubectl logs -n tundra-dome deployment/airflow-scheduler | grep -i error

# Manually trigger DAG scan
kubectl exec -n tundra-dome deployment/airflow-scheduler -- \
  airflow dags list-import-errors
```

---

### Issue: Observability Pipeline Not Receiving Logs

**Symptoms**: No logs in Datadog

**Resolution**:
```bash
# Check OPW pod status
kubectl get pods -n datadog

# Check OPW logs
kubectl logs -n datadog -l app.kubernetes.io/name=observability-pipelines-worker

# Verify Datadog API key
kubectl get secret datadog-secret -n datadog -o jsonpath='{.data.DD_API_KEY}' | base64 -d

# Test connectivity
kubectl exec -n datadog deployment/observability-pipelines-worker -- \
  curl -I https://http-intake.logs.datadoghq.com
```

---

### Issue: Cross-Cluster Communication Fails

**Symptoms**: Beads not syncing across clusters

**Resolution**:
```bash
# Verify cluster registry
kubectl get cm cluster-registry -n tundra-dome -o yaml

# Check federation controller logs
kubectl logs -n tundra-dome -l app=federation-controller --tail=100

# Verify network connectivity between clusters
kubectl run test-pod --image=busybox --rm -it -- \
  wget -O- http://federation-controller.tundra-dome.svc.cluster.local:8080/health
```

---

## Communication Plan

### Stakeholders

- Platform Engineering Team (primary contact)
- SRE Team (on-call support)
- Development Teams (users of infrastructure)

### Notification Channels

- Slack: #platform-engineering, #incidents
- Email: platform-team@example.com
- PagerDuty: For critical issues during deployment

### Deployment Windows

- **Development**: Anytime
- **Staging**: Monday-Thursday, 9am-5pm PT
- **Production**: Tuesday-Thursday, 10am-2pm PT (with change approval)

---

## Related Documentation

- [Multi-Cluster Architecture](./MULTI-CLUSTER-ARCHITECTURE.md)
- [Rollback Runbook](./RUNBOOK-ROLLBACK.md)
- [Tundra Dome README](../README.md)
- [Deployment Guide](../../../docs/DEPLOYMENT_GUIDE.md)

---

**End of Rollforward Runbook**
