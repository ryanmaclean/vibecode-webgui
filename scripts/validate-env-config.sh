#!/usr/bin/env bash
# =============================================================================
# VibeCode Configuration Validation Script
# =============================================================================
# Purpose: Validate .env.example completeness and check for missing variables
# Version: 1.0.0
# =============================================================================

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $*"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

echo "============================================================================="
echo "Configuration Validation Report"
echo "============================================================================="
echo ""

# Check if .env.example exists
if [ ! -f ".env.example" ]; then
    log_error ".env.example not found"
    exit 1
fi

log_success ".env.example found"

# Count variables
total_vars=$(grep -c "^[A-Z_].*=" .env.example || true)
log_info "Total variables defined: $total_vars"

# Check for required sections
echo ""
log_info "Checking required sections..."
required_sections=(
    "Runtime"
    "Database & Caching"
    "Primary AI Provider"
    "Observability & Datadog"
    "Authentication Providers"
    "Security & Rate Limiting"
)

missing_sections=()
for section in "${required_sections[@]}"; do
    if grep -q "# $section" .env.example; then
        log_success "✓ $section"
    else
        log_error "✗ $section"
        missing_sections+=("$section")
    fi
done

# Check for sensitive variables
echo ""
log_info "Checking for placeholder values..."
sensitive_vars=(
    "NEXTAUTH_SECRET"
    "DATABASE_URL"
    "OPENAI_API_KEY"
    "DD_API_KEY"
)

for var in "${sensitive_vars[@]}"; do
    if grep -q "^${var}=" .env.example; then
        value=$(grep "^${var}=" .env.example | cut -d= -f2)
        if [[ "$value" == *"your-"* ]] || [[ "$value" == *"change-me"* ]] || [ -z "$value" ]; then
            log_success "✓ $var has placeholder value"
        else
            log_warning "⚠ $var may contain real value: $value"
        fi
    else
        log_warning "⚠ $var not found in .env.example"
    fi
done

# Summary
echo ""
echo "============================================================================="
if [ ${#missing_sections[@]} -eq 0 ]; then
    log_success "Validation passed: .env.example is ready for migration"
    exit 0
else
    log_error "Validation failed: Missing ${#missing_sections[@]} required sections"
    exit 1
fi
