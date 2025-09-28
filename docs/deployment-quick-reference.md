# VibeCode Deployment Quick Reference

This quick reference guide provides the essential commands for deploying the VibeCode platform on Azure AKS with Datadog monitoring.

## Prerequisites

- Azure CLI (`az`) installed and logged in
- kubectl installed and configured
- Helm v3+ installed
- Datadog account and API key (for monitoring)
- OpenTofu v1.7.3+ (optional, for infrastructure as code)

## Deployment Process

### 1. AKS Cluster Creation

```bash
# Deploy new AKS cluster
./scripts/create-aks-cluster.sh \
  --resource-group rg-vibecode-aks-prod \
  --cluster-name vibecode-aks \
  --location eastus2 \
  --node-count 3 \
  --node-vm-size Standard_D4s_v3 \
  --acr-name vibecodecr$(openssl rand -hex 4)
```

### 2. DNS Configuration

```bash
# Create public IP with DNS name
./scripts/create-public-ip.sh \
  --resource-group rg-vibecode-dns \
  --dns-name-label vibecode \
  --location eastus2

# Verify DNS setup
./scripts/verify-dns-ssl.sh
```

### 3. Application Deployment

```bash
# Deploy the full stack
./scripts/deploy-vibecode.sh \
  --resource-group rg-vibecode-dns \
  --cluster-name vibecode-aks \
  --acr-name vibecodecr12345

# Just deploy ingress controller
./scripts/deploy-ingress-controller.sh \
  --resource-group rg-vibecode-dns \
  --public-ip-name vibecode-dns-ip

# Deploy application with Python helper
python scripts/app_deploy.py \
  --acr-name vibecodecr12345 \
  --image-tag latest \
  --skip-build \
  --fullname-override vibecode-app \
  --namespace vibecode-platform \
  --wait
```

### 4. Datadog Monitoring Setup

```bash
# Export your Datadog credentials
export DD_API_KEY=your_datadog_api_key
export DD_APP_KEY=your_datadog_app_key
export DD_SITE=datadoghq.com  # Optional, defaults to datadoghq.com

# Deploy Datadog monitoring stack
./scripts/setup-aks-datadog-monitoring.sh \
  --resource-group rg-vibecode-dns \
  --cluster-name vibecode-aks \
  --namespace vibecode-platform \
  --datadog-namespace datadog

# Apply least-privilege RBAC for DBM operations
kubectl apply -f k8s/rbac/dbm-ops-rbac.yaml

# Validate Database Monitoring (after application is deployed)
./scripts/verify-datadog-dbm.sh

# Quick metric smoke test against Datadog (requires jq)
DD_API_KEY=$DD_API_KEY DD_APP_KEY=$DD_APP_KEY ./scripts/check-datadog-dbmon-metrics.sh -s vibecode -w 15m

# The curated dashboard is available at:
# https://app.datadoghq.com/dashboard/t47-awp-k2u/postgresql-pgvector-monitoring---vibecode
```

### 5. LLM Provider Configuration

The default deployment rotates through a pool of free-tier OpenRouter models before falling back to OpenAI. Update the Helm values or environment overrides if you need a different mix:

```bash
# Update the default LLM model and free pool (newline separated keeps it readable)
export VIBECODE_DEFAULT_LLM_MODEL="mistralai/mistral-small-3.2-24b-instruct:free"
read -r -d '' FREE_LLM_MODELS <<'EOF'
mistralai/mistral-small-3.2-24b-instruct:free
x-ai/grok-4-fast:free
openai/gpt-oss-20b:free
openai/gpt-oss-120b:free
deepseek/deepseek-chat-v3.1:free
nvidia/nemotron-nano-9b-v2:free
z-ai/glm-4.5-air:free
google/gemma-3n-e4b-it:free
tencent/hunyuan-a13b-instruct:free
moonshotai/kimi-dev-72b:free
EOF

# Persist the overrides via Helm
helm upgrade vibecode charts/vibecode \
  --namespace vibecode-platform \
  --set env.VIBECODE_DEFAULT_LLM_MODEL="$VIBECODE_DEFAULT_LLM_MODEL" \
  --set-file env.FREE_LLM_MODELS=<(printf "%s" "$FREE_LLM_MODELS")
```

