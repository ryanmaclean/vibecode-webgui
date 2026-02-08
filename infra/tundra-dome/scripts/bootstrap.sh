#!/bin/bash
# Tundra Dome One-Command Bootstrap
# Complete cluster setup from scratch

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Defaults
CLUSTER_NAME="${CLUSTER_NAME:-tundra-dome}"
CLUSTER_TYPE="${CLUSTER_TYPE:-kind}"
DD_API_KEY="${DD_API_KEY:-}"
GITOPS="${GITOPS:-false}"
GIT_REPO="${GIT_REPO:-}"
FULL_STACK="${FULL_STACK:-true}"

usage() {
    cat <<EOF
Tundra Dome One-Command Bootstrap

Usage: $(basename "$0") [OPTIONS]

Options:
    --name NAME         Cluster name (default: tundra-dome)
    --type TYPE         Cluster type: kind, aks, eks, gke (default: kind)
    --dd-key KEY        Datadog API key
    --gitops            Enable GitOps with ArgoCD
    --git-repo URL      Git repository for GitOps
    --minimal           Minimal install (no Datadog, no examples)
    --help              Show this help

Examples:
    $(basename "$0")                              # Full KIND bootstrap
    $(basename "$0") --type aks --name prod       # AKS production cluster
    $(basename "$0") --gitops --git-repo URL      # GitOps setup

Environment:
    DD_API_KEY          Datadog API key (or use --dd-key)
    CLUSTER_NAME        Cluster name (or use --name)
    CLUSTER_TYPE        Cluster type (or use --type)
EOF
    exit 0
}

log() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')] WARNING:${NC} $1"
}

error() {
    echo -e "${RED}[$(date +'%H:%M:%S')] ERROR:${NC} $1"
    exit 1
}

check_prerequisites() {
    log "Checking prerequisites..."

    local missing=()

    # Required tools
    command -v docker &>/dev/null || missing+=("docker")
    command -v kubectl &>/dev/null || missing+=("kubectl")

    case "$CLUSTER_TYPE" in
        kind)
            command -v kind &>/dev/null || missing+=("kind")
            ;;
        aks)
            command -v az &>/dev/null || missing+=("azure-cli")
            command -v terraform &>/dev/null || missing+=("terraform")
            ;;
        eks)
            command -v aws &>/dev/null || missing+=("aws-cli")
            command -v terraform &>/dev/null || missing+=("terraform")
            ;;
        gke)
            command -v gcloud &>/dev/null || missing+=("gcloud")
            command -v terraform &>/dev/null || missing+=("terraform")
            ;;
    esac

    if [[ "$GITOPS" == "true" ]]; then
        command -v argocd &>/dev/null || warn "argocd CLI not installed (optional)"
    fi

    if [[ ${#missing[@]} -gt 0 ]]; then
        error "Missing required tools: ${missing[*]}"
    fi

    # Check Docker
    if ! docker info &>/dev/null; then
        log "Starting Docker (Colima)..."
        colima start --cpu 4 --memory 8 2>/dev/null || error "Docker is not running"
        sleep 5
    fi

    log "Prerequisites OK"
}

create_kind_cluster() {
    log "Creating KIND cluster: $CLUSTER_NAME"

    # Check if cluster exists
    if kind get clusters 2>/dev/null | grep -q "^${CLUSTER_NAME}$"; then
        warn "Cluster '$CLUSTER_NAME' already exists"
        return 0
    fi

    # Use config if available
    local config_file="${PROJECT_DIR}/kind-config.yaml"
    local args=("create" "cluster" "--name" "$CLUSTER_NAME" "--wait" "2m")

    if [[ -f "$config_file" ]]; then
        args+=("--config" "$config_file")
    fi

    kind "${args[@]}"
    log "KIND cluster created"
}

create_cloud_cluster() {
    local provider="$1"
    log "Creating $provider cluster: $CLUSTER_NAME"

    local tf_dir="${PROJECT_DIR}/terraform/${provider}"

    if [[ ! -d "$tf_dir" ]]; then
        error "Terraform module not found: $tf_dir"
    fi

    cd "$tf_dir"

    # Initialize Terraform
    terraform init

    # Create cluster
    terraform apply -auto-approve \
        -var "cluster_name=${CLUSTER_NAME}" \
        -var "dd_api_key=${DD_API_KEY}"

    # Get kubeconfig
    case "$provider" in
        aks)
            az aks get-credentials --resource-group "rg-${CLUSTER_NAME}" --name "$CLUSTER_NAME"
            ;;
        eks)
            aws eks update-kubeconfig --region us-west-2 --name "$CLUSTER_NAME"
            ;;
        gke)
            gcloud container clusters get-credentials "$CLUSTER_NAME" --region us-west1
            ;;
    esac

    log "$provider cluster created"
}

install_crds() {
    log "Installing Tundra Dome CRDs..."
    kubectl apply -f "${PROJECT_DIR}/crds/"
}

deploy_infrastructure() {
    log "Deploying infrastructure..."

    local context
    if [[ "$CLUSTER_TYPE" == "kind" ]]; then
        context="kind-${CLUSTER_NAME}"
    else
        context=$(kubectl config current-context)
    fi

    # Create namespace
    kubectl --context "$context" create namespace tundra-dome --dry-run=client -o yaml | kubectl --context "$context" apply -f -

    # Create secrets
    if [[ -n "$DD_API_KEY" ]]; then
        kubectl --context "$context" create secret generic tundra-dome-secrets \
            --from-literal=DD_API_KEY="$DD_API_KEY" \
            --from-literal=DD_SITE="datadoghq.com" \
            -n tundra-dome --dry-run=client -o yaml | kubectl --context "$context" apply -f -
    fi

    # Deploy PostgreSQL
    log "Deploying PostgreSQL..."
    cat <<'EOF' | kubectl --context "$context" apply -n tundra-dome -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:15-alpine
        ports:
        - containerPort: 5432
        env:
        - name: POSTGRES_USER
          value: airflow
        - name: POSTGRES_PASSWORD
          value: airflow
        - name: POSTGRES_DB
          value: airflow
---
apiVersion: v1
kind: Service
metadata:
  name: postgres-service
spec:
  selector:
    app: postgres
  ports:
  - port: 5432
    targetPort: 5432
EOF

    # Deploy Kafka
    log "Deploying Kafka..."
    cat <<'EOF' | kubectl --context "$context" apply -n tundra-dome -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kafka
spec:
  replicas: 1
  selector:
    matchLabels:
      app: kafka
  template:
    metadata:
      labels:
        app: kafka
    spec:
      containers:
      - name: kafka
        image: apache/kafka:3.9.0
        ports:
        - containerPort: 9092
        env:
        - name: KAFKA_NODE_ID
          value: "1"
        - name: KAFKA_PROCESS_ROLES
          value: broker,controller
        - name: KAFKA_LISTENERS
          value: PLAINTEXT://:9092,CONTROLLER://:9093
        - name: KAFKA_ADVERTISED_LISTENERS
          value: PLAINTEXT://kafka-service:9092
        - name: KAFKA_CONTROLLER_LISTENER_NAMES
          value: CONTROLLER
        - name: KAFKA_LISTENER_SECURITY_PROTOCOL_MAP
          value: CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT
        - name: KAFKA_CONTROLLER_QUORUM_VOTERS
          value: 1@localhost:9093
        - name: KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR
          value: "1"
        - name: CLUSTER_ID
          value: "MkU3OEVBNTcwNTJENDM2Qk"
---
apiVersion: v1
kind: Service
metadata:
  name: kafka-service
spec:
  selector:
    app: kafka
  ports:
  - port: 9092
    targetPort: 9092
EOF

    log "Infrastructure deployed"
}

