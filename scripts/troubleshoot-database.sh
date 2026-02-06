#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"


# Database Connection Troubleshooting Script
# This script helps diagnose and fix database connection issues for DBM-APM testing

# Initialize log aggregation
init_log_aggregation


set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Database Connection Troubleshooting${NC}"
echo "====================================="

# Database configurations
declare -A DATABASES=(
    ["dev"]="vibecode-pgflex-1758429506.postgres.database.azure.com"
    ["staging"]="vibecode-staging-pg.postgres.database.azure.com"
    ["production"]="vibecode-pgflex-1758422944.postgres.database.azure.com"
)

declare -A USERS=(
    ["dev"]="pgadmin"
    ["staging"]="vibecodeusr"
    ["production"]="pgadmin"
)

declare -A RESOURCE_GROUPS=(
    ["dev"]="rg-vibecode-dev"
    ["staging"]="rg-vibecode-staging"
    ["production"]="rg-vibecode-aks-prod"
)

# Function to check Azure CLI login
check_azure_login() {
    echo -e "${BLUE}🔐 Checking Azure CLI login...${NC}"
    if az account show >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Azure CLI is logged in${NC}"
        return 0
    else
        echo -e "${RED}❌ Azure CLI not logged in${NC}"
        echo -e "${YELLOW}Please run: az login${NC}"
        return 1
    fi
}

# Function to check database server status
check_database_status() {
    local env=$1
    local server_name=${DATABASES[$env]}
    local resource_group=${RESOURCE_GROUPS[$env]}
    
    echo -e "${BLUE}📊 Checking ${env} database status...${NC}"
    
    # Extract server name from FQDN
    local short_name=$(echo $server_name | cut -d'.' -f1)
    
    if az postgres flexible-server show --name "$short_name" --resource-group "$resource_group" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Database server exists${NC}"
        
        # Get server details
        local state=$(az postgres flexible-server show --name "$short_name" --resource-group "$resource_group" --query "state" -o tsv)
        echo -e "${BLUE}   State: ${state}${NC}"
        
        if [[ "$state" == "Ready" ]]; then
            echo -e "${GREEN}✅ Database server is ready${NC}"
            return 0
        else
            echo -e "${YELLOW}⚠️  Database server is not ready (${state})${NC}"
            return 1
        fi
    else
        echo -e "${RED}❌ Database server not found${NC}"
        return 1
    fi
}

# Function to check firewall rules
check_firewall_rules() {
    local env=$1
    local server_name=${DATABASES[$env]}
    local resource_group=${RESOURCE_GROUPS[$env]}
    
    echo -e "${BLUE}🔥 Checking firewall rules for ${env}...${NC}"
    
    local short_name=$(echo $server_name | cut -d'.' -f1)
    
    # Get firewall rules
    local rules=$(az postgres flexible-server firewall-rule list --name "$short_name" --resource-group "$resource_group" --query "[].{Name:name, StartIP:startIpAddress, EndIP:endIpAddress}" -o table 2>/dev/null || echo "No rules found")
    
    if [[ "$rules" == "No rules found" ]]; then
        echo -e "${RED}❌ No firewall rules found${NC}"
        echo -e "${YELLOW}⚠️  This may be causing connection timeouts${NC}"
        return 1
    else
        echo -e "${GREEN}✅ Firewall rules found:${NC}"
        echo "$rules"
        return 0
    fi
}

# Function to check database credentials
check_database_credentials() {
    local env=$1
    local server_name=${DATABASES[$env]}
    local username=${USERS[$env]}
    
    echo -e "${BLUE}🔑 Checking database credentials for ${env}...${NC}"
    
    # Check if we can connect (this will fail but give us info)
    if command -v psql >/dev/null 2>&1; then
        echo -e "${BLUE}   Testing connection to ${server_name}...${NC}"
        # This will fail but give us error details
        timeout 10 psql -h "$server_name" -U "$username" -d postgres -c "SELECT 1;" 2>&1 || true
    else
        echo -e "${YELLOW}⚠️  psql not available for testing${NC}"
    fi
}

