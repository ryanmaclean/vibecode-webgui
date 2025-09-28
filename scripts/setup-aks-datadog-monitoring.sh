#!/usr/bin/env bash
# Script to set up Datadog monitoring for AKS production deployment

set -euo pipefail

# Configuration
ENVIRONMENT=${ENVIRONMENT:-"prod"}
RESOURCE_GROUP=${RESOURCE_GROUP:-"rg-vibecode-aks-prod"}
CLUSTER_NAME=${CLUSTER_NAME:-"vibecode-prod-aks-6c3db0e6"}
NAMESPACE=${NAMESPACE:-"vibecode-platform"}
DATADOG_NAMESPACE=${DATADOG_NAMESPACE:-"datadog"}
VALUES_FILE=${VALUES_FILE:-""}
POSTGRES_SERVICE=${POSTGRES_SERVICE:-"postgres-service"}
DB_NAME=${DB_NAME:-"vibecode"}
DB_USER=${DB_USER:-"datadog"}
DB_PASSWORD=${DB_PASSWORD:-"datadog_monitoring_password"}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

show_help() {
  echo "Usage: $0 [options]"
  echo
  echo "Set up Datadog monitoring for AKS"
  echo
  echo "Options:"
  echo "  --resource-group <name>   Resource group name (default: ${RESOURCE_GROUP})"
  echo "  --cluster-name <name>     AKS cluster name (default: ${CLUSTER_NAME})"
  echo "  --namespace <name>        Application namespace (default: ${NAMESPACE})"
  echo "  --datadog-namespace <ns>  Datadog namespace (default: ${DATADOG_NAMESPACE})"
  echo "  --environment <env>       Deployment environment (prod|staging) (default: ${ENVIRONMENT})"
  echo "  --db-name <name>          Database name (default: ${DB_NAME})"
  echo "  --db-user <user>          Datadog monitoring user (default: ${DB_USER})"
  echo "  --db-password <pass>      Datadog monitoring password (default: ${DB_PASSWORD})"
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
    --cluster-name)
      CLUSTER_NAME="$2"
      shift 2
      ;;
    --namespace)
      NAMESPACE="$2"
      shift 2
      ;;
    --datadog-namespace)
      DATADOG_NAMESPACE="$2"
      shift 2
      ;;
    --environment)
      ENVIRONMENT="$2"
      shift 2
      ;;
    --db-name)
      DB_NAME="$2"
      shift 2
      ;;
    --db-user)
      DB_USER="$2"
      shift 2
      ;;
    --db-password)
      DB_PASSWORD="$2"
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

if [ -z "$VALUES_FILE" ]; then
  case "$ENVIRONMENT" in
    staging)
      VALUES_FILE="k8s/datadog-values-aks-staging.yaml"
      ;;
    prod|production)
      VALUES_FILE="k8s/datadog-values-aks.yaml"
      ;;
    *)
      echo -e "${YELLOW}Unknown environment '$ENVIRONMENT'; defaulting Datadog values to production file.${NC}"
      VALUES_FILE="k8s/datadog-values-aks.yaml"
      ;;
  esac
fi

echo -e "${YELLOW}=== Setting up Datadog Monitoring for AKS Cluster ===${NC}"
echo -e "Resource Group: ${RESOURCE_GROUP}"
echo -e "AKS Cluster: ${CLUSTER_NAME}"
echo -e "Application Namespace: ${NAMESPACE}"
echo -e "Datadog Namespace: ${DATADOG_NAMESPACE}"
echo -e "Environment: ${ENVIRONMENT}"
echo -e "Helm values file: ${VALUES_FILE}"
echo -e "Database: ${DB_NAME}"

# Check if Datadog API key is set
if [ -z "${DD_API_KEY:-}" ]; then
  echo -e "${RED}DD_API_KEY environment variable is not set. Please set it first:${NC}"
  echo -e "export DD_API_KEY=your_datadog_api_key"
  exit 1
fi

# Check if Datadog site is set, default to datadoghq.com
DD_SITE=${DD_SITE:-"datadoghq.com"}

# Check AKS cluster status
echo -e "\n${YELLOW}Checking AKS cluster status...${NC}"
CLUSTER_STATUS=$(az aks show --name $CLUSTER_NAME --resource-group $RESOURCE_GROUP --query provisioningState -o tsv 2>/dev/null || echo "NotFound")

if [ "$CLUSTER_STATUS" != "Succeeded" ]; then
  echo -e "${RED}AKS cluster is not ready (Status: $CLUSTER_STATUS). Please wait for it to be fully provisioned.${NC}"
  echo -e "Check status with: az aks show --name $CLUSTER_NAME --resource-group $RESOURCE_GROUP --query provisioningState -o tsv"
  exit 1
fi

echo -e "${GREEN}AKS cluster is ready.${NC}"

# Get AKS credentials
echo -e "\n${YELLOW}Getting AKS credentials...${NC}"
az aks get-credentials --resource-group $RESOURCE_GROUP --name $CLUSTER_NAME --admin --overwrite-existing

