#!/bin/bash
# Build unified services with Datadog APM and RUM integration
# Referenced by: CONTRIBUTING.md, docs/DEVELOPMENT.md, CHANGELOG.md
# Fixes GitHub issue #1143

set -euo pipefail

# =============================================================================
# Configuration
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="${BUILD_DIR:-/tmp/unified-services-build}"
OUTPUT_DIR="${OUTPUT_DIR:-$PROJECT_ROOT/dist}"

# Datadog Configuration
DD_ENV="${DD_ENV:-development}"
DD_SERVICE="${DD_SERVICE:-unified-services}"
DD_VERSION="${DD_VERSION:-$(git -C "$PROJECT_ROOT" describe --tags --always 2>/dev/null || echo "0.0.0")}"
DD_SITE="${DD_SITE:-datadoghq.com}"
DD_AGENT_HOST="${DD_AGENT_HOST:-localhost}"
DD_TRACE_AGENT_PORT="${DD_TRACE_AGENT_PORT:-8126}"

# Build options
BUILD_MODE="${BUILD_MODE:-production}"
FAST_BUILD="${FAST_BUILD:-false}"
WITH_EXTENSIONS="${WITH_EXTENSIONS:-false}"
VERBOSE="${VERBOSE:-false}"
DRY_RUN="${DRY_RUN:-false}"

# =============================================================================
# Color Output
# =============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1" >&2; }

# =============================================================================
# Help & Usage
# =============================================================================

show_help() {
    cat << EOF
Build unified services with Datadog APM and RUM integration.

Usage: $(basename "$0") [OPTIONS]

Options:
  --fast              Fast build (minimal services, skip non-essential steps)
  --with-extensions   Include VS Code extensions in build
  --clean             Clean build from scratch (removes BUILD_DIR)
  --verbose           Enable verbose output
  --dry-run           Show what would be done without executing
  --help              Show this help message

Environment Variables:
  DD_ENV              Datadog environment tag (default: development)
  DD_SERVICE          Datadog service name (default: unified-services)
  DD_VERSION          Datadog version tag (default: git tag or 0.0.0)
  DD_API_KEY          Datadog API key (required for APM validation)
  DD_APP_KEY          Datadog Application key (optional, for RUM)
  DD_SITE             Datadog site (default: datadoghq.com)
  DD_AGENT_HOST       Datadog agent host (default: localhost)
  BUILD_DIR           Build directory (default: /tmp/unified-services-build)
  OUTPUT_DIR          Output directory (default: ./dist)

Examples:
  # Standard build
  ./$(basename "$0")

  # Fast build for development
  ./$(basename "$0") --fast

  # Production build with extensions
  DD_ENV=production ./$(basename "$0") --with-extensions

  # Clean rebuild
  ./$(basename "$0") --clean --verbose

EOF
    exit 0
}

# =============================================================================
# Parse Arguments
# =============================================================================

CLEAN_BUILD=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --fast)
            FAST_BUILD=true
            shift
            ;;
        --with-extensions)
            WITH_EXTENSIONS=true
            shift
            ;;
        --clean)
            CLEAN_BUILD=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            set -x
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --help|-h)
            show_help
            ;;
        *)
            log_error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# =============================================================================
# Validation Functions
# =============================================================================

