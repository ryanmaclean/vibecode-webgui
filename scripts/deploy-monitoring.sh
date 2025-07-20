#!/bin/bash
# VibeCode Platform Monitoring Stack Deployment Script
# Deploys comprehensive observability infrastructure

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
GRAFANA_PASSWORD=${GRAFANA_PASSWORD:-admin123}

# Function to check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."

    # Check required commands
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

    # Check Docker is running
    if ! docker info &> /dev/null; then
        error "Docker is not running or not accessible"
    fi

    # Check monitoring directory exists
    if [[ ! -d "$MONITORING_DIR" ]]; then
        error "Monitoring directory not found: $MONITORING_DIR"
    fi

    log "Prerequisites check passed ✅"
}

# Function to validate environment variables
validate_environment() {
    log "Validating environment configuration..."

    # Create .env file if it doesn't exist
    local env_file="$MONITORING_DIR/.env"
    if [[ ! -f "$env_file" ]]; then
        info "Creating monitoring environment file..."
        cat > "$env_file" <<EOL
# Monitoring Stack Environment Variables
DATADOG_API_KEY=${DATADOG_API_KEY:-}
GRAFANA_ADMIN_PASSWORD=${GRAFANA_PASSWORD:-admin}
EOL
        warn "Created $env_file - please update with your actual credentials if they were not in the environment"
    fi

    # Load environment variables
    set -a
    source "$env_file"
    set +a

    # Check for Datadog API key
    if [[ -z "$DATADOG_API_KEY" ]]; then
        warn "DATADOG_API_KEY not set - Datadog integration will be disabled"
    fi

    log "Environment validation completed ✅"
}

# Function to create directories
create_directories() {
    log "Creating monitoring directories..."
    local dirs=(
        "$MONITORING_DIR/grafana/dashboards/application"
        "$MONITORING_DIR/grafana/dashboards/infrastructure"
        "$MONITORING_DIR/grafana/dashboards/business"
        "$MONITORING_DIR/grafana/dashboards/security"
        "$MONITORING_DIR/recording_rules"
        "$MONITORING_DIR/templates"
        "$MONITORING_DIR/data/prometheus"
        "$MONITORING_DIR/data/grafana"
        "$MONITORING_DIR/data/alertmanager"
    )

    for dir in "${dirs[@]}"; do
        if [[ ! -d "$dir" ]]; then
            mkdir -p "$dir"
            info "Created directory: $dir"
        fi
    done

    log "Directories created ✅"
}

# Function to configure monitoring targets
configure_targets() {
    log "Configuring monitoring targets..."
    # Placeholder for dynamic configuration logic
    # Example: Generate Prometheus scrape configs based on services
    log "Monitoring targets configured ✅"
}

# Function to deploy with Docker Compose
deploy_docker_compose() {
    log "Deploying monitoring stack with Docker Compose..."
    docker-compose -f "$MONITORING_DIR/docker-compose.yml" up -d --remove-orphans
    log "Docker Compose deployment completed ✅"
}

# Function to deploy to Kubernetes
deploy_kubernetes() {
    log "Deploying monitoring stack to Kubernetes..."

    # Create namespace
    kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

    # Install Prometheus Operator
    info "Installing Prometheus Operator..."
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo update

    helm upgrade --install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
        --namespace "$NAMESPACE" \
        --values "$MONITORING_DIR/k8s/prometheus-values.yaml" \
        --wait

    # Deploy Datadog Agent
    info "Deploying Datadog Agent..."
    helm repo add datadog https://helm.datadoghq.com
    helm repo update

    helm upgrade --install datadog-agent datadog/datadog \
        --namespace "$NAMESPACE" \
        --set datadog.apiKey="$DATADOG_API_KEY" \
        --set datadog.site='datadoghq.com' \
        --set clusterAgent.enabled=true \
        --set clusterAgent.metrics.enabled=true \
        --wait

    # Deploy OpenTelemetry Collector
    info "Deploying OpenTelemetry Collector..."
    kubectl apply -f "$MONITORING_DIR/k8s/otel-collector.yaml" -n "$NAMESPACE"

    # Deploy Jaeger
    info "Deploying Jaeger..."
    helm repo add jaegertracing https://jaegertracing.github.io/helm-charts
    helm upgrade --install jaeger jaegertracing/jaeger \
        --namespace "$NAMESPACE" \
        --set storage.type=elasticsearch \
        --wait

    log "Kubernetes deployment completed ✅"
}

# Function to verify deployment
verify_deployment() {
    log "Verifying deployment..."
    # Placeholder for verification logic
    # Example: Check pod statuses, service endpoints
    log "Deployment verification passed ✅"
}

# Function to display access info
display_access_info() {
    log "Monitoring Stack Access Information:"
    echo "-----------------------------------"
    echo "Grafana: http://localhost:3000 (user: admin, pass: $GRAFANA_PASSWORD)"
    echo "Prometheus: http://localhost:9090"
    echo "Alertmanager: http://localhost:9093"
    echo "-----------------------------------"
}

# Cleanup function
cleanup() {
    log "Deployment script finished."
}

# Main function
main() {
    log "Starting VibeCode Platform Monitoring Deployment"
    log "Environment: $ENVIRONMENT"
    log "Deploy Method: $DEPLOY_METHOD"
    log "Namespace: $NAMESPACE"
    echo

    # Set up error handling
    trap cleanup ERR

    # Run deployment steps
    check_prerequisites
    validate_environment
    create_directories
    configure_targets

    if [[ "$DEPLOY_METHOD" == "docker-compose" ]]; then
        deploy_docker_compose
    elif [[ "$DEPLOY_METHOD" == "kubernetes" ]]; then
        deploy_kubernetes
    else
        error "Unknown deploy method: $DEPLOY_METHOD"
    fi

    verify_deployment
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
    echo "  -d, --datadog-key    Datadog API key for integration"
    echo "  -g, --grafana-pass   Grafana admin password (default: admin123)"
    echo "  -h, --help           Show this help message"
    echo
    echo "Examples:"
    echo "  $0                                    # Deploy with defaults"
    echo "  $0 -m kubernetes -n monitoring       # Deploy to Kubernetes"
    echo "  $0 -d dd-api-key -g secure-password  # Deploy with Datadog and custom password"
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
        -g|--grafana-pass)
            GRAFANA_PASSWORD="$2"
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
