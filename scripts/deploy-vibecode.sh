#!/usr/bin/env bash
# Master script to deploy the full VibeCode stack on AKS

set -euo pipefail

# Configuration
# INGRESS/DNS resource group is where the Public IP lives
RESOURCE_GROUP=${RESOURCE_GROUP:-"rg-vibecode-dns"}
# Allow separate override for ingress public IP resource group; default to RESOURCE_GROUP
INGRESS_RESOURCE_GROUP=${INGRESS_RESOURCE_GROUP:-"${RESOURCE_GROUP}"}
# AKS resource group is where the managed cluster lives
AKS_RESOURCE_GROUP=${AKS_RESOURCE_GROUP:-"rg-vibecode-aks-prod"}
CLUSTER_NAME=${CLUSTER_NAME:-"vibecode-aks-new"}
ACR_NAME=${ACR_NAME:-"vibecodecr84859296"}
PUBLIC_IP_NAME=${PUBLIC_IP_NAME:-"vibecode-dns-ip"}
INGRESS_NAMESPACE=${INGRESS_NAMESPACE:-"ingress-nginx"}
APP_NAMESPACE=${APP_NAMESPACE:-"vibecode-platform"}
DEPLOY_INGRESS=${DEPLOY_INGRESS:-true}
DEPLOY_APP=${DEPLOY_APP:-true}
SETUP_SSL=${SETUP_SSL:-true}
SKIP_BUILD=${SKIP_BUILD:-true}  # Skip building by default, assuming image is in ACR
IMAGE_TAG=${IMAGE_TAG:-"latest"}
FULLNAME_OVERRIDE=${FULLNAME_OVERRIDE:-"vibecode-app"}
DOMAIN=${DOMAIN:-"vibecode.eastus2.cloudapp.azure.com"}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

show_help() {
  echo "Usage: $0 [options]"
  echo
  echo "Deploy the full VibeCode stack to AKS"
  echo
  echo "Options:"
  echo "  --resource-group <name>   Ingress/DNS resource group (Public IP) (default: ${RESOURCE_GROUP})"
  echo "  --aks-resource-group <name>  AKS cluster resource group (default: ${AKS_RESOURCE_GROUP})"
  echo "  --cluster-name <name>     AKS cluster name (default: ${CLUSTER_NAME})"
  echo "  --acr-name <name>         Azure Container Registry name (default: ${ACR_NAME})"
  echo "  --public-ip <name>        Public IP resource name (default: ${PUBLIC_IP_NAME})"
  echo "  --skip-ingress            Skip deploying the NGINX Ingress controller"
  echo "  --skip-app                Skip deploying the application"
  echo "  --skip-ssl                Skip setting up SSL certificates"
  echo "  --build                   Build the application image instead of using existing one"
  echo "  --image-tag <tag>         Application image tag (default: ${IMAGE_TAG})"
  echo "  --help                    Display this help message and exit"
  echo
}

# Parse command-line arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --resource-group)
      RESOURCE_GROUP="$2"
      shift 2
      ;;
    --ingress-resource-group)
      INGRESS_RESOURCE_GROUP="$2"
      shift 2
      ;;
    --aks-resource-group)
      AKS_RESOURCE_GROUP="$2"
      shift 2
      ;;
    --cluster-name)
      CLUSTER_NAME="$2"
      shift 2
      ;;
    --acr-name)
      ACR_NAME="$2"
      shift 2
      ;;
    --public-ip)
      PUBLIC_IP_NAME="$2"
      shift 2
      ;;
    --skip-ingress)
      DEPLOY_INGRESS=false
      shift
      ;;
    --skip-app)
      DEPLOY_APP=false
      shift
      ;;
    --skip-ssl)
      SETUP_SSL=false
      shift
      ;;
    --build)
      SKIP_BUILD=false
      shift
      ;;
    --image-tag)
      IMAGE_TAG="$2"
      shift 2
      ;;
    --help)
      show_help
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      show_help
      exit 1
      ;;
  esac
done

echo -e "${YELLOW}=== VibeCode AKS Deployment ===${NC}"
echo -e "Ingress/DNS Resource Group: ${RESOURCE_GROUP}"
echo -e "AKS Resource Group: ${AKS_RESOURCE_GROUP}"
echo -e "AKS Cluster: ${CLUSTER_NAME}"
echo -e "ACR Name: ${ACR_NAME}"
echo -e "Public IP: ${PUBLIC_IP_NAME}"
echo -e "Domain: ${DOMAIN}"

