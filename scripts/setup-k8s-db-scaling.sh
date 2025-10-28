#!/usr/bin/env bash
# Kubernetes Database Deployment Setup Script
# This script sets up a PostgreSQL database with pgvector in Kubernetes
# Author: Database Engineering Team

set -e

# Configuration
export NAMESPACE=${NAMESPACE:-"vibecode-db"}
export RELEASE_NAME=${RELEASE_NAME:-"vector-db"}
export POSTGRES_VERSION=${POSTGRES_VERSION:-"15.4.0"}
export STORAGE_CLASS=${STORAGE_CLASS:-"standard"}
export REPLICAS=${REPLICAS:-3}
export VECTOR_EXTENSION_VERSION=${VECTOR_EXTENSION_VERSION:-"0.5.1"}

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Kubernetes PostgreSQL/pgvector Deployment Script${NC}"
echo "==============================================="
echo "Setting up PostgreSQL with pgvector in Kubernetes"
echo "Namespace: $NAMESPACE"
echo "Release name: $RELEASE_NAME"
echo "PostgreSQL version: $POSTGRES_VERSION"
echo "Storage class: $STORAGE_CLASS"
echo "Replicas: $REPLICAS"
echo "pgvector version: $VECTOR_EXTENSION_VERSION"
echo "==============================================="

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}Error: kubectl command not found. Please install kubectl.${NC}"
    exit 1
fi

# Check if helm is available
if ! command -v helm &> /dev/null; then
    echo -e "${RED}Error: helm command not found. Please install helm.${NC}"
    exit 1
fi

# Function to create namespace if it doesn't exist
create_namespace() {
    local namespace=$1
    
    echo -e "${YELLOW}Creating namespace $namespace if it doesn't exist...${NC}"
    
    if kubectl get namespace "$namespace" &> /dev/null; then
        echo -e "${GREEN}Namespace $namespace already exists${NC}"
    else
        kubectl create namespace "$namespace"
        echo -e "${GREEN}Namespace $namespace created${NC}"
    fi
}

# Function to add bitnami helm repo if it doesn't exist
add_helm_repos() {
    echo -e "${YELLOW}Adding required Helm repositories...${NC}"
    
    if ! helm repo list | grep -q "bitnami"; then
        helm repo add bitnami https://charts.bitnami.com/bitnami
    fi
    
    if ! helm repo list | grep -q "datadog"; then
        helm repo add datadog https://helm.datadoghq.com
    fi
    
    helm repo update
    echo -e "${GREEN}Helm repositories updated${NC}"
}

# Function to create PostgreSQL secrets
create_postgres_secrets() {
    local namespace=$1
    local release=$2
    
    echo -e "${YELLOW}Creating PostgreSQL secrets in namespace $namespace...${NC}"
    
    # Generate random passwords
    local postgres_password=$(openssl rand -hex 12)
    local replication_password=$(openssl rand -hex 12)
    
    # Create secret
    kubectl create secret generic "$release-credentials" \
        --namespace="$namespace" \
        --from-literal=postgres-password="$postgres_password" \
        --from-literal=replication-password="$replication_password" \
        --dry-run=client -o yaml | kubectl apply -f -
    
    echo -e "${GREEN}PostgreSQL secrets created in namespace $namespace${NC}"
    
    # Save credentials to a local file (for testing purposes)
    echo "PostgreSQL Credentials (for testing only)" > "$release-credentials.txt"
    echo "POSTGRES_PASSWORD: $postgres_password" >> "$release-credentials.txt"
    echo "REPLICATION_PASSWORD: $replication_password" >> "$release-credentials.txt"
    
    chmod 600 "$release-credentials.txt"
    echo -e "${YELLOW}Credentials saved to $release-credentials.txt (keep this secure!)${NC}"
}

# Function to create ConfigMap with init scripts for pgvector
create_init_configmap() {
    local namespace=$1
    local release=$2
    
    echo -e "${YELLOW}Creating ConfigMap with initialization scripts...${NC}"
    
    # Create directory for init scripts
    mkdir -p init-scripts
    
    # Create init script for pgvector
    cat > init-scripts/init-pgvector.sh <<EOF
#!/bin/bash
set -e

echo "Installing pgvector extension version $VECTOR_EXTENSION_VERSION"

# Update package lists
apt-get update

# Install build essentials and PostgreSQL development packages
apt-get install -y build-essential postgresql-server-dev-$PG_MAJOR git

# Clone and build pgvector
cd /tmp
git clone --branch v$VECTOR_EXTENSION_VERSION https://github.com/pgvector/pgvector.git
cd pgvector
make
make install

# Create extension in the database
echo "CREATE EXTENSION IF NOT EXISTS vector;" | psql
EOF
    
    # Create script for setting up test tables
    cat > init-scripts/setup-test-tables.sql <<EOF
-- Create test tables for vector database
CREATE TABLE IF NOT EXISTS document_embeddings (
    id SERIAL PRIMARY KEY,
    document_id VARCHAR(255) UNIQUE NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536),
    metadata JSONB DEFAULT '{}',
    embedding_generation_time_ms INTEGER,
    search_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS document_embeddings_document_id_idx ON document_embeddings(document_id);
CREATE INDEX IF NOT EXISTS document_embeddings_embedding_idx ON document_embeddings USING ivfflat (embedding vector_l2_ops);

-- Create a table for testing connection routing
CREATE TABLE IF NOT EXISTS connection_routing_test (
    id SERIAL PRIMARY KEY,
    operation_type VARCHAR(50) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    node_name TEXT NOT NULL,
    data JSONB DEFAULT '{}'
);
EOF
    
    # Create ConfigMap
    kubectl create configmap "$release-init-scripts" \
        --namespace="$namespace" \
        --from-file=init-scripts/ \
        --dry-run=client -o yaml | kubectl apply -f -
    
    echo -e "${GREEN}ConfigMap with initialization scripts created${NC}"
}

# Function to create custom values file for PostgreSQL helm chart
create_values_file() {
    local release=$1
    local replicas=$2
    local storage_class=$3
    
    echo -e "${YELLOW}Creating custom values file for PostgreSQL Helm chart...${NC}"
    
    cat > "$release-values.yaml" <<EOF
global:
  storageClass: "$storage_class"
  postgresql:
    auth:
      existingSecret: "$release-credentials"
      username: postgres
      database: vibecode

architecture: replication
primary:
  initdb:
    scriptsConfigMap: "$release-init-scripts"
    user: postgres
  extraEnvVars:
    - name: PG_MAJOR
      value: "${POSTGRES_VERSION%%.*}"
  containerSecurityContext:
    allowPrivilegeEscalation: true
  podSecurityContext:
    fsGroup: 1001
  resources:
    requests:
      memory: 1Gi
      cpu: 500m
    limits:
      memory: 2Gi
      cpu: 1000m
  persistence:
    size: 10Gi
  service:
    type: ClusterIP
  livenessProbe:
    initialDelaySeconds: 60
    periodSeconds: 20
    failureThreshold: 6
  readinessProbe:
    initialDelaySeconds: 30
    periodSeconds: 10
    failureThreshold: 3

readReplicas:
  replicaCount: $((replicas - 1))
  extraEnvVars:
    - name: PG_MAJOR
      value: "${POSTGRES_VERSION%%.*}"
  resources:
    requests:
      memory: 1Gi
      cpu: 500m
    limits:
      memory: 2Gi
      cpu: 1000m
  persistence:
    size: 10Gi
  service:
    type: ClusterIP
  livenessProbe:
    initialDelaySeconds: 60
    periodSeconds: 20
    failureThreshold: 6
  readinessProbe:
    initialDelaySeconds: 30
    periodSeconds: 10
    failureThreshold: 3

metrics:
  enabled: true
  serviceMonitor:
    enabled: true
  prometheusRule:
    enabled: true
    rules:
      - alert: PostgreSQLHighConnectionCount
        expr: sum(pg_stat_activity_count{instance=~"$instance"}) > 100
        for: 5m
        labels:
          severity: warning
        annotations:
          description: "PostgreSQL instance has more than 100 connections"
          summary: "High number of connections in PostgreSQL"
      - alert: PostgreSQLReplicationLag
        expr: pg_replication_lag_bytes{instance=~"$instance"} > 10000000
        for: 5m
        labels:
          severity: warning
        annotations:
          description: "PostgreSQL replication lag is high"
          summary: "PostgreSQL replication is lagging"

volumePermissions:
  enabled: true
EOF
    
    echo -e "${GREEN}Values file created: $release-values.yaml${NC}"
}

