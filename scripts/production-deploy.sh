#!/bin/bash

# VibeCode Production Deployment Script
# Complete deployment pipeline with OAuth configuration and environment validation
# Staff Engineer Implementation - Production-ready deployment automation

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEPLOYMENT_LOG="$PROJECT_ROOT/deployment.log"
DEPLOYMENT_ENV="${DEPLOYMENT_ENV:-production}"
DEPLOYMENT_TYPE="${DEPLOYMENT_TYPE:-}"

# Functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$DEPLOYMENT_LOG"
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$DEPLOYMENT_LOG"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$DEPLOYMENT_LOG"
    exit 1
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$DEPLOYMENT_LOG"
}

# Banner
show_banner() {
    cat << 'EOF'
╔══════════════════════════════════════════════════════════════╗
║                 VibeCode Production Deployment              ║
║                                                              ║
║  🚀 Enterprise-grade AI development platform deployment     ║
║  ✅ OAuth integration with GitHub and Google                ║
║  🔒 Security hardening and secret management                ║
║  📊 Datadog monitoring and observability                    ║
║  ☸️  Azure AKS and Kubernetes deployment                    ║
╚══════════════════════════════════════════════════════════════╝
EOF
}

# Prerequisites check
check_prerequisites() {
    log "🔍 Checking prerequisites..."
    
    local required_tools=("kubectl" "helm" "docker" "node" "npm")
    local missing_tools=()
    
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            missing_tools+=("$tool")
        fi
    done
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        error "Missing required tools: ${missing_tools[*]}"
    fi
    
    # Check Node.js version
    local node_version=$(node --version | cut -d'v' -f2)
    local required_version="22.0.0"
    
    if ! node -e "process.exit(require('semver').gte('$node_version', '$required_version') ? 0 : 1)" 2>/dev/null; then
        error "Node.js version $node_version is not supported. Required: $required_version or higher"
    fi
    
    log "✅ All prerequisites satisfied"
}

# Environment validation
validate_environment() {
    log "🔧 Validating environment configuration..."
    
    local required_vars=(
        "NEXTAUTH_URL"
        "NEXTAUTH_SECRET"
        "DATABASE_URL"
        "REDIS_URL"
        "DD_API_KEY"
        "DD_APP_KEY"
    )
    
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var:-}" ]; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -ne 0 ]; then
        error "Missing required environment variables: ${missing_vars[*]}"
    fi
    
    # Validate OAuth configuration
    if [ -z "${GITHUB_ID:-}" ] || [ -z "${GITHUB_SECRET:-}" ]; then
        warn "GitHub OAuth not configured. OAuth authentication will be unavailable."
    else
        log "✅ GitHub OAuth configured"
    fi
    
    if [ -z "${GOOGLE_CLIENT_ID:-}" ] || [ -z "${GOOGLE_CLIENT_SECRET:-}" ]; then
        warn "Google OAuth not configured. OAuth authentication will be unavailable."
    else
        log "✅ Google OAuth configured"
    fi
    
    # Validate API keys
    if [[ ! "${NEXTAUTH_SECRET}" =~ ^.{32,}$ ]]; then
        error "NEXTAUTH_SECRET must be at least 32 characters long"
    fi
    
    if [[ ! "${DD_API_KEY:-}" =~ ^[a-f0-9]{32}$ ]]; then
        warn "Datadog API key format appears invalid"
    fi
    
    log "✅ Environment validation complete"
}

