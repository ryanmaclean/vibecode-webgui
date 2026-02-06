#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Validate cloud-init configurations for VibeCode VMs
# Checks for common issues and best practices

# Initialize log aggregation
init_log_aggregation


set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CLOUD_INIT_DIR="$PROJECT_ROOT/config/cloud-init"

echo "======================================"
echo "Cloud-Init Configuration Validator"
echo "======================================"
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

# Function to check YAML syntax
check_yaml_syntax() {
    local file=$1
    echo -n "Checking YAML syntax for $(basename $file)... "
    if python3 -c "import yaml; yaml.safe_load(open('$file'))" 2>/dev/null; then
        echo -e "${GREEN}✓${NC}"
        return 0
    else
        echo -e "${RED}✗${NC}"
        ERRORS=$((ERRORS + 1))
        return 1
    fi
}

# Function to check for required fields
check_required_fields() {
    local file=$1
    local vm_name=$(basename $file .yaml | sed 's/-user-data//')
    
    echo "Validating $vm_name configuration..."
    
    # Check for hostname
    if ! grep -q "^hostname:" "$file"; then
        echo -e "  ${RED}✗${NC} Missing hostname field"
        ERRORS=$((ERRORS + 1))
    else
        echo -e "  ${GREEN}✓${NC} Hostname field present"
    fi
    
    # Check for packages
    if ! grep -q "^packages:" "$file"; then
        echo -e "  ${YELLOW}⚠${NC} No packages section found"
        WARNINGS=$((WARNINGS + 1))
    else
        echo -e "  ${GREEN}✓${NC} Packages section present"
    fi
    
    # Check for users
    if ! grep -q "^users:" "$file"; then
        echo -e "  ${YELLOW}⚠${NC} No users section found"
        WARNINGS=$((WARNINGS + 1))
    else
        echo -e "  ${GREEN}✓${NC} Users section present"
    fi
    
    # Check for runcmd
    if ! grep -q "^runcmd:" "$file"; then
        echo -e "  ${YELLOW}⚠${NC} No runcmd section found"
        WARNINGS=$((WARNINGS + 1))
    else
        echo -e "  ${GREEN}✓${NC} Runcmd section present"
    fi
}

# Function to check Alpine Linux specific requirements
check_alpine_requirements() {
    local file=$1
    local vm_name=$(basename $file .yaml | sed 's/-user-data//')
    
    echo "Checking Alpine Linux compatibility for $vm_name..."
    
    # Check for openssh package (required for SSH)
    if ! grep -q "openssh" "$file"; then
        echo -e "  ${RED}✗${NC} Missing openssh package"
        ERRORS=$((ERRORS + 1))
    else
        echo -e "  ${GREEN}✓${NC} openssh package included"
    fi
    
    # Check for proper shell in user config
    if ! grep -q "shell: /bin/ash" "$file"; then
        echo -e "  ${YELLOW}⚠${NC} User shell not set to /bin/ash (Alpine default)"
        WARNINGS=$((WARNINGS + 1))
    else
        echo -e "  ${GREEN}✓${NC} User shell set to /bin/ash"
    fi
    
    # Check for rc-update commands (OpenRC service management)
    if grep -q "runcmd:" "$file"; then
        if ! grep -q "rc-update add" "$file"; then
            echo -e "  ${YELLOW}⚠${NC} No rc-update commands found (services may not auto-start)"
            WARNINGS=$((WARNINGS + 1))
        else
            echo -e "  ${GREEN}✓${NC} rc-update commands present"
        fi
    fi
    
    # Check for proper su command syntax with Alpine
    if grep -q "su - " "$file" && ! grep -q "su -s /bin/sh" "$file"; then
        echo -e "  ${YELLOW}⚠${NC} Using 'su -' without explicit shell may fail on Alpine"
        WARNINGS=$((WARNINGS + 1))
    elif grep -q "su -s /bin/sh" "$file"; then
        echo -e "  ${GREEN}✓${NC} Using proper su syntax for Alpine"
    fi
}

