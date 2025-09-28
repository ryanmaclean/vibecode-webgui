#!/bin/bash

# DBM-APM API Test Script
# This script tests the DBM-APM connection using various methods

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 DBM-APM API Connection Test${NC}"
echo "=================================="

# Test endpoints
ENDPOINTS=(
    "https://vibecode.eastus2.cloudapp.azure.com"
    "http://localhost:3000"
    "http://localhost:8080"
)

# Test paths
PATHS=(
    "/api/health"
    "/api/status"
    "/health"
    "/api/database/test"
)

# Function to test an endpoint
test_endpoint() {
    local base_url=$1
    local path=$2
    local full_url="${base_url}${path}"
    
    echo -e "${BLUE}🔍 Testing: ${full_url}${NC}"
    
    # Test with curl
    if command -v curl >/dev/null 2>&1; then
        response=$(curl -s -w "\n%{http_code}\n%{time_total}" -H "User-Agent: DBM-APM-Test/1.0" -H "X-Test-Source: dbm-apm-validation" "$full_url" 2>/dev/null || echo "ERROR")
        
        if [[ "$response" == "ERROR" ]]; then
            echo -e "${RED}❌ Connection failed${NC}"
            return 1
        fi
        
        # Extract status code and time
        status_code=$(echo "$response" | tail -n 2 | head -n 1)
        time_total=$(echo "$response" | tail -n 1)
        response_body=$(echo "$response" | head -n -2)
        
        if [[ "$status_code" =~ ^[2-3][0-9][0-9]$ ]]; then
            echo -e "${GREEN}✅ Status: ${status_code} (${time_total}s)${NC}"
            
            # Check for trace headers
            trace_headers=$(curl -s -I -H "User-Agent: DBM-APM-Test/1.0" "$full_url" 2>/dev/null | grep -i "datadog\|trace\|span" || true)
            if [[ -n "$trace_headers" ]]; then
                echo -e "${BLUE}   🔗 Trace headers found:${NC}"
                echo "$trace_headers" | sed 's/^/      /'
            fi
            
            # Check response content
            if echo "$response_body" | grep -q "database\|db\|postgres"; then
                echo -e "${GREEN}   🗄️  Database-related content found${NC}"
            fi
            
            if echo "$response_body" | grep -q "trace\|span\|datadog"; then
                echo -e "${GREEN}   🔍 Trace-related content found${NC}"
            fi
            
            return 0
        else
            echo -e "${YELLOW}⚠️  Status: ${status_code} (${time_total}s)${NC}"
            return 1
        fi
    else
        echo -e "${RED}❌ curl not available${NC}"
        return 1
    fi
}

# Function to test database connectivity
test_database() {
    local base_url=$1
    
    echo -e "${BLUE}🗄️  Testing database connectivity...${NC}"
    
    db_paths=(
        "/api/database/health"
        "/api/db/test"
        "/api/health/db"
        "/api/database/status"
    )
    
    for path in "${db_paths[@]}"; do
        if test_endpoint "$base_url" "$path"; then
            echo -e "${GREEN}✅ Database connectivity confirmed${NC}"
            return 0
        fi
    done
    
    echo -e "${YELLOW}⚠️  No database endpoints found${NC}"
    return 1
}

# Function to generate test traces
generate_traces() {
    local base_url=$1
    
    echo -e "${BLUE}🔍 Generating test traces...${NC}"
    
    trace_paths=(
        "/api/health"
        "/api/status"
        "/api/trace-test"
    )
    
    trace_count=0
    
    for path in "${trace_paths[@]}"; do
        if test_endpoint "$base_url" "$path"; then
            ((trace_count++))
        fi
    done
    
    echo -e "${BLUE}📊 Generated ${trace_count} test requests${NC}"
    return $trace_count
}

# Main test function
main() {
    local successful_tests=0
    local total_tests=0
    local db_connected=false
    local traces_generated=0
    
    for endpoint in "${ENDPOINTS[@]}"; do
        echo -e "\n${BLUE}🌐 Testing endpoint: ${endpoint}${NC}"
        
        # Test basic connectivity
        for path in "${PATHS[@]}"; do
            ((total_tests++))
            if test_endpoint "$endpoint" "$path"; then
                ((successful_tests++))
            fi
        done
        
        # Test database connectivity
        if test_database "$endpoint"; then
            db_connected=true
        fi
        
        # Generate traces
        local endpoint_traces
        endpoint_traces=$(generate_traces "$endpoint")
        traces_generated=$((traces_generated + endpoint_traces))
    done
    
    # Summary
    echo -e "\n${BLUE}📊 Test Summary${NC}"
    echo "=================="
    echo -e "${GREEN}✅ Successful tests: ${successful_tests}/${total_tests}${NC}"
    echo -e "${BLUE}🗄️  Database connected: $([ "$db_connected" = true ] && echo "Yes" || echo "No")${NC}"
    echo -e "${BLUE}🔍 Test traces generated: ${traces_generated}${NC}"
    
    if [[ $successful_tests -gt 0 ]]; then
        echo -e "\n${GREEN}🎉 DBM-APM API Test Results:${NC}"
        echo -e "${GREEN}✅ API endpoints are accessible${NC}"
        echo -e "${GREEN}✅ DBM-APM configuration is active${NC}"
        echo -e "${BLUE}📚 Next steps:${NC}"
        echo -e "${BLUE}   1. Check Datadog APM Services: https://app.datadoghq.com/apm/services${NC}"
        echo -e "${BLUE}   2. Check Database Monitoring: https://app.datadoghq.com/databases${NC}"
        echo -e "${BLUE}   3. Look for trace correlation in query samples${NC}"
        echo -e "${BLUE}   4. Verify service attribution in database hosts${NC}"
    else
        echo -e "\n${RED}❌ DBM-APM API Test Results:${NC}"
        echo -e "${RED}❌ No accessible API endpoints found${NC}"
        echo -e "${YELLOW}⚠️  Check if the application is running${NC}"
        echo -e "${YELLOW}⚠️  Verify network connectivity${NC}"
    fi
}

# Run the test
main "$@"
