# AWS Cloud Workspaces Deployment Guide

Production-ready implementation of affordable, resumable cloud workspaces on Amazon Web Services.

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                    EKS Cluster (us-east-1)                    │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  Code-Server Pods (Spot Instances)                      │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐             │ │
│  │  │ User A   │  │ User B   │  │ User C   │             │ │
│  │  │ Pod      │  │ Pod      │  │ Pod      │             │ │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘             │ │
│  │       │             │             │                    │ │
│  └───────┼─────────────┼─────────────┼────────────────────┘ │
│          │             │             │                      │
│    ┌─────▼─────────────▼─────────────▼──────┐              │
│    │   EFS (Elastic File System)            │              │
│    │   - /workspaces/user-a                 │              │
│    │   - /workspaces/user-b                 │              │
│    │   - /workspaces/user-c                 │              │
│    └────────────────────────────────────────┘              │
└──────────────────────────────────────────────────────────────┘
         │                                      │
         │                                      │
    ┌────▼──────┐                        ┌─────▼─────┐
    │ EventBridge│◄──────Activity────────│  Lambda   │
    │   Rules   │       Monitoring       │ (Idle     │
    │           │                        │ Detection)│
    │ (Cron)    │                        │ Function) │
    └───────────┘                        └───────────┘
```

## Cost Optimization Strategy

### Compute Cost Savings (70-90% reduction)
1. **EC2 Spot Instances**: 70-90% discount vs on-demand pricing
2. **Fargate Spot**: 70% savings on serverless containers
3. **EKS with Spot Node Groups**: Automatic spot instance management
4. **Karpenter**: Intelligent node provisioning and bin-packing

### Storage Cost Optimization
1. **EFS Standard-IA**: $0.025/GB/month for infrequent access
2. **EFS Lifecycle Management**: Auto-transition to IA after 30 days
3. **EFS Intelligent-Tiering**: Automatic cost optimization
4. **S3 Glacier**: Archive inactive workspaces at $0.004/GB/month

### Estimated Monthly Costs (per user)
```
Component              Cost/Month    Notes
─────────────────────────────────────────────────────────
EKS Control Plane     $72 (shared)  Fixed cost, shared across users
Spot EC2 Instances    $5-12         Based on 40h/week, t3.large spot
EFS Storage (50GB)    $7.50         Standard tier, first 50GB
EFS Data Transfer     $1-3          Within same AZ
Lambda Invocations    $0.20         Idle detection automation
EventBridge           $0.10         Cron rules
CloudWatch Logs       $0.50         Log ingestion and storage
─────────────────────────────────────────────────────────
Per-User TOTAL        $14.30-16.80  (excluding shared EKS cost)
With EKS (10 users)   $21.50-24.00  Per user with shared control plane
```

**Cost reduction vs traditional EC2**: 75-85% savings
**Break-even point**: 5+ users = cheaper than dedicated instances

## Prerequisites

### Required AWS Services
```bash
# Enable required services
aws service enable-service \
  --service-name eks \
  --service-name efs \
  --service-name lambda \
  --service-name events \
  --service-name logs \
  --service-name cloudwatch
```

### Required Tools
- `aws` CLI (v2.15.0+)
- `kubectl` (v1.28+)
- `terraform` (v1.6+) or `tofu` (v1.6+)
- `helm` (v3.12+)
- `eksctl` (v0.175.0+)

### IAM Permissions
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "eks:*",
        "ec2:*",
        "efs:*",
        "lambda:*",
        "events:*",
        "logs:*",
        "cloudwatch:*",
        "iam:CreateRole",
        "iam:AttachRolePolicy",
        "iam:PassRole"
      ],
      "Resource": "*"
    }
  ]
}
```

## Infrastructure Deployment

### 1. Deploy Infrastructure with Terraform

```bash
cd terraform/aws

# Initialize Terraform
terraform init

# Review planned changes
terraform plan \
  -var="cluster_name=vibecode-workspaces" \
  -var="region=us-east-1" \
  -var="vpc_cidr=10.0.0.0/16"

# Deploy infrastructure
terraform apply \
  -var="cluster_name=vibecode-workspaces" \
  -var="region=us-east-1" \
  -var="vpc_cidr=10.0.0.0/16"
```

### 2. Configure kubectl

```bash
aws eks update-kubeconfig \
  --name vibecode-workspaces \
  --region us-east-1
```

### 3. Deploy EFS CSI Driver

```bash
# Install EFS CSI driver
kubectl apply -k "github.com/kubernetes-sigs/aws-efs-csi-driver/deploy/kubernetes/overlays/stable/?ref=release-1.7"

# Create storage class
kubectl apply -f k8s/cloud-workspaces/aws/efs-storage-class.yaml
```

### 4. Deploy Code-Server Workspaces

