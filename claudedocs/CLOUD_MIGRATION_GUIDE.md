# Cloud Migration Playbook

**Version:** 1.0
**Date:** 2025-10-02
**Purpose:** Step-by-step guide for migrating VibeCode between cloud providers

## Overview

This guide provides detailed procedures for migrating VibeCode infrastructure between AWS, GCP, and Azure with zero data loss and minimal downtime (<5 minutes).

---

## Prerequisites

### Tools Required
```bash
# Install required CLI tools
brew install aws-cli google-cloud-sdk azure-cli
brew install kubectl helm terraform
brew install postgresql@16 redis
```

### Access Requirements
- Cloud provider accounts with admin privileges
- Kubernetes cluster access
- Database admin credentials
- Storage bucket permissions
- DNS management access

### Pre-Migration Checklist
- [ ] Backup all data (database, storage, configurations)
- [ ] Document current infrastructure state
- [ ] Test migration in staging environment
- [ ] Prepare rollback plan
- [ ] Schedule maintenance window
- [ ] Notify stakeholders

---

## Migration Scenarios

### Scenario 1: AWS → GCP

**Timeline:** 16 hours
**Downtime:** <5 minutes
**Data Loss:** Zero

#### Phase 1: Preparation (4 hours)

**1.1 Create GCP Project**
```bash
# Create new GCP project
gcloud projects create vibecode-prod-gcp \
  --name="VibeCode Production" \
  --set-as-default

# Enable required APIs
gcloud services enable \
  container.googleapis.com \
  sqladmin.googleapis.com \
  redis.googleapis.com \
  storage-api.googleapis.com \
  compute.googleapis.com

# Create service account for Terraform
gcloud iam service-accounts create vibecode-terraform \
  --display-name="VibeCode Terraform"

gcloud projects add-iam-policy-binding vibecode-prod-gcp \
  --member="serviceAccount:vibecode-terraform@vibecode-prod-gcp.iam.gserviceaccount.com" \
  --role="roles/editor"
```

**1.2 Deploy GCP Infrastructure**
```bash
cd terraform/gcp

# Initialize Terraform
terraform init

# Plan deployment
terraform plan \
  -var="project_id=vibecode-prod-gcp" \
  -var="region=us-central1" \
  -var="cluster_name=vibecode-cluster" \
  -out=tfplan

# Apply infrastructure
terraform apply tfplan

# Verify resources
gcloud container clusters describe vibecode-cluster --region=us-central1
gcloud sql instances describe vibecode-db
gcloud redis instances describe vibecode-cache --region=us-central1
```

**1.3 Configure Kubernetes Access**
```bash
# Get GKE credentials
gcloud container clusters get-credentials vibecode-cluster \
  --region=us-central1 \
  --project=vibecode-prod-gcp

# Verify cluster access
kubectl cluster-info
kubectl get nodes

# Install required Kubernetes addons
kubectl apply -f k8s/cloud-workspaces/gcp/filestore-csi.yaml
kubectl apply -f k8s/cloud-workspaces/gcp/namespace.yaml
```

#### Phase 2: Database Migration (6 hours)

**2.1 Create Cloud SQL Read Replica**
```bash
# Export AWS RDS configuration
aws rds describe-db-instances \
  --db-instance-identifier vibecode-db \
  --query 'DBInstances[0]' > rds-config.json

# Get database credentials from AWS Secrets Manager
aws secretsmanager get-secret-value \
  --secret-id vibecode-db-password \
  --query SecretString \
  --output text

# Create Cloud SQL instance with external replication
gcloud sql instances create vibecode-db \
  --database-version=POSTGRES_16 \
  --tier=db-custom-8-32768 \
  --region=us-central1 \
  --network=vibecode-vpc \
  --no-assign-ip \
  --enable-bin-log \
  --database-flags=cloudsql.logical_decoding=on

# Set up logical replication from AWS RDS
gcloud sql instances patch vibecode-db \
  --database-flags=cloudsql.logical_decoding=on,max_replication_slots=10

# Create replication user on AWS RDS
psql -h <rds-endpoint> -U postgres -d vibecode <<SQL
CREATE ROLE replicator WITH REPLICATION LOGIN PASSWORD '<strong-password>';
GRANT SELECT ON ALL TABLES IN SCHEMA public TO replicator;
SQL

# Create publication on AWS RDS
psql -h <rds-endpoint> -U postgres -d vibecode <<SQL
CREATE PUBLICATION vibecode_pub FOR ALL TABLES;
SQL

# Create subscription on Cloud SQL
psql -h <cloudsql-endpoint> -U postgres -d vibecode <<SQL
CREATE SUBSCRIPTION vibecode_sub
CONNECTION 'host=<rds-endpoint> port=5432 user=replicator password=<password> dbname=vibecode'
PUBLICATION vibecode_pub;
SQL
```