# OAuth setup helper
setup_oauth() {
    log "🔐 Setting up OAuth providers..."
    
    echo ""
    echo "OAuth Provider Setup:"
    echo "===================="
    echo ""
    
    # GitHub OAuth setup
    if [ -z "${GITHUB_ID:-}" ]; then
        echo "📋 GitHub OAuth Setup:"
        echo "1. Go to https://github.com/settings/applications/new"
        echo "2. Application name: VibeCode Production"
        echo "3. Homepage URL: ${NEXTAUTH_URL}"
        echo "4. Authorization callback URL: ${NEXTAUTH_URL}/api/auth/callback/github"
        echo "5. Copy Client ID and generate Client Secret"
        echo ""
        read -p "Enter GitHub Client ID: " github_id
        read -s -p "Enter GitHub Client Secret: " github_secret
        echo ""
        export GITHUB_ID="$github_id"
        export GITHUB_SECRET="$github_secret"
        log "✅ GitHub OAuth configured"
    fi
    
    # Google OAuth setup
    if [ -z "${GOOGLE_CLIENT_ID:-}" ]; then
        echo "📋 Google OAuth Setup:"
        echo "1. Go to https://console.cloud.google.com/apis/credentials"
        echo "2. Create OAuth 2.0 Client ID"
        echo "3. Application type: Web application"
        echo "4. Authorized redirect URIs: ${NEXTAUTH_URL}/api/auth/callback/google"
        echo "5. Copy Client ID and Client Secret"
        echo ""
        read -p "Enter Google Client ID: " google_id
        read -s -p "Enter Google Client Secret: " google_secret
        echo ""
        export GOOGLE_CLIENT_ID="$google_id"
        export GOOGLE_CLIENT_SECRET="$google_secret"
        log "✅ Google OAuth configured"
    fi
}

# Build application
build_application() {
    log "🏗️ Building VibeCode application..."
    
    cd "$PROJECT_ROOT"
    
    # Install dependencies
    log "Installing dependencies..."
    npm ci --production=false
    
    # Run tests
    log "Running critical tests..."
    npm run test:unit
    npm run test:integration
    npm run test:ai-workflow
    
    # Build application
    log "Building production bundle..."
    npm run build
    
    # Build Docker image
    log "Building Docker image..."
    docker build -f Dockerfile.production -t "vibecode/webgui:${DEPLOYMENT_ENV}-$(date +%Y%m%d-%H%M%S)" .
    docker tag "vibecode/webgui:${DEPLOYMENT_ENV}-$(date +%Y%m%d-%H%M%S)" "vibecode/webgui:${DEPLOYMENT_ENV}-latest"
    
    log "✅ Application build complete"
}

# Deploy to Kubernetes
deploy_kubernetes() {
    log "☸️ Deploying to Kubernetes..."
    
    # Create namespace if it doesn't exist
    kubectl create namespace vibecode-platform --dry-run=client -o yaml | kubectl apply -f -
    
    # Create secrets
    log "Creating Kubernetes secrets..."
    create_k8s_secrets
    
    # Deploy using Helm
    log "Deploying with Helm..."
    helm upgrade --install vibecode-platform \
        "$PROJECT_ROOT/helm/vibecode-platform" \
        --namespace vibecode-platform \
        --set global.environment="$DEPLOYMENT_ENV" \
        --set web.image.tag="${DEPLOYMENT_ENV}-latest" \
        --set ingress.hosts[0].host="${NEXTAUTH_URL#https://}" \
        --set ingress.tls[0].hosts[0]="${NEXTAUTH_URL#https://}" \
        --timeout 10m \
        --wait
    
    log "✅ Kubernetes deployment complete"
}

# Create Kubernetes secrets
create_k8s_secrets() {
    # Main application secrets
    kubectl create secret generic vibecode-secrets \
        --from-literal=NEXTAUTH_SECRET="$NEXTAUTH_SECRET" \
        --from-literal=DATABASE_URL="$DATABASE_URL" \
        --from-literal=REDIS_URL="$REDIS_URL" \
        --from-literal=DD_API_KEY="$DD_API_KEY" \
        --from-literal=DD_APP_KEY="$DD_APP_KEY" \
        --from-literal=OPENROUTER_API_KEY="${OPENROUTER_API_KEY:-}" \
        --from-literal=ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-}" \
        --namespace vibecode-platform \
        --dry-run=client -o yaml | kubectl apply -f -
    
    # OAuth secrets
    kubectl create secret generic oauth-secrets \
        --from-literal=GITHUB_ID="${GITHUB_ID:-}" \
        --from-literal=GITHUB_SECRET="${GITHUB_SECRET:-}" \
        --from-literal=GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID:-}" \
        --from-literal=GOOGLE_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET:-}" \
        --from-literal=NEXTAUTH_URL="$NEXTAUTH_URL" \
        --namespace vibecode-platform \
        --dry-run=client -o yaml | kubectl apply -f -
}

