# GCP Cloud Workspaces Deployment Guide

Production-ready implementation of affordable, resumable cloud workspaces on Google Cloud Platform.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    GKE Autopilot Cluster                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Code-Server Pods (Spot/Preemptible VMs)              │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐            │ │
│  │  │ User A   │  │ User B   │  │ User C   │            │ │
│  │  │ Pod      │  │ Pod      │  │ Pod      │            │ │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘            │ │
│  │       │             │             │                   │ │
│  └───────┼─────────────┼─────────────┼───────────────────┘ │
│          │             │             │                     │
│    ┌─────▼─────────────▼─────────────▼─────┐              │
│    │   Filestore (Persistent Workspace)     │              │
│    │   - /workspaces/user-a                 │              │
│    │   - /workspaces/user-b                 │              │
│    │   - /workspaces/user-c                 │              │
│    └────────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────┘
         │                                      │
         │                                      │
    ┌────▼──────┐                        ┌─────▼─────┐
    │  Cloud    │                        │  Cloud    │
    │ Scheduler │◄──────Activity─────────│ Functions │
    │           │       Monitoring       │ (Idle     │
    │ (Cron)    │                        │ Detection)│
    └───────────┘                        └───────────┘
```

## Cost Optimization Strategy

### Compute Cost Savings (60-80% reduction)
1. **GKE Autopilot**: Pay only for running pods, no node management
2. **Spot VMs**: 60-91% discount on compute (with graceful interruption handling)
3. **Preemptible Nodes**: Additional 60-80% savings for non-critical workloads
4. **Auto-scaling**: Scale to zero when not in use

### Storage Cost Optimization
1. **Filestore Basic**: $0.20/GB/month for persistent workspaces
2. **Lifecycle Policies**: Archive inactive workspaces after 30 days
3. **Compression**: Reduce storage footprint by 40-60%
4. **Shared Filestore**: Multi-tenant storage with per-user directories

### Estimated Monthly Costs (per user)
```
Component              Cost/Month    Notes
─────────────────────────────────────────────────────────
GKE Autopilot         $5-15         Based on 40h/week usage
Spot VM Compute       $3-8          60-91% cheaper than on-demand
Filestore (50GB)      $10           Basic tier, shared across users
Network Egress        $1-2          Minimal for browser-based IDE
Cloud Functions       $0.50         Idle detection automation
Cloud Scheduler       $0.10         Cron jobs for automation
─────────────────────────────────────────────────────────
TOTAL                 $19.60-35.60  Per active user/month
```

**Cost reduction vs traditional VM**: 70-80% savings
**Break-even point**: 3+ users = cheaper than dedicated VMs

## Prerequisites

### Required GCP Services
```bash
gcloud services enable \
  container.googleapis.com \
  file.googleapis.com \
  cloudfunctions.googleapis.com \
  cloudscheduler.googleapis.com \
  logging.googleapis.com \
  monitoring.googleapis.com
```

### Required Tools
- `gcloud` CLI (v450.0.0+)
- `kubectl` (v1.28+)
- `terraform` (v1.6+) or `tofu` (v1.6+)
- `helm` (v3.12+)

### IAM Permissions
```yaml
roles:
  - roles/container.admin              # GKE cluster management
  - roles/file.editor                  # Filestore management
  - roles/cloudfunctions.admin         # Idle detection functions
  - roles/cloudscheduler.admin         # Cron job management
  - roles/logging.viewer               # Activity monitoring
  - roles/monitoring.metricWriter      # Custom metrics
```

## Infrastructure Deployment

### 1. Deploy Infrastructure with Terraform

```bash
cd terraform/gcp

# Initialize Terraform
terraform init

# Review planned changes
terraform plan \
  -var="project_id=your-project-id" \
  -var="region=us-central1" \
  -var="cluster_name=vibecode-workspaces"

# Deploy infrastructure
terraform apply \
  -var="project_id=your-project-id" \
  -var="region=us-central1" \
  -var="cluster_name=vibecode-workspaces"
```

### 2. Configure kubectl

```bash
gcloud container clusters get-credentials vibecode-workspaces \
  --region=us-central1 \
  --project=your-project-id
```

### 3. Deploy Code-Server Workspaces

```bash
# Apply namespace and RBAC
kubectl apply -f k8s/cloud-workspaces/gcp/namespace.yaml

# Deploy Filestore CSI driver
kubectl apply -f k8s/cloud-workspaces/gcp/filestore-csi.yaml

# Create persistent volumes
kubectl apply -f k8s/cloud-workspaces/gcp/filestore-pv.yaml

# Deploy code-server StatefulSet
kubectl apply -f k8s/cloud-workspaces/gcp/code-server.yaml