**2.2 Monitor Replication Progress**
```bash
# Check replication lag (run every 5 minutes)
psql -h <cloudsql-endpoint> -U postgres -d vibecode -c "
SELECT
  subscription_name,
  received_lsn,
  latest_end_lsn,
  latest_end_time,
  AGE(now(), latest_end_time) as lag
FROM pg_stat_subscription;
"

# Verify data consistency
psql -h <rds-endpoint> -U postgres -d vibecode -c "SELECT COUNT(*) FROM users;"
psql -h <cloudsql-endpoint> -U postgres -d vibecode -c "SELECT COUNT(*) FROM users;"
```

**2.3 Create pgvector Extension**
```bash
# Install pgvector on Cloud SQL
gcloud sql instances patch vibecode-db \
  --database-flags=cloudsql.enable_pgvector=on

psql -h <cloudsql-endpoint> -U postgres -d vibecode <<SQL
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify pgvector works
SELECT vector_dims('[1,2,3]'::vector);

-- Create HNSW indexes
CREATE INDEX ON rag_chunks USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
SQL
```

#### Phase 3: Storage Migration (4 hours)

**3.1 S3 to Cloud Storage Migration**
```bash
# Install gsutil
pip install gsutil

# Create Cloud Storage bucket
gsutil mb -p vibecode-prod-gcp -c NEARLINE -l us-central1 gs://vibecode-archives/

# Enable versioning
gsutil versioning set on gs://vibecode-archives/

# Sync S3 to GCS (parallel transfer)
gsutil -m rsync -r -d \
  s3://vibecode-workspace-archives/ \
  gs://vibecode-archives/

# Verify data integrity
aws s3 ls s3://vibecode-workspace-archives/ --recursive | wc -l
gsutil ls -r gs://vibecode-archives/ | wc -l
```

**3.2 EFS to Filestore Migration**
```bash
# Get Filestore mount point
gcloud filestore instances describe vibecode-filestore \
  --location=us-central1-a \
  --format="value(networks[0].ipAddresses[0])"

# Create temporary VM for data transfer
gcloud compute instances create transfer-vm \
  --zone=us-central1-a \
  --machine-type=n1-highmem-8 \
  --network=vibecode-vpc \
  --metadata=startup-script='#!/bin/bash
apt-get update
apt-get install -y nfs-common rsync'

# SSH into transfer VM
gcloud compute ssh transfer-vm --zone=us-central1-a

# Mount EFS (source)
sudo mkdir /mnt/efs
sudo mount -t nfs4 \
  -o nfsvers=4.1,rsize=1048576,wsize=1048576,hard,timeo=600,retrans=2 \
  <efs-dns-name>:/ /mnt/efs

# Mount Filestore (target)
sudo mkdir /mnt/filestore
sudo mount -t nfs \
  -o vers=3 \
  <filestore-ip>:/workspaces /mnt/filestore

# Transfer data with rsync (preserves permissions)
sudo rsync -avzP --progress \
  /mnt/efs/ /mnt/filestore/

# Verify checksums
find /mnt/efs -type f -exec md5sum {} \; | sort > /tmp/efs-checksums.txt
find /mnt/filestore -type f -exec md5sum {} \; | sort > /tmp/filestore-checksums.txt
diff /tmp/efs-checksums.txt /tmp/filestore-checksums.txt

# Cleanup
sudo umount /mnt/efs /mnt/filestore
gcloud compute instances delete transfer-vm --zone=us-central1-a
```

#### Phase 4: Application Deployment (2 hours)

**4.1 Deploy to GKE**
```bash
# Configure kubectl for GKE
kubectl config use-context gke_vibecode-prod-gcp_us-central1_vibecode-cluster

# Create namespace and secrets
kubectl apply -f k8s/cloud-workspaces/gcp/namespace.yaml

# Create database connection secret
kubectl create secret generic db-credentials -n vibecode \
  --from-literal=DATABASE_URL="postgresql://postgres:<password>@<cloudsql-ip>:5432/vibecode"

# Create Redis connection secret
kubectl create secret generic cache-credentials -n vibecode \
  --from-literal=REDIS_URL="redis://<memorystore-ip>:6379"

# Deploy application
helm install vibecode-app ./helm/vibecode-platform \
  --namespace vibecode \
  --set image.repository=gcr.io/vibecode-prod-gcp/vibecode-webgui \
  --set image.tag=latest \
  --set cloudProvider=gcp \
  --set database.host=<cloudsql-ip> \
  --set cache.host=<memorystore-ip> \
  --set storage.bucket=vibecode-archives \
  --set fileStorage.mountPoint=<filestore-ip>:/workspaces

# Verify deployment
kubectl get pods -n vibecode
kubectl logs -f deployment/vibecode-app -n vibecode

# Run health checks
kubectl exec -it deployment/vibecode-app -n vibecode -- \
  curl http://localhost:3000/api/health
```