# Deploy to Azure AKS
deploy_azure() {
    log "☁️ Deploying to Azure AKS..."
    
    cd "$PROJECT_ROOT/infrastructure/terraform/azure"
    
    # Check if Terraform is initialized
    if [ ! -d ".terraform" ]; then
        log "Initializing Terraform..."
        terraform init
    fi
    
    # Plan deployment
    log "Planning Azure infrastructure..."
    terraform plan -out=tfplan
    
    # Apply deployment
    log "Applying Azure infrastructure..."
    terraform apply tfplan
    
    # Get AKS credentials
    log "Configuring kubectl for AKS..."
    local resource_group=$(terraform output -raw resource_group_name)
    local cluster_name=$(terraform output -raw aks_cluster_name)
    
    az aks get-credentials --resource-group "$resource_group" --name "$cluster_name" --overwrite-existing
    
    # Deploy application to AKS
    deploy_kubernetes
    
    log "✅ Azure deployment complete"
}

# Deploy to cloud platforms
deploy_cloud_platform() {
    local platform="$1"
    
    case "$platform" in
        "vercel")
            deploy_vercel
            ;;
        "netlify")
            deploy_netlify
            ;;
        "railway")
            deploy_railway
            ;;
        "azure")
            deploy_azure
            ;;
        "kubernetes")
            deploy_kubernetes
            ;;
        *)
            error "Unsupported platform: $platform"
            ;;
    esac
}

# Deploy to Vercel
deploy_vercel() {
    log "🚀 Deploying to Vercel..."
    
    if ! command -v vercel &> /dev/null; then
        log "Installing Vercel CLI..."
        npm install -g vercel
    fi
    
    # Create environment variables file for Vercel
    cat > .env.vercel << EOF
NEXTAUTH_URL=${NEXTAUTH_URL}
NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
DATABASE_URL=${DATABASE_URL}
REDIS_URL=${REDIS_URL}
GITHUB_ID=${GITHUB_ID:-}
GITHUB_SECRET=${GITHUB_SECRET:-}
GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID:-}
GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET:-}
OPENROUTER_API_KEY=${OPENROUTER_API_KEY:-}
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}
DD_API_KEY=${DD_API_KEY}
DD_APP_KEY=${DD_APP_KEY}
EOF
    
    # Deploy to Vercel
    vercel --prod --env-file .env.vercel
    
    # Clean up
    rm .env.vercel
    
    log "✅ Vercel deployment complete"
}

# Health check
run_health_checks() {
    log "🏥 Running post-deployment health checks..."
    
    local app_url="${NEXTAUTH_URL}"
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "${app_url}/api/health" > /dev/null; then
            log "✅ Application health check passed"
            break
        fi
        
        if [ $attempt -eq $max_attempts ]; then
            error "❌ Application health check failed after $max_attempts attempts"
        fi
        
        info "Health check attempt $attempt/$max_attempts failed, retrying in 10s..."
        sleep 10
        ((attempt++))
    done
    
    # Test OAuth providers
    if [ -n "${GITHUB_ID:-}" ]; then
        if curl -f -s "${app_url}/api/auth/providers" | grep -q "github"; then
            log "✅ GitHub OAuth provider available"
        else
            warn "⚠️ GitHub OAuth provider not detected"
        fi
    fi
    
    if [ -n "${GOOGLE_CLIENT_ID:-}" ]; then
        if curl -f -s "${app_url}/api/auth/providers" | grep -q "google"; then
            log "✅ Google OAuth provider available"
        else
            warn "⚠️ Google OAuth provider not detected"
        fi
    fi
    
    # Test AI endpoints
    log "Testing AI endpoints..."
    local session_token=$(curl -s -X POST "${app_url}/api/auth/signin" -d "email=admin@vibecode.dev&password=admin123" | jq -r '.sessionToken // empty')
    
    if [ -n "$session_token" ]; then
        if curl -f -s -H "Authorization: Bearer $session_token" "${app_url}/api/ai/health" > /dev/null; then
            log "✅ AI endpoints accessible"
        else
            warn "⚠️ AI endpoints may not be functioning"
        fi
    fi
    
    log "✅ Health checks complete"
}

