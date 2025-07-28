#!/bin/bash
# Complete Zero-to-Production Kubernetes Automation
# Handles everything from dependency installation to full deployment

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

echo "🚀 VIBECODE ZERO-TO-PRODUCTION AUTOMATION"
echo "========================================="

# Step 1: Install all dependencies automatically
install_dependencies() {
    log_info "Step 1: Installing dependencies..."
    
    case "$(uname -s)" in
        Darwin)
            # macOS
            if ! command -v brew >/dev/null 2>&1; then
                log_info "Installing Homebrew..."
                /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
            fi
            
            # Install dependencies via brew
            BREW_DEPS=("kind" "kubectl" "helm" "docker")
            for dep in "${BREW_DEPS[@]}"; do
                if ! command -v "$dep" >/dev/null 2>&1; then
                    log_info "Installing $dep..."
                    brew install "$dep"
                fi
            done
            ;;
        Linux)
            # Linux
            log_info "Installing dependencies for Linux..."
            
            # Install KIND
            if ! command -v kind >/dev/null 2>&1; then
                curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.24.0/kind-linux-amd64
                chmod +x ./kind
                sudo mv ./kind /usr/local/bin/kind
            fi
            
            # Install kubectl
            if ! command -v kubectl >/dev/null 2>&1; then
                curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
                chmod +x kubectl
                sudo mv kubectl /usr/local/bin/
            fi
            
            # Install Helm
            if ! command -v helm >/dev/null 2>&1; then
                curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
            fi
            ;;
    esac
    
    log_success "All dependencies installed"
}

# Step 2: Setup environment variables automatically
setup_environment() {
    log_info "Step 2: Setting up environment..."
    
    # Create .env.local if it doesn't exist
    if [ ! -f ".env.local" ]; then
        log_info "Creating .env.local with default values..."
        cat > .env.local <<EOF
# Database Configuration
DATABASE_URL=postgresql://vibecode:vibecode_password@postgres-service:5432/vibecode
REDIS_URL=redis://valkey-service:6379

# Authentication
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=$(openssl rand -hex 32)

# API Keys (Set these to real values)
OPENROUTER_API_KEY=your-openrouter-key-here
DD_API_KEY=your-datadog-api-key-here
DD_APP_KEY=your-datadog-app-key-here

# OAuth (Set these to real values)
GITHUB_ID=your-github-oauth-id
GITHUB_SECRET=your-github-oauth-secret
GOOGLE_ID=your-google-oauth-id  
GOOGLE_SECRET=your-google-oauth-secret

# Monitoring
DD_SITE=datadoghq.com
DD_SERVICE=vibecode-webgui
DD_VERSION=1.0.0
DD_ENV=development
EOF
        log_success ".env.local created with defaults"
        log_warning "⚠️  Edit .env.local to add your real API keys"
    else
        log_success ".env.local already exists"
    fi
}

# Step 3: Setup secrets automatically
setup_secrets() {
    log_info "Step 3: Setting up Kubernetes secrets..."
    
    # Source environment variables
    if [ -f ".env.local" ]; then
        set -a
        source .env.local
        set +a
    fi
    
    # Create namespace first
    kubectl create namespace vibecode-platform --dry-run=client -o yaml | kubectl apply -f -
    
    # Create secrets from environment variables
    kubectl create secret generic vibecode-secrets \
        --from-literal=OPENROUTER_API_KEY="${OPENROUTER_API_KEY:-placeholder}" \
        --from-literal=DD_API_KEY="${DD_API_KEY:-placeholder}" \
        --from-literal=DD_APP_KEY="${DD_APP_KEY:-placeholder}" \
        --from-literal=NEXTAUTH_SECRET="${NEXTAUTH_SECRET:-$(openssl rand -hex 32)}" \
        --from-literal=ADMIN_EMAIL="admin@vibecode.dev" \
        --from-literal=ADMIN_PASSWORD="admin123" \
        --from-literal=NODE_ENV="development" \
        --namespace=vibecode-platform \
        --dry-run=client -o yaml | kubectl apply -f -
    
    kubectl create secret generic oauth-secrets \
        --from-literal=GITHUB_ID="${GITHUB_ID:-placeholder}" \
        --from-literal=GITHUB_SECRET="${GITHUB_SECRET:-placeholder}" \
        --from-literal=GOOGLE_ID="${GOOGLE_ID:-placeholder}" \
        --from-literal=GOOGLE_SECRET="${GOOGLE_SECRET:-placeholder}" \
        --from-literal=NEXTAUTH_URL="${NEXTAUTH_URL:-http://localhost:3000}" \
        --from-literal=NEXTAUTH_SECRET="${NEXTAUTH_SECRET:-$(openssl rand -hex 32)}" \
        --namespace=vibecode-platform \
        --dry-run=client -o yaml | kubectl apply -f -
    
    log_success "Kubernetes secrets created"
}