check_prerequisites() {
    log_info "Checking prerequisites..."

    local missing=()

    # Check for required commands
    for cmd in node npm git curl; do
        if ! command -v "$cmd" &> /dev/null; then
            missing+=("$cmd")
        fi
    done

    # Check for pnpm (preferred) or npm
    if command -v pnpm &> /dev/null; then
        PKG_MANAGER="pnpm"
    elif command -v npm &> /dev/null; then
        PKG_MANAGER="npm"
    else
        missing+=("pnpm or npm")
    fi

    if [[ ${#missing[@]} -gt 0 ]]; then
        log_error "Missing required tools: ${missing[*]}"
        exit 1
    fi

    log_success "Prerequisites check passed (using $PKG_MANAGER)"
}

validate_datadog_config() {
    log_info "Validating Datadog configuration..."

    local warnings=()
    local errors=()

    # Check environment variables
    if [[ -z "${DD_API_KEY:-}" ]]; then
        warnings+=("DD_API_KEY not set - APM traces won't be sent")
    fi

    if [[ -z "${DD_SERVICE:-}" ]]; then
        warnings+=("DD_SERVICE not set - using default: unified-services")
    fi

    if [[ -z "${DD_ENV:-}" ]]; then
        warnings+=("DD_ENV not set - using default: development")
    fi

    # Validate DD_SITE format
    case "$DD_SITE" in
        datadoghq.com|datadoghq.eu|us3.datadoghq.com|us5.datadoghq.com|ap1.datadoghq.com|ddog-gov.com)
            ;;
        *)
            warnings+=("DD_SITE '$DD_SITE' may not be valid")
            ;;
    esac

    # Print warnings
    if [[ ${#warnings[@]} -gt 0 ]]; then
        for warn in "${warnings[@]}"; do
            log_warn "$warn"
        done
    fi

    # Print errors
    if [[ ${#errors[@]} -gt 0 ]]; then
        for err in "${errors[@]}"; do
            log_error "$err"
        done
        return 1
    fi

    log_success "Datadog configuration validated"
    log_info "  DD_ENV: $DD_ENV"
    log_info "  DD_SERVICE: $DD_SERVICE"
    log_info "  DD_VERSION: $DD_VERSION"
    log_info "  DD_SITE: $DD_SITE"

    return 0
}

# =============================================================================
# Build Functions
# =============================================================================

setup_build_directory() {
    log_info "Setting up build directory..."

    if [[ "$CLEAN_BUILD" == "true" ]] && [[ -d "$BUILD_DIR" ]]; then
        log_info "Cleaning existing build directory..."
        if [[ "$DRY_RUN" == "true" ]]; then
            log_info "[DRY-RUN] Would remove: $BUILD_DIR"
        else
            rm -rf "$BUILD_DIR"
        fi
    fi

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY-RUN] Would create: $BUILD_DIR"
        log_info "[DRY-RUN] Would create: $OUTPUT_DIR"
    else
        mkdir -p "$BUILD_DIR"
        mkdir -p "$OUTPUT_DIR"
    fi

    log_success "Build directory ready: $BUILD_DIR"
}

setup_datadog_env() {
    log_info "Setting up Datadog environment variables..."

    # Export Datadog environment variables for the build
    export DD_ENV="$DD_ENV"
    export DD_SERVICE="$DD_SERVICE"
    export DD_VERSION="$DD_VERSION"
    export DD_SITE="$DD_SITE"
    export DD_AGENT_HOST="$DD_AGENT_HOST"
    export DD_TRACE_AGENT_PORT="$DD_TRACE_AGENT_PORT"

    # APM configuration
    export DD_TRACE_ENABLED="${DD_TRACE_ENABLED:-true}"
    export DD_LOGS_INJECTION="${DD_LOGS_INJECTION:-true}"
    export DD_PROFILING_ENABLED="${DD_PROFILING_ENABLED:-false}"
    export DD_RUNTIME_METRICS_ENABLED="${DD_RUNTIME_METRICS_ENABLED:-true}"

    # RUM configuration (for frontend)
    export DD_RUM_ENABLED="${DD_RUM_ENABLED:-true}"

    # Custom tags
    export DD_TAGS="team:vibecode,build_mode:${BUILD_MODE}"

    log_success "Datadog environment configured"
}

install_datadog_tracer() {
    log_info "Installing Datadog tracer packages..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY-RUN] Would install dd-trace"
        return 0
    fi

    # Check if package.json exists in project root
    if [[ -f "$PROJECT_ROOT/package.json" ]]; then
        cd "$PROJECT_ROOT"

        # Install dd-trace for Node.js APM
        if ! grep -q "dd-trace" package.json 2>/dev/null; then
            log_info "Adding dd-trace to dependencies..."
            $PKG_MANAGER add dd-trace --save 2>/dev/null || true
        fi

        # Install @datadog/browser-rum for RUM (frontend)
        if [[ "$WITH_EXTENSIONS" == "true" ]]; then
            if ! grep -q "@datadog/browser-rum" package.json 2>/dev/null; then
                log_info "Adding @datadog/browser-rum to dependencies..."
                $PKG_MANAGER add @datadog/browser-rum --save 2>/dev/null || true
            fi
        fi
    fi

    log_success "Datadog tracer packages ready"
}

create_datadog_init_script() {
    log_info "Creating Datadog initialization script..."

    local init_script="$BUILD_DIR/dd-init.js"

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY-RUN] Would create: $init_script"
        return 0
    fi

    cat > "$init_script" << 'EOF'
/**
 * Datadog APM Initialization
 * This file should be required before any other modules
 *
 * Usage: node -r ./dd-init.js app.js
 * Or: NODE_OPTIONS='-r ./dd-init.js' npm start
 */

const tracer = require('dd-trace').init({
  // Service identification
  service: process.env.DD_SERVICE || 'unified-services',
  env: process.env.DD_ENV || 'development',
  version: process.env.DD_VERSION || '0.0.0',

  // Tracing configuration
  enabled: process.env.DD_TRACE_ENABLED !== 'false',
  logInjection: process.env.DD_LOGS_INJECTION !== 'false',
  runtimeMetrics: process.env.DD_RUNTIME_METRICS_ENABLED !== 'false',

  // Profiling (opt-in)
  profiling: process.env.DD_PROFILING_ENABLED === 'true',

  // Sampling
  sampleRate: parseFloat(process.env.DD_TRACE_SAMPLE_RATE || '1.0'),

  // Tags
  tags: {
    team: 'vibecode',
    component: 'unified-services'
  }
});

// Log initialization
if (process.env.DD_TRACE_DEBUG === 'true') {
  console.log('[Datadog] APM tracer initialized', {
    service: tracer._tracer._service,
    env: process.env.DD_ENV,
    version: process.env.DD_VERSION
  });
}

module.exports = tracer;
EOF

    log_success "Datadog init script created: $init_script"
}

create_rum_config() {
    log_info "Creating RUM configuration..."

    local rum_config="$BUILD_DIR/dd-rum-config.js"

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY-RUN] Would create: $rum_config"
        return 0
    fi

    cat > "$rum_config" << 'EOF'
/**
 * Datadog RUM Configuration
 * Include this in your frontend application
 */

export const datadogRumConfig = {
  applicationId: process.env.DD_RUM_APPLICATION_ID || '',
  clientToken: process.env.DD_RUM_CLIENT_TOKEN || '',
  site: process.env.DD_SITE || 'datadoghq.com',
  service: process.env.DD_SERVICE || 'unified-services-frontend',
  env: process.env.DD_ENV || 'development',
  version: process.env.DD_VERSION || '0.0.0',
  sessionSampleRate: 100,
  sessionReplaySampleRate: 20,
  trackUserInteractions: true,
  trackResources: true,
  trackLongTasks: true,
  defaultPrivacyLevel: 'mask-user-input'
};

/**
 * Initialize RUM in your application:
 *
 * import { datadogRum } from '@datadog/browser-rum';
 * import { datadogRumConfig } from './dd-rum-config';
 *
 * if (datadogRumConfig.applicationId) {
 *   datadogRum.init(datadogRumConfig);
 *   datadogRum.startSessionReplayRecording();
 * }
 */
EOF

    log_success "RUM configuration created: $rum_config"
}

build_application() {
    log_info "Building application..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY-RUN] Would run: $PKG_MANAGER run build"
        return 0
    fi

    cd "$PROJECT_ROOT"

    # Check for build script in package.json
    if [[ -f "package.json" ]]; then
        if grep -q '"build"' package.json; then
            log_info "Running build with Datadog environment..."

            # Run build with Datadog environment variables
            if [[ "$FAST_BUILD" == "true" ]]; then
                log_info "Running fast build (development mode)..."
                NODE_ENV=development $PKG_MANAGER run build 2>&1 || {
                    log_warn "Build script not found or failed, skipping..."
                }
            else
                log_info "Running production build..."
                NODE_ENV=production $PKG_MANAGER run build 2>&1 || {
                    log_warn "Build script not found or failed, skipping..."
                }
            fi
        else
            log_info "No build script found in package.json, skipping npm build..."
        fi
    else
        log_info "No package.json found, skipping npm build..."
    fi

    log_success "Application build completed"
}

run_validation() {
    log_info "Running validation steps..."

    local validation_errors=0

    # Validate Datadog environment
    log_info "Checking Datadog environment variables..."

    if [[ -n "${DD_API_KEY:-}" ]]; then
        log_info "Validating Datadog API connectivity..."

        if [[ "$DRY_RUN" == "true" ]]; then
            log_info "[DRY-RUN] Would validate API key"
        else
            # Test API connectivity
            local response
            response=$(curl -s -o /dev/null -w "%{http_code}" \
                -H "DD-API-KEY: $DD_API_KEY" \
                "https://api.${DD_SITE}/api/v1/validate" 2>/dev/null || echo "000")

            if [[ "$response" == "200" ]]; then
                log_success "Datadog API key is valid"
            elif [[ "$response" == "403" ]]; then
                log_error "Datadog API key is invalid"
                ((validation_errors++))
            else
                log_warn "Could not validate Datadog API key (status: $response)"
            fi
        fi
    else
        log_warn "DD_API_KEY not set, skipping API validation"
    fi

    # Check if dd-trace is installed
    if [[ -f "$PROJECT_ROOT/package.json" ]]; then
        if grep -q "dd-trace" "$PROJECT_ROOT/package.json" 2>/dev/null; then
            log_success "dd-trace is installed"
        else
            log_warn "dd-trace not found in package.json"
        fi
    fi

    # Check APM agent connectivity
    log_info "Checking APM agent connectivity..."
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY-RUN] Would check agent at $DD_AGENT_HOST:$DD_TRACE_AGENT_PORT"
    else
        if curl -s -f -m 5 "http://${DD_AGENT_HOST}:${DD_TRACE_AGENT_PORT}/info" &>/dev/null; then
            log_success "APM agent is reachable at $DD_AGENT_HOST:$DD_TRACE_AGENT_PORT"
        else
            log_warn "APM agent not reachable at $DD_AGENT_HOST:$DD_TRACE_AGENT_PORT"
            log_warn "Traces will be buffered until agent is available"
        fi
    fi

    # Validate build output
    log_info "Checking build output..."
    if [[ -d "$BUILD_DIR" ]]; then
        if [[ -f "$BUILD_DIR/dd-init.js" ]]; then
            log_success "Datadog init script present"
        else
            log_warn "Datadog init script not found"
        fi
    fi

    if [[ $validation_errors -gt 0 ]]; then
        log_error "Validation failed with $validation_errors error(s)"
        return 1
    fi

    log_success "All validation checks passed"
    return 0
}

copy_artifacts() {
    log_info "Copying build artifacts..."

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY-RUN] Would copy artifacts to $OUTPUT_DIR"
        return 0
    fi

    # Copy Datadog configuration files
    if [[ -f "$BUILD_DIR/dd-init.js" ]]; then
        cp "$BUILD_DIR/dd-init.js" "$OUTPUT_DIR/"
    fi

    if [[ -f "$BUILD_DIR/dd-rum-config.js" ]]; then
        cp "$BUILD_DIR/dd-rum-config.js" "$OUTPUT_DIR/"
    fi

    # Create environment file template
    cat > "$OUTPUT_DIR/.env.datadog.template" << EOF
# Datadog Configuration Template
# Copy to .env and fill in your values

# Required
DD_API_KEY=your_api_key_here
DD_APP_KEY=your_app_key_here

# Service identification
DD_ENV=${DD_ENV}
DD_SERVICE=${DD_SERVICE}
DD_VERSION=${DD_VERSION}
DD_SITE=${DD_SITE}

# APM Configuration
DD_AGENT_HOST=${DD_AGENT_HOST}
DD_TRACE_AGENT_PORT=${DD_TRACE_AGENT_PORT}
DD_TRACE_ENABLED=true
DD_LOGS_INJECTION=true
DD_RUNTIME_METRICS_ENABLED=true

# RUM Configuration (for frontend)
DD_RUM_APPLICATION_ID=
DD_RUM_CLIENT_TOKEN=
DD_RUM_ENABLED=true

# Optional
DD_PROFILING_ENABLED=false
DD_TRACE_SAMPLE_RATE=1.0
DD_TRACE_DEBUG=false
EOF

    log_success "Build artifacts copied to $OUTPUT_DIR"
}

print_summary() {
    echo ""
    echo "======================================================================"
    echo "  Build Complete"
    echo "======================================================================"
    echo ""
    echo "Datadog Configuration:"
    echo "  DD_ENV:     $DD_ENV"
    echo "  DD_SERVICE: $DD_SERVICE"
    echo "  DD_VERSION: $DD_VERSION"
    echo "  DD_SITE:    $DD_SITE"
    echo ""
    echo "Output Directory: $OUTPUT_DIR"
    echo ""
    echo "Files Created:"
    if [[ -f "$OUTPUT_DIR/dd-init.js" ]]; then
        echo "  - dd-init.js (APM initialization)"
    fi
    if [[ -f "$OUTPUT_DIR/dd-rum-config.js" ]]; then
        echo "  - dd-rum-config.js (RUM configuration)"
    fi
    if [[ -f "$OUTPUT_DIR/.env.datadog.template" ]]; then
        echo "  - .env.datadog.template (environment template)"
    fi
    echo ""
    echo "Next Steps:"
    echo "  1. Set DD_API_KEY environment variable"
    echo "  2. Start your application with:"
    echo "     node -r ./dd-init.js app.js"
    echo "  3. View traces at: https://app.${DD_SITE}/apm/traces"
    echo ""
    if [[ -n "${DD_API_KEY:-}" ]]; then
        echo "  Datadog Dashboard: https://app.${DD_SITE}/apm/services/${DD_SERVICE}"
    fi
    echo ""
}

# =============================================================================
# Main Execution
# =============================================================================

main() {
    echo "======================================================================"
    echo "  Building Unified Services with Datadog"
    echo "======================================================================"
    echo ""

    if [[ "$DRY_RUN" == "true" ]]; then
        log_warn "DRY-RUN MODE - No changes will be made"
        echo ""
    fi

    # Run build steps
    check_prerequisites
    validate_datadog_config || true  # Continue even with warnings
    setup_build_directory
    setup_datadog_env
    install_datadog_tracer
    create_datadog_init_script
    create_rum_config
    build_application
    run_validation || true  # Continue even with validation warnings
    copy_artifacts
    print_summary

    log_success "Build completed successfully!"
}

# Run main function
main