# Verify kubectl access
echo -e "${YELLOW}Verifying kubectl access...${NC}"
if ! kubectl get nodes &> /dev/null; then
  echo -e "${RED}Cannot access Kubernetes cluster.${NC}"
  exit 1
fi

# Create Datadog namespace
echo -e "\n${YELLOW}Creating Datadog namespace if it doesn't exist...${NC}"
kubectl create namespace $DATADOG_NAMESPACE --dry-run=client -o yaml | kubectl apply -f -

# Create Datadog secret
echo -e "\n${YELLOW}Creating Datadog secret with API key...${NC}"
kubectl create secret generic datadog-secret \
  --namespace $DATADOG_NAMESPACE \
  --from-literal=api-key=$DD_API_KEY \
  ${DD_APP_KEY:+--from-literal=app-key=$DD_APP_KEY} \
  --dry-run=client -o yaml | kubectl apply -f -

# Ensure values file exists with correct Datadog site
echo -e "\n${YELLOW}Ensuring Datadog values file exists...${NC}"
if [ ! -f "$VALUES_FILE" ]; then
  echo -e "${YELLOW}Creating Datadog values file: $VALUES_FILE${NC}"
  mkdir -p $(dirname "$VALUES_FILE")
  
  cat > "$VALUES_FILE" << EOF
# Datadog Helm Values for AKS Production Deployment
# Production-grade configuration with Azure-specific optimizations

datadog:
  # Use existing secrets created by scripts
  apiKeyExistingSecret: datadog-secret
  appKeyExistingSecret: datadog-secret
  
  # Datadog site configuration
  site: "${DD_SITE}"
  
  # Cluster name for identification
  clusterName: "${CLUSTER_NAME}"
  
  # Production resource configuration
  resources:
    requests:
      cpu: "200m"
      memory: "512Mi"
    limits:
      cpu: "500m"
      memory: "1Gi"
  
  # Enable comprehensive monitoring features
  logs:
    enabled: true
    containerCollectAll: true
    configMapName: "datadog-logs"
  
  # Enable APM for application tracing with Dynamic Instrumentation
  apm:
    portEnabled: true
    socketEnabled: true
    hostSocketPath: /var/run/datadog
  
  # Enable process monitoring
  processAgent:
    enabled: true
    
  # Enable network monitoring for AKS
  networkMonitoring:
    enabled: true
    
  # Enable database monitoring for PostgreSQL
  dbm:
    enabled: true
    
  # Enable orchestrator explorer for AKS
  orchestratorExplorer:
    enabled: true
    
  # Production tags for AKS
  tags:
    - "env:production"
    - "provider:azure"
    - "cluster:aks"
    - "project:vibecode"
    - "region:eastus2"

# Cluster Agent configuration for AKS
clusterAgent:
  enabled: true
  image:
    tag: "1.24.0"
  
  # Production resources for Cluster Agent
  resources:
    requests:
      cpu: "200m"
      memory: "256Mi"
    limits:
      cpu: "500m"
      memory: "512Mi"
  
  # Enable metrics provider for HPA
  metricsProvider:
    enabled: true
    
  # Enable cluster checks
  clusterChecks:
    enabled: true
    
  # Enable external metrics for autoscaling
  externalMetrics:
    enabled: true
    
  # Azure-specific configurations
  tolerations:
    - key: "kubernetes.azure.com/scalesetpriority"
      operator: "Equal"
      value: "spot"
      effect: "NoSchedule"
    - key: "CriticalAddonsOnly"
      operator: "Exists"

# Node Agent configuration for AKS
agents:
  image:
    tag: "7.66.1"
    
  # Production resources for Node Agents
  resources:
    requests:
      cpu: "200m"
      memory: "512Mi"
    limits:
      cpu: "1000m"
      memory: "2Gi"
      
  # Azure-specific configurations
  tolerations:
    - key: "kubernetes.azure.com/scalesetpriority"
      operator: "Equal"
      value: "spot"
      effect: "NoSchedule"
    - key: "CriticalAddonsOnly"
      operator: "Exists"
      
  # Use host network for better performance on AKS
  useHostNetwork: true
  
  # Azure Disk mounts for persistent data
  volumeMounts:
    - name: datadog-agent-storage
      mountPath: /opt/datadog-agent/run
    - name: proc
      mountPath: /host/proc
      readOnly: true
    - name: cgroup
      mountPath: /host/sys/fs/cgroup
      readOnly: true
      
  volumes:
    - name: datadog-agent-storage
      persistentVolumeClaim:
        claimName: datadog-agent-storage
    - name: proc
      hostPath:
        path: /proc
    - name: cgroup
      hostPath:
        path: /sys/fs/cgroup

# System Probe for network monitoring (AKS-optimized)
systemProbe:
  enabled: true
  # Enable network security monitoring
  seccomp: "runtime/default"
  appArmor: "runtime/default"
  
# Security Agent for runtime security
securityAgent:
  enabled: true
  runtime:
    enabled: true
    
# Additional AKS-specific configurations
nodeSelector:
  kubernetes.io/os: linux