```bash
# Apply namespace and RBAC
kubectl apply -f k8s/cloud-workspaces/aws/namespace.yaml

# Create persistent volumes
kubectl apply -f k8s/cloud-workspaces/aws/efs-pv.yaml

# Deploy code-server StatefulSet
kubectl apply -f k8s/cloud-workspaces/aws/code-server.yaml

# Deploy Application Load Balancer
kubectl apply -f k8s/cloud-workspaces/aws/ingress.yaml
```

## Idle Detection System

### Architecture
```
User Activity → CloudWatch Logs → Lambda → Metrics → EventBridge → Shutdown
```

### Implementation

#### 1. Lambda Function for Idle Detection
Location: `terraform/aws/functions/idle-detection/`

```python
import boto3
import json
from datetime import datetime, timedelta

eks_client = boto3.client('eks')
cloudwatch = boto3.client('cloudwatch')

IDLE_THRESHOLD = 30  # minutes
TERMINATE_THRESHOLD = 24  # hours

def lambda_handler(event, context):
    """Check for idle workspaces and take action"""

    workspaces = get_active_workspaces()

    for workspace in workspaces:
        last_activity = get_last_activity_time(workspace)
        idle_minutes = (datetime.now() - last_activity).total_seconds() / 60

        if idle_minutes > TERMINATE_THRESHOLD * 60:
            terminate_workspace(workspace)
            print(f"Terminated idle workspace: {workspace['name']}")
        elif idle_minutes > IDLE_THRESHOLD:
            suspend_workspace(workspace)
            print(f"Suspended idle workspace: {workspace['name']}")

    return {
        'statusCode': 200,
        'body': json.dumps('Idle check complete')
    }

def get_active_workspaces():
    """Query EKS for active code-server pods"""
    # Implementation details
    pass

def get_last_activity_time(workspace):
    """Get last activity from CloudWatch Logs"""
    # Implementation details
    pass

def suspend_workspace(workspace):
    """Scale pod to 0 replicas"""
    # kubectl scale statefulset {workspace} --replicas=0
    pass

def terminate_workspace(workspace):
    """Archive and delete workspace"""
    # Archive to S3, delete pod and PVC
    pass
```

#### 2. EventBridge Schedule

```bash
# Create EventBridge rule to run every 5 minutes
aws events put-rule \
  --name vibecode-idle-check \
  --schedule-expression "rate(5 minutes)" \
  --state ENABLED

# Add Lambda function as target
aws events put-targets \
  --rule vibecode-idle-check \
  --targets "Id"="1","Arn"="arn:aws:lambda:us-east-1:ACCOUNT:function:IdleWorkspaceChecker"
```

### Idle Detection Thresholds
```yaml
thresholds:
  warning: 20m        # Send SNS notification to user
  suspend: 30m        # Scale pod to 0, preserve EFS mount
  terminate: 24h      # Delete pod, archive workspace to S3 Glacier

resumption:
  from_suspend: <10s  # Fast pod restart
  from_terminate: 30-60s  # Restore from S3
```

## Workspace Lifecycle Management

### 1. Creating a New Workspace

```bash
# Create workspace for user using Helm
helm install code-server-${USER_ID} charts/code-server \
  --namespace vibecode \
  --set user.id=${USER_ID} \
  --set user.email=${USER_EMAIL} \
  --set resources.requests.cpu=500m \
  --set resources.requests.memory=1Gi \
  --set persistence.enabled=true \
  --set persistence.storageClass=efs-sc \
  --set persistence.size=50Gi \
  --set nodeSelector."eks\.amazonaws\.com/capacityType"=SPOT
```

### 2. Suspending Workspace (Idle)

```bash
# Scale down to 0 replicas (EFS mount persists)
kubectl scale statefulset code-server-${USER_ID} --replicas=0 -n vibecode
```

### 3. Resuming Workspace

```bash
# Scale back up to 1 replica
kubectl scale statefulset code-server-${USER_ID} --replicas=1 -n vibecode
```

### 4. Archiving Workspace (24h+ idle)

```bash
# Archive to S3 Glacier Deep Archive
aws s3 sync \
  /mnt/efs/workspaces/${USER_ID}/ \
  s3://vibecode-archives/workspaces/${USER_ID}/ \
  --storage-class DEEP_ARCHIVE

# Delete StatefulSet and PVC
helm uninstall code-server-${USER_ID} -n vibecode
```

### 5. Restoring Archived Workspace

```bash
# Restore from S3 (may take 12-48h for Glacier)
aws s3 sync \
  s3://vibecode-archives/workspaces/${USER_ID}/ \
  /mnt/efs/workspaces/${USER_ID}/

# Recreate workspace
helm install code-server-${USER_ID} charts/code-server \
  --namespace vibecode \
  --set user.id=${USER_ID} \
  --set persistence.existingClaim=workspace-${USER_ID}
```

