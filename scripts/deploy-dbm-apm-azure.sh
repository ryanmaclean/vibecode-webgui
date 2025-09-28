#!/bin/bash

# Deploy DBM-APM Configuration to Azure App Service Environments
# This script deploys the updated DBM-APM configuration to staging and production Azure App Service

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENV_FILE=".env.local"
STAGING_RG="rg-vibecode-appservice-staging"
PRODUCTION_RG="rg-vibecode-appservice-prod"
STAGING_APP="vibecode-webgui-staging"
PRODUCTION_APP="vibecode-webgui-prod"

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
    esac
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check prerequisites
check_prerequisites() {
    print_status "INFO" "Checking prerequisites..."
    
    local missing_tools=()
    
    if ! command_exists az; then
        missing_tools+=("az")
    fi
    
    if ! command_exists jq; then
        missing_tools+=("jq")
    fi
    
    if [ ${#missing_tools[@]} -gt 0 ]; then
        print_status "ERROR" "Missing required tools: ${missing_tools[*]}"
        print_status "INFO" "Please install the missing tools and try again."
        exit 1
    fi
    
    # Check Azure CLI login
    if ! az account show >/dev/null 2>&1; then
        print_status "ERROR" "Not logged into Azure CLI"
        print_status "INFO" "Please run: az login"
        exit 1
    fi
    
    print_status "SUCCESS" "All prerequisites are available"
}

# Function to load environment variables
load_environment() {
    print_status "INFO" "Loading environment variables..."
    
    if [ -f "$ENV_FILE" ]; then
        print_status "SUCCESS" "Found $ENV_FILE"
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
            print_status "WARNING" "Missing environment variables: ${missing_vars[*]}"
            print_status "INFO" "Setting default values for missing variables..."
            
            # Set defaults
            export DD_SERVICE=${DD_SERVICE:-"vibecode-webgui"}
            export DD_ENV=${DD_ENV:-"production"}
            export DD_VERSION=${DD_VERSION:-"1.0.0"}
            export DD_DBM_PROPAGATION_MODE=${DD_DBM_PROPAGATION_MODE:-"full"}
        fi
        
        print_status "SUCCESS" "Environment variables loaded"
    else
        print_status "ERROR" "$ENV_FILE not found"
        print_status "INFO" "Please create $ENV_FILE with your configuration"
        exit 1
    fi
}

# Function to validate Azure resources
validate_azure_resources() {
    print_status "INFO" "Validating Azure resources..."
    
    # Check if resource groups exist
    if ! az group show --name "$STAGING_RG" >/dev/null 2>&1; then
        print_status "ERROR" "Staging resource group '$STAGING_RG' not found"
        exit 1
    fi
    
    if ! az group show --name "$PRODUCTION_RG" >/dev/null 2>&1; then
        print_status "ERROR" "Production resource group '$PRODUCTION_RG' not found"
        exit 1
    fi
    
    # Check if App Services exist
    if ! az webapp show --name "$STAGING_APP" --resource-group "$STAGING_RG" >/dev/null 2>&1; then
        print_status "ERROR" "Staging App Service '$STAGING_APP' not found"
        exit 1
    fi
    
    if ! az webapp show --name "$PRODUCTION_APP" --resource-group "$PRODUCTION_RG" >/dev/null 2>&1; then
        print_status "ERROR" "Production App Service '$PRODUCTION_APP' not found"
        exit 1
    fi
    
    print_status "SUCCESS" "All Azure resources are available"
}

# Function to update App Service environment variables
update_app_service_env() {
    local app_name=$1
    local resource_group=$2
    local environment=$3
    
    print_status "INFO" "Updating App Service environment variables for $app_name..."
    
    # Set environment-specific variables
    local dd_env
    local dd_version
    local dd_trace_sample_rate
    
    case $environment in
        "staging")
            dd_env="staging"
            dd_version="0.1.0-staging"
            dd_trace_sample_rate="0.5"
            ;;
        "production")
            dd_env="production"
            dd_version="1.0.0"
            dd_trace_sample_rate="0.1"
            ;;
        *)
            print_status "ERROR" "Unknown environment: $environment"
            return 1
            ;;
    esac
    
    # Update App Service configuration
    az webapp config appsettings set \
        --name "$app_name" \
        --resource-group "$resource_group" \
        --settings \
            "DD_API_KEY=$DD_API_KEY" \
            "DD_SITE=${DD_SITE:-datadoghq.com}" \
            "DD_SERVICE=$DD_SERVICE" \
            "DD_ENV=$dd_env" \
            "DD_VERSION=$dd_version" \
            "DD_DBM_PROPAGATION_MODE=$DD_DBM_PROPAGATION_MODE" \
            "DD_DBM_TRACE_INJECTION=true" \
            "DD_TRACE_SAMPLE_RATE=$dd_trace_sample_rate" \
            "DD_TRACE_ENABLED=true" \
            "DD_TRACE_ANALYTICS_ENABLED=true" \
            "DD_PROFILING_ENABLED=true" \
            "DD_RUNTIME_METRICS_ENABLED=true" \
            "DD_LLMOBS_ENABLED=true" \
            "DD_LLMOBS_AGENTLESS_ENABLED=true" \
            "DD_LLMOBS_ML_APP=vibecode-ai-$environment" \
            "NODE_ENV=$environment" \
            "WEBSITES_PORT=3000" \
            "WEBSITES_ENABLE_APP_SERVICE_STORAGE=false" \
            "WEBSITES_CONTAINER_START_TIME_LIMIT=1800" \
            "WEBSITES_CONTAINER_STOP_TIME_LIMIT=1800" \
        --output table
    
    print_status "SUCCESS" "App Service environment variables updated for $app_name"
}