# Deploy ingress for external access
kubectl apply -f k8s/cloud-workspaces/gcp/ingress.yaml
```

## Idle Detection System

### Architecture
```
User Activity → Logs → Cloud Function → Metrics → Scheduler → Shutdown
```

### Implementation

#### 1. Activity Monitoring Function
Location: `terraform/gcp/functions/idle-detection/`

```javascript
// Monitors last activity timestamp per workspace
exports.checkIdleWorkspaces = async (req, res) => {
  const IDLE_THRESHOLD = 30 * 60 * 1000; // 30 minutes
  const TERMINATE_THRESHOLD = 24 * 60 * 60 * 1000; // 24 hours

  const workspaces = await listActiveWorkspaces();

  for (const workspace of workspaces) {
    const lastActivity = await getLastActivityTime(workspace);
    const idleTime = Date.now() - lastActivity;

    if (idleTime > TERMINATE_THRESHOLD) {
      await terminateWorkspace(workspace);
      console.log(`Terminated idle workspace: ${workspace.name}`);
    } else if (idleTime > IDLE_THRESHOLD) {
      await suspendWorkspace(workspace);
      console.log(`Suspended idle workspace: ${workspace.name}`);
    }
  }

  res.status(200).send('Idle check complete');
};
```

#### 2. Cloud Scheduler Configuration
```bash
# Check every 5 minutes for idle workspaces
gcloud scheduler jobs create http idle-workspace-check \
  --location=us-central1 \
  --schedule="*/5 * * * *" \
  --uri="https://us-central1-your-project.cloudfunctions.net/checkIdleWorkspaces" \
  --http-method=POST \
  --oidc-service-account-email=idle-checker@your-project.iam.gserviceaccount.com
```

### Idle Detection Thresholds
```yaml
thresholds:
  warning: 20m        # Send notification to user
  suspend: 30m        # Scale pod to 0, preserve state
  terminate: 24h      # Delete pod, archive workspace to Cloud Storage

resumption:
  from_suspend: <10s  # Fast pod restart
  from_terminate: 30-60s  # Restore from archive
```

## Workspace Lifecycle Management

### 1. Creating a New Workspace

```bash
# Create workspace for user
kubectl create -f - <<EOF
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: workspace-${USER_ID}
  namespace: vibecode
spec:
  accessModes:
    - ReadWriteMany
  storageClassName: filestore-sc
  resources:
    requests:
      storage: 50Gi
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: code-server-${USER_ID}
  namespace: vibecode
spec:
  serviceName: code-server-${USER_ID}
  replicas: 1
  selector:
    matchLabels:
      app: code-server
      user: ${USER_ID}
  template:
    metadata:
      labels:
        app: code-server
        user: ${USER_ID}
    spec:
      nodeSelector:
        cloud.google.com/gke-spot: "true"
      tolerations:
      - key: cloud.google.com/gke-spot
        operator: Equal
        value: "true"
        effect: NoSchedule
      containers:
      - name: code-server
        image: gcr.io/${PROJECT_ID}/vibecode-code-server:latest
        resources:
          requests:
            cpu: 500m
            memory: 1Gi
          limits:
            cpu: 2000m
            memory: 4Gi
        volumeMounts:
        - name: workspace
          mountPath: /home/coder/workspace
      volumes:
      - name: workspace
        persistentVolumeClaim:
          claimName: workspace-${USER_ID}
EOF
```

### 2. Suspending Workspace (Idle)

```bash
# Scale down to 0 replicas (preserves PVC)
kubectl scale statefulset code-server-${USER_ID} --replicas=0 -n vibecode
```

### 3. Resuming Workspace

```bash
# Scale back up to 1 replica
kubectl scale statefulset code-server-${USER_ID} --replicas=1 -n vibecode
```

### 4. Archiving Workspace (24h+ idle)

```bash
# Archive to Cloud Storage
gcloud storage cp -r \
  /mnt/filestore/workspaces/${USER_ID}/ \
  gs://vibecode-archives/workspaces/${USER_ID}/

# Delete StatefulSet and PVC
kubectl delete statefulset code-server-${USER_ID} -n vibecode
kubectl delete pvc workspace-${USER_ID} -n vibecode
```

### 5. Restoring Archived Workspace

```bash
# Restore from Cloud Storage
gcloud storage cp -r \
  gs://vibecode-archives/workspaces/${USER_ID}/ \
  /mnt/filestore/workspaces/${USER_ID}/

# Recreate workspace (same as step 1)
```

## Spot VM Interruption Handling

### Graceful Shutdown on Preemption

```yaml
# Pod spec with graceful termination
spec:
  terminationGracePeriodSeconds: 30
  containers:
  - name: code-server
    lifecycle:
      preStop:
        exec:
          command:
          - /bin/bash
          - -c
          - |
            # Save all open files
            code-server --save-all
            # Sync to persistent storage
            sync
            # Wait for flush
            sleep 5
```

### Automatic Recovery

```yaml
# StatefulSet ensures pod is rescheduled automatically
spec:
  replicas: 1  # Kubernetes will maintain this
  podManagementPolicy: OrderedReady
  updateStrategy:
    type: RollingUpdate
