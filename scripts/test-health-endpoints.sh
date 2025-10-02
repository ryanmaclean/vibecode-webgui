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

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/lib/bootstrap.sh"
bootstrap_init "${SCRIPT_DIR}"
# shellcheck disable=SC1091
source "${LIB_DIR}/logging.sh"

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

log_step "VibeCode Health Check Testing"
log_info "Base URL: ${BASE_URL}"
log_info "Timeout: ${TIMEOUT}s"
log_info "Retries: ${RETRIES}"
printf '\n'

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
  
  log_info "Testing endpoint: ${endpoint}"
  
  local max_retries="${RETRIES}"

  while (( attempt <= max_retries )) && [ "$success" = false ]; do
    if (( attempt > 1 )); then
      log_warn "Retry $((attempt-1)) of ${max_retries}..."
    fi
    
    start_time=$(date +%s%3N)
    
    # Make the HTTP request
    response=$(curl -s -o - -w "%{http_code}" -m "$TIMEOUT" "$url" 2>/dev/null || echo "000")
    status_code=${response: -3}
    content=${response:0:${#response}-3}
    
    end_time=$(date +%s%3N)
    time_taken=$((end_time - start_time))
    
    if [[ $status_code =~ ^2[0-9][0-9]$ ]]; then
      success=true
      log_success "Success (${status_code}) - ${time_taken}ms"
      
      if [ "$VERBOSE" = true ]; then
        # Pretty-print JSON if possible
        if command -v jq &> /dev/null; then
          log_info "Response:"
          echo "$content" | jq . || echo "$content"
        else
          log_info "Response: $content"
        fi
      fi
      
      # Check for health/ready status in the response
      if echo "$content" | grep -q '"status":"healthy"' || echo "$content" | grep -q '"status":"ready"'; then
        log_success "Service reports healthy/ready"
      elif echo "$content" | grep -q '"status":"unhealthy"' || echo "$content" | grep -q '"status":"not ready"'; then
        log_error "Service reports unhealthy/not ready"
        success=false
      else
        log_warn "Could not determine health status from response"
      fi
      
    else
      log_error "Failed (${status_code}) - ${time_taken}ms"
      if [ "$VERBOSE" = true ] && [ -n "$content" ]; then
        log_info "Response: $content"
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
  printf '\n'
done

# Summary
log_step "Test Summary"
log_info "Total endpoints tested: $((success_count + failure_count))"
log_success "Successful: ${success_count}"
log_info "Failed: ${failure_count}"

if [ "$failure_count" -eq 0 ]; then
  log_success "All health endpoints are responding correctly!"
  exit 0
else
  log_error "Some health endpoints failed to respond correctly."
  exit 1
fi