# Function to restart App Service
restart_app_service() {
    local app_name=$1
    local resource_group=$2
    
    print_status "INFO" "Restarting App Service $app_name..."
    
    az webapp restart \
        --name "$app_name" \
        --resource-group "$resource_group" \
        --output table
    
    print_status "SUCCESS" "App Service $app_name restarted"
}

# Function to validate App Service configuration
validate_app_service_config() {
    local app_name=$1
    local resource_group=$2
    
    print_status "INFO" "Validating App Service configuration for $app_name..."
    
    # Get current configuration
    local config=$(az webapp config appsettings list \
        --name "$app_name" \
        --resource-group "$resource_group" \
        --output json)
    
    # Check for required DBM-APM variables
    local required_vars=(
        "DD_API_KEY"
        "DD_SERVICE"
        "DD_ENV"
        "DD_VERSION"
        "DD_DBM_PROPAGATION_MODE"
        "DD_DBM_TRACE_INJECTION"
        "DD_TRACE_SAMPLE_RATE"
        "DD_TRACE_ENABLED"
    )
    
    local missing_vars=()
    for var in "${required_vars[@]}"; do
        if ! echo "$config" | jq -e ".[] | select(.name == \"$var\")" >/dev/null 2>&1; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -gt 0 ]; then
        print_status "ERROR" "Missing required variables in $app_name: ${missing_vars[*]}"
        return 1
    fi
    
    print_status "SUCCESS" "App Service configuration validated for $app_name"
}

# Function to deploy to staging
deploy_staging() {
    print_status "INFO" "Deploying DBM-APM configuration to staging..."
    
    update_app_service_env "$STAGING_APP" "$STAGING_RG" "staging"
    restart_app_service "$STAGING_APP" "$STAGING_RG"
    validate_app_service_config "$STAGING_APP" "$STAGING_RG"
    
    print_status "SUCCESS" "Staging deployment completed"
}

