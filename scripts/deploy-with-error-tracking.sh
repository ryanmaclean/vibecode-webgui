#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Comprehensive Deployment Script with Error Tracking
# This script handles all deployment scenarios with automatic error tracking

# Initialize log aggregation
init_log_aggregation


# Source error tracking module
source "$(dirname "$0")/lib/error-tracking.sh"

# Initialize error tracking for deployment
init_error_tracking "deployment" "full_deployment"

# Configuration
DEPLOYMENT_TYPE=${1:-"auto"}
ENVIRONMENT=${2:-"development"}
VERBOSE=${VERBOSE:-false}
DRY_RUN=${DRY_RUN:-false}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Track deployment start
track_deployment_start() {
    log_info "🚀 Starting deployment process..."
    log_info "Deployment Type: $DEPLOYMENT_TYPE"
    log_info "Environment: $ENVIRONMENT"
    log_info "Dry Run: $DRY_RUN"
    
    # Track performance metric
    track_performance_metric "deployment_start_time" "$(date +%s)" "deployment" "timestamp"
}

# Validate prerequisites
validate_prerequisites() {
    log_info "🔍 Validating prerequisites..."
    
    local missing_tools=()
    
    # Check required tools
    command -v kubectl >/dev/null 2>&1 || missing_tools+=("kubectl")
    command -v docker >/dev/null 2>&1 || missing_tools+=("docker")
    command -v npm >/dev/null 2>&1 || missing_tools+=("npm")
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        log_error_to_datadog "Missing required tools: ${missing_tools[*]}" "1" "deployment" "prerequisites_check" "missing_tools:${missing_tools[*]}"
        exit 1
    fi
    
    # Check environment variables
    if [ -z "$DD_API_KEY" ]; then
        log_warning "DD_API_KEY not set - error tracking will be limited"
    fi
    
    log_success "Prerequisites validated"
}

# Build application
build_application() {
    log_info "🏗️ Building application..."
    
    local build_start=$(date +%s)
    
    if [ "$DRY_RUN" = "true" ]; then
        log_info "DRY RUN: Would run 'npm run build'"
        return 0
    fi
    
    if safe_execute "npm run build" "deployment" "build"; then
        local build_duration=$(($(date +%s) - build_start))
        track_performance_metric "build_duration" "$build_duration" "deployment" "seconds"
        log_success "Application built successfully"
    else
        log_error "Application build failed"
        exit 1
    fi
}

# Run tests
run_tests() {
    log_info "🧪 Running tests..."
    
    local test_start=$(date +%s)
    
    if [ "$DRY_RUN" = "true" ]; then
        log_info "DRY RUN: Would run 'npm test'"
        return 0
    fi
    
    if safe_execute "npm test" "deployment" "testing"; then
        local test_duration=$(($(date +%s) - test_start))
        track_performance_metric "test_duration" "$test_duration" "deployment" "seconds"
        log_success "Tests passed"
    else
        log_error "Tests failed"
        exit 1
    fi
}

# Deploy to Kubernetes
deploy_kubernetes() {
    log_info "☸️ Deploying to Kubernetes..."
    
    local deploy_start=$(date +%s)
    
    # Check if KIND cluster exists
    if kubectl cluster-info >/dev/null 2>&1; then
        log_info "Kubernetes cluster is accessible"
    else
        log_error "Kubernetes cluster is not accessible"
        log_error_to_datadog "Kubernetes cluster not accessible" "1" "deployment" "kubernetes_deploy" "cluster_check_failed"
        exit 1
    fi
    
    if [ "$DRY_RUN" = "true" ]; then
        log_info "DRY RUN: Would apply Kubernetes manifests"
        return 0
    fi
    
    # Apply Kubernetes manifests
    if safe_execute "kubectl apply -f k8s/" "deployment" "k8s_apply"; then
        local deploy_duration=$(($(date +%s) - deploy_start))
        track_performance_metric "k8s_deploy_duration" "$deploy_duration" "deployment" "seconds"
        log_success "Kubernetes deployment completed"
    else
        log_error "Kubernetes deployment failed"
        exit 1
    fi
}

# Deploy to Azure AKS
deploy_aks() {
    log_info "☁️ Deploying to Azure AKS..."
    
    local deploy_start=$(date +%s)
    
    # Check Azure CLI
    if ! command -v az >/dev/null 2>&1; then
        log_error "Azure CLI not found"
        log_error_to_datadog "Azure CLI not found" "1" "deployment" "aks_deploy" "azure_cli_missing"
        exit 1
    fi
    
    # Check if logged in to Azure
    if ! az account show >/dev/null 2>&1; then
        log_error "Not logged in to Azure"
        log_error_to_datadog "Not logged in to Azure" "1" "deployment" "aks_deploy" "azure_not_logged_in"
        exit 1
    fi
    
    if [ "$DRY_RUN" = "true" ]; then
        log_info "DRY RUN: Would deploy to AKS"
        return 0
    fi
    
    # Run AKS deployment script
    if safe_execute "./scripts/aks-datadog-setup.sh" "deployment" "aks_deploy"; then
        local deploy_duration=$(($(date +%s) - deploy_start))
        track_performance_metric "aks_deploy_duration" "$deploy_duration" "deployment" "seconds"
        log_success "AKS deployment completed"
    else
        log_error "AKS deployment failed"
        exit 1
    fi
}

