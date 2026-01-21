# Cloud Workspaces Implementation

Affordable, resumable code-server workspaces on GCP and AWS with automatic idle detection and cost optimization.

## Overview

This implementation provides production-ready cloud workspaces that:

- **Cost Optimization**: 70-80% savings vs traditional VMs using spot/preemptible instances
- **Persistence**: User data survives pod restarts and spot interruptions
- **Auto-scaling**: Scale to zero when idle, resume in <10 seconds
- **Multi-cloud**: Identical architecture for GCP and AWS
- **Production Ready**: Security hardening, monitoring, and disaster recovery

## Architecture Comparison

| Feature | GCP (GKE Autopilot) | AWS (EKS) |
|---------|---------------------|-----------|
| **Compute** | Spot VMs (60-91% discount) | EC2 Spot (70-90% discount) |
| **Storage** | Filestore (ReadWriteMany) | EFS (ReadWriteMany) |
| **Scaling** | Built-in Autopilot | Karpenter + Spot Node Groups |
| **Idle Detection** | Cloud Functions + Scheduler | Lambda + EventBridge |
| **Archive** | Cloud Storage (Nearline) | S3 Glacier Deep Archive |
| **Cost/User/Month** | $15-40 | $18-45 |

## Directory Structure

```
cloud-workspaces/
├── README.md                    # This file
├── gcp/                         # GCP-specific manifests
│   └── code-server.yaml         # GKE Autopilot deployment
├── aws/                         # AWS-specific manifests
│   └── code-server.yaml         # EKS deployment
└── smoke-test/                  # Local testing with KinD
    ├── kind-config.yaml         # Multi-node cluster config
    ├── test-deployment.yaml     # Test workspace deployment
    └── run-tests.sh             # Automated test runner
```

## Quick Start

### Prerequisites

```bash
# Install required tools
brew install terraform kubectl helm

# For GCP
brew install --cask google-cloud-sdk

# For AWS
brew install awscli eksctl

# For local testing
brew install kind docker
```

### GCP Deployment

```bash
# 1. Deploy infrastructure
cd terraform/gcp
terraform init
terraform apply \
  -var="project_id=your-project-id" \
  -var="region=us-central1"

# 2. Configure kubectl
gcloud container clusters get-credentials vibecode-workspaces \
  --region=us-central1

# 3. Deploy workspaces
kubectl apply -f k8s/cloud-workspaces/gcp/code-server.yaml

# 4. Verify deployment
kubectl get pods -n vibecode
kubectl get pvc -n vibecode
```

### AWS Deployment

```bash
# 1. Deploy infrastructure
cd terraform/aws
terraform init
terraform apply \
  -var="cluster_name=vibecode-workspaces" \
  -var="region=us-east-1"

# 2. Configure kubectl
aws eks update-kubeconfig \
  --name vibecode-workspaces \
  --region us-east-1

# 3. Deploy workspaces
kubectl apply -f k8s/cloud-workspaces/aws/code-server.yaml

# 4. Verify deployment
kubectl get pods -n vibecode
kubectl get pvc -n vibecode
```

### Local Smoke Testing

```bash
# Run comprehensive smoke tests
cd k8s/cloud-workspaces/smoke-test
./run-tests.sh

# Keep cluster for manual inspection
./run-tests.sh --keep

# Access test workspace
kubectl port-forward -n vibecode-test svc/code-server-test 8080:8080
# Visit http://localhost:8080
```

## Cost Analysis

### GCP Monthly Costs (per user)

```
GKE Autopilot (40h/week):     $8-15
Spot VM Compute:               $3-8
Filestore (50GB):              $10
Network Egress:                $1-2
Cloud Functions:               $0.50
Cloud Scheduler:               $0.10
Total:                         $22.60-35.60
```

**Savings vs On-Demand VM**: 75% ($140 → $35)

### AWS Monthly Costs (per user)

```
EKS Control Plane (shared):    $72 (÷10 users = $7.20)
EC2 Spot (40h/week):           $8-14
EFS Storage (50GB):            $7.50
Data Transfer:                 $1-3
Lambda + EventBridge:          $0.30
Total:                         $24.00-32.00
```

