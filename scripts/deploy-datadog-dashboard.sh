#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Deploy Datadog AI Operations Monitoring Dashboard
# Uses Datadog API to create or update the AI operations dashboard

# Initialize log aggregation
init_log_aggregation

set -euo pipefail

# Source Datadog logging library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/datadog-logging.sh"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
    dd_info "$1" "script:deploy-datadog-dashboard"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
    dd_warn "$1" "script:deploy-datadog-dashboard"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    dd_error "$1" "script:deploy-datadog-dashboard"
    exit 1
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
    dd_info "$1" "script:deploy-datadog-dashboard"
}

# Script configuration
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DASHBOARD_FILE="$PROJECT_ROOT/config/datadog/ai-operations-dashboard.json"
BACKUP_DIR="$PROJECT_ROOT/config/datadog/.backups"

# API configuration
DD_SITE="${DD_SITE:-datadoghq.com}"
DD_API_KEY="${DD_API_KEY:-}"
DD_APP_KEY="${DD_APP_KEY:-}"
DASHBOARD_ID="${DASHBOARD_ID:-}"
DRY_RUN="${DRY_RUN:-false}"
FORCE="${FORCE:-false}"

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."

    if ! command -v curl &> /dev/null; then
        error "curl is required but not installed"
    fi

    if ! command -v jq &> /dev/null; then
        error "jq is required but not installed. Install with: brew install jq (macOS) or apt-get install jq (Linux)"
    fi

    if [ ! -f "$DASHBOARD_FILE" ]; then
        error "Dashboard file not found: $DASHBOARD_FILE"
    fi

    # Validate JSON
    if ! jq empty "$DASHBOARD_FILE" 2>/dev/null; then
        error "Dashboard file contains invalid JSON: $DASHBOARD_FILE"
    fi

    log "Prerequisites check passed ✅"
}

# Validate API credentials
validate_credentials() {
    log "Validating API credentials..."

    if [ -z "$DD_API_KEY" ]; then
        error "DD_API_KEY environment variable is required"
    fi

    if [ -z "$DD_APP_KEY" ]; then
        error "DD_APP_KEY environment variable is required"
    fi

    # Mask keys for display
    local masked_api_key="${DD_API_KEY:0:10}..."
    local masked_app_key="${DD_APP_KEY:0:10}..."

    info "DD_API_KEY: $masked_api_key"
    info "DD_APP_KEY: $masked_app_key"
    info "DD_SITE: $DD_SITE"

    log "API credentials validated ✅"
}

# Check if dashboard already exists
check_existing_dashboard() {
    log "Checking for existing dashboard..."

    local response
    response=$(curl -s -w "\n%{http_code}" \
        -X GET "https://api.$DD_SITE/api/v1/dashboard" \
        -H "DD-API-KEY: $DD_API_KEY" \
        -H "DD-APPLICATION-KEY: $DD_APP_KEY")

    local http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | sed '$d')

    if [ "$http_code" != "200" ]; then
        warn "Failed to list dashboards (HTTP $http_code). Proceeding with creation..."
        return 1
    fi

    # Search for existing "VibeCode AI Operations Monitoring" dashboard
    local existing_id=$(echo "$body" | jq -r '.dashboards[] | select(.title == "VibeCode AI Operations Monitoring") | .id' | head -n1)

    if [ -n "$existing_id" ] && [ "$existing_id" != "null" ]; then
        info "Found existing dashboard with ID: $existing_id"
        DASHBOARD_ID="$existing_id"
        return 0
    else
        info "No existing dashboard found"
        return 1
    fi
}

# Backup existing dashboard
backup_dashboard() {
    local dashboard_id="$1"

    log "Backing up existing dashboard..."

    mkdir -p "$BACKUP_DIR"

    local backup_file="$BACKUP_DIR/ai-operations-dashboard-${dashboard_id}-$(date +%Y%m%d-%H%M%S).json"

    local response
    response=$(curl -s -w "\n%{http_code}" \
        -X GET "https://api.$DD_SITE/api/v1/dashboard/$dashboard_id" \
        -H "DD-API-KEY: $DD_API_KEY" \
        -H "DD-APPLICATION-KEY: $DD_APP_KEY")

    local http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | sed '$d')

    if [ "$http_code" = "200" ]; then
        echo "$body" | jq '.' > "$backup_file"
        log "Dashboard backed up to: $backup_file ✅"
        echo "$backup_file"
    else
        warn "Failed to backup dashboard (HTTP $http_code)"
        return 1
    fi
}