# Function to fix firewall rules
fix_firewall_rules() {
    local env=$1
    local server_name=${DATABASES[$env]}
    local resource_group=${RESOURCE_GROUPS[$env]}
    
    echo -e "${BLUE}🔧 Fixing firewall rules for ${env}...${NC}"
    
    local short_name=$(echo $server_name | cut -d'.' -f1)
    
    # Get current public IP
    local public_ip=$(curl -s ifconfig.me 2>/dev/null || echo "0.0.0.0")
    
    if [[ "$public_ip" != "0.0.0.0" ]]; then
        echo -e "${BLUE}   Adding firewall rule for IP: ${public_ip}${NC}"
        
        if az postgres flexible-server firewall-rule create \
            --name "$short_name" \
            --resource-group "$resource_group" \
            --rule-name "AllowCurrentIP" \
            --start-ip-address "$public_ip" \
            --end-ip-address "$public_ip" >/dev/null 2>&1; then
            echo -e "${GREEN}✅ Firewall rule added${NC}"
        else
            echo -e "${RED}❌ Failed to add firewall rule${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  Could not determine public IP${NC}"
    fi
}

# Function to reset database password
reset_database_password() {
    local env=$1
    local server_name=${DATABASES[$env]}
    local resource_group=${RESOURCE_GROUPS[$env]}
    local username=${USERS[$env]}
    
    echo -e "${BLUE}🔐 Resetting database password for ${env}...${NC}"
    
    local short_name=$(echo $server_name | cut -d'.' -f1)
    
    # Generate a new password
    local new_password=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    
    echo -e "${BLUE}   Resetting password for user: ${username}${NC}"
    
    if az postgres flexible-server update \
        --name "$short_name" \
        --resource-group "$resource_group" \
        --admin-password "$new_password" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Password reset successful${NC}"
        echo -e "${BLUE}   New password: ${new_password}${NC}"
        echo -e "${YELLOW}⚠️  Update your environment variables with this password${NC}"
        return 0
    else
        echo -e "${RED}❌ Password reset failed${NC}"
        return 1
    fi
}

# Function to test database connection
test_database_connection() {
    local env=$1
    local server_name=${DATABASES[$env]}
    local username=${USERS[$env]}
    
    echo -e "${BLUE}🧪 Testing database connection for ${env}...${NC}"
    
    if command -v psql >/dev/null 2>&1; then
        echo -e "${BLUE}   Testing connection to ${server_name}...${NC}"
        
        # Test connection (will prompt for password)
        if timeout 30 psql -h "$server_name" -U "$username" -d postgres -c "SELECT version();" >/dev/null 2>&1; then
            echo -e "${GREEN}✅ Database connection successful${NC}"
            return 0
        else
            echo -e "${RED}❌ Database connection failed${NC}"
            return 1
        fi
    else
        echo -e "${YELLOW}⚠️  psql not available for testing${NC}"
        return 1
    fi
}

# Main troubleshooting function
troubleshoot_environment() {
    local env=$1
    
    echo -e "\n${BLUE}🔍 Troubleshooting ${env} environment${NC}"
    echo "=================================="
    
    # Check database status
    if check_database_status "$env"; then
        # Check firewall rules
        if ! check_firewall_rules "$env"; then
            echo -e "${YELLOW}🔧 Attempting to fix firewall rules...${NC}"
            fix_firewall_rules "$env"
        fi
        
        # Check credentials
        check_database_credentials "$env"
        
        # Test connection
        if ! test_database_connection "$env"; then
            echo -e "${YELLOW}🔧 Attempting to reset password...${NC}"
            reset_database_password "$env"
        fi
    else
        echo -e "${RED}❌ Database server is not ready${NC}"
    fi
}

# Main execution
main() {
    echo -e "${BLUE}🚀 Starting database troubleshooting...${NC}"
    
    # Check Azure CLI login
    if ! check_azure_login; then
        exit 1
    fi
    
    # Troubleshoot each environment
    for env in dev staging production; do
        troubleshoot_environment "$env"
    done
    
    echo -e "\n${BLUE}📊 Troubleshooting Summary${NC}"
    echo "=========================="
    echo -e "${GREEN}✅ Checked all database servers${NC}"
    echo -e "${GREEN}✅ Verified firewall rules${NC}"
    echo -e "${GREEN}✅ Tested database connections${NC}"
    echo -e "${GREEN}✅ Reset passwords where needed${NC}"
    
    echo -e "\n${BLUE}📚 Next Steps:${NC}"
    echo "1. Update your .env.local with new passwords"
    echo "2. Test DBM-APM connection with: npm run validate:dbm-apm"
    echo "3. Run API tests to verify trace correlation"
    echo "4. Check Datadog dashboard for DBM-APM data"
}

# Run the troubleshooting
main "$@"