# Monitoring setup
setup_monitoring() {
    log "📊 Setting up monitoring and alerting..."
    
    # Deploy Datadog synthetics tests
    if [ -f "$PROJECT_ROOT/infrastructure/monitoring/terraform/main.tf" ]; then
        cd "$PROJECT_ROOT/infrastructure/monitoring/terraform"
        
        terraform init
        terraform plan \
            -var="app_base_url=$NEXTAUTH_URL" \
            -var="environment=$DEPLOYMENT_ENV" \
            -var="datadog_api_key=$DD_API_KEY" \
            -var="datadog_app_key=$DD_APP_KEY" \
            -out=monitoring-plan
        
        terraform apply monitoring-plan
        
        log "✅ Datadog monitoring configured"
    fi
    
    # Trigger synthetic tests
    if command -v datadog-ci &> /dev/null; then
        log "Running initial synthetic tests..."
        datadog-ci synthetics run-tests --public-id vib-ecd-aig || warn "Synthetic tests failed - check Datadog dashboard"
    fi
}

# Cleanup on exit
cleanup() {
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
        error "Deployment failed with exit code $exit_code"
        echo "Check $DEPLOYMENT_LOG for details"
    fi
    exit $exit_code
}

# Main deployment flow
main() {
    trap cleanup EXIT
    
    show_banner
    log "Starting VibeCode production deployment..."
    log "Environment: $DEPLOYMENT_ENV"
    log "Deployment type: ${DEPLOYMENT_TYPE:-auto-detect}"
    
    # Deployment steps
    check_prerequisites
    validate_environment
    
    # Interactive OAuth setup if needed
    if [ -z "${GITHUB_ID:-}" ] || [ -z "${GOOGLE_CLIENT_ID:-}" ]; then
        echo ""
        read -p "Do you want to configure OAuth providers now? (y/N): " configure_oauth
        if [[ "$configure_oauth" =~ ^[Yy]$ ]]; then
            setup_oauth
        fi
    fi
    
    build_application
    
    # Determine deployment target
    if [ -z "$DEPLOYMENT_TYPE" ]; then
        echo ""
        echo "Select deployment target:"
        echo "1) Azure AKS (Enterprise)"
        echo "2) Kubernetes (Custom cluster)"
        echo "3) Vercel (Serverless)"
        echo "4) Netlify (JAMstack)"
        echo "5) Railway (Full-stack)"
        echo ""
        read -p "Enter choice (1-5): " choice
        
        case $choice in
            1) DEPLOYMENT_TYPE="azure" ;;
            2) DEPLOYMENT_TYPE="kubernetes" ;;
            3) DEPLOYMENT_TYPE="vercel" ;;
            4) DEPLOYMENT_TYPE="netlify" ;;
            5) DEPLOYMENT_TYPE="railway" ;;
            *) error "Invalid choice" ;;
        esac
    fi
    
    deploy_cloud_platform "$DEPLOYMENT_TYPE"
    run_health_checks
    setup_monitoring
    
    # Success message
    echo ""
    echo "🎉 VibeCode deployment completed successfully!"
    echo ""
    echo "📋 Deployment Summary:"
    echo "======================"
    echo "• Environment: $DEPLOYMENT_ENV"
    echo "• Platform: $DEPLOYMENT_TYPE"
    echo "• Application URL: $NEXTAUTH_URL"
    echo "• OAuth Providers: ${GITHUB_ID:+GitHub }${GOOGLE_CLIENT_ID:+Google}"
    echo "• Monitoring: ${DD_API_KEY:+Datadog enabled}"
    echo ""
    echo "📖 Next Steps:"
    echo "• Test authentication: $NEXTAUTH_URL/auth/signin"
    echo "• AI project generation: $NEXTAUTH_URL/projects"
    echo "• Monitoring dashboard: https://app.datadoghq.com/"
    echo "• Documentation: $NEXTAUTH_URL/docs"
    echo ""
    
    log "✅ Production deployment complete!"
}

# Script entry point
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi 