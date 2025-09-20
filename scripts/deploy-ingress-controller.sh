#!/usr/bin/env bash
# Script to deploy NGINX Ingress Controller to AKS with a specific public IP

set -euo pipefail

# Configuration
RESOURCE_GROUP=${RESOURCE_GROUP:-"rg-vibecode-dns"}
PUBLIC_IP_NAME=${PUBLIC_IP_NAME:-"vibecode-dns-ip"}
INGRESS_NAMESPACE=${INGRESS_NAMESPACE:-"ingress-nginx"}
INGRESS_RELEASE_NAME=${INGRESS_RELEASE_NAME:-"nginx-ingress"}
TIMEOUT=${TIMEOUT:-600s}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Check if logged in to Azure
echo -e "${YELLOW}Checking Azure CLI login...${NC}"
if ! az account show &> /dev/null; then
  echo -e "${RED}Please log in to Azure CLI first with: az login${NC}"
  exit 1
fi

# Check if kubectl is configured
echo -e "${YELLOW}Checking kubectl access...${NC}"
if ! kubectl get nodes &> /dev/null; then
  echo -e "${RED}Cannot access Kubernetes cluster. Make sure kubectl is configured correctly.${NC}"
  echo "Run: az aks get-credentials --resource-group ${RESOURCE_GROUP} --name <cluster-name> --admin"
  exit 1
fi

# Get the resource ID of the public IP
echo -e "${YELLOW}Getting public IP resource ID...${NC}"
PUBLIC_IP_ID=$(az network public-ip show \
  --resource-group "${RESOURCE_GROUP}" \
  --name "${PUBLIC_IP_NAME}" \
  --query "id" \
  --output tsv)

if [ -z "$PUBLIC_IP_ID" ]; then
  echo -e "${RED}Could not find public IP ${PUBLIC_IP_NAME} in resource group ${RESOURCE_GROUP}${NC}"
  exit 1
fi

PUBLIC_IP_ADDRESS=$(az network public-ip show \
  --resource-group "${RESOURCE_GROUP}" \
  --name "${PUBLIC_IP_NAME}" \
  --query "ipAddress" \
  --output tsv)

echo -e "${GREEN}Using public IP: ${PUBLIC_IP_ADDRESS} (${PUBLIC_IP_ID})${NC}"

# Create the ingress-nginx namespace if it doesn't exist
if ! kubectl get namespace "${INGRESS_NAMESPACE}" &> /dev/null; then
  echo -e "${YELLOW}Creating namespace ${INGRESS_NAMESPACE}...${NC}"
  kubectl create namespace "${INGRESS_NAMESPACE}"
fi

# Add the ingress-nginx Helm repository
echo -e "${YELLOW}Adding NGINX Ingress Helm repository...${NC}"
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

# Deploy NGINX Ingress Controller
echo -e "${YELLOW}Deploying NGINX Ingress Controller...${NC}"
helm upgrade --install "${INGRESS_RELEASE_NAME}" ingress-nginx/ingress-nginx \
  --namespace "${INGRESS_NAMESPACE}" \
  --set controller.service.loadBalancerIP="${PUBLIC_IP_ADDRESS}" \
  --set controller.service.annotations."service\.beta\.kubernetes\.io/azure-load-balancer-resource-group"="${RESOURCE_GROUP}" \
  --set controller.service.annotations."service\.beta\.kubernetes\.io/azure-pip-name"="${PUBLIC_IP_NAME}" \
  --set controller.service.annotations."service\.beta\.kubernetes\.io/azure-dns-label-name"="vibecode" \
  --set controller.service.externalTrafficPolicy=Local \
  --set controller.config.use-proxy-protocol=false \
  --set controller.config.use-forwarded-headers=true \
  --set controller.config.compute-full-forwarded-for=true \
  --set controller.config.proxy-buffer-size="8k" \
  --set controller.metrics.enabled=true \
  --wait \
  --timeout="${TIMEOUT}"

# Wait for the ingress controller to be ready
echo -e "${YELLOW}Waiting for Ingress Controller to be ready...${NC}"
kubectl rollout status deployment "${INGRESS_RELEASE_NAME}-ingress-nginx-controller" -n "${INGRESS_NAMESPACE}" --timeout="${TIMEOUT}"

# Get the external IP of the ingress controller
INGRESS_IP=$(kubectl get service "${INGRESS_RELEASE_NAME}-ingress-nginx-controller" -n "${INGRESS_NAMESPACE}" -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
if [ -z "$INGRESS_IP" ]; then
  echo -e "${RED}Failed to get external IP for Ingress Controller${NC}"
  exit 1
fi

echo -e "${GREEN}NGINX Ingress Controller successfully deployed!${NC}"
echo -e "External IP: ${GREEN}${INGRESS_IP}${NC}"
echo -e "DNS Name: ${GREEN}vibecode.eastus2.cloudapp.azure.com${NC}"

# Verify that the ingress controller is working
echo -e "${YELLOW}Verifying ingress controller health...${NC}"
if ! kubectl get pods -n "${INGRESS_NAMESPACE}" | grep -q "Running"; then
  echo -e "${RED}Ingress Controller pods are not running correctly${NC}"
  kubectl get pods -n "${INGRESS_NAMESPACE}"
  exit 1
fi

echo -e "${GREEN}✓ All pods are running${NC}"

# Create a test ingress resource to verify functionality
echo -e "${YELLOW}Creating test ingress resource...${NC}"
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: test-ingress
  namespace: default
  annotations:
    kubernetes.io/ingress.class: nginx
spec:
  rules:
  - host: vibecode.eastus2.cloudapp.azure.com
    http:
      paths:
      - path: /healthz
        pathType: Prefix
        backend:
          service:
            name: ${INGRESS_RELEASE_NAME}-ingress-nginx-controller
            port:
              number: 80
EOF

echo -e "${GREEN}Next steps:${NC}"
echo -e "1. Test the ingress with: curl -v https://vibecode.eastus2.cloudapp.azure.com/healthz"
echo -e "2. Deploy the application using scripts/app_deploy.py"
echo -e "3. Configure Let's Encrypt for TLS"

echo -e "${YELLOW}Example app_deploy.py command:${NC}"
echo -e "python scripts/app_deploy.py --acr-name <acr-name> --image-tag latest --fullname-override vibecode-app --wait"