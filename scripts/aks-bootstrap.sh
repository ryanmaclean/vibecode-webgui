#!/usr/bin/env bash
set -euo pipefail

# AKS Bootstrap Script - Production deployment for Azure Kubernetes Service
# Extends min-kind-bootstrap.sh functionality for AKS with Azure-specific defaults

# Azure-specific defaults
PROVIDER=${PROVIDER:-aks}
RESOURCE_GROUP=${RESOURCE_GROUP:-vibecode-rg}
CLUSTER_NAME=${CLUSTER_NAME:-vibecode-aks}
ACR_NAME=${ACR_NAME:-vibecodecr}
LOCATION=${LOCATION:-eastus}
NAMESPACE=${NAMESPACE:-vibecode-platform}
DATADOG_NAMESPACE=${DD_NAMESPACE:-datadog}
STORAGE_CLASS=${STORAGE_CLASS:-managed-csi}
POSTGRES_STORAGE_CLASS=${POSTGRES_STORAGE_CLASS:-managed-csi-premium}

# Environment and configuration
ENV_FILE=${ENV_FILE:-.env.azure}
SKIP_CLUSTER_VALIDATION=${SKIP_CLUSTER_VALIDATION:-false}
SKIP_ACR_LOGIN=${SKIP_ACR_LOGIN:-false}
ENABLE_MONITORING=${ENABLE_MONITORING:-true}
ENABLE_BACKUP=${ENABLE_BACKUP:-true}

log() {
  printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*"
}

error() {
  printf '[%s] ERROR: %s\n' "$(date +%H:%M:%S)" "$*" >&2
  exit 1
}

require() {
  if ! command -v "$1" >/dev/null 2>&1; then
    error "Missing required dependency: $1"
  fi
}

# Validate Azure tooling
log "Validating Azure and Kubernetes tooling"
require az
require kubectl
require helm
require openssl

# Load environment overrides
if [ -f "$ENV_FILE" ]; then
  log "Loading environment overrides from $ENV_FILE"
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
else
  log "Warning: $ENV_FILE not found, using defaults"
fi

# Validate Azure login
if ! az account show >/dev/null 2>&1; then
  error "Not logged into Azure. Run 'az login' first."
fi

# Validate required environment variables
required_vars=(
  "DD_API_KEY"
  "POSTGRES_PASSWORD"
  "NEXTAUTH_SECRET"
)

for var in "${required_vars[@]}"; do
  if [ -z "${!var:-}" ]; then
    error "Required environment variable $var is not set"
  fi
done

# Validate AKS cluster access
validate_aks_access() {
  log "Validating AKS cluster access"
  
  if [ "$SKIP_CLUSTER_VALIDATION" = "true" ]; then
    log "Skipping cluster validation (SKIP_CLUSTER_VALIDATION=true)"
    return 0
  fi
  
  # Get AKS credentials
  log "Getting AKS credentials for cluster $CLUSTER_NAME"
  az aks get-credentials --resource-group "$RESOURCE_GROUP" --name "$CLUSTER_NAME" --overwrite-existing
  
  # Validate cluster connectivity
  if ! kubectl cluster-info >/dev/null 2>&1; then
    error "Cannot connect to AKS cluster. Verify cluster exists and credentials are correct."
  fi
  
  # Validate cluster readiness
  if ! kubectl get nodes >/dev/null 2>&1; then
    error "Cannot list cluster nodes. Check RBAC permissions."
  fi
  
  local node_count
  node_count=$(kubectl get nodes --no-headers | wc -l)
  log "AKS cluster validation successful ($node_count nodes ready)"
}

# Configure ACR authentication
configure_acr() {
  if [ "$SKIP_ACR_LOGIN" = "true" ]; then
    log "Skipping ACR login (SKIP_ACR_LOGIN=true)"
    return 0
  fi
  
  log "Configuring Azure Container Registry authentication"
  
  # Login to ACR
  az acr login --name "$ACR_NAME"
  
  # Attach ACR to AKS cluster (if not already attached)
  log "Attaching ACR $ACR_NAME to AKS cluster $CLUSTER_NAME"
  az aks update --resource-group "$RESOURCE_GROUP" --name "$CLUSTER_NAME" --attach-acr "$ACR_NAME" || {
    log "Warning: ACR attach failed (may already be attached)"
  }
}

# Install Azure-specific storage classes
install_storage_classes() {
  log "Installing Azure storage classes"
  
  cat <<EOF | kubectl apply -f -
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: managed-csi-premium
  annotations:
    storageclass.kubernetes.io/is-default-class: "false"
provisioner: disk.csi.azure.com
parameters:
  skuName: Premium_LRS
  cachingmode: ReadOnly
  kind: Managed
reclaimPolicy: Delete
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: true
---
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: azurefile-csi-premium
  annotations:
    storageclass.kubernetes.io/is-default-class: "false"
provisioner: file.csi.azure.com
parameters:
  skuName: Premium_LRS
reclaimPolicy: Delete
volumeBindingMode: Immediate
allowVolumeExpansion: true
EOF
}