# Create new dashboard
create_dashboard() {
    log "Creating new dashboard..."

    if [ "$DRY_RUN" = "true" ]; then
        info "DRY RUN: Would create dashboard from $DASHBOARD_FILE"
        info "Dashboard JSON validated successfully"
        return 0
    fi

    local response
    response=$(curl -s -w "\n%{http_code}" \
        -X POST "https://api.$DD_SITE/api/v1/dashboard" \
        -H "Content-Type: application/json" \
        -H "DD-API-KEY: $DD_API_KEY" \
        -H "DD-APPLICATION-KEY: $DD_APP_KEY" \
        -d @"$DASHBOARD_FILE")

    local http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | sed '$d')

    if [ "$http_code" = "200" ]; then
        DASHBOARD_ID=$(echo "$body" | jq -r '.id')
        local dashboard_url="https://app.$DD_SITE/dashboard/$DASHBOARD_ID"
        log "Dashboard created successfully! ✅"
        info "Dashboard ID: $DASHBOARD_ID"
        info "Dashboard URL: $dashboard_url"
        dd_metric "datadog.dashboard.created" "1" "count" "dashboard:ai-operations"
        echo "$dashboard_url"
        return 0
    else
        error "Failed to create dashboard (HTTP $http_code): $(echo "$body" | jq -r '.errors[]? // .error? // .')"
    fi
}

# Update existing dashboard
update_dashboard() {
    local dashboard_id="$1"

    log "Updating existing dashboard (ID: $dashboard_id)..."

    if [ "$DRY_RUN" = "true" ]; then
        info "DRY RUN: Would update dashboard $dashboard_id from $DASHBOARD_FILE"
        info "Dashboard JSON validated successfully"
        return 0
    fi

    # Backup before update
    local backup_file
    backup_file=$(backup_dashboard "$dashboard_id") || warn "Failed to backup dashboard before update"

    local response
    response=$(curl -s -w "\n%{http_code}" \
        -X PUT "https://api.$DD_SITE/api/v1/dashboard/$dashboard_id" \
        -H "Content-Type: application/json" \
        -H "DD-API-KEY: $DD_API_KEY" \
        -H "DD-APPLICATION-KEY: $DD_APP_KEY" \
        -d @"$DASHBOARD_FILE")

    local http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | sed '$d')

    if [ "$http_code" = "200" ]; then
        local dashboard_url="https://app.$DD_SITE/dashboard/$dashboard_id"
        log "Dashboard updated successfully! ✅"
        info "Dashboard ID: $dashboard_id"
        info "Dashboard URL: $dashboard_url"
        if [ -n "$backup_file" ]; then
            info "Backup saved to: $backup_file"
        fi
        dd_metric "datadog.dashboard.updated" "1" "count" "dashboard:ai-operations"
        echo "$dashboard_url"
        return 0
    else
        error "Failed to update dashboard (HTTP $http_code): $(echo "$body" | jq -r '.errors[]? // .error? // .')"
        if [ -n "$backup_file" ]; then
            warn "You can restore from backup: $backup_file"
        fi
    fi
}

# Rollback to previous version
rollback_dashboard() {
    local backup_file="$1"

    if [ -z "$DASHBOARD_ID" ]; then
        error "No dashboard ID specified for rollback"
    fi

    if [ ! -f "$backup_file" ]; then
        error "Backup file not found: $backup_file"
    fi

    log "Rolling back dashboard to backup: $backup_file"

    local response
    response=$(curl -s -w "\n%{http_code}" \
        -X PUT "https://api.$DD_SITE/api/v1/dashboard/$DASHBOARD_ID" \
        -H "Content-Type: application/json" \
        -H "DD-API-KEY: $DD_API_KEY" \
        -H "DD-APPLICATION-KEY: $DD_APP_KEY" \
        -d @"$backup_file")

    local http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | sed '$d')

    if [ "$http_code" = "200" ]; then
        log "Dashboard rolled back successfully! ✅"
        dd_metric "datadog.dashboard.rollback" "1" "count" "dashboard:ai-operations"
        return 0
    else
        error "Failed to rollback dashboard (HTTP $http_code): $(echo "$body" | jq -r '.errors[]? // .error? // .')"
    fi
}

