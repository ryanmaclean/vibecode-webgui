#!/usr/bin/env bash
set -euo pipefail

# AKS Bootstrap Script - Production-ready deployment to Azure Kubernetes Service
# Extends min-kind-bootstrap.sh pattern for AKS with Azure-specific configurations

PROVIDER=${PROVIDER:-aks}
CLUSTER_NAME=${CLUSTER_NAME:-vibecode-aks}
RESOURCE_GROUP=${RESOURCE_GROUP:-vibecode-rg}
ACR_NAME=${ACR_NAME:-vibecodecr}
NAMESPACE=${NAMESPACE:-vibecode-platform}
DD_NAMESPACE=${DD_NAMESPACE:-datadog}
LOCATION=${LOCATION:-eastus2}

# Azure-specific configurations
STORAGE_CLASS=${STORAGE_CLASS:-managed-csi}
NODE_RESOURCE_GROUP=${NODE_RESOURCE_GROUP:-MC_${RESOURCE_GROUP}_${CLUSTER_NAME}_${LOCATION}}
SUBSCRIPTION_ID=${SUBSCRIPTION_ID:-}

log() {
  printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*"
}

error() {
  printf '[%s] ERROR: %s\n' "$(date +%H:%M:%S)" "$*" >&2
  exit 1
}

require() {
  if ! command -v "$1" >/dev/null 2>&1; then
    error "Missing dependency: $1"
  fi
}

log "validating Azure tooling for AKS bootstrap"
require az
require kubectl
require helm
require docker

# Load environment overrides
ENV_FILE=${ENV_FILE:-.env.aks}
if [ -f "$ENV_FILE" ]; then
  log "loading AKS environment overrides from $ENV_FILE"
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

# Validate Azure authentication
if ! az account show >/dev/null 2>&1; then
  error "Not logged in to Azure. Run 'az login' first."
fi

# Get subscription ID if not provided
if [ -z "$SUBSCRIPTION_ID" ]; then
  SUBSCRIPTION_ID=$(az account show --query id -o tsv)
  log "using current subscription: $SUBSCRIPTION_ID"
fi

validate_aks_cluster() {
  log "validating AKS cluster access"
  
  if ! az aks show --resource-group "$RESOURCE_GROUP" --name "$CLUSTER_NAME" >/dev/null 2>&1; then
    error "AKS cluster '$CLUSTER_NAME' not found in resource group '$RESOURCE_GROUP'"
  fi
  
  log "getting AKS credentials"
  az aks get-credentials --resource-group "$RESOURCE_GROUP" --name "$CLUSTER_NAME" --overwrite-existing
  
  if ! kubectl cluster-info >/dev/null 2>&1; then
    error "Cannot connect to AKS cluster. Check kubectl configuration."
  fi
  
  log "AKS cluster connection validated"
}

validate_acr_access() {
  log "validating ACR access"
  
  if ! az acr show --name "$ACR_NAME" >/dev/null 2>&1; then
    error "ACR '$ACR_NAME' not found or not accessible"
  fi
  
  # Test ACR login
  if ! az acr login --name "$ACR_NAME" >/dev/null 2>&1; then
    error "Cannot login to ACR '$ACR_NAME'. Check permissions."
  fi
  
  log "ACR access validated"
}

ensure_azure_storage_class() {
  log "ensuring Azure storage classes are available"
  
  # Check if managed-csi storage class exists (default in AKS)
  if ! kubectl get storageclass "$STORAGE_CLASS" >/dev/null 2>&1; then
    log "creating Azure Disk storage class"
    cat <<EOF | kubectl apply -f -
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: $STORAGE_CLASS
provisioner: disk.csi.azure.com
parameters:
  storageaccounttype: Premium_LRS
  kind: Managed
  cachingmode: ReadOnly
allowVolumeExpansion: true
reclaimPolicy: Delete
volumeBindingMode: WaitForFirstConsumer
EOF
  fi
  
  log "Azure storage class '$STORAGE_CLASS' ready"
}

main() {
  log "starting AKS bootstrap for VibeCode platform"
  
  validate_aks_cluster
  validate_acr_access
  ensure_azure_storage_class
  
  # Call additional setup scripts
  ./scripts/aks-datadog-setup.sh
  ./scripts/aks-postgresql-setup.sh
  ./scripts/aks-app-deploy.sh
  
  log "AKS bootstrap complete!"
  log ""
  log "📊 Deployment Summary:"
  log "  Cluster: $CLUSTER_NAME"
  log "  Resource Group: $RESOURCE_GROUP"
  log "  Namespace: $NAMESPACE"
  log "  ACR: $ACR_NAME"
  log ""
  log "🔍 Next Steps:"
  log "  1. Configure DNS for ingress: ${INGRESS_HOST:-vibecode.example.com}"
  log "  2. Check Datadog dashboard for metrics"
  log "  3. Test pgvector functionality"
  log "  4. Monitor application logs and performance"
}

# Run main function
main "$@"