> Tip: Keep at least one stable coding/generalist model (for example, the Mistral entry above) at the front of the list so the fallback chain has a reliable first responder.

Starting with this release the chart installs a `CronJob` named `vibecode-free-llm-updater` that re-validates the OpenRouter free-tier catalogue every 12 hours. Successful runs patch the `free-llm-models` ConfigMap, which is mounted into the web pods at `/etc/vibecode/free-llm-models/models.txt` and read through the `FREE_LLM_MODELS_FILE` environment variable. Docker Compose environments include an equivalent `free-llm-model-updater` sidecar that performs the same refresh loop and writes to `/app/runtime/free-llm-models/models.txt`.

Each job run also emits Datadog metrics (counts, gauges, and durations) under the `openrouter.free_models.*` namespace when `DD_API_KEY` is available, so you can alert on stale data (for example, `openrouter.free_models.working_models` dropping below your comfort threshold or consecutive `openrouter.free_models.failure` increments).

### 6. Data and Vector Setup

```bash
# Apply database migrations
npx prisma generate
npx prisma migrate deploy

# Generate vector data
./scripts/generate-vector-activity.sh

# Verify RAG functionality
npx ts-node scripts/verify-rag-functionality.ts
```

## Validation and Testing

### Application Access

The application is accessible via:
- **URL**: `https://vibecode.eastus2.cloudapp.azure.com`

### Checking Deployment Status

```bash
# Check ingress
kubectl get ingress -n vibecode-platform

# Check pods
kubectl get pods -n vibecode-platform

# Check services
kubectl get svc -n vibecode-platform

# Check certificate status
kubectl get certificate -n vibecode-platform
```

### Datadog Verification

```bash
# Ensure DBM cluster agents are running for Kubernetes resource collection
kubectl get deployments -n datadog -l app.kubernetes.io/name=datadog-cluster-agent

# Check Datadog agent status
kubectl get pods -n datadog

# Check Datadog cluster agent
kubectl get deployment datadog-cluster-agent -n datadog

# Verify PostgreSQL monitoring
./scripts/verify-datadog-dbm.sh
```

## Common Operations

### Restarting Components

```bash
# Restart application
kubectl rollout restart deployment vibecode-app -n vibecode-platform

# Restart Datadog agents
kubectl rollout restart daemonset datadog -n datadog
kubectl rollout restart deployment datadog-cluster-agent -n datadog
```

### Scaling Application

```bash
# Scale application replicas
kubectl scale deployment vibecode-app -n vibecode-platform --replicas=3
```

### Updating Configurations

```bash
# Update ingress configuration
helm upgrade nginx-ingress ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --set controller.service.annotations."service\.beta\.kubernetes\.io/azure-dns-label-name"=vibecode

# Update Datadog values
helm upgrade datadog datadog/datadog \
  --namespace datadog \
  --values k8s/datadog-values-aks.yaml            # production
# helm upgrade datadog datadog/datadog \
#   --namespace datadog \
#   --values k8s/datadog-values-aks-staging.yaml   # staging
```

## Troubleshooting

### Application Issues

```bash
# Check application logs
kubectl logs -n vibecode-platform -l app=vibecode-app

# Check ingress controller logs
kubectl logs -n ingress-nginx -l app.kubernetes.io/component=controller
```

### Datadog Issues

```bash
# Check Datadog agent logs
kubectl logs -n datadog -l app=datadog

# Check Datadog cluster agent logs 
kubectl logs -n datadog -l app=datadog-cluster-agent
```

### Network Issues

```bash
# Test DNS resolution
nslookup vibecode.eastus2.cloudapp.azure.com

# Test HTTP connectivity
curl -v http://vibecode.eastus2.cloudapp.azure.com

# Test HTTPS connectivity
curl -v https://vibecode.eastus2.cloudapp.azure.com
```

## Reference Documentation

For more detailed guidance, refer to:
- [AKS Datadog Monitoring Guide](./aks-datadog-monitoring-guide.md)
- [DNS Setup Guide](./dns-setup-guide.md)
- [OpenTofu Backend Configuration](../tofu/backend.tf.example)
- [Datadog Kubernetes Documentation](https://docs.datadoghq.com/integrations/kubernetes/)