**4.2 DNS Update Preparation**
```bash
# Get GKE ingress IP
kubectl get service vibecode-ingress -n vibecode \
  -o jsonpath='{.status.loadBalancer.ingress[0].ip}'

# Prepare DNS record update
# OLD: vibecode.dev → <aws-alb-dns>
# NEW: vibecode.dev → <gke-ingress-ip>

# Lower TTL before cutover (6 hours before)
# Change DNS TTL from 3600s to 60s
```

#### Phase 5: Cutover (30 minutes)

**5.1 Pre-Cutover Checks**
```bash
# Verify replication lag <10 seconds
psql -h <cloudsql-endpoint> -U postgres -d vibecode -c "
SELECT subscription_name, AGE(now(), latest_end_time) as lag
FROM pg_stat_subscription;
"

# Verify storage sync complete
aws s3 ls s3://vibecode-workspace-archives/ --recursive | wc -l
gsutil ls -r gs://vibecode-archives/ | wc -l

# Verify GKE application health
kubectl get pods -n vibecode --field-selector=status.phase=Running | wc -l

# Run smoke tests on GCP environment
npm run test:smoke -- --url=http://<gke-ip>
```

**5.2 Execute Cutover**
```bash
# T-5min: Enable read-only mode on AWS
kubectl scale deployment vibecode-app -n vibecode --replicas=0

# T-3min: Promote Cloud SQL to primary
psql -h <cloudsql-endpoint> -U postgres -d vibecode <<SQL
DROP SUBSCRIPTION vibecode_sub;
SQL

# T-2min: Update DNS (A record)
# vibecode.dev → <gke-ingress-ip>
# Wait 60 seconds for DNS propagation

# T-1min: Scale up GKE deployment
kubectl scale deployment vibecode-app -n vibecode --replicas=3

# T-0min: Verify cutover
curl https://vibecode.dev/api/health
curl https://vibecode.dev/api/health/db

# Monitor for 10 minutes
watch -n 5 'kubectl get pods -n vibecode'
watch -n 5 'curl -s https://vibecode.dev/api/health | jq'
```

**5.3 Post-Cutover Validation**
```bash
# Run full integration tests
npm run test:integration:production

# Check error logs
kubectl logs -n vibecode deployment/vibecode-app --tail=100

# Monitor Datadog dashboard
# Check for:
# - API latency <200ms
# - Error rate <0.1%
# - Database query time <50ms
```

#### Phase 6: Cleanup (optional, after 7 days)

**6.1 Decommission AWS Resources**
```bash
# After confirming GCP stability for 7 days

# Delete Kubernetes cluster
eksctl delete cluster --name vibecode-workspaces --region us-east-1

# Delete RDS instance (with final snapshot)
aws rds delete-db-instance \
  --db-instance-identifier vibecode-db \
  --final-db-snapshot-identifier vibecode-db-final-snapshot \
  --region us-east-1

# Delete ElastiCache cluster
aws elasticache delete-replication-group \
  --replication-group-id vibecode-cache \
  --region us-east-1

# Archive S3 bucket to Glacier
aws s3api put-bucket-lifecycle-configuration \
  --bucket vibecode-workspace-archives \
  --lifecycle-configuration file://s3-archive-policy.json

# Delete EFS (after archiving)
aws efs delete-file-system \
  --file-system-id <efs-id> \
  --region us-east-1
```

---

### Scenario 2: GCP → Azure

**Timeline:** 18 hours
**Downtime:** <5 minutes

#### Key Differences from AWS→GCP
- Use `azcopy` instead of `gsutil` for storage migration
- Azure Database for PostgreSQL uses different replication method
- Azure Files uses SMB protocol (requires different mount commands)
- Azure Kubernetes Service (AKS) has different networking model

#### Phase 1: Preparation (4 hours)

