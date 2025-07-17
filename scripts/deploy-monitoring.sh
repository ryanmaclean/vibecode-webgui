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
    local required_commands=("docker" "docker-compose")

    if [[ "$DEPLOY_METHOD" == "kubernetes" ]]; then
        required_commands+=("kubectl" "helm")
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
        cat > "$env_file" << EOF
# VibeCode Monitoring Environment Configuration
ENVIRONMENT=$ENVIRONMENT
GRAFANA_PASSWORD=$GRAFANA_PASSWORD
DATADOG_API_KEY=$DATADOG_API_KEY
SLACK_WEBHOOK_URL=
SENDGRID_API_KEY=
PAGERDUTY_INTEGRATION_KEY=
HONEYCOMB_API_KEY=
INFLUXDB_USER=admin
INFLUXDB_PASSWORD=password123
EOF
        warn "Created $env_file - please update with your actual credentials"
    fi

    # Validate critical environment variables
    if [[ -z "$DATADOG_API_KEY" ]]; then
        warn "DATADOG_API_KEY not set - Datadog integration will be disabled"
    fi

    log "Environment validation completed ✅"
}

# Function to create monitoring directories
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
        mkdir -p "$dir"
        info "Created directory: $dir"
    done

    log "Directories created ✅"
}

# Function to deploy with Docker Compose
deploy_docker_compose() {
    log "Deploying monitoring stack with Docker Compose..."

    cd "$MONITORING_DIR"

    # Pull latest images
    info "Pulling Docker images..."
    docker-compose -f docker-compose.monitoring.yml pull

    # Start monitoring services
    info "Starting monitoring services..."
    docker-compose -f docker-compose.monitoring.yml up -d

    # Wait for services to be healthy
    info "Waiting for services to be healthy..."
    local services=("prometheus" "grafana" "alertmanager" "vector" "otel-collector")

    for service in "${services[@]}"; do
        info "Checking $service health..."
        local retries=30
        while [[ $retries -gt 0 ]]; do
            if docker-compose -f docker-compose.monitoring.yml ps "$service" | grep -q "healthy\|Up"; then
                log "$service is healthy ✅"
                break
            fi
            warn "$service not ready yet, retrying... ($retries attempts left)"
            sleep 10
            ((retries--))
        done

        if [[ $retries -eq 0 ]]; then
            error "$service failed to become healthy"
        fi
    done

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
        --set grafana.adminPassword="$GRAFANA_PASSWORD" \
        --set prometheus.prometheusSpec.retention=30d \
        --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.resources.requests.storage=50Gi \
        --set grafana.persistence.enabled=true \
        --set grafana.persistence.size=10Gi \
        --wait

    # Deploy Vector
    info "Deploying Vector..."
    kubectl apply -f "$MONITORING_DIR/k8s/vector.yaml" -n "$NAMESPACE"

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

# Function to configure monitoring targets
configure_targets() {
    log "Configuring monitoring targets..."

    # Update Prometheus configuration with actual targets
    local prometheus_config="$MONITORING_DIR/prometheus.yml"

    if [[ "$DEPLOY_METHOD" == "docker-compose" ]]; then
        # For Docker Compose, use service names
        sed -i.bak 's/vibecode-app:3000/vibecode-app:3000/g' "$prometheus_config"
        sed -i.bak 's/postgres:5432/postgres:5432/g' "$prometheus_config"
        sed -i.bak 's/redis:6379/redis:6379/g' "$prometheus_config"
    elif [[ "$DEPLOY_METHOD" == "kubernetes" ]]; then
        # For Kubernetes, use service DNS names
        sed -i.bak 's/vibecode-app:3000/vibecode-app.vibecode-webgui.svc.cluster.local:3000/g' "$prometheus_config"
    fi

    log "Monitoring targets configured ✅"
}

# Function to verify deployment
verify_deployment() {
    log "Verifying monitoring deployment..."

    if [[ "$DEPLOY_METHOD" == "docker-compose" ]]; then
        # Check Docker Compose services
        info "Checking Docker Compose services..."
        docker-compose -f "$MONITORING_DIR/docker-compose.monitoring.yml" ps

        # Test service endpoints
        local endpoints=(
            "http://localhost:9090/-/healthy:Prometheus"
            "http://localhost:3001/api/health:Grafana"
            "http://localhost:9093/-/healthy:AlertManager"
            "http://localhost:8686/health:Vector"
            "http://localhost:13133:OpenTelemetry Collector"
        )

        for endpoint_info in "${endpoints[@]}"; do
            IFS=':' read -r endpoint name <<< "$endpoint_info"
            info "Testing $name endpoint: $endpoint"

            if curl -f -s "$endpoint" > /dev/null; then
                log "$name is accessible ✅"
            else
                warn "$name is not accessible at $endpoint"
            fi
        done

    elif [[ "$DEPLOY_METHOD" == "kubernetes" ]]; then
        # Check Kubernetes deployments
        info "Checking Kubernetes deployments..."
        kubectl get pods -n "$NAMESPACE"
        kubectl get services -n "$NAMESPACE"
    fi

    log "Deployment verification completed ✅"
}

# Function to display access information
display_access_info() {
    log "Monitoring Stack Deployment Complete! 🎉"
    echo
    echo "📊 Access Information:"
    echo "====================="

    if [[ "$DEPLOY_METHOD" == "docker-compose" ]]; then
        echo "• Grafana Dashboard:     http://localhost:3001 (admin / $GRAFANA_PASSWORD)"
        echo "• Prometheus:           http://localhost:9090"
        echo "• AlertManager:         http://localhost:9093"
        echo "• Jaeger Tracing:       http://localhost:16686"
        echo "• Kibana (Logs):        http://localhost:5601"
        echo "• Vector API:           http://localhost:8686"
        echo "• Elasticsearch:        http://localhost:9200"
        echo "• Node Exporter:        http://localhost:9100"
        echo "• cAdvisor:             http://localhost:8080"
    elif [[ "$DEPLOY_METHOD" == "kubernetes" ]]; then
        echo "• Grafana Dashboard:     kubectl port-forward -n $NAMESPACE svc/kube-prometheus-stack-grafana 3000:80"
        echo "• Prometheus:           kubectl port-forward -n $NAMESPACE svc/kube-prometheus-stack-prometheus 9090:9090"
        echo "• AlertManager:         kubectl port-forward -n $NAMESPACE svc/kube-prometheus-stack-alertmanager 9093:9093"
    fi

    echo
    echo "🔧 Management Commands:"
    echo "======================="
    echo "• View logs:            docker-compose -f monitoring/docker-compose.monitoring.yml logs -f [service]"
    echo "• Stop monitoring:      docker-compose -f monitoring/docker-compose.monitoring.yml down"
    echo "• Restart service:      docker-compose -f monitoring/docker-compose.monitoring.yml restart [service]"
    echo "• Update config:        docker-compose -f monitoring/docker-compose.monitoring.yml up -d --force-recreate [service]"
    echo
    echo "📚 Documentation:"
    echo "=================="
    echo "• Monitoring Guide:     https://docs.vibecode.dev/monitoring"
    echo "• Alerting Runbooks:    https://docs.vibecode.dev/runbooks"
    echo "• Grafana Dashboards:   https://docs.vibecode.dev/dashboards"
    echo

    if [[ -z "$DATADOG_API_KEY" ]]; then
        warn "Datadog integration is disabled. Set DATADOG_API_KEY to enable full observability."
    fi
}

# Function to cleanup on failure
cleanup() {
    error "Deployment failed. Cleaning up..."

    if [[ "$DEPLOY_METHOD" == "docker-compose" ]]; then
        docker-compose -f "$MONITORING_DIR/docker-compose.monitoring.yml" down || true
    elif [[ "$DEPLOY_METHOD" == "kubernetes" ]]; then
        kubectl delete namespace "$NAMESPACE" || true
    fi
}

# Main deployment function
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