## Spot Instance Interruption Handling

### Spot Instance Termination Handler

```yaml
# Deploy AWS Node Termination Handler
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: aws-node-termination-handler
  namespace: kube-system
spec:
  selector:
    matchLabels:
      app: aws-node-termination-handler
  template:
    metadata:
      labels:
        app: aws-node-termination-handler
    spec:
      serviceAccountName: aws-node-termination-handler
      containers:
      - name: aws-node-termination-handler
        image: public.ecr.aws/aws-ec2/aws-node-termination-handler:v1.21.0
        env:
        - name: NODE_NAME
          valueFrom:
            fieldRef:
              fieldPath: spec.nodeName
        - name: POD_NAME
          valueFrom:
            fieldRef:
              fieldPath: metadata.name
        - name: NAMESPACE
          valueFrom:
            fieldRef:
              fieldPath: metadata.namespace
        - name: ENABLE_SPOT_INTERRUPTION_DRAINING
          value: "true"
        - name: ENABLE_SCHEDULED_EVENT_DRAINING
          value: "true"
```

### Graceful Shutdown

```yaml
# Pod spec with graceful termination
spec:
  terminationGracePeriodSeconds: 120
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
            # Sync to EFS
            sync
            # Flush filesystem cache
            echo 3 > /proc/sys/vm/drop_caches
            # Wait for EFS sync
            sleep 10
```

## Karpenter for Intelligent Scaling

### Install Karpenter

```bash
# Install Karpenter for automatic node provisioning
helm repo add karpenter https://charts.karpenter.sh
helm install karpenter karpenter/karpenter \
  --namespace karpenter \
  --create-namespace \
  --set serviceAccount.annotations."eks\.amazonaws\.com/role-arn"=${KARPENTER_IAM_ROLE_ARN} \
  --set clusterName=vibecode-workspaces \
  --set clusterEndpoint=${CLUSTER_ENDPOINT}
```

### Provisioner Configuration

```yaml
apiVersion: karpenter.sh/v1alpha5
kind: Provisioner
metadata:
  name: spot-provisioner
spec:
  requirements:
  - key: karpenter.sh/capacity-type
    operator: In
    values: ["spot"]
  - key: node.kubernetes.io/instance-type
    operator: In
    values: ["t3.large", "t3a.large", "t3.xlarge"]
  limits:
    resources:
      cpu: 100
      memory: 200Gi
  ttlSecondsAfterEmpty: 300  # Terminate nodes after 5 min idle
  ttlSecondsUntilExpired: 604800  # Rotate nodes weekly
```

## Monitoring and Observability

### CloudWatch Dashboard

```bash
# Deploy custom CloudWatch dashboard
aws cloudwatch put-dashboard \
  --dashboard-name vibecode-workspaces \
  --dashboard-body file://monitoring/aws-dashboard.json
```

### Key Metrics

```yaml
metrics:
  workspace_active_time:
    namespace: VibeCode
    metric: WorkspaceActiveMinutes
    statistic: Average

  workspace_cost_per_hour:
    namespace: VibeCode
    metric: WorkspaceHourlyCost
    statistic: Sum

  spot_interruptions:
    namespace: AWS/EC2Spot
    metric: SpotInstanceInterruptions
    statistic: Sum

  efs_throughput:
    namespace: AWS/EFS
    metric: TotalIOBytes
    statistic: Sum
```

### Datadog Integration

```bash
# Install Datadog agent on EKS
helm repo add datadog https://helm.datadoghq.com
helm install datadog-agent datadog/datadog \
  --set datadog.apiKey=$DD_API_KEY \
  --set datadog.site=datadoghq.com \
  --set datadog.logs.enabled=true \
  --set datadog.logs.containerCollectAll=true \
  --set datadog.clusterName=vibecode-workspaces
```

## Security Hardening

### 1. IAM Roles for Service Accounts (IRSA)

```bash
# Create IAM role for workspace pods
eksctl create iamserviceaccount \
  --name workspace-sa \
  --namespace vibecode \
  --cluster vibecode-workspaces \
  --attach-policy-arn arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess \
  --approve
```

### 2. Network Policies

```yaml
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
      port: 443
```

### 3. Pod Security Standards

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: vibecode
  labels:
    pod-security.kubernetes.io/enforce: baseline
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

## EFS Performance Optimization

### Throughput Modes

```hcl
# Terraform configuration for EFS
resource "aws_efs_file_system" "workspaces" {
  throughput_mode = "elastic"  # Auto-scales throughput
  performance_mode = "generalPurpose"

  lifecycle_policy {
    transition_to_ia = "AFTER_30_DAYS"
  }
}
```

### Mount Options

