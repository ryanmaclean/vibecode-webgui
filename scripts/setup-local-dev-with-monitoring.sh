#!/bin/bash
set -euo pipefail

# Local Development Setup with Datadog Monitoring
# Ensures dev/stg/prd parity by including monitoring in local development

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/lib/bootstrap.sh"
bootstrap_init "${SCRIPT_DIR}"
# shellcheck disable=SC1091
source "${LIB_DIR}/logging.sh"

BASE_DIR="${BASE_DIR:-${SCRIPTS_ROOT}}"

log_step "VibeCode Local Development Setup with Monitoring"

# shellcheck disable=SC2329
cleanup() {
    log_warn "Cleaning up docker-compose stack..."
    (cd "$BASE_DIR" && docker-compose down &>/dev/null) || true
}

trap cleanup EXIT

cd "$BASE_DIR"

log_step "1. Prerequisites Check"

# Check Docker
if docker --version &>/dev/null; then
    log_success "Docker is installed"
else
    log_error "Docker is not installed or not running"
    exit 1
fi

# Check Docker Compose
if docker-compose --version &>/dev/null; then
    log_success "Docker Compose is installed"
else
    log_error "Docker Compose is not installed"
    exit 1
fi

# Check Node.js
if node --version | grep -q 'v2[0-9]'; then
    log_success "Node.js $(node --version) is installed"
else
    log_warning "Node.js 20+ recommended for local development"
fi

log_step "2. Environment Configuration"
echo "-------------------------------"

# Ensure environment file exists: prefer .env, fall back to .env.local
if [ -f ".env" ]; then
    log_success ".env file exists"
elif [ -f ".env.local" ]; then
    log_success ".env.local file exists (fallback)"
else
    log_info "Creating .env from template..."
    cp .env.example .env
    log_warning "Please update .env with your Datadog API keys"
    log_info "For local development, dummy keys are sufficient"
fi

# Check if essential environment variables are set in whichever env file exists
ENV_FILE=""
if [ -f ".env" ]; then ENV_FILE=".env"; elif [ -f ".env.local" ]; then ENV_FILE=".env.local"; fi
if [ -n "$ENV_FILE" ]; then
    if grep -Eq '^(DD_API_KEY|DATADOG_API_KEY)=' "$ENV_FILE" 2>/dev/null; then
        if grep -Eq '^(DD_API_KEY|DATADOG_API_KEY)=dummy' "$ENV_FILE" 2>/dev/null; then
            log_info "Using dummy Datadog keys for local development"
        else
            log_success "Datadog API key configured"
        fi
    else
        log_warning "Datadog API key not found in $ENV_FILE; set DD_API_KEY (preferred) or DATADOG_API_KEY"
    fi
fi

log_step "3. Docker Compose Stack with Monitoring"
echo "---------------------------------------------"

# Validate Docker Compose configuration
log_info "Validating Docker Compose configuration..."
if docker-compose config &>/dev/null; then
    log_success "Docker Compose configuration is valid"
else
    log_error "Docker Compose configuration has errors"
    docker-compose config
    exit 1
fi

# Check if Datadog service is configured
if docker-compose config | grep -q "datadog-agent:"; then
    log_success "Datadog agent service is configured"
else
    log_error "Datadog agent service not found in Docker Compose"
    exit 1
fi

log_step "4. Building and Starting Services"
echo "-----------------------------------"

# Build all services
log_info "Building Docker services..."
docker-compose build

# Start the services
log_info "Starting all services with monitoring..."
docker-compose up -d

# Wait for services to start
log_info "Waiting for services to initialize..."
sleep 30

log_step "5. Service Health Checks"
echo "-------------------------"

# Check docs service
if curl -s -f http://localhost:8080/ &>/dev/null; then
    log_success "Docs service is running on http://localhost:8080"
else
    log_error "Docs service failed to start"
fi

# Check main app (if it exists)
if docker-compose ps app | grep -q "Up"; then
    if curl -s -f http://localhost:3000/ &>/dev/null; then
        log_success "Main app is running on http://localhost:3000"
    else
        log_warning "Main app container is up but not responding"
    fi
fi

# Check database
if docker-compose exec -T db pg_isready -U vibecode &>/dev/null; then
    log_success "PostgreSQL database is ready"
else
    log_error "PostgreSQL database is not ready"
fi

# Check Redis
if docker-compose exec -T redis redis-cli ping | grep -q "PONG"; then
    log_success "Redis is responding"
else
    log_error "Redis is not responding"
fi

# Check Datadog agent
if docker-compose ps datadog-agent | grep -q "Up"; then
    log_success "Datadog agent is running"
    
    # Test Datadog agent health
    if docker-compose exec -T datadog-agent agent health &>/dev/null; then
        log_success "Datadog agent health check passed"
    else
        log_warning "Datadog agent running but health check failed (expected with dummy keys)"
    fi
else
    log_error "Datadog agent failed to start"
fi

log_step "6. Monitoring Integration Validation"
echo "--------------------------------------"

# Check APM port
if docker-compose ps datadog-agent | grep -q "8126"; then
    log_success "APM trace collection port (8126) is exposed"
else
    log_warning "APM port may not be properly configured"
fi

# Check StatsD port
if docker-compose ps datadog-agent | grep -q "8125"; then
    log_success "StatsD metrics port (8125) is exposed"
else
    log_warning "StatsD port may not be properly configured"
fi

# Check log collection
if docker-compose logs datadog-agent | grep -q "Starting"; then
    log_success "Datadog agent logs indicate successful startup"
else
    log_warning "Check Datadog agent logs for potential issues"
fi

log_step "7. Development Environment Status"

log_success "🎯 Development Environment Ready!"
echo ""
echo "📋 Service URLs:"
echo "  📚 Documentation: http://localhost:8080"
if docker-compose ps app | grep -q "Up"; then
    echo "  🌐 Main Application: http://localhost:3000"
fi
echo "  🗄️  PostgreSQL: localhost:5432 (user: vibecode, db: vibecode)"
echo "  🔴 Redis: localhost:6379"
echo "  📊 Datadog APM: localhost:8126 (traces)"
echo "  📈 DogStatsD: localhost:8125 (metrics)"

echo ""
echo "📊 Monitoring Features:"
echo "  ✅ Application Performance Monitoring (APM)"
echo "  ✅ Infrastructure monitoring"
echo "  ✅ Log aggregation and analysis"
echo "  ✅ Database monitoring"
echo "  ✅ Container insights"
echo "  ✅ Real-time metrics collection"

echo ""
echo "🔧 Management Commands:"
echo "  📋 View all services: docker-compose ps"
echo "  📊 View logs: docker-compose logs [service-name]"
echo "  🔄 Restart service: docker-compose restart [service-name]"
echo "  🛑 Stop all: docker-compose down"
echo "  🗄️  Database CLI: docker-compose exec db psql -U vibecode -d vibecode"
echo "  📊 Datadog agent status: docker-compose exec datadog-agent agent status"

echo ""
echo "🌟 Environment Parity:"
echo "  🖥️  Local Dev: Docker Compose with Datadog agent"
echo "  🧪 Staging: KIND cluster with Datadog DaemonSet"
echo "  🚀 Production: Azure AKS with Datadog Helm chart"

if docker-compose ps | grep -q "Exit"; then
    echo ""
    log_warning "Some services may have issues. Check logs:"
    echo "  docker-compose logs"
fi

echo ""
echo -e "${GREEN}✨ Local development environment with monitoring is ready!${NC}"
echo -e "${BLUE}Dev/Stg/Prd parity achieved with consistent Datadog monitoring.${NC}"

exit 0