# Function to deploy to production
deploy_production() {
    print_status "INFO" "Deploying DBM-APM configuration to production..."
    
    # Confirm production deployment
    echo -e "${YELLOW}⚠️  You are about to deploy to PRODUCTION. This will affect live users.${NC}"
    read -p "Are you sure you want to continue? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
        print_status "INFO" "Production deployment cancelled"
        return 0
    fi
    
    update_app_service_env "$PRODUCTION_APP" "$PRODUCTION_RG" "production"
    restart_app_service "$PRODUCTION_APP" "$PRODUCTION_RG"
    validate_app_service_config "$PRODUCTION_APP" "$PRODUCTION_RG"
    
    print_status "SUCCESS" "Production deployment completed"
}

# Function to show deployment status
show_deployment_status() {
    print_status "INFO" "Deployment Status:"
    echo
    
    # Staging status
    echo "🔄 Staging Environment:"
    local staging_url=$(az webapp show --name "$STAGING_APP" --resource-group "$STAGING_RG" --query "defaultHostName" --output tsv)
    echo "   URL: https://$staging_url"
    echo "   Resource Group: $STAGING_RG"
    echo "   App Service: $STAGING_APP"
    echo
    
    # Production status
    echo "🚀 Production Environment:"
    local production_url=$(az webapp show --name "$PRODUCTION_APP" --resource-group "$PRODUCTION_RG" --query "defaultHostName" --output tsv)
    echo "   URL: https://$production_url"
    echo "   Resource Group: $PRODUCTION_RG"
    echo "   App Service: $PRODUCTION_APP"
    echo
    
    # DBM-APM configuration
    echo "📊 DBM-APM Configuration:"
    echo "   DD_DBM_PROPAGATION_MODE: $DD_DBM_PROPAGATION_MODE"
    echo "   DD_DBM_TRACE_INJECTION: true"
    echo "   DD_SERVICE: $DD_SERVICE"
    echo "   DD_ENV: $DD_ENV"
    echo "   DD_VERSION: $DD_VERSION"
    echo
    
    # Monitoring links
    echo "🔍 Monitoring:"
    echo "   Datadog: https://app.datadoghq.com/"
    echo "   Service: $DD_SERVICE"
    echo "   Environment: $DD_ENV"
    echo
    echo "🔧 Debug Commands:"
    echo "   az webapp log tail --name $STAGING_APP --resource-group $STAGING_RG"
    echo "   az webapp log tail --name $PRODUCTION_APP --resource-group $PRODUCTION_RG"
    echo "   az webapp config appsettings list --name $STAGING_APP --resource-group $STAGING_RG"
    echo "   az webapp config appsettings list --name $PRODUCTION_APP --resource-group $PRODUCTION_RG"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [staging|production|all]"
    echo
    echo "Options:"
    echo "  staging     Deploy to staging environment only"
    echo "  production  Deploy to production environment only"
    echo "  all         Deploy to both staging and production"
    echo
    echo "Environment Variables (from $ENV_FILE):"
    echo "  DD_API_KEY              - Datadog API key"
    echo "  DD_SERVICE              - Service name"
    echo "  DD_ENV                  - Environment"
    echo "  DD_VERSION              - Application version"
    echo "  DD_DBM_PROPAGATION_MODE - DBM propagation mode"
    echo
    echo "Examples:"
    echo "  $0 staging"
    echo "  $0 production"
    echo "  $0 all"
}

# Main deployment function
main() {
    local target=${1:-"all"}
    
    echo -e "${BLUE}🚀 Deploying DBM-APM Configuration to Azure App Service${NC}"
    echo "=============================================================="
    echo
    
    check_prerequisites
    load_environment
    validate_azure_resources
    
    case $target in
        "staging")
            deploy_staging
            ;;
        "production")
            deploy_production
            ;;
        "all")
            deploy_staging
            echo
            deploy_production
            ;;
        *)
            show_usage
            exit 1
            ;;
    esac
    
    show_deployment_status
    
    print_status "SUCCESS" "DBM-APM configuration deployed successfully to Azure App Service!"
}

# Run main function
main "$@"