```yaml
# Optimized EFS mount options
apiVersion: v1
kind: PersistentVolume
metadata:
  name: efs-pv
spec:
  capacity:
    storage: 100Gi
  volumeMode: Filesystem
  accessModes:
    - ReadWriteMany
  persistentVolumeReclaimPolicy: Retain
  storageClassName: efs-sc
  mountOptions:
    - nfsvers=4.1
    - rsize=1048576
    - wsize=1048576
    - hard
    - timeo=600
    - retrans=2
  csi:
    driver: efs.csi.aws.com
    volumeHandle: fs-12345678
```

## Backup and Disaster Recovery

### AWS Backup Configuration

```bash
# Create backup plan
aws backup create-backup-plan \
  --backup-plan '{
    "BackupPlanName": "vibecode-daily-backups",
    "Rules": [{
      "RuleName": "DailyBackup",
      "TargetBackupVaultName": "vibecode-vault",
      "ScheduleExpression": "cron(0 2 * * ? *)",
      "StartWindowMinutes": 60,
      "CompletionWindowMinutes": 120,
      "Lifecycle": {
        "DeleteAfterDays": 30,
        "MoveToColdStorageAfterDays": 7
      }
    }]
  }'

# Associate EFS with backup plan
aws backup create-backup-selection \
  --backup-plan-id <plan-id> \
  --backup-selection '{
    "SelectionName": "efs-workspaces",
    "IamRoleArn": "arn:aws:iam::ACCOUNT:role/AWSBackupDefaultServiceRole",
    "Resources": ["arn:aws:elasticfilesystem:us-east-1:ACCOUNT:file-system/fs-12345678"]
  }'
```

## Cost Management

### Budget Alerts

```bash
# Create budget with alerts
aws budgets create-budget \
  --account-id ACCOUNT_ID \
  --budget '{
    "BudgetName": "vibecode-workspaces-monthly",
    "BudgetLimit": {"Amount": "500", "Unit": "USD"},
    "TimeUnit": "MONTHLY",
    "BudgetType": "COST"
  }' \
  --notifications-with-subscribers '[{
    "Notification": {
      "NotificationType": "ACTUAL",
      "ComparisonOperator": "GREATER_THAN",
      "Threshold": 80,
      "ThresholdType": "PERCENTAGE"
    },
    "Subscribers": [{
      "SubscriptionType": "EMAIL",
      "Address": "devops@vibecode.io"
    }]
  }]'
```

### Cost Allocation Tags

```hcl
# Apply tags for cost tracking
resource "aws_eks_cluster" "vibecode" {
  tags = {
    Project = "vibecode"
    Environment = "production"
    CostCenter = "engineering"
    Workload = "cloud-workspaces"
  }
}
```

## Troubleshooting

### Common Issues

#### 1. EFS Mount Failures
```bash
# Check EFS mount targets
aws efs describe-mount-targets --file-system-id fs-12345678

# Verify security group rules
aws ec2 describe-security-groups --group-ids sg-12345678

# Test EFS connectivity from pod
kubectl exec -it code-server-${USER_ID} -n vibecode -- \
  nc -zv ${EFS_DNS} 2049
```

#### 2. Spot Instance Interruptions
```bash
# Check interruption history
aws ec2 describe-spot-instance-requests \
  --filters "Name=state,Values=instance-terminated-by-price"

# Switch to mixed spot/on-demand
kubectl patch deployment code-server-${USER_ID} -n vibecode \
  --type=json \
  -p='[{"op": "remove", "path": "/spec/template/spec/nodeSelector/eks.amazonaws.com~1capacityType"}]'
```

#### 3. High EFS Costs
```bash
# Check EFS storage breakdown
aws efs describe-file-systems --file-system-id fs-12345678

# Enable lifecycle management
aws efs put-lifecycle-configuration \
  --file-system-id fs-12345678 \
  --lifecycle-policies '[{"TransitionToIA": "AFTER_30_DAYS"}]'
```

## Next Steps

1. **Staging Deployment**: Test with 10 users for 2 weeks
2. **Cost Validation**: Monitor actual costs vs projections
3. **Load Testing**: Simulate 100+ concurrent workspaces
4. **Disaster Recovery Test**: Validate backup/restore procedures
5. **Production Rollout**: Phased migration over 4 weeks

## References

- [EKS Pricing](https://aws.amazon.com/eks/pricing/)
- [EC2 Spot Pricing](https://aws.amazon.com/ec2/spot/pricing/)
- [EFS Pricing](https://aws.amazon.com/efs/pricing/)
- [Karpenter Documentation](https://karpenter.sh/)
- [AWS Node Termination Handler](https://github.com/aws/aws-node-termination-handler)

## Support

For issues or questions:
- GitHub Issues: https://github.com/ryanmaclean/vibecode-webgui/issues
- Slack: #vibecode-infrastructure
- Email: devops@vibecode.io
