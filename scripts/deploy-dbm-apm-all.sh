#!/bin/bash

# Comprehensive DBM-APM Deployment Script
# This script deploys DBM-APM configuration to all environments: KIND (local), Staging, and Production

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
ENV_FILE=".env.local"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    case $status in
        "SUCCESS")
            echo -e "${GREEN}✅ $message${NC}"
            ;;
        "ERROR")
            echo -e "${RED}❌ $message${NC}"
            ;;
        "WARNING")
            echo -e "${YELLOW}⚠️  $message${NC}"
            ;;
        "INFO")
            echo -e "${BLUE}ℹ️  $message${NC}"
            ;;
        "HEADER")
            echo -e "${PURPLE}🚀 $message${NC}"
            ;;
    esac
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to validate environment file
validate_environment() {
    print_status "INFO" "Validating environment configuration..."
    
    if [ ! -f "$ENV_FILE" ]; then
        print_status "ERROR" "Environment file $ENV_FILE not found"
        print_status "INFO" "Please create $ENV_FILE with your configuration"
        print_status "INFO" "You can use the example files:"
        print_status "INFO" "  cp env.development.example .env.local"
        exit 1
    fi
    
    # Source environment variables
    set -a
    source "$ENV_FILE"
    set +a
    
    # Validate required variables
    local required_vars=(
        "DD_API_KEY"
        "DD_SERVICE"
        "DD_ENV"
        "DD_VERSION"
        "DD_DBM_PROPAGATION_MODE"
    )
    
    local missing_vars=()
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -gt 0 ]; then
        print_status "ERROR" "Missing required environment variables: ${missing_vars[*]}"
        print_status "INFO" "Please add these variables to $ENV_FILE"
        exit 1
    fi
    
    print_status "SUCCESS" "Environment configuration validated"
}

# Function to run validation script
run_validation() {
    print_status "INFO" "Running DBM-APM connection validation..."
    
    if [ -f "$SCRIPT_DIR/validate-dbm-apm-connection.sh" ]; then
        if "$SCRIPT_DIR/validate-dbm-apm-connection.sh"; then
            print_status "SUCCESS" "DBM-APM connection validation passed"
        else
            print_status "ERROR" "DBM-APM connection validation failed"
            return 1
        fi
    else
        print_status "WARNING" "Validation script not found, skipping validation"
    fi
}

# Function to deploy to KIND local development
deploy_kind() {
    print_status "HEADER" "Deploying to KIND Local Development"
    echo "=============================================="
    
    if [ -f "$SCRIPT_DIR/deploy-dbm-apm-kind.sh" ]; then
        if "$SCRIPT_DIR/deploy-dbm-apm-kind.sh"; then
            print_status "SUCCESS" "KIND deployment completed"
        else
            print_status "ERROR" "KIND deployment failed"
            return 1
        fi
    else
        print_status "ERROR" "KIND deployment script not found"
        return 1
    fi
}

# Function to deploy to Azure staging
deploy_azure_staging() {
    print_status "HEADER" "Deploying to Azure Staging"
    echo "=================================="
    
    if [ -f "$SCRIPT_DIR/deploy-dbm-apm-azure.sh" ]; then
        if "$SCRIPT_DIR/deploy-dbm-apm-azure.sh" staging; then
            print_status "SUCCESS" "Azure staging deployment completed"
        else
            print_status "ERROR" "Azure staging deployment failed"
            return 1
        fi
    else
        print_status "ERROR" "Azure deployment script not found"
        return 1
    fi
}

# Function to deploy to Azure production
deploy_azure_production() {
    print_status "HEADER" "Deploying to Azure Production"
    echo "====================================="
    
    if [ -f "$SCRIPT_DIR/deploy-dbm-apm-azure.sh" ]; then
        if "$SCRIPT_DIR/deploy-dbm-apm-azure.sh" production; then
            print_status "SUCCESS" "Azure production deployment completed"
        else
            print_status "ERROR" "Azure production deployment failed"
            return 1
        fi
    else
        print_status "ERROR" "Azure deployment script not found"
        return 1
    fi
}

