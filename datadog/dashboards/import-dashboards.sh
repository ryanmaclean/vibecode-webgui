#!/bin/bash
#
# Import VibeCode Datadog Dashboards
# 
# Usage:
#   export DD_API_KEY="your-api-key"
#   export DD_APP_KEY="your-app-key"
#   export DD_SITE="datadoghq.com"  # or datadoghq.eu, etc.
#   ./import-dashboards.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check required environment variables
if [ -z "$DD_API_KEY" ]; then
    echo -e "${RED}Error: DD_API_KEY environment variable is not set${NC}"
    echo "Please set it with: export DD_API_KEY=\"your-api-key\""
    exit 1
fi

if [ -z "$DD_APP_KEY" ]; then
    echo -e "${RED}Error: DD_APP_KEY environment variable is not set${NC}"
    echo "Please set it with: export DD_APP_KEY=\"your-app-key\""
    exit 1
fi

if [ -z "$DD_SITE" ]; then
    echo -e "${YELLOW}Warning: DD_SITE not set, defaulting to datadoghq.com${NC}"
    DD_SITE="datadoghq.com"
fi

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
API_URL="https://api.${DD_SITE}/api/v1/dashboard"

echo -e "${GREEN}Importing VibeCode Datadog Dashboards${NC}"
echo "API URL: $API_URL"
echo ""

# Function to import a dashboard
import_dashboard() {
    local dashboard_file=$1
    local dashboard_name=$2
    
    echo -e "${YELLOW}Importing: ${dashboard_name}${NC}"
    
    response=$(curl -s -w "\n%{http_code}" -X POST "$API_URL" \
        -H "Content-Type: application/json" \
        -H "DD-API-KEY: ${DD_API_KEY}" \
        -H "DD-APPLICATION-KEY: ${DD_APP_KEY}" \
        -d @"${SCRIPT_DIR}/${dashboard_file}")
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" -eq 200 ] || [ "$http_code" -eq 201 ]; then
        dashboard_id=$(echo "$body" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
        dashboard_url="https://app.${DD_SITE}/dashboard/${dashboard_id}"
        echo -e "${GREEN}✓ Successfully imported${NC}"
        echo -e "  Dashboard URL: ${dashboard_url}"
        echo ""
        
        # Save URL to file for easy access
        echo "$dashboard_url" >> "${SCRIPT_DIR}/dashboard-urls.txt"
    else
        echo -e "${RED}✗ Failed to import (HTTP $http_code)${NC}"
        echo "Response: $body"
        echo ""
        return 1
    fi
}

# Clear previous URLs file
> "${SCRIPT_DIR}/dashboard-urls.txt"

# Import dashboards
echo "Starting dashboard import..."
echo ""

import_dashboard "ai-cost-monitoring.json" "AI Cost & Token Usage"
import_dashboard "code-quality-monitoring.json" "Code Quality & Complexity"

echo -e "${GREEN}Dashboard import complete!${NC}"
echo ""
echo "Dashboard URLs have been saved to: ${SCRIPT_DIR}/dashboard-urls.txt"
echo ""
echo "Next steps:"
echo "1. Visit the dashboard URLs to verify they loaded correctly"
echo "2. Customize template variables if needed"
echo "3. Set up monitors/alerts (see README.md for examples)"
echo "4. Test the VS Code extension to send metrics"
echo ""