# Check Azure CLI login
echo -e "\n${YELLOW}Checking Azure CLI login...${NC}"
if ! az account show &> /dev/null; then
  echo -e "${RED}Please log in to Azure CLI first with: az login${NC}"
  exit 1
fi

# Get AKS credentials
echo -e "\n${YELLOW}Getting AKS credentials...${NC}"
az aks get-credentials --resource-group "${AKS_RESOURCE_GROUP}" --name "${CLUSTER_NAME}" --admin --overwrite-existing

# Check kubectl access
echo -e "\n${YELLOW}Checking kubectl access...${NC}"
if ! kubectl get nodes &> /dev/null; then
  echo -e "${RED}Cannot access Kubernetes cluster.${NC}"
  exit 1
fi

# 1. Deploy NGINX Ingress Controller
if [[ "${DEPLOY_INGRESS}" == "true" ]]; then
  echo -e "\n${YELLOW}=== Deploying NGINX Ingress Controller ===${NC}"
  
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
  helm upgrade --install nginx-ingress ingress-nginx/ingress-nginx \
    --namespace "${INGRESS_NAMESPACE}" \
    --set controller.service.loadBalancerIP="${PUBLIC_IP_ADDRESS}" \
    --set controller.service.annotations."service\.beta\.kubernetes\.io/azure-load-balancer-resource-group"="${INGRESS_RESOURCE_GROUP}" \
    --set controller.service.annotations."service\.beta\.kubernetes\.io/azure-pip-name"="${PUBLIC_IP_NAME}" \
    --set controller.service.annotations."service\.beta\.kubernetes\.io/azure-dns-label-name"="vibecode" \
    --set controller.service.externalTrafficPolicy=Local \
    --set controller.config.use-proxy-protocol=false \
    --set controller.config.use-forwarded-headers=true \
    --set controller.config.compute-full-forwarded-for=true \
    --set controller.config.proxy-buffer-size="8k" \
    --set controller.metrics.enabled=true \
    --wait \
    --timeout=600s

  # Wait for the ingress controller to be ready
  echo -e "${YELLOW}Waiting for Ingress Controller to be ready...${NC}"
  kubectl rollout status deployment nginx-ingress-ingress-nginx-controller -n "${INGRESS_NAMESPACE}" --timeout=600s

  # Get the external IP of the ingress controller
  INGRESS_IP=$(kubectl get service nginx-ingress-ingress-nginx-controller -n "${INGRESS_NAMESPACE}" -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
  echo -e "${GREEN}NGINX Ingress Controller deployed with external IP: ${INGRESS_IP}${NC}"
else
  echo -e "\n${YELLOW}Skipping NGINX Ingress Controller deployment${NC}"
fi

# 2. Deploy the application
if [[ "${DEPLOY_APP}" == "true" ]]; then
  echo -e "\n${YELLOW}=== Deploying VibeCode Application ===${NC}"
  
  # Create the app namespace if it doesn't exist
  if ! kubectl get namespace "${APP_NAMESPACE}" &> /dev/null; then
    echo -e "${YELLOW}Creating namespace ${APP_NAMESPACE}...${NC}"
    kubectl create namespace "${APP_NAMESPACE}"
  fi

  # Deploy the application using app_deploy.py
  echo -e "${YELLOW}Deploying VibeCode application...${NC}"
  # Set any additional environment variables needed by the script
  SET_VALUES=(
    "ingress.enabled=true"
    "ingress.className=nginx"
    "ingress.hosts[0].host=${DOMAIN}"
    "ingress.hosts[0].paths[0].path=/"
    "ingress.hosts[0].paths[0].pathType=Prefix"
  )
  
  # If TLS is enabled, add TLS values
  if [[ "${SETUP_SSL}" == "true" ]]; then
    SET_VALUES+=(
      "ingress.tls[0].secretName=${DOMAIN//./-}-tls"
      "ingress.tls[0].hosts[0]=${DOMAIN}"
      "ingress.annotations.cert-manager\\.io/cluster-issuer=letsencrypt-prod"
      "ingress.annotations.kubernetes\\.io/tls-acme=true"
    )
  fi

  # Create the SET_VALUES string for the command
  SET_VALUES_ARGS=""
  for val in "${SET_VALUES[@]}"; do
    SET_VALUES_ARGS+=" --set \"${val}\""
  done

  # Deploy using app_deploy.py
  echo -e "${YELLOW}Executing app_deploy.py...${NC}"
  COMMAND="python scripts/app_deploy.py --acr-name ${ACR_NAME} --image-tag ${IMAGE_TAG} --fullname-override ${FULLNAME_OVERRIDE} --namespace ${APP_NAMESPACE} --wait"
  
  if [[ "${SKIP_BUILD}" == "true" ]]; then
    COMMAND+=" --skip-build"
  fi
  
  for val in "${SET_VALUES[@]}"; do
    COMMAND+=" --set \"${val}\""
  fi
  
  echo -e "${YELLOW}Command: ${COMMAND}${NC}"
  eval $COMMAND
  
  echo -e "${GREEN}VibeCode application deployment completed${NC}"
else
  echo -e "\n${YELLOW}Skipping VibeCode application deployment${NC}"
fi

# 3. Set up SSL certificates if cert-manager is not already installed
if [[ "${SETUP_SSL}" == "true" ]]; then
  echo -e "\n${YELLOW}=== Setting up SSL Certificates ===${NC}"
  
  # Check if cert-manager is installed
  if ! kubectl get namespace cert-manager &> /dev/null; then
    echo -e "${YELLOW}Installing cert-manager...${NC}"
    
    # Create the cert-manager namespace
    kubectl create namespace cert-manager
    
    # Add the Jetstack Helm repository
    helm repo add jetstack https://charts.jetstack.io
    helm repo update
    
    # Install cert-manager
    helm install cert-manager jetstack/cert-manager \
      --namespace cert-manager \
      --create-namespace \
      --set installCRDs=true \
      --wait \
      --timeout=600s
  else
    echo -e "${GREEN}cert-manager is already installed${NC}"
  fi
  
  # Create the Let's Encrypt ClusterIssuer
  echo -e "${YELLOW}Creating Let's Encrypt ClusterIssuer...${NC}"
  kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF
  
  echo -e "${GREEN}SSL certificate setup completed${NC}"
else
  echo -e "\n${YELLOW}Skipping SSL certificate setup${NC}"
fi

# 4. Verify the deployment
echo -e "\n${YELLOW}=== Verifying Deployment ===${NC}"

# Check ingress status
echo -e "${YELLOW}Checking ingress status...${NC}"
kubectl get ingress -n "${APP_NAMESPACE}"

# Check application pods
echo -e "\n${YELLOW}Checking application pods...${NC}"
kubectl get pods -n "${APP_NAMESPACE}"

# Check services
echo -e "\n${YELLOW}Checking services...${NC}"
kubectl get svc -n "${APP_NAMESPACE}"

# Print deployment summary
echo -e "\n${GREEN}=== Deployment Summary ===${NC}"
echo -e "Domain: ${DOMAIN}"
echo -e "Application namespace: ${APP_NAMESPACE}"
echo -e "Ingress namespace: ${INGRESS_NAMESPACE}"
echo -e "Application release: ${FULLNAME_OVERRIDE}"

# Verify DNS and application access
echo -e "\n${YELLOW}Verifying DNS resolution...${NC}"
if nslookup "${DOMAIN}" &> /dev/null; then
  echo -e "${GREEN}DNS resolution successful!${NC}"
  
  echo -e "\n${YELLOW}Testing HTTP access...${NC}"
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://${DOMAIN}" || echo "Failed")
  echo -e "HTTP status code: ${HTTP_STATUS}"
  
  if [[ "${SETUP_SSL}" == "true" ]]; then
    echo -e "\n${YELLOW}Testing HTTPS access (might take some time for SSL certificate to be issued)...${NC}"
    echo -e "${YELLOW}Note: It can take up to 5-10 minutes for Let's Encrypt to issue a certificate${NC}"
    HTTPS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -k "https://${DOMAIN}" || echo "Failed")
    echo -e "HTTPS status code: ${HTTPS_STATUS}"
  fi
else
  echo -e "${RED}DNS resolution failed.${NC}"
fi

echo -e "\n${GREEN}Deployment process completed!${NC}"
echo -e "To verify the SSL certificate status, run: kubectl get certificate -n ${APP_NAMESPACE}"
echo -e "To verify the application is running, run: kubectl get pods -n ${APP_NAMESPACE}"
echo -e "To access the application, navigate to: https://${DOMAIN}"