# Pod Disruption Budget for high availability
podDisruptionBudget:
  enabled: true
  minAvailable: 1

# Service Account with Azure RBAC
serviceAccount:
  create: true
  annotations:
    azure.workload.identity/client-id: "" # Will be set by OpenTofu
    
# Azure-specific storage class for persistent volumes
persistence:
  enabled: true
  storageClass: "managed-csi"
  size: "10Gi"
  
# Ingress for Datadog Agent (if needed)
ingress:
  enabled: false # Typically not needed for agents

# Azure Monitor integration
azureMonitor:
  enabled: true
  workspace:
    # Will be configured by OpenTofu
    id: ""
    key: ""
EOF
else
  echo -e "${GREEN}Using existing values file: $VALUES_FILE${NC}"
fi

# Install Datadog with Helm
echo -e "\n${YELLOW}Installing Datadog using Helm...${NC}"
helm repo add datadog https://helm.datadoghq.com
helm repo update

helm upgrade --install datadog datadog/datadog \
  --namespace $DATADOG_NAMESPACE \
  --create-namespace \
  --values $VALUES_FILE \
  --set datadog.clusterName=$CLUSTER_NAME \
  --wait

echo -e "${GREEN}Datadog agents installed.${NC}"

# Wait for Datadog agents to be ready
echo -e "\n${YELLOW}Waiting for Datadog agents to be ready...${NC}"
kubectl rollout status daemonset/datadog --namespace $DATADOG_NAMESPACE --timeout=180s || true
kubectl rollout status deployment/datadog-cluster-agent --namespace $DATADOG_NAMESPACE --timeout=180s || true

# Setup PostgreSQL monitoring user and DBM configuration
echo -e "\n${YELLOW}Setting up PostgreSQL Database Monitoring...${NC}"

# Create secret for PostgreSQL monitoring credentials
kubectl create secret generic postgres-datadog-secret \
  --namespace $DATADOG_NAMESPACE \
  --from-literal=password=$DB_PASSWORD \
  --dry-run=client -o yaml | kubectl apply -f -

# Create ConfigMap for PostgreSQL monitoring
cat > /tmp/datadog-postgres-config.yaml << EOF
init_config:

instances:
  - host: ${POSTGRES_SERVICE}.${NAMESPACE}.svc.cluster.local
    port: 5432
    username: ${DB_USER}
    password: "${DB_PASSWORD}"
    dbname: ${DB_NAME}
    ssl: disable
    dbm: true
    query_metrics:
      enabled: true
      run_sync: true
      collection_interval: 10
    query_samples:
      enabled: false
    query_activity:
      enabled: false
    collect_schemas:
      enabled: true
      collection_interval: 600
    collect_activity:
      enabled: true
      collection_interval: 10
    collect_settings:
      enabled: true
      collection_interval: 600
    tags:
      - env:production
      - service:vibecode
      - database:postgresql
      - vector_db:pgvector
EOF

kubectl create configmap datadog-postgres-config \
  --namespace $DATADOG_NAMESPACE \
  --from-file=conf.yaml=/tmp/datadog-postgres-config.yaml \
  --dry-run=client -o yaml | kubectl apply -f -

# Restart Datadog agent to apply changes
echo -e "\n${YELLOW}Restarting Datadog agents to apply configuration changes...${NC}"
kubectl rollout restart daemonset/datadog --namespace $DATADOG_NAMESPACE
kubectl rollout restart deployment/datadog-cluster-agent --namespace $DATADOG_NAMESPACE

# Create validation script for DBM
echo -e "\n${YELLOW}Creating DBM validation script...${NC}"
cat > /tmp/validate-datadog-dbm.sh << EOF
#!/usr/bin/env bash
# Script to validate Datadog Database Monitoring

export NAMESPACE="${NAMESPACE}"
export DATADOG_AGENT_NAMESPACE="${DATADOG_NAMESPACE}"
export DB_NAME="${DB_NAME}"
export DB_USER="${DB_USER}"
export MONITORING_PASSWORD="${DB_PASSWORD}"

# Run the validation script
./scripts/verify-datadog-dbm.sh
EOF

chmod +x /tmp/validate-datadog-dbm.sh

echo -e "\n${GREEN}==== Datadog Monitoring Setup Complete! ====${NC}"
echo -e "Datadog agents have been deployed to the AKS cluster."
echo -e "Database monitoring has been configured for PostgreSQL."
echo -e ""
echo -e "Next steps:"
echo -e "1. Wait 5-10 minutes for agents to report data to Datadog"
echo -e "2. Run the validation script to verify DBM configuration:"
echo -e "   cp /tmp/validate-datadog-dbm.sh ./validate-datadog-dbm.sh"
echo -e "   ./validate-datadog-dbm.sh"
echo -e ""
echo -e "3. Check Datadog dashboard: https://app.datadoghq.com/infrastructure/map"
echo -e "4. Check Datadog Database Monitoring: https://app.datadoghq.com/databases"
echo -e ""
echo -e "Note: After the application is deployed, run the DBM validation script to ensure"
echo -e "      the PostgreSQL database is properly configured for monitoring."
