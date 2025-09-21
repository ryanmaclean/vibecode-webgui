#!/usr/bin/env bash
# Script to test health check endpoints for the VibeCode application

set -euo pipefail

# Configuration
BASE_URL=${BASE_URL:-"https://vibecode.eastus2.cloudapp.azure.com"}
ENDPOINTS=(
  "/api/health"
  "/api/healthz"
  "/api/readyz"
)
TIMEOUT=${TIMEOUT:-5}
RETRIES=${RETRIES:-3}
VERBOSE=${VERBOSE:-true}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

show_help() {
  echo "Usage: $0 [options]"
  echo
  echo "Test health check endpoints for the VibeCode application"
  echo
  echo "Options:"
  echo "  --url <url>              Base URL to test (default: ${BASE_URL})"
  echo "  --timeout <seconds>      Timeout in seconds (default: ${TIMEOUT})"
  echo "  --retries <count>        Number of retries (default: ${RETRIES})"
  echo "  --quiet                  Suppress detailed output"
  echo "  --help                   Display this help message and exit"
  echo
}

# Parse command-line arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --url)
      BASE_URL="$2"
      shift 2
      ;;
    --timeout)
      TIMEOUT="$2"
      shift 2
      ;;
    --retries)
      RETRIES="$2"
      shift 2
      ;;
    --quiet)
      VERBOSE=false
      shift
      ;;
    --help)
      show_help
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      show_help
      exit 1
      ;;
  esac
done

echo -e "${BLUE}=== VibeCode Health Check Testing ===${NC}"
echo -e "Base URL: ${BASE_URL}"
echo -e "Timeout: ${TIMEOUT}s"
echo -e "Retries: ${RETRIES}"
echo

# Function to test an endpoint with retries
test_endpoint() {
  local endpoint=$1
  local url="${BASE_URL}${endpoint}"
  local attempt=1
  local success=false
  local status_code=0
  local response=""
  local start_time=0
  local end_time=0
  local time_taken=0
  
  echo -e "${YELLOW}Testing endpoint: ${endpoint}${NC}"
  
  while [ $attempt -le $RETRIES ] && [ "$success" = false ]; do
    if [ $attempt -gt 1 ]; then
      echo -e "  Retry $((attempt-1)) of ${RETRIES}..."
    fi
    
    start_time=$(date +%s%3N)
    
    # Make the HTTP request
    response=$(curl -s -o - -w "%{http_code}" -m $TIMEOUT "$url" 2>/dev/null || echo "000")
    status_code=${response: -3}
    content=${response:0:${#response}-3}
    
    end_time=$(date +%s%3N)
    time_taken=$((end_time - start_time))
    
    if [[ $status_code =~ ^2[0-9][0-9]$ ]]; then
      success=true
      echo -e "  ${GREEN}✅ Success (${status_code}) - ${time_taken}ms${NC}"
      
      if [ "$VERBOSE" = true ]; then
        # Pretty-print JSON if possible
        if command -v jq &> /dev/null; then
          echo -e "  ${BLUE}Response:${NC}"
          echo "$content" | jq . || echo "$content"
        else
          echo -e "  ${BLUE}Response:${NC} $content"
        fi
      fi
      
      # Check for health/ready status in the response
      if echo "$content" | grep -q '"status":"healthy"' || echo "$content" | grep -q '"status":"ready"'; then
        echo -e "  ${GREEN}✅ Service reports healthy/ready${NC}"
      elif echo "$content" | grep -q '"status":"unhealthy"' || echo "$content" | grep -q '"status":"not ready"'; then
        echo -e "  ${RED}❌ Service reports unhealthy/not ready${NC}"
        success=false
      else
        echo -e "  ${YELLOW}⚠️ Could not determine health status from response${NC}"
      fi
      
    else
      echo -e "  ${RED}❌ Failed (${status_code}) - ${time_taken}ms${NC}"
      if [ "$VERBOSE" = true ] && [ -n "$content" ]; then
        echo -e "  ${BLUE}Response:${NC} $content"
      fi
    fi
    
    attempt=$((attempt + 1))
  done
  
  # Return success/failure for overall reporting
  if [ "$success" = true ]; then
    return 0
  else
    return 1
  fi
}

# Test all endpoints
success_count=0
failure_count=0

for endpoint in "${ENDPOINTS[@]}"; do
  if test_endpoint "$endpoint"; then
    success_count=$((success_count + 1))
  else
    failure_count=$((failure_count + 1))
  fi
  echo
done

# Summary
echo -e "${BLUE}=== Test Summary ===${NC}"
echo -e "Total endpoints tested: $((success_count + failure_count))"
echo -e "${GREEN}✅ Successful: ${success_count}${NC}"
echo -e "${RED}❌ Failed: ${failure_count}${NC}"

if [ $failure_count -eq 0 ]; then
  echo -e "${GREEN}All health endpoints are responding correctly!${NC}"
  exit 0
else
  echo -e "${RED}Some health endpoints failed to respond correctly.${NC}"
  exit 1
fi