# Deploy Datadog with Azure-specific configuration
deploy_datadog() {
  if [ "$ENABLE_MONITORING" != "true" ]; then
    log "Skipping Datadog deployment (ENABLE_MONITORING=false)"
    return 0
  fi
  
  log "Deploying Datadog monitoring with Azure configuration"
  
  # Create Datadog namespace
  kubectl create namespace "$DATADOG_NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
  
  # Create Datadog secrets
  kubectl -n "$DATADOG_NAMESPACE" create secret generic datadog-secret \
    --from-literal=api-key="${DD_API_KEY}" \
    --from-literal=app-key="${DD_APP_KEY:-}" \
    --dry-run=client -o yaml | kubectl apply -f -
  
  # Deploy using Helm with Azure-specific values
  helm repo add datadog https://helm.datadoghq.com || true
  helm repo update
  
  helm upgrade --install datadog-agent datadog/datadog \
    --namespace "$DATADOG_NAMESPACE" \
    --values k8s/datadog-values-aks.yaml \
    --set datadog.apiKey="$DD_API_KEY" \
    --set datadog.appKey="${DD_APP_KEY:-}" \
    --set datadog.site="${DD_SITE:-datadoghq.com}" \
    --set datadog.clusterName="$CLUSTER_NAME" \
    --set datadog.tags[0]="env:production" \
    --set datadog.tags[1]="provider:azure" \
    --set datadog.tags[2]="cluster:$CLUSTER_NAME" \
    --wait --timeout=600s
}

# Deploy PostgreSQL with pgvector
deploy_postgresql() {
  log "Deploying PostgreSQL 16 with pgvector extension"
  
  # Apply init SQL ConfigMap into target namespace
  log "Applying PostgreSQL init ConfigMap in namespace ${NAMESPACE}"
  tmp_file=$(mktemp)
  sed "s/namespace: vibecode-platform/namespace: ${NAMESPACE}/g" k8s/postgres-init-configmap.yaml > "$tmp_file"
  kubectl apply -f "$tmp_file"
  rm -f "$tmp_file"

  # Create PostgreSQL password secret
  log "Creating PostgreSQL password secret in ${NAMESPACE}"
  kubectl -n "$NAMESPACE" create secret generic postgresql-secret \
    --from-literal=POSTGRES_PASSWORD="${POSTGRES_PASSWORD}" \
    --dry-run=client -o yaml | kubectl apply -f -

  # Apply PostgreSQL StatefulSet with Azure Disk
  kubectl -n "$NAMESPACE" apply -f k8s/postgresql-aks-statefulset.yaml
  
  # Wait for PostgreSQL to be ready
  kubectl -n "$NAMESPACE" rollout status statefulset/postgresql --timeout=600s
  kubectl -n "$NAMESPACE" wait --for=condition=Ready pod -l app=postgresql --timeout=300s
  
  # Verify pgvector extension
  log "Verifying pgvector extension installation"
  kubectl -n "$NAMESPACE" exec -it postgresql-0 -- psql -U postgres -d vibecode -c "SELECT extname FROM pg_extension WHERE extname = 'vector';" || {
    log "Warning: pgvector extension verification failed"
  }
}

# Deploy application with production configuration
deploy_application() {
  log "Deploying VibeCode application with production configuration"
  
  # Create application secrets
  kubectl -n "$NAMESPACE" create secret generic vibecode-secrets \
    --from-literal=DATABASE_URL="postgresql://postgres:${POSTGRES_PASSWORD}@postgresql:5432/vibecode" \
    --from-literal=NEXTAUTH_SECRET="$NEXTAUTH_SECRET" \
    --from-literal=NODE_ENV="production" \
    --from-literal=DD_API_KEY="$DD_API_KEY" \
    --from-literal=DD_APP_KEY="${DD_APP_KEY:-}" \
    --from-literal=OPENROUTER_API_KEY="${OPENROUTER_API_KEY:-}" \
    --dry-run=client -o yaml | kubectl apply -f -
  
  # Deploy using Helm chart
  helm upgrade --install vibecode-app ./charts/vibecode-platform \
    --namespace "$NAMESPACE" \
    --values charts/vibecode-platform/values-aks.yaml \
    --set web.image.repository="$ACR_NAME.azurecr.io/vibecode-webgui" \
    --set web.image.tag="${IMAGE_TAG:-latest}" \
    --set postgresql.enabled=false \
    --set ingress.hostname="${INGRESS_HOSTNAME:-vibecode.${LOCATION}.cloudapp.azure.com}" \
    --wait --timeout=600s
}

# Main execution
main() {
  log "Starting AKS bootstrap for VibeCode platform"
  log "Cluster: $CLUSTER_NAME | Resource Group: $RESOURCE_GROUP | Location: $LOCATION"
  
  # Validation phase
  validate_aks_access
  configure_acr
  
  # Infrastructure setup
  log "Creating namespace $NAMESPACE"
  kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
  
  install_storage_classes
  
  # Service deployments
  deploy_datadog
  deploy_postgresql
  deploy_application
  
  # Final validation
  log "Validating deployment health"
  kubectl -n "$NAMESPACE" get pods -o wide
  kubectl -n "$NAMESPACE" get services
  
  log "AKS bootstrap completed successfully!"
  log ""
  log "Next steps:"
  log "1. Configure DNS for your ingress hostname"
  log "2. Set up SSL certificates (cert-manager recommended)"
  log "3. Configure backup schedules for PostgreSQL"
  log "4. Review Datadog dashboards and alerts"
  log ""
  log "Access your application:"
  if [ -n "${INGRESS_HOSTNAME:-}" ]; then
    log "  External: https://${INGRESS_HOSTNAME}"
  fi
  log "  Port-forward: kubectl -n $NAMESPACE port-forward svc/vibecode-app 3000:80"
}

# Execute main function
main "$@"
