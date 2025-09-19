#!/usr/bin/env bash
# AKS Datadog Setup - Deploy Datadog monitoring to AKS cluster
set -euo pipefail

# Source common configuration
CLUSTER_NAME=${CLUSTER_NAME:-vibecode-aks}
RESOURCE_GROUP=${RESOURCE_GROUP:-vibecode-rg}
DD_NAMESPACE=${DD_NAMESPACE:-datadog}
LOCATION=${LOCATION:-eastus2}

log() {
  printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*"
}

error() {
  printf '[%s] ERROR: %s\n' "$(date +%H:%M:%S)" "$*" >&2
  exit 1
}

log "setting up Datadog monitoring on AKS cluster $CLUSTER_NAME"

# Validate required environment variables
if [ -z "${DD_API_KEY:-}" ]; then
  error "DD_API_KEY environment variable is required"
fi

# Create Datadog namespace
log "creating Datadog namespace: $DD_NAMESPACE"
kubectl create namespace "$DD_NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

# Create Datadog secret
log "creating Datadog API secret"
kubectl -n "$DD_NAMESPACE" create secret generic datadog-secret \
  --from-literal=api-key="${DD_API_KEY}" \
  --from-literal=app-key="${DD_APP_KEY:-}" \
  --dry-run=client -o yaml | kubectl apply -f -

# Add Datadog Helm repository
log "adding Datadog Helm repository"
helm repo add datadog https://helm.datadoghq.com || true
helm repo update

# Check if values file exists
VALUES_FILE="k8s/datadog-values-aks.yaml"
if [ ! -f "$VALUES_FILE" ]; then
  log "creating basic Datadog values file"
  cat > "$VALUES_FILE" << EOF
# Basic Datadog configuration for AKS
datadog:
  site: "${DD_SITE:-datadoghq.com}"
  logs:
    enabled: true
    containerCollectAll: true
  apm:
    enabled: true
  processAgent:
    enabled: true
  networkMonitoring:
    enabled: true

agents:
  image:
    tag: "7.50.3"
  
  tolerations:
    - key: "CriticalAddonsOnly"
      operator: "Exists"
    - key: "kubernetes.azure.com/scalesetpriority"
      operator: "Equal"
      value: "spot"
      effect: "NoSchedule"

clusterAgent:
  enabled: true
  replicas: 2
  
  tolerations:
    - key: "CriticalAddonsOnly"
      operator: "Exists"
    - key: "kubernetes.azure.com/scalesetpriority"
      operator: "Equal"
      value: "spot"
      effect: "NoSchedule"
EOF
fi

# Deploy Datadog agent
log "deploying Datadog agent with AKS-specific configuration"
helm upgrade --install datadog-agent datadog/datadog \
  --namespace "$DD_NAMESPACE" \
  --values "$VALUES_FILE" \
  --set datadog.apiKey="$DD_API_KEY" \
  --set datadog.appKey="${DD_APP_KEY:-}" \
  --set datadog.site="${DD_SITE:-datadoghq.com}" \
  --set datadog.clusterName="$CLUSTER_NAME" \
  --set datadog.tags[0]="env:${NODE_ENV:-production}" \
  --set datadog.tags[1]="provider:azure" \
  --set datadog.tags[2]="cluster:$CLUSTER_NAME" \
  --set datadog.tags[3]="location:$LOCATION" \
  --wait --timeout=600s

# Verify Datadog deployment
log "verifying Datadog agent deployment"
kubectl -n "$DD_NAMESPACE" rollout status daemonset/datadog-agent --timeout=300s
kubectl -n "$DD_NAMESPACE" rollout status deployment/datadog-cluster-agent --timeout=300s

# Check agent pods
agent_pods=$(kubectl -n "$DD_NAMESPACE" get pods -l app=datadog-agent --no-headers | wc -l)
cluster_agent_pods=$(kubectl -n "$DD_NAMESPACE" get pods -l app=datadog-cluster-agent --no-headers | wc -l)

log "✅ Datadog setup complete!"
log "  Agent pods: $agent_pods"
log "  Cluster agent pods: $cluster_agent_pods"
log "  Namespace: $DD_NAMESPACE"
log ""
log "🔍 Check Datadog dashboard for cluster: $CLUSTER_NAME"
log "   Tags: env:${NODE_ENV:-production}, provider:azure, cluster:$CLUSTER_NAME"