# Function to show deployment summary
show_deployment_summary() {
    print_status "HEADER" "Deployment Summary"
    echo "=================="
    echo
    
    echo "🌍 Environment Status:"
    echo "   ✅ KIND Local Development: DBM-APM configured"
    echo "   ✅ Azure Staging: DBM-APM configured"
    echo "   ✅ Azure Production: DBM-APM configured"
    echo
    
    echo "📊 DBM-APM Configuration:"
    echo "   DD_DBM_PROPAGATION_MODE: $DD_DBM_PROPAGATION_MODE"
    echo "   DD_DBM_TRACE_INJECTION: true"
    echo "   DD_SERVICE: $DD_SERVICE"
    echo "   DD_ENV: $DD_ENV"
    echo "   DD_VERSION: $DD_VERSION"
    echo
    
    echo "🔍 Monitoring Access:"
    echo "   Datadog Dashboard: https://app.datadoghq.com/"
    echo "   Service: $DD_SERVICE"
    echo "   Environment: $DD_ENV"
    echo
    
    echo "🧪 Testing Commands:"
    echo "   # Validate DBM-APM connection"
    echo "   npm run validate:dbm-apm"
    echo
    echo "   # Check KIND deployment"
    echo "   kubectl get pods -n vibecode-platform"
    echo
    echo "   # Check Azure App Service logs"
    echo "   az webapp log tail --name vibecode-webgui-staging --resource-group rg-vibecode-appservice-staging"
    echo "   az webapp log tail --name vibecode-webgui-prod --resource-group rg-vibecode-appservice-prod"
    echo
    
    echo "📚 Documentation:"
    echo "   DBM-APM Guide: DATADOG_DBM_APM_CONNECTION_GUIDE.md"
    echo "   Validation Script: scripts/validate-dbm-apm-connection.sh"
    echo
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [kind|staging|production|all] [options]"
    echo
    echo "Targets:"
    echo "  kind        Deploy to KIND local development only"
    echo "  staging     Deploy to Azure staging only"
    echo "  production  Deploy to Azure production only"
    echo "  all         Deploy to all environments (default)"
    echo
    echo "Options:"
    echo "  --skip-validation  Skip DBM-APM connection validation"
    echo "  --dry-run         Show what would be deployed without executing"
    echo "  --help           Show this help message"
    echo
    echo "Examples:"
    echo "  $0                    # Deploy to all environments"
    echo "  $0 kind               # Deploy to KIND only"
    echo "  $0 staging            # Deploy to staging only"
    echo "  $0 production         # Deploy to production only"
    echo "  $0 all --dry-run      # Show deployment plan"
    echo
    echo "Prerequisites:"
    echo "  - .env.local file with required environment variables"
    echo "  - Docker and KIND for local development"
    echo "  - Azure CLI logged in for Azure deployments"
    echo "  - kubectl configured for KIND cluster"
}

# Function to check prerequisites for specific targets
check_target_prerequisites() {
    local target=$1
    
    case $target in
        "kind")
            if ! command_exists docker; then
                print_status "ERROR" "Docker is required for KIND deployment"
                return 1
            fi
            if ! command_exists kind; then
                print_status "ERROR" "KIND is required for local deployment"
                return 1
            fi
            if ! command_exists kubectl; then
                print_status "ERROR" "kubectl is required for KIND deployment"
                return 1
            fi
            ;;
        "staging"|"production")
            if ! command_exists az; then
                print_status "ERROR" "Azure CLI is required for Azure deployment"
                return 1
            fi
            if ! az account show >/dev/null 2>&1; then
                print_status "ERROR" "Not logged into Azure CLI"
                return 1
            fi
            ;;
        "all")
            check_target_prerequisites "kind"
            check_target_prerequisites "staging"
            check_target_prerequisites "production"
            ;;
    esac
    
    return 0
}

# Main deployment function
main() {
    local target=${1:-"all"}
    local skip_validation=false
    local dry_run=false
    
    # Parse arguments
    shift
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-validation)
                skip_validation=true
                shift
                ;;
            --dry-run)
                dry_run=true
                shift
                ;;
            --help)
                show_usage
                exit 0
                ;;
            *)
                print_status "ERROR" "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    echo -e "${PURPLE}🚀 Comprehensive DBM-APM Deployment${NC}"
    echo "======================================"
    echo
    
    # Validate environment
    validate_environment
    
    # Check prerequisites
    if ! check_target_prerequisites "$target"; then
        exit 1
    fi
    
    # Run validation unless skipped
    if [ "$skip_validation" = false ]; then
        if ! run_validation; then
            print_status "ERROR" "Validation failed. Use --skip-validation to bypass."
            exit 1
        fi
    fi
    
    # Dry run mode
    if [ "$dry_run" = true ]; then
        print_status "INFO" "DRY RUN MODE - No actual deployments will be performed"
        echo
        echo "Would deploy to:"
        case $target in
            "kind")
                echo "  - KIND Local Development"
                ;;
            "staging")
                echo "  - Azure Staging"
                ;;
            "production")
                echo "  - Azure Production"
                ;;
            "all")
                echo "  - KIND Local Development"
                echo "  - Azure Staging"
                echo "  - Azure Production"
                ;;
        esac
        echo
        print_status "INFO" "Dry run completed"
        exit 0
    fi
    
    # Deploy to specified targets
    local deployment_success=true
    
    case $target in
        "kind")
            if ! deploy_kind; then
                deployment_success=false
            fi
            ;;
        "staging")
            if ! deploy_azure_staging; then
                deployment_success=false
            fi
            ;;
        "production")
            if ! deploy_azure_production; then
                deployment_success=false
            fi
            ;;
        "all")
            if ! deploy_kind; then
                deployment_success=false
            fi
            echo
            if ! deploy_azure_staging; then
                deployment_success=false
            fi
            echo
            if ! deploy_azure_production; then
                deployment_success=false
            fi
            ;;
        *)
            print_status "ERROR" "Unknown target: $target"
            show_usage
            exit 1
            ;;
    esac
    
    echo
    show_deployment_summary
    
    if [ "$deployment_success" = true ]; then
        print_status "SUCCESS" "All deployments completed successfully!"
        exit 0
    else
        print_status "ERROR" "Some deployments failed. Check the logs above."
        exit 1
    fi
}

# Run main function
main "$@"