# Function to install PostgreSQL with Helm
install_postgres() {
    local namespace=$1
    local release=$2
    local values_file=$3
    
    echo -e "${YELLOW}Installing PostgreSQL with Helm...${NC}"
    
    helm upgrade --install "$release" bitnami/postgresql \
        --namespace="$namespace" \
        --version="$POSTGRES_VERSION" \
        --values="$values_file" \
        --timeout 10m0s
    
    echo -e "${GREEN}PostgreSQL installation completed${NC}"
}

# Function to install Datadog agent
install_datadog() {
    local namespace=$1
    
    echo -e "${YELLOW}Installing Datadog agent...${NC}"
    
    # Create Datadog values file
    cat > datadog-values.yaml <<EOF
datadog:
  apiKey: ${DATADOG_API_KEY:-"YOUR_API_KEY"}
  appKey: ${DATADOG_APP_KEY:-"YOUR_APP_KEY"}
  logs:
    enabled: true
    containerCollectAll: true
  apm:
    enabled: true
  processAgent:
    enabled: true
  kubelet:
    tlsVerify: false

agents:
  containers:
    agent:
      resources:
        requests:
          cpu: 100m
          memory: 256Mi
        limits:
          cpu: 200m
          memory: 512Mi
  tolerations:
    - operator: Exists

clusterAgent:
  enabled: true
  metricsProvider:
    enabled: true
  resources:
    requests:
      cpu: 100m
      memory: 256Mi
    limits:
      cpu: 200m
      memory: 512Mi

kube-state-metrics:
  enabled: true
EOF
    
    # Install Datadog agent
    if [ -z "${DATADOG_API_KEY}" ]; then
        echo -e "${YELLOW}Skipping Datadog installation (DATADOG_API_KEY not provided)${NC}"
        echo -e "${YELLOW}To install Datadog, run this script with DATADOG_API_KEY and DATADOG_APP_KEY set${NC}"
    else
        helm upgrade --install datadog datadog/datadog \
            --namespace="$namespace" \
            --values=datadog-values.yaml
        
        echo -e "${GREEN}Datadog agent installation completed${NC}"
    fi
}

# Function to wait for PostgreSQL to be ready
wait_for_postgres() {
    local namespace=$1
    local release=$2
    
    echo -e "${YELLOW}Waiting for PostgreSQL to be ready...${NC}"
    
    kubectl wait --namespace="$namespace" \
        --for=condition=ready pod \
        --selector="app.kubernetes.io/instance=$release,app.kubernetes.io/name=postgresql" \
        --timeout=300s
    
    echo -e "${GREEN}PostgreSQL is ready${NC}"
}

# Function to print connection information
print_connection_info() {
    local namespace=$1
    local release=$2
    
    echo -e "${GREEN}PostgreSQL with pgvector has been deployed successfully!${NC}"
    echo -e "${YELLOW}Connection Information:${NC}"
    echo "Primary: $release-postgresql-primary.$namespace.svc.cluster.local:5432"
    echo "Read Replicas: $release-postgresql-readreplicas.$namespace.svc.cluster.local:5432"
    echo ""
    echo "To connect to the primary from inside the cluster:"
    echo "kubectl run $release-postgresql-client --rm --tty -i --restart='Never' --namespace $namespace --image docker.io/bitnami/postgresql:$POSTGRES_VERSION --env=\"PGPASSWORD=\$(kubectl get secret --namespace $namespace $release-credentials -o jsonpath='{.data.postgres-password}' | base64 -d)\" --command -- psql --host $release-postgresql-primary -U postgres -d vibecode -p 5432"
    echo ""
    echo "To forward the primary port to your local machine:"
    echo "kubectl port-forward --namespace $namespace svc/$release-postgresql-primary 5432:5432"
    echo ""
    echo "To forward a read replica port to your local machine:"
    echo "kubectl port-forward --namespace $namespace svc/$release-postgresql-readreplicas 5433:5432"
}

# Main execution
create_namespace "$NAMESPACE"
add_helm_repos
create_postgres_secrets "$NAMESPACE" "$RELEASE_NAME"
create_init_configmap "$NAMESPACE" "$RELEASE_NAME"
create_values_file "$RELEASE_NAME" "$REPLICAS" "$STORAGE_CLASS"
install_postgres "$NAMESPACE" "$RELEASE_NAME" "$RELEASE_NAME-values.yaml"
install_datadog "$NAMESPACE"
wait_for_postgres "$NAMESPACE" "$RELEASE_NAME"
print_connection_info "$NAMESPACE" "$RELEASE_NAME"

echo -e "${GREEN}Setup completed successfully!${NC}"