**Savings vs On-Demand EC2**: 80% ($120 → $24)

### Break-Even Analysis

| Users | GCP/month | AWS/month | Dedicated VM/month |
|-------|-----------|-----------|-------------------|
| 1     | $35       | $86       | $140              |
| 5     | $115      | $120      | $700              |
| 10    | $230      | $240      | $1,400            |
| 50    | $1,150    | $1,200    | $7,000            |

**ROI**: 5+ users = 70-80% cost reduction

## Idle Detection System

### How It Works

```
User Activity → Logs → Function/Lambda → Metrics → Scheduler/EventBridge → Action
```

### Thresholds

| State | Threshold | Action | Resume Time |
|-------|-----------|--------|-------------|
| Active | <20 min idle | None | N/A |
| Warning | 20 min idle | Send notification | N/A |
| Suspended | 30 min idle | Scale to 0 replicas | <10 seconds |
| Terminated | 24 hours idle | Archive to cold storage | 30-60 seconds |

### Resumption Process

1. **From Suspend** (30 min idle):
   - Pod scaled from 0→1 replica
   - PVC already attached
   - Resume in <10 seconds

2. **From Archive** (24h+ idle):
   - Restore from Cloud Storage/S3
   - Create new PVC
   - Deploy pod
   - Resume in 30-60 seconds

## Workspace Lifecycle

### Creating Workspace

```bash
# GCP
kubectl apply -f - <<EOF
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
    spec:
      nodeSelector:
        cloud.google.com/gke-spot: "true"
      containers:
      - name: code-server
        image: gcr.io/${PROJECT_ID}/vibecode-code-server:latest
        volumeMounts:
        - name: workspace
          mountPath: /home/coder/workspace
  volumeClaimTemplates:
  - metadata:
      name: workspace
    spec:
      accessModes: ["ReadWriteMany"]
      storageClassName: filestore-sc
      resources:
        requests:
          storage: 50Gi
EOF
```

### Suspending Workspace

```bash
# Scale to 0 (preserves PVC)
kubectl scale statefulset code-server-${USER_ID} \
  --replicas=0 -n vibecode
```

### Resuming Workspace

```bash
# Scale back to 1
kubectl scale statefulset code-server-${USER_ID} \
  --replicas=1 -n vibecode
```

### Archiving Workspace

```bash
# GCP
gcloud storage cp -r \
  /mnt/filestore/workspaces/${USER_ID}/ \
  gs://vibecode-archives/workspaces/${USER_ID}/

# AWS
aws s3 sync \
  /mnt/efs/workspaces/${USER_ID}/ \
  s3://vibecode-archives/workspaces/${USER_ID}/ \
  --storage-class DEEP_ARCHIVE

# Delete resources
kubectl delete statefulset code-server-${USER_ID} -n vibecode
kubectl delete pvc workspace-${USER_ID} -n vibecode
```

## Spot Instance Handling

### Graceful Shutdown

Both GCP and AWS implementations include:

- 60-120 second termination grace period
- PreStop hook to save open files
- Automatic filesystem sync
- Pod rescheduling on healthy nodes

### GCP Spot Interruptions

- 30 second warning before termination
- Automatic pod migration to new spot node
- No data loss with Filestore persistence

### AWS Spot Interruptions

- 2 minute warning via instance metadata
- AWS Node Termination Handler drains gracefully
- Automatic rescheduling by EKS

## Security Hardening

### Pod Security

- Non-root user (UID 1000)
- Read-only root filesystem (where possible)
- Dropped Linux capabilities
- seccomp profile enabled
- Pod Security Standards: baseline/restricted

### Network Security

- Network policies isolate workspaces
- Egress limited to HTTPS + DNS
- No pod-to-pod communication
- Ingress only from load balancer

### Identity and Access

- **GCP**: Workload Identity for GCP API access
- **AWS**: IRSA (IAM Roles for Service Accounts)
- Least privilege IAM policies
- No static credentials in pods

### Encryption

- Data at rest: KMS-encrypted PVCs
- Data in transit: TLS for all external traffic
- Secrets: Kubernetes secrets (not env vars)

## Monitoring and Alerting

### Key Metrics

```yaml
workspace_active_time: Time since last user activity
workspace_cost_per_hour: Current hourly cost
workspace_resume_time: Time to resume from suspended
spot_interruptions: Number of spot evictions
storage_utilization: Workspace disk usage
```

### Datadog Integration

```bash
# Install agent
helm install datadog-agent datadog/datadog \
  --set datadog.apiKey=$DD_API_KEY \
  --set datadog.logs.enabled=true \
  --set datadog.apm.enabled=true
```

### CloudWatch/Cloud Monitoring

Both platforms include dashboards for:
- Cost tracking per workspace
- Resource utilization
- Spot interruption rates
- Idle detection metrics

## Disaster Recovery

### Backup Strategy

- **Active workspaces**: Continuous replication to persistent storage
- **Suspended workspaces**: Daily snapshots, 30 day retention
- **Archived workspaces**: Glacier/Coldline with 90 day retention

### Recovery Procedures

1. **Individual workspace failure**: Restore from last snapshot (<5 min)
2. **Storage failure**: Restore from archive bucket (<30 min)
3. **Regional outage**: Failover to secondary region (<2 hours)

## Performance Tuning

### Storage Optimization

**GCP Filestore:**
```yaml
tier: BASIC_HDD  # $0.20/GB vs $0.60 for SSD
capacity: 1TB    # Minimum for BASIC tier
```

**AWS EFS:**
```yaml
throughput_mode: elastic  # Auto-scales performance
lifecycle_policy: AFTER_30_DAYS  # Move to IA tier
```

### Compute Optimization

**Instance Selection:**
- t3/t3a family for burstable workloads
- Spot instances for 70-90% savings
- Mixed on-demand for critical workloads

**Resource Requests:**
```yaml
requests:
  cpu: 500m      # Guaranteed CPU
  memory: 1Gi    # Guaranteed memory
limits:
  cpu: 2000m     # Max burst CPU
  memory: 4Gi    # Max memory
```

## Troubleshooting

### Common Issues

#### 1. Workspace Won't Resume

```bash
# Check pod status
kubectl describe pod code-server-${USER_ID} -n vibecode

# Check PVC binding
kubectl get pvc -n vibecode

# Check events
kubectl get events -n vibecode --sort-by='.lastTimestamp'
```

#### 2. High Costs

```bash
# Check idle workspaces
kubectl get statefulsets -n vibecode -o json | \
  jq -r '.items[] | select(.status.replicas > 0) | .metadata.name'

# Review storage usage
kubectl exec -n vibecode pod-name -- df -h /home/coder/workspace
```

#### 3. Spot Interruptions

```bash
# Check interruption rate
kubectl get events -n vibecode | grep -i preempt

# Switch to mixed spot/on-demand
kubectl patch statefulset code-server-${USER_ID} -n vibecode \
  --type=json \
  -p='[{"op": "remove", "path": "/spec/template/spec/nodeSelector"}]'
```

## Next Steps

1. **Review Documentation**:
   - [GCP Deployment Guide](../../docs/deployment/GCP_CLOUD_WORKSPACES.md)
   - [AWS Deployment Guide](../../docs/deployment/AWS_CLOUD_WORKSPACES.md)

2. **Run Smoke Tests**:
   ```bash
   cd smoke-test && ./run-tests.sh
   ```

3. **Deploy to Staging**:
   - Start with 5-10 test users
   - Validate cost metrics
   - Test idle detection

4. **Production Rollout**:
   - Gradual migration over 4 weeks
   - Monitor costs and performance
   - Adjust thresholds as needed

## Support

- **GitHub Issues**: https://github.com/ryanmaclean/vibecode-webgui/issues
- **Documentation**: docs/deployment/
- **Slack**: #vibecode-infrastructure

## License

MIT License - see LICENSE file for details
