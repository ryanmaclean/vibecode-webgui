#!/usr/bin/env bash
# Script to create a new AKS cluster after the old one is deleted

set -euo pipefail

# Configuration
RESOURCE_GROUP=${RESOURCE_GROUP:-"rg-vibecode-aks-new"}
CLUSTER_NAME=${CLUSTER_NAME:-"vibecode-aks-new"}
LOCATION=${LOCATION:-"eastus2"}
NODE_COUNT=${NODE_COUNT:-3}
NODE_VM_SIZE=${NODE_VM_SIZE:-"Standard_D4s_v3"}
KUBERNETES_VERSION=${KUBERNETES_VERSION:-"1.32.6"}
ACR_NAME=${ACR_NAME:-"vibecodecrnew"}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Creating New AKS Cluster ===${NC}"
echo -e "Resource Group: ${RESOURCE_GROUP}"
echo -e "Cluster Name: ${CLUSTER_NAME}"
echo -e "Location: ${LOCATION}"
echo -e "Node Count: ${NODE_COUNT}"
echo -e "VM Size: ${NODE_VM_SIZE}"
echo -e "Kubernetes Version: ${KUBERNETES_VERSION}"
echo -e "ACR Name: ${ACR_NAME}"

# Check Azure CLI login
echo -e "\n${YELLOW}Checking Azure CLI login...${NC}"
if ! az account show &> /dev/null; then
  echo -e "${RED}Please log in to Azure CLI first with: az login${NC}"
  exit 1
fi

# Check if old resources are still being deleted
echo -e "\n${YELLOW}Checking if old resources are still being deleted...${NC}"
OLD_RG_STATUS=$(az group show --name rg-vibecode-aks-prod --query properties.provisioningState -o tsv 2>/dev/null || echo "NotFound")

if [ "$OLD_RG_STATUS" == "Deleting" ]; then
  echo -e "${RED}Old resource group rg-vibecode-aks-prod is still being deleted. Wait for deletion to complete.${NC}"
  echo -e "Current status: ${OLD_RG_STATUS}"
  echo -e "Try running the following command to check the status:"
  echo -e "  az group show --name rg-vibecode-aks-prod --query properties.provisioningState -o tsv"
  exit 1
elif [ "$OLD_RG_STATUS" != "NotFound" ]; then
  echo -e "${RED}Old resource group rg-vibecode-aks-prod is still present with status: ${OLD_RG_STATUS}.${NC}"
  echo -e "Wait for deletion to complete or delete it manually with:"
  echo -e "  az group delete --name rg-vibecode-aks-prod --yes --no-wait"
  exit 1
fi

# Also check for the nodes resource group
OLD_NODES_RG_STATUS=$(az group show --name rg-vibecode-aks-prod-nodes --query properties.provisioningState -o tsv 2>/dev/null || echo "NotFound")

if [ "$OLD_NODES_RG_STATUS" == "Deleting" ]; then
  echo -e "${RED}Old nodes resource group rg-vibecode-aks-prod-nodes is still being deleted. Wait for deletion to complete.${NC}"
  echo -e "Current status: ${OLD_NODES_RG_STATUS}"
  exit 1
elif [ "$OLD_NODES_RG_STATUS" != "NotFound" ]; then
  echo -e "${RED}Old nodes resource group rg-vibecode-aks-prod-nodes is still present with status: ${OLD_NODES_RG_STATUS}.${NC}"
  echo -e "Wait for deletion to complete or delete it manually with:"
  echo -e "  az group delete --name rg-vibecode-aks-prod-nodes --yes --no-wait"
  exit 1
fi

echo -e "${GREEN}Old resources have been deleted. Proceeding with new cluster creation.${NC}"

# Create resource group
echo -e "\n${YELLOW}Creating resource group ${RESOURCE_GROUP}...${NC}"
az group create --name "${RESOURCE_GROUP}" --location "${LOCATION}" \
  --tags Application=vibecode Environment=prod Owner="Platform Team"

# Create ACR
echo -e "\n${YELLOW}Creating Azure Container Registry ${ACR_NAME}...${NC}"
az acr create --resource-group "${RESOURCE_GROUP}" --name "${ACR_NAME}" --sku Standard \
  --tags Application=vibecode Environment=prod Owner="Platform Team"

# Create AKS cluster
echo -e "\n${YELLOW}Creating AKS cluster ${CLUSTER_NAME}...${NC}"
az aks create \
  --resource-group "${RESOURCE_GROUP}" \
  --name "${CLUSTER_NAME}" \
  --node-count "${NODE_COUNT}" \
  --node-vm-size "${NODE_VM_SIZE}" \
  --kubernetes-version "${KUBERNETES_VERSION}" \
  --enable-managed-identity \
  --enable-addons monitoring \
  --generate-ssh-keys \
  --network-plugin azure \
  --network-policy azure \
  --node-resource-group "${RESOURCE_GROUP}-nodes" \
  --enable-cluster-autoscaler \
  --min-count 1 \
  --max-count 5 \
  --dns-name-prefix "${CLUSTER_NAME}" \
  --enable-aad \
  --enable-azure-rbac \
  --network-plugin-mode overlay \
  --tags Application=vibecode Environment=prod Owner="Platform Team"

# Attach ACR to AKS
echo -e "\n${YELLOW}Attaching ACR to AKS...${NC}"
az aks update \
  --resource-group "${RESOURCE_GROUP}" \
  --name "${CLUSTER_NAME}" \
  --attach-acr "${ACR_NAME}"

# Get AKS credentials
echo -e "\n${YELLOW}Getting AKS credentials...${NC}"
az aks get-credentials \
  --resource-group "${RESOURCE_GROUP}" \
  --name "${CLUSTER_NAME}" \
  --admin \
  --overwrite-existing

# Verify cluster access
echo -e "\n${YELLOW}Verifying cluster access...${NC}"
kubectl get nodes

# Create required namespaces
echo -e "\n${YELLOW}Creating required namespaces...${NC}"
kubectl create namespace vibecode-platform --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace ingress-nginx --dry-run=client -o yaml | kubectl apply -f -

echo -e "\n${GREEN}AKS cluster ${CLUSTER_NAME} created successfully!${NC}"
echo -e "${GREEN}Resource group: ${RESOURCE_GROUP}${NC}"
echo -e "${GREEN}ACR: ${ACR_NAME}${NC}"

echo -e "\n${YELLOW}Next steps:${NC}"
echo -e "1. Deploy NGINX Ingress Controller: ./scripts/deploy-ingress-controller.sh --resource-group ${RESOURCE_GROUP} --cluster-name ${CLUSTER_NAME}"
echo -e "2. Deploy application: ./scripts/deploy-vibecode.sh --resource-group ${RESOURCE_GROUP} --cluster-name ${CLUSTER_NAME} --acr-name ${ACR_NAME}"