```bash
# Create Azure resource group
az group create \
  --name vibecode-prod \
  --location eastus

# Create AKS cluster
az aks create \
  --resource-group vibecode-prod \
  --name vibecode-cluster \
  --node-count 3 \
  --node-vm-size Standard_D4s_v3 \
  --enable-addons monitoring \
  --generate-ssh-keys

# Get AKS credentials
az aks get-credentials \
  --resource-group vibecode-prod \
  --name vibecode-cluster
```

#### Phase 2: Database Migration (6 hours)

```bash
# Create Azure Database for PostgreSQL
az postgres flexible-server create \
  --resource-group vibecode-prod \
  --name vibecode-db \
  --location eastus \
  --admin-user postgres \
  --admin-password '<strong-password>' \
  --sku-name Standard_D8s_v3 \
  --tier GeneralPurpose \
  --version 16 \
  --storage-size 512 \
  --backup-retention 30

# Enable logical replication
az postgres flexible-server parameter set \
  --resource-group vibecode-prod \
  --server-name vibecode-db \
  --name wal_level \
  --value logical

# Set up replication from Cloud SQL to Azure PostgreSQL
# (Similar process to AWS→GCP scenario)
```

#### Phase 3: Storage Migration (4 hours)

```bash
# Create Azure Storage account
az storage account create \
  --name vibecodeprodstorage \
  --resource-group vibecode-prod \
  --location eastus \
  --sku Standard_LRS

# Create blob container
az storage container create \
  --name archives \
  --account-name vibecodeprodstorage

# Copy from GCS to Azure Blob (using azcopy)
azcopy copy \
  'https://storage.googleapis.com/vibecode-archives/*' \
  'https://vibecodeprodstorage.blob.core.windows.net/archives' \
  --recursive

# Create Azure Files share
az storage share create \
  --name workspaces \
  --account-name vibecodeprodstorage \
  --quota 2048

# Mount Azure Files and sync from Filestore
# (Different mount command due to SMB protocol)
```

#### Phase 4-6: Same as AWS→GCP
(Deploy to AKS, cutover, cleanup)

---

### Scenario 3: Azure → AWS

**Timeline:** 16 hours
**Downtime:** <5 minutes

#### Key Differences
- Use AWS DMS (Database Migration Service) for continuous replication
- AWS S3 sync from Azure Blob using `aws s3 sync` with Azure SAS token
- EFS mount uses NFS v4.1 instead of SMB

---

## Rollback Procedures

### Immediate Rollback (<1 hour)

**When to Rollback:**
- Database replication lag >60 seconds
- Error rate >5% after cutover
- Critical functionality broken
- Customer-facing issues

**Rollback Steps:**
```bash
# 1. Revert DNS (A record)
# vibecode.dev → <old-cloud-lb-ip>

# 2. Re-enable old cloud deployment
kubectl scale deployment vibecode-app -n vibecode --replicas=3

# 3. Verify health
curl https://vibecode.dev/api/health

# 4. Monitor for 15 minutes
watch -n 5 'curl -s https://vibecode.dev/api/health | jq'

# 5. Document rollback reason
# Create incident report for post-mortem
```

---

## Disaster Recovery

### Cross-Cloud Backup Strategy

**Daily Backups:**
```bash
#!/bin/bash
# backup-cross-cloud.sh

# Database backup
pg_dump -h <db-host> -U postgres -Fc vibecode > vibecode-$(date +%Y%m%d).dump

# Upload to all cloud providers
aws s3 cp vibecode-$(date +%Y%m%d).dump s3://vibecode-backups-aws/
gsutil cp vibecode-$(date +%Y%m%d).dump gs://vibecode-backups-gcp/
az storage blob upload --file vibecode-$(date +%Y%m%d).dump \
  --account-name vibecodebackups --container-name backups
```

**Weekly Full System Snapshot:**
```bash
# Export all Kubernetes resources
kubectl get all -A -o yaml > k8s-snapshot-$(date +%Y%m%d).yaml

# Archive storage
tar -czf storage-$(date +%Y%m%d).tar.gz /mnt/storage/

# Store in all clouds
```

---

## Monitoring During Migration

### Key Metrics to Watch

```yaml
critical_metrics:
  database:
    replication_lag: <10s
    connection_count: <80% of max
    query_latency_p95: <200ms

  application:
    error_rate: <0.1%
    api_latency_p95: <500ms
    success_rate: >99.9%

  storage:
    transfer_rate: >100 MB/s
    integrity_check: 100% match

  infrastructure:
    pod_health: 100% ready
    node_health: 100% ready
    network_latency: <50ms
```