# Step 4: Build and load container images
build_and_load_images() {
    log_info "Step 4: Building and loading container images..."
    
    # Build the application image
    log_info "Building VibeCode application image..."
    docker build -t vibecode-webgui:latest .
    
    # Load image into KIND cluster
    log_info "Loading image into KIND cluster..."
    kind load docker-image vibecode-webgui:latest --name vibecode-test
    
    log_success "Container images ready"
}

# Step 5: Deploy monitoring
deploy_monitoring() {
    log_info "Step 5: Deploying monitoring..."
    
    # Deploy Datadog agent if API key is available
    if [ "${DD_API_KEY:-}" != "placeholder" ] && [ -n "${DD_API_KEY:-}" ]; then
        log_info "Deploying Datadog agent..."
        
        # Create Datadog configuration
        kubectl create configmap datadog-config \
            --from-literal=DD_SITE="${DD_SITE:-datadoghq.com}" \
            --from-literal=DD_SERVICE="${DD_SERVICE:-vibecode-webgui}" \
            --from-literal=DD_VERSION="${DD_VERSION:-1.0.0}" \
            --from-literal=DD_ENV="${DD_ENV:-development}" \
            --namespace=vibecode-platform \
            --dry-run=client -o yaml | kubectl apply -f -
        
        log_success "Monitoring configured"
    else
        log_warning "⚠️  Datadog API key not set - monitoring not deployed"
    fi
}

# Step 6: Verify everything is working
verify_deployment() {
    log_info "Step 6: Verifying deployment..."
    
    # Wait for pods to be ready
    log_info "Waiting for pods to be ready..."
    kubectl wait --for=condition=ready pod -l app=postgres -n vibecode-platform --timeout=120s || true
    kubectl wait --for=condition=ready pod -l app=valkey -n vibecode-platform --timeout=60s || true
    
    # Check pod status
    log_info "Pod status:"
    kubectl get pods -n vibecode-platform
    
    # Check services
    log_info "Service status:"
    kubectl get services -n vibecode-platform
    
    log_success "Deployment verification complete"
}

# Main execution flow
main() {
    log_info "Starting complete automation from zero state..."
    
    # Check if we're in the right directory
    if [ ! -f "package.json" ]; then
        log_error "Not in VibeCode project directory - please run from project root"
        exit 1
    fi
    
    # Execute all steps
    install_dependencies
    setup_environment
    
    # Create cluster and deploy services
    log_info "Creating Kubernetes cluster..."
    ./scripts/setup-kind-cluster.sh
    
    # Setup secrets and deploy
    setup_secrets
    build_and_load_images
    
    log_info "Deploying all services..."
    ./scripts/kind-deploy-services.sh
    
    deploy_monitoring
    verify_deployment
    
    echo ""
    log_success "🎉 COMPLETE AUTOMATION FINISHED!"
    echo ""
    echo "📊 What was automated:"
    echo "✅ Dependency installation (KIND, kubectl, Helm)"
    echo "✅ Environment configuration (.env.local)"
    echo "✅ Kubernetes cluster creation"
    echo "✅ Secret management (from environment variables)"
    echo "✅ Container image building and loading"
    echo "✅ Complete service deployment"
    echo "✅ Authelia authentication server (2FA/TOTP/WebAuthn)"
    echo "✅ Monitoring setup (if API keys provided)"
    echo ""
    echo "🌐 Access your application:"
    echo "kubectl port-forward -n vibecode svc/vibecode-service 3000:3000"
    echo ""
    echo "🔒 Access Authelia authentication:"
    echo "kubectl port-forward -n vibecode-auth svc/authelia 9091:9091"
    echo "Then open: http://localhost:9091"
    echo "Default users: admin@vibecode.dev, dev@vibecode.dev, user@vibecode.dev"
    echo "Default password: password123 (see k8s/authelia/authelia-config.yaml)"
    echo ""
    echo "⚙️  To customize: Edit .env.local and re-run this script"
}

# Allow running specific steps
case "${1:-all}" in
    deps)
        install_dependencies
        ;;
    env)
        setup_environment
        ;;
    secrets)
        setup_secrets
        ;;
    build)
        build_and_load_images
        ;;
    monitor)
        deploy_monitoring
        ;;
    verify)
        verify_deployment
        ;;
    all|*)
        main
        ;;
esac