deploy_controllers() {
    log "Deploying Tundra Dome controllers..."

    local context
    if [[ "$CLUSTER_TYPE" == "kind" ]]; then
        context="kind-${CLUSTER_NAME}"
    else
        context=$(kubectl config current-context)
    fi

    # Deploy controllers
    if [[ -f "${PROJECT_DIR}/controllers/controllers.yaml" ]]; then
        kubectl --context "$context" apply -f "${PROJECT_DIR}/controllers/controllers.yaml"
    fi

    # Deploy controller ConfigMaps
    for controller_dir in "${PROJECT_DIR}/controllers"/*; do
        if [[ -d "$controller_dir" && -f "$controller_dir/index.js" ]]; then
            local name=$(basename "$controller_dir")
            log "Creating ConfigMap for $name..."
            kubectl --context "$context" create configmap "${name}-code" \
                --from-file="$controller_dir/index.js" \
                --from-file="$controller_dir/package.json" \
                -n tundra-dome --dry-run=client -o yaml | kubectl --context "$context" apply -f -
        fi
    done

    log "Controllers deployed"
}

deploy_datadog() {
    if [[ -z "$DD_API_KEY" ]]; then
        warn "DD_API_KEY not set, skipping Datadog installation"
        return 0
    fi

    log "Deploying Datadog agent..."

    helm repo add datadog https://helm.datadoghq.com 2>/dev/null || true
    helm repo update datadog

    local context
    if [[ "$CLUSTER_TYPE" == "kind" ]]; then
        context="kind-${CLUSTER_NAME}"
    else
        context=$(kubectl config current-context)
    fi

    kubectl --context "$context" create namespace datadog --dry-run=client -o yaml | kubectl --context "$context" apply -f -

    helm upgrade --install datadog-agent datadog/datadog \
        --set datadog.apiKey="$DD_API_KEY" \
        --set datadog.site="datadoghq.com" \
        --set datadog.clusterName="$CLUSTER_NAME" \
        --set datadog.apm.portEnabled=true \
        --set datadog.logs.enabled=true \
        --set datadog.logs.containerCollectAll=true \
        --set clusterAgent.enabled=true \
        -n datadog --kube-context "$context"

    log "Datadog agent deployed"
}

deploy_examples() {
    log "Deploying example Polecats and Lanes..."

    local context
    if [[ "$CLUSTER_TYPE" == "kind" ]]; then
        context="kind-${CLUSTER_NAME}"
    else
        context=$(kubectl config current-context)
    fi

    if [[ -d "${PROJECT_DIR}/examples" ]]; then
        kubectl --context "$context" apply -f "${PROJECT_DIR}/examples/" -n tundra-dome
    fi

    log "Examples deployed"
}

setup_gitops() {
    if [[ "$GITOPS" != "true" ]]; then
        return 0
    fi

    log "Setting up GitOps with ArgoCD..."

    local context
    if [[ "$CLUSTER_TYPE" == "kind" ]]; then
        context="kind-${CLUSTER_NAME}"
    else
        context=$(kubectl config current-context)
    fi

    # Install ArgoCD
    kubectl --context "$context" create namespace argocd --dry-run=client -o yaml | kubectl --context "$context" apply -f -
    kubectl --context "$context" apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

    # Wait for ArgoCD
    log "Waiting for ArgoCD to be ready..."
    kubectl --context "$context" wait --for=condition=available deployment/argocd-server -n argocd --timeout=300s

    # Apply Tundra Dome ArgoCD apps
    if [[ -n "$GIT_REPO" ]]; then
        sed "s|https://github.com/YOUR_ORG/tundra-dome.git|${GIT_REPO}|g" \
            "${PROJECT_DIR}/argocd/tundra-dome-app.yaml" | kubectl --context "$context" apply -f -
    fi

    # Get ArgoCD password
    local argocd_password
    argocd_password=$(kubectl --context "$context" -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d)

    log "ArgoCD installed"
    echo ""
    echo -e "${BLUE}ArgoCD Access:${NC}"
    echo "  URL:      kubectl port-forward svc/argocd-server -n argocd 8080:443"
    echo "  Username: admin"
    echo "  Password: $argocd_password"
}

show_summary() {
    echo ""
    echo -e "${GREEN}=== Tundra Dome Bootstrap Complete ===${NC}"
    echo ""
    echo "Cluster: $CLUSTER_NAME ($CLUSTER_TYPE)"
    echo ""
    echo "Quick commands:"
    echo "  td cluster status                    # Show cluster status"
    echo "  kubectl get polecats -n tundra-dome  # List polecats"
    echo "  kubectl get lanes -n tundra-dome     # List lanes"
    echo "  kubectl get beads -n tundra-dome     # List beads"
    echo ""

    if [[ -n "$DD_API_KEY" ]]; then
        echo "Datadog: https://app.datadoghq.com/infrastructure?tags=cluster_name:$CLUSTER_NAME"
    fi

    if [[ "$GITOPS" == "true" ]]; then
        echo "ArgoCD:  kubectl port-forward svc/argocd-server -n argocd 8080:443"
    fi
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --name)
            CLUSTER_NAME="$2"
            shift 2
            ;;
        --type)
            CLUSTER_TYPE="$2"
            shift 2
            ;;
        --dd-key)
            DD_API_KEY="$2"
            shift 2
            ;;
        --gitops)
            GITOPS="true"
            shift
            ;;
        --git-repo)
            GIT_REPO="$2"
            GITOPS="true"
            shift 2
            ;;
        --minimal)
            FULL_STACK="false"
            shift
            ;;
        --help)
            usage
            ;;
        *)
            error "Unknown option: $1"
            ;;
    esac
done

# Main
echo -e "${BLUE}"
cat <<'EOF'
  _____ _   _ _   _ ____  ____      _      ____   ___  __  __ _____
 |_   _| | | | \ | |  _ \|  _ \    / \    |  _ \ / _ \|  \/  | ____|
   | | | | | |  \| | | | | |_) |  / _ \   | | | | | | | |\/| |  _|
   | | | |_| | |\  | |_| |  _ <  / ___ \  | |_| | |_| | |  | | |___
   |_|  \___/|_| \_|____/|_| \_\/_/   \_\ |____/ \___/|_|  |_|_____|

EOF
echo -e "${NC}"

check_prerequisites

case "$CLUSTER_TYPE" in
    kind)
        create_kind_cluster
        ;;
    aks|eks|gke)
        create_cloud_cluster "$CLUSTER_TYPE"
        ;;
    *)
        error "Unknown cluster type: $CLUSTER_TYPE"
        ;;
esac

install_crds
deploy_infrastructure
deploy_controllers

if [[ "$FULL_STACK" == "true" ]]; then
    deploy_datadog
    deploy_examples
fi

setup_gitops
show_summary