# Validate dashboard JSON in dry-run mode
validate_dashboard_json() {
    log "Validating dashboard JSON..."

    # Check if file exists
    if [ ! -f "$DASHBOARD_FILE" ]; then
        error "Dashboard file not found: $DASHBOARD_FILE"
    fi

    # Validate JSON syntax
    if ! jq empty "$DASHBOARD_FILE" 2>/dev/null; then
        error "Dashboard file contains invalid JSON: $DASHBOARD_FILE"
    fi

    # Check required fields
    local title=$(jq -r '.title // empty' "$DASHBOARD_FILE")
    local widgets=$(jq -r '.widgets // empty' "$DASHBOARD_FILE")

    if [ -z "$title" ]; then
        error "Dashboard JSON missing required field: title"
    fi

    if [ -z "$widgets" ]; then
        error "Dashboard JSON missing required field: widgets"
    fi

    local widget_count=$(jq '.widgets | length' "$DASHBOARD_FILE")
    info "Dashboard title: $title"
    info "Widget count: $widget_count"

    log "Dashboard JSON validated successfully ✅"
}

# Main deployment function
main() {
    log "Starting Datadog AI Operations Monitoring Dashboard Deployment"
    echo

    check_prerequisites

    # For dry-run mode, only validate JSON without needing credentials
    if [ "$DRY_RUN" = "true" ]; then
        validate_dashboard_json
        echo
        log "Dry run validation completed successfully! 🚀"
        info "Dashboard JSON validated successfully"
        return 0
    fi

    validate_credentials

    if check_existing_dashboard; then
        if [ "$FORCE" = "true" ]; then
            update_dashboard "$DASHBOARD_ID"
        else
            warn "Dashboard already exists (ID: $DASHBOARD_ID)"
            echo
            info "To update the existing dashboard, run with --force flag"
            info "Dashboard URL: https://app.$DD_SITE/dashboard/$DASHBOARD_ID"
            exit 0
        fi
    else
        create_dashboard
    fi

    echo
    log "Deployment completed successfully! 🚀"
}

# Script usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo
    echo "Deploy or update Datadog AI Operations Monitoring dashboard"
    echo
    echo "Required environment variables (except for --dry-run):"
    echo "  DD_API_KEY     Datadog API key"
    echo "  DD_APP_KEY     Datadog Application key"
    echo
    echo "Options:"
    echo "  -f, --force           Force update if dashboard already exists"
    echo "  -d, --dry-run         Validate dashboard JSON without deploying"
    echo "  -s, --site SITE       Datadog site (default: datadoghq.com)"
    echo "  -r, --rollback FILE   Rollback to a previous dashboard backup"
    echo "  -h, --help            Show this help message"
    echo
    echo "Examples:"
    echo "  # Validate dashboard JSON (no API keys required)"
    echo "  $0 --dry-run"
    echo
    echo "  # Create or check dashboard"
    echo "  DD_API_KEY=xxx DD_APP_KEY=yyy $0"
    echo
    echo "  # Force update existing dashboard"
    echo "  DD_API_KEY=xxx DD_APP_KEY=yyy $0 --force"
    echo
    echo "  # Rollback to previous version"
    echo "  DD_API_KEY=xxx DD_APP_KEY=yyy $0 --rollback config/datadog/.backups/ai-operations-dashboard-xyz-20260214-120000.json"
    echo
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--force)
            FORCE="true"
            shift
            ;;
        -d|--dry-run)
            DRY_RUN="true"
            shift
            ;;
        -s|--site)
            DD_SITE="$2"
            shift 2
            ;;
        -r|--rollback)
            ROLLBACK_FILE="$2"
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

# Handle rollback if requested
if [ -n "${ROLLBACK_FILE:-}" ]; then
    log "Rollback mode activated"
    validate_credentials

    # Extract dashboard ID from backup filename if not set
    if [ -z "$DASHBOARD_ID" ]; then
        DASHBOARD_ID=$(basename "$ROLLBACK_FILE" | sed -E 's/ai-operations-dashboard-([^-]+)-.*/\1/')
        if [ -z "$DASHBOARD_ID" ]; then
            error "Could not extract dashboard ID from backup filename. Set DASHBOARD_ID environment variable."
        fi
        info "Extracted dashboard ID from filename: $DASHBOARD_ID"
    fi

    rollback_dashboard "$ROLLBACK_FILE"
    exit 0
fi

# Run main function
main "$@"
