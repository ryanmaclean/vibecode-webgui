#!/bin/bash
# VibeCode Platform Monitoring Stack Deployment Script
# Deploys observability infrastructure using Prometheus and Datadog.

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MONITORING_DIR="$PROJECT_ROOT/monitoring"

# Default values
ENVIRONMENT=${ENVIRONMENT:-production}
NAMESPACE=${NAMESPACE:-vibecode-monitoring}
DEPLOY_METHOD=${DEPLOY_METHOD:-docker-compose}
DATADOG_API_KEY=${DATADOG_API_KEY:-}

# Function to check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    local required_commands=("docker")
    if [[ "$DEPLOY_METHOD" == "kubernetes" ]]; then
        required_commands+=("kubectl" "helm")
    elif [[ "$DEPLOY_METHOD" == "docker-compose" ]]; then
        required_commands+=("docker-compose")
    fi

    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            error "$cmd is required but not installed"
        fi
    done

    if ! docker info &> /dev/null; then
        error "Docker is not running or not accessible"
    fi
    log "Prerequisites check passed ✅"
}

# Function to validate environment
validate_environment() {
    log "Validating environment configuration..."
    if [[ -z "$DATADOG_API_KEY" ]]; then
        error "DATADOG_API_KEY is required. Please provide it with the -d flag or by setting the environment variable."
    fi
    
    local env_file="$MONITORING_DIR/.env"
    echo "DATADOG_API_KEY=$DATADOG_API_KEY" > "$env_file"
    log "Environment validation passed ✅"
}

# Function to deploy with Kubernetes
deploy_kubernetes() {
    log "Deploying to Kubernetes..."
    log "Ensuring Kubernetes namespace '$NAMESPACE' exists..."
    kubectl get ns "$NAMESPACE" &>/dev/null || kubectl create namespace "$NAMESPACE"

    log "Updating Helm repositories..."
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo add datadog https://helm.datadoghq.com
    helm repo update

    log "Deploying Prometheus..."
    helm upgrade --install prometheus prometheus-community/prometheus \
        --namespace "$NAMESPACE" \
        --values "$MONITORING_DIR/prometheus-helm-values.yml" \
        --set alertmanager.enabled=false \
        --set grafana.enabled=false \
        --set pushgateway.enabled=false \
        --atomic \
        --wait

    log "Deploying Datadog agent with log collection enabled..."
    helm upgrade --install datadog-agent datadog/datadog \
        --namespace "$NAMESPACE" \
        --set datadog.apiKey="$DATADOG_API_KEY" \
        --set datadog.site='datadoghq.com' \
        --set datadog.logs.enabled=true \
        --set datadog.logs.containerCollectAll=true \
        --set clusterAgent.enabled=true \
        --set clusterAgent.metrics.enabled=true \
        --set metrics-server.enabled=true \
        --atomic \
        --wait

    log "Kubernetes deployment completed ✅"
}

# Function to deploy with Docker Compose
deploy_docker_compose() {
    log "Deploying with Docker Compose..."
    docker-compose -f "$MONITORING_DIR/docker-compose.yml" up -d --remove-orphans
    log "Docker Compose deployment completed ✅"
}

# Function to display access info
display_access_info() {
    echo
    log "--- Access Information ---"
    info "Prometheus: http://localhost:9090"
    info "Datadog:    https://app.datadoghq.com/"
    echo "-----------------------------------"
}

# Main deployment function
main() {
    log "Starting VibeCode Platform Monitoring Deployment"
    log "Environment: $ENVIRONMENT"
    log "Deploy Method: $DEPLOY_METHOD"
    [[ "$DEPLOY_METHOD" == "kubernetes" ]] && log "Namespace: $NAMESPACE"
    echo

    check_prerequisites
    validate_environment

    if [[ "$DEPLOY_METHOD" == "docker-compose" ]]; then
        deploy_docker_compose
    elif [[ "$DEPLOY_METHOD" == "kubernetes" ]]; then
        deploy_kubernetes
    else
        error "Unknown deploy method: $DEPLOY_METHOD"
    fi

    display_access_info
    log "Monitoring deployment completed successfully! 🚀"
}

# Script usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo
    echo "Options:"
    echo "  -e, --environment    Environment (default: production)"
    echo "  -m, --method         Deployment method: docker-compose|kubernetes (default: docker-compose)"
    echo "  -n, --namespace      Kubernetes namespace (default: vibecode-monitoring)"
    echo "  -d, --datadog-key    Datadog API key (required)"
    echo "  -h, --help           Show this help message"
    echo
    echo "Examples:"
    echo "  $0 -d <your-datadog-api-key>                      # Deploy with Docker Compose"
    echo "  $0 -m kubernetes -n monitoring -d <your-key>   # Deploy to Kubernetes"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -m|--method)
            DEPLOY_METHOD="$2"
            shift 2
            ;;
        -n|--namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        -d|--datadog-key)
            DATADOG_API_KEY="$2"
            shift 2
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            ;;
    esac
done

# Run main function
main "$@"