### Datadog Alerts
```json
{
  "alerts": [
    {
      "name": "Migration Replication Lag High",
      "query": "avg(last_5m):avg:postgresql.replication_lag{*} > 60",
      "message": "Database replication lag exceeded 60 seconds. @pagerduty-migration-team",
      "priority": "P1"
    },
    {
      "name": "Migration Error Rate Spike",
      "query": "avg(last_5m):sum:vibecode.api.errors{*}.as_rate() > 0.05",
      "message": "Error rate exceeded 5% during migration. @pagerduty-migration-team",
      "priority": "P1"
    }
  ]
}
```

---

## Success Criteria

### Post-Migration Validation Checklist

- [ ] All services healthy (kubectl get pods shows 100% ready)
- [ ] Database replication lag = 0 (no subscription active)
- [ ] API latency p95 <200ms
- [ ] Error rate <0.1%
- [ ] Storage integrity verified (checksum match)
- [ ] User authentication working
- [ ] Code completion functional
- [ ] Vector search operational
- [ ] WebSocket connections stable
- [ ] File uploads working
- [ ] Workspace provisioning functional

### Performance Benchmarks

```bash
# Run performance tests
npm run test:performance -- --url=https://vibecode.dev

# Expected results:
# - Homepage load: <2s
# - API response time: <200ms (p95)
# - Vector search: <100ms
# - Code completion: <500ms
# - Concurrent users: 100+ without degradation
```

---

## Communication Plan

### Stakeholder Notifications

**Pre-Migration (24 hours before):**
```
Subject: VibeCode Platform Migration - Scheduled Maintenance

We will be performing a cloud infrastructure migration on [DATE] from [TIME] to [TIME].

Expected downtime: <5 minutes
Affected services: All VibeCode features

What to expect:
- Brief service interruption (<5 minutes)
- Automatic reconnection for active users
- No data loss
- Improved performance and reliability

Contact: devops@vibecode.io
Status page: https://status.vibecode.dev
```

**During Migration:**
```
Subject: [IN PROGRESS] VibeCode Migration

Migration in progress. Current status: [Phase X of 6]
Expected completion: [TIME]

Status updates every 30 minutes at:
https://status.vibecode.dev
```

**Post-Migration:**
```
Subject: [COMPLETE] VibeCode Migration Successful

Migration completed successfully!

New infrastructure:
- Provider: [AWS/GCP/Azure]
- Region: [us-east-1/us-central1/eastus]
- Performance: [metrics]

All services operational. Thank you for your patience.
```

---

## Appendix

### Cost Comparison Calculator

```typescript
// migration-cost-calculator.ts
interface MigrationCosts {
  dataTransfer: number
  dualRunning: number
  engineeringTime: number
  total: number
}

function calculateMigrationCost(dataSize: number, dualRunHours: number): MigrationCosts {
  const dataTransferCost = dataSize * 0.09 // $0.09/GB egress
  const dualRunningCost = (2401 / 730) * dualRunHours // hourly cost * hours
  const engineeringTime = 16 * 150 // 16 hours * $150/hour

  return {
    dataTransfer: dataTransferCost,
    dualRunning: dualRunningCost,
    engineeringTime: engineeringTime,
    total: dataTransferCost + dualRunningCost + engineeringTime
  }
}

// Example: 500GB data, 8 hours dual running
const cost = calculateMigrationCost(500, 8)
console.log(cost)
// {
//   dataTransfer: $45,
//   dualRunning: $263,
//   engineeringTime: $2,400,
//   total: $2,708
// }
```

### Terraform Migration Helper

```hcl
# terraform/migration/main.tf

module "source_cloud" {
  source = "../${var.source_provider}"

  # Source cloud configuration
  cluster_name = var.cluster_name
  region = var.source_region
}

module "target_cloud" {
  source = "../${var.target_provider}"

  # Mirror configuration from source
  cluster_name = var.cluster_name
  region = var.target_region
  kubernetes_version = module.source_cloud.kubernetes_version
  node_count = module.source_cloud.node_count
}

output "migration_plan" {
  value = {
    source = module.source_cloud.cluster_endpoint
    target = module.target_cloud.cluster_endpoint
    estimated_downtime = "5 minutes"
    data_transfer_gb = var.data_size_gb
    estimated_cost = var.data_size_gb * 0.09 + 2400
  }
}
```

---

**End of Migration Guide**

*Generated by Agent 10 - Cloud Platform Engineer*
*VibeCode Project - 2025-10-02*
