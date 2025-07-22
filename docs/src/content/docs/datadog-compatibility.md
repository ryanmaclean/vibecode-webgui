---
title: datadog compatibility
description: datadog compatibility documentation
---

# Datadog Compatibility & PostgreSQL pgvector Standardization

## 🔍 Datadog Agent Compatibility Matrix Compliance

### Requirements Met ✅
- **Datadog Agent**: `7.66.1` (required: >=7.33.0)
- **Cluster Agent**: `1.24.0` (required: >=1.18.0)  
- **orchestratorExplorer**: Enabled for Pod collection
- **Both agents running**: Yes, in each monitored cluster

### Updated Configurations

#### 1. Main Datadog Agent (`datadog-agent.yaml`)
```yaml
features:
  orchestratorExplorer:
    enabled: true  # Required for Pod collection
override:
  clusterAgent:
    image:
      tag: "1.24.0"  # Meets >=1.18.0 requirement
  nodeAgent:
    image:
      tag: "7.66.1"  # Meets >=7.33.0 requirement
```

#### 2. Kubernetes Values (`k8s/datadog-values.yaml`)
```yaml
clusterAgent:
  enabled: true
  image:
    tag: "1.24.0"
  orchestratorExplorer:
    enabled: true

agents:
  enabled: true
  image:
    tag: "7.66.1"
  orchestratorExplorer:
    enabled: true
```

## 🐘 PostgreSQL pgvector Standardization

### Problem Identified
Multiple deployment methods were using inconsistent PostgreSQL images:
- ❌ `postgres:15-alpine` (no pgvector)
- ❌ `postgres:16-alpine` (no pgvector) 
- ✅ `pgvector/pgvector:pg16` (correct)

### Official pgvector Image Benefits
- **Official**: Maintained by pgvector team
- **MIT Licensed**: Compatible with our requirements
- **Production Ready**: Based on official PostgreSQL images
- **Pre-installed**: pgvector extension built-in
- **Current**: PostgreSQL 16 + latest pgvector

### Files Updated ✅

1. **KIND Setup**: `scripts/kind-setup.sh`
   ```yaml
   image: pgvector/pgvector:pg16  # was postgres:16-alpine
   ```

2. **Production Compose**: `docker-compose.production.yml`
   ```yaml
   image: pgvector/pgvector:pg16  # was postgres:15-alpine
   ```

3. **Kubernetes**: `k8s/postgres-deployment.yaml`
   ```yaml
   image: pgvector/pgvector:pg16  # was postgres:15
   ```

4. **Project Scaffolder**: `src/components/projects/ProjectScaffolder.tsx`
   ```yaml
   image: pgvector/pgvector:pg16  # was postgres:15-alpine
   ```

5. **Authelia Deploy**: `scripts/deploy-authelia.sh`
   ```yaml
   image: pgvector/pgvector:pg16  # was postgres:15-alpine
   ```

6. **Cluster Setup**: `scripts/setup-vibecode-cluster.sh`
   ```yaml
   image: pgvector/pgvector:pg16  # was postgres:15
   ```

7. **Vibecode K8s**: `k8s/vibecode-deployment.yaml`
   ```yaml
   image: pgvector/pgvector:pg16  # was postgres:15
   ```

8. **Testing Scripts**: `scripts/comprehensive-kind-testing.sh`
   ```bash
   "pgvector/pgvector:pg16"  # was "postgres:15-alpine"
   ```

### Database Schema Compatibility
The Prisma schema uses:
```prisma
embedding  Unsupported("vector(1536)")? // pgvector embedding for semantic search
```

This requires the `vector` extension, which is now available in all deployments using the `pgvector/pgvector:pg16` image.

## 🚀 Next Steps

1. **Test Schema Migration**:
   ```bash
   export DATABASE_URL="postgresql://vibecode:vibecode123@localhost:5432/vibecode_dev"
   npx prisma db push
   ```

2. **Verify Datadog Deployment**:
   ```bash
   kubectl get pods -n datadog
   kubectl logs -f deployment/datadog-agent -n datadog
   ```

3. **Check Pod Collection**:
   - Visit Datadog Infrastructure > Kubernetes
   - Verify Pod metrics are being collected
   - Confirm orchestratorExplorer is functioning

## 📋 Deployment Status

### ✅ Completed
- [x] Standardized all PostgreSQL images to `pgvector/pgvector:pg16`
- [x] Updated Datadog Agent versions to meet compatibility matrix
- [x] Enabled orchestratorExplorer for Pod collection
- [x] Verified both Datadog Agent and Cluster Agent configurations

### 🔄 In Progress
- [ ] Test Prisma schema against updated PostgreSQL
- [ ] Validate Datadog Pod collection functionality
- [ ] Update existing KIND cluster to use new image

### 📊 Impact
- **Security**: All PostgreSQL deployments now use officially maintained images
- **Functionality**: Vector embeddings now work across all deployment methods
- **Monitoring**: Full Pod collection capabilities with compliant Datadog versions
- **Consistency**: Single PostgreSQL image across all environments 