# Function to check service-specific requirements
check_service_requirements() {
    local file=$1
    local vm_name=$(basename $file .yaml | sed 's/-user-data//')
    
    echo "Checking service-specific requirements for $vm_name..."
    
    case "$vm_name" in
        postgresql)
            if ! grep -q "postgresql" "$file"; then
                echo -e "  ${RED}✗${NC} Missing postgresql package"
                ERRORS=$((ERRORS + 1))
            else
                echo -e "  ${GREEN}✓${NC} PostgreSQL package present"
            fi
            
            if ! grep -q "initdb" "$file"; then
                echo -e "  ${RED}✗${NC} Missing initdb command"
                ERRORS=$((ERRORS + 1))
            else
                echo -e "  ${GREEN}✓${NC} initdb command present"
            fi
            
            if ! grep -q "rc-update add postgresql" "$file"; then
                echo -e "  ${RED}✗${NC} PostgreSQL not set to auto-start"
                ERRORS=$((ERRORS + 1))
            else
                echo -e "  ${GREEN}✓${NC} PostgreSQL set to auto-start"
            fi
            ;;
            
        valkey)
            if ! grep -q "redis" "$file"; then
                echo -e "  ${RED}✗${NC} Missing redis package"
                ERRORS=$((ERRORS + 1))
            else
                echo -e "  ${GREEN}✓${NC} Redis package present"
            fi
            
            if ! grep -q "rc-update add redis" "$file"; then
                echo -e "  ${RED}✗${NC} Redis not set to auto-start"
                ERRORS=$((ERRORS + 1))
            else
                echo -e "  ${GREEN}✓${NC} Redis set to auto-start"
            fi
            ;;
            
        nodejs)
            if ! grep -q "nodejs" "$file"; then
                echo -e "  ${RED}✗${NC} Missing nodejs package"
                ERRORS=$((ERRORS + 1))
            else
                echo -e "  ${GREEN}✓${NC} Node.js package present"
            fi
            
            if ! grep -q "/etc/local.d/start-node-server.start" "$file"; then
                echo -e "  ${YELLOW}⚠${NC} No startup script found"
                WARNINGS=$((WARNINGS + 1))
            else
                echo -e "  ${GREEN}✓${NC} Startup script configured"
            fi
            
            if ! grep -q "rc-update add local" "$file"; then
                echo -e "  ${RED}✗${NC} Local service not enabled (Node.js won't auto-start)"
                ERRORS=$((ERRORS + 1))
            else
                echo -e "  ${GREEN}✓${NC} Local service enabled for auto-start"
            fi
            ;;
            
        codeserver)
            if ! grep -q "nodejs" "$file"; then
                echo -e "  ${RED}✗${NC} Missing nodejs package (required for code-server)"
                ERRORS=$((ERRORS + 1))
            else
                echo -e "  ${GREEN}✓${NC} Node.js package present"
            fi
            
            if ! grep -q "code-server" "$file"; then
                echo -e "  ${YELLOW}⚠${NC} No code-server installation found"
                WARNINGS=$((WARNINGS + 1))
            else
                echo -e "  ${GREEN}✓${NC} code-server installation configured"
            fi
            
            if ! grep -q "rc-update add local" "$file"; then
                echo -e "  ${RED}✗${NC} Local service not enabled (code-server won't auto-start)"
                ERRORS=$((ERRORS + 1))
            else
                echo -e "  ${GREEN}✓${NC} Local service enabled for auto-start"
            fi
            ;;
        
        ssh)
            # SSH config doesn't need service-specific checks
            echo -e "  ${GREEN}✓${NC} SSH configuration is service-agnostic"
            ;;
    esac
}

# Main validation loop
echo "Scanning cloud-init configurations in $CLOUD_INIT_DIR"
echo ""

for config_file in "$CLOUD_INIT_DIR"/*.yaml; do
    if [ -f "$config_file" ]; then
        echo "======================================"
        echo "Validating: $(basename $config_file)"
        echo "======================================"
        
        check_yaml_syntax "$config_file"
        check_required_fields "$config_file"
        check_alpine_requirements "$config_file"
        check_service_requirements "$config_file"
        
        echo ""
    fi
done

# Summary
echo "======================================"
echo "Validation Summary"
echo "======================================"
echo -e "Errors: ${RED}$ERRORS${NC}"
echo -e "Warnings: ${YELLOW}$WARNINGS${NC}"
echo ""

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✓ All critical checks passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Found $ERRORS critical issues that must be fixed${NC}"
    exit 1
fi