```

## Monitoring and Observability

### Key Metrics to Monitor

```yaml
metrics:
  workspace_active_time:
    type: gauge
    description: Time since last user activity

  workspace_cost_per_hour:
    type: gauge
    description: Current hourly cost of workspace

  workspace_interruptions:
    type: counter
    description: Number of spot VM interruptions

  workspace_resume_time:
    type: histogram
    description: Time to resume from suspended state
```

### Datadog Integration

```bash
# Install Datadog agent on cluster
helm repo add datadog https://helm.datadoghq.com
helm install datadog-agent datadog/datadog \
  --set datadog.apiKey=$DD_API_KEY \
  --set datadog.site=datadoghq.com \
  --set datadog.logs.enabled=true \
  --set datadog.logs.containerCollectAll=true
```

### Cost Monitoring Dashboard

```bash
# Deploy custom dashboard
kubectl apply -f k8s/cloud-workspaces/gcp/monitoring-dashboard.yaml
```

## Security Hardening

### 1. Workload Identity

```bash
# Create service account for workspaces
gcloud iam service-accounts create workspace-sa \
  --project=${PROJECT_ID}

# Bind to Kubernetes service account
gcloud iam service-accounts add-iam-policy-binding \
  workspace-sa@${PROJECT_ID}.iam.gserviceaccount.com \
  --role roles/iam.workloadIdentityUser \
  --member "serviceAccount:${PROJECT_ID}.svc.id.goog[vibecode/workspace-sa]"
```

### 2. Network Policies

```yaml
# Isolate workspaces from each other
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: workspace-isolation
  namespace: vibecode
spec:
  podSelector:
    matchLabels:
      app: code-server
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
  egress:
  - to:
    - namespaceSelector: {}
    ports:
    - protocol: TCP
      port: 443  # HTTPS only
```

### 3. Binary Authorization

```bash
# Require signed container images
gcloud container clusters update vibecode-workspaces \
  --enable-binauthz \
  --region=us-central1
```

## Scaling Strategies

### Horizontal Pod Autoscaling

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: code-server-hpa
  namespace: vibecode
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: StatefulSet
    name: code-server
  minReplicas: 0  # Scale to zero when idle
  maxReplicas: 5  # Limit concurrent sessions per user
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

### Cluster Autoscaling

GKE Autopilot handles this automatically - no configuration needed.

## Backup and Disaster Recovery

### Automated Backups

```bash
# Daily backups to Cloud Storage
gcloud scheduler jobs create http workspace-backup \
  --location=us-central1 \
  --schedule="0 2 * * *" \
  --uri="https://us-central1-your-project.cloudfunctions.net/backupWorkspaces" \
  --http-method=POST
```

### Retention Policy

```yaml
retention:
  active_workspaces: Continuous backup
  suspended_workspaces: Daily backup, 30 day retention
  archived_workspaces: Weekly backup, 90 day retention
```

## Troubleshooting

### Common Issues

#### 1. Workspace Won't Resume
```bash
# Check pod status
kubectl describe pod code-server-${USER_ID} -n vibecode

# Check PVC binding
kubectl get pvc workspace-${USER_ID} -n vibecode

# Check Filestore mount
kubectl exec -it code-server-${USER_ID} -n vibecode -- df -h
```

#### 2. Spot VM Interruptions Too Frequent
```bash
# Switch to balanced spot/on-demand mix
kubectl patch statefulset code-server-${USER_ID} -n vibecode \
  --type=json \
  -p='[{"op": "remove", "path": "/spec/template/spec/nodeSelector/cloud.google.com~1gke-spot"}]'
```

#### 3. High Storage Costs
```bash
# Check workspace sizes
gsutil du -sh gs://vibecode-archives/workspaces/*

# Enable compression
kubectl exec -it code-server-${USER_ID} -n vibecode -- \
  tar -czf /tmp/workspace-compressed.tar.gz /home/coder/workspace/
```

## Next Steps

1. **Deploy to Staging**: Test with 5-10 users for 1 week
2. **Validate Cost Metrics**: Ensure costs align with projections
3. **Test Idle Detection**: Verify graceful suspend/resume cycles
4. **Load Testing**: Simulate 50+ concurrent users
5. **Production Rollout**: Gradual migration of existing users

## References

- [GKE Autopilot Pricing](https://cloud.google.com/kubernetes-engine/pricing#autopilot_mode)
- [Filestore Pricing](https://cloud.google.com/filestore/pricing)
- [Spot VM Documentation](https://cloud.google.com/kubernetes-engine/docs/how-to/spot-pods)
- [Cloud Functions Pricing](https://cloud.google.com/functions/pricing)

## Support

For issues or questions:
- GitHub Issues: https://github.com/ryanmaclean/vibecode-webgui/issues
- Slack: #vibecode-infrastructure
- Email: devops@vibecode.io