# Deploy locally with Docker
deploy_local() {
    log_info "🐳 Deploying locally with Docker..."
    
    local deploy_start=$(date +%s)
    
    # Check Docker
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker is not running"
        log_error_to_datadog "Docker is not running" "1" "deployment" "local_deploy" "docker_not_running"
        exit 1
    fi
    
    if [ "$DRY_RUN" = "true" ]; then
        log_info "DRY RUN: Would build and run Docker containers"
        return 0
    fi
    
    # Build Docker image
    if safe_execute "docker build -t vibecode-webgui:latest ." "deployment" "docker_build"; then
        log_success "Docker image built"
    else
        log_error "Docker build failed"
        exit 1
    fi
    
    # Run Docker Compose
    if safe_execute "docker-compose up -d" "deployment" "docker_compose"; then
        local deploy_duration=$(($(date +%s) - deploy_start))
        track_performance_metric "local_deploy_duration" "$deploy_duration" "deployment" "seconds"
        log_success "Local deployment completed"
    else
        log_error "Local deployment failed"
        exit 1
    fi
}

# Health check
health_check() {
    log_info "🩺 Running health checks..."
    
    local health_start=$(date +%s)
    local health_passed=true
    
    # Check application health
    if [ "$ENVIRONMENT" = "production" ]; then
        local health_url="https://your-production-url.com/api/health"
    else
        local health_url="http://localhost:3000/api/health"
    fi
    
    if [ "$DRY_RUN" = "true" ]; then
        log_info "DRY RUN: Would check health at $health_url"
        return 0
    fi
    
    # Wait for application to be ready
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f "$health_url" >/dev/null 2>&1; then
            log_success "Health check passed (attempt $attempt)"
            break
        else
            log_info "Health check attempt $attempt/$max_attempts failed, retrying..."
            sleep 10
            ((attempt++))
        fi
    done
    
    if [ $attempt -gt $max_attempts ]; then
        log_error "Health check failed after $max_attempts attempts"
        log_error_to_datadog "Health check failed after $max_attempts attempts" "1" "deployment" "health_check" "max_attempts_exceeded"
        health_passed=false
    fi
    
    local health_duration=$(($(date +%s) - health_start))
    track_performance_metric "health_check_duration" "$health_duration" "deployment" "seconds"
    
    if [ "$health_passed" = "true" ]; then
        log_success "All health checks passed"
    else
        log_error "Health checks failed"
        exit 1
    fi
}

# Post-deployment tasks
post_deployment() {
    log_info "🔧 Running post-deployment tasks..."
    
    # Update monitoring
    if safe_execute "./scripts/setup-datadog-monitoring.ts" "deployment" "monitoring_setup"; then
        log_success "Monitoring setup completed"
    else
        log_warning "Monitoring setup failed"
    fi
    
    # Run database migrations
    if safe_execute "./scripts/deploy-database-migrations.sh" "deployment" "db_migrations"; then
        log_success "Database migrations completed"
    else
        log_warning "Database migrations failed"
    fi
    
    # Verify deployment
    if safe_execute "./scripts/validate-deployment-readiness.sh" "deployment" "deployment_validation"; then
        log_success "Deployment validation completed"
    else
        log_warning "Deployment validation failed"
    fi
}

# Main deployment logic
main() {
    local deployment_start=$(date +%s)
    
    track_deployment_start
    
    # Validate prerequisites
    validate_prerequisites
    
    # Build application
    build_application
    
    # Run tests
    run_tests
    
    # Deploy based on type
    case "$DEPLOYMENT_TYPE" in
        "kubernetes"|"k8s")
            deploy_kubernetes
            ;;
        "aks"|"azure")
            deploy_aks
            ;;
        "local"|"docker")
            deploy_local
            ;;
        "auto")
            # Auto-detect deployment type
            if kubectl cluster-info >/dev/null 2>&1; then
                log_info "Kubernetes cluster detected, deploying to K8s"
                deploy_kubernetes
            elif command -v az >/dev/null 2>&1 && az account show >/dev/null 2>&1; then
                log_info "Azure CLI detected, deploying to AKS"
                deploy_aks
            else
                log_info "No cloud provider detected, deploying locally"
                deploy_local
            fi
            ;;
        *)
            log_error "Unknown deployment type: $DEPLOYMENT_TYPE"
            log_error_to_datadog "Unknown deployment type: $DEPLOYMENT_TYPE" "1" "deployment" "main" "invalid_deployment_type"
            exit 1
            ;;
    esac
    
    # Health check
    health_check
    
    # Post-deployment tasks
    post_deployment
    
    # Track deployment completion
    local deployment_duration=$(($(date +%s) - deployment_start))
    track_performance_metric "total_deployment_duration" "$deployment_duration" "deployment" "seconds"
    
    log_success "🎉 Deployment completed successfully!"
    log_info "Total deployment time: ${deployment_duration}s"
    
    # Track successful completion
    track_script_completion 0 "deployment" "completion" "$deployment_duration"
}

# Error handling
trap 'handle_script_error $LINENO' ERR

# Run main function
main "$@"
