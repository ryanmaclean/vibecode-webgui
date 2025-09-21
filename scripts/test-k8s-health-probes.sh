#!/usr/bin/env bash
# Script to test Kubernetes health probes for VibeCode application

set -euo pipefail

# Configuration
NAMESPACE=${NAMESPACE:-"vibecode-platform"}
APP_LABEL=${APP_LABEL:-"app=vibecode-app"}
LOCAL_PORT=${LOCAL_PORT:-8080}
TIMEOUT=${TIMEOUT:-5}
VERBOSE=${VERBOSE:-true}

# Health probe endpoints
LIVENESS_PROBE="/api/healthz"
READINESS_PROBE="/api/readyz"
HEALTH_CHECK="/api/health"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

show_help() {
  echo "Usage: $0 [options]"
  echo
  echo "Test Kubernetes health probes for VibeCode application pods"
  echo
  echo "Options:"
  echo "  --namespace <namespace>  Kubernetes namespace (default: ${NAMESPACE})"
  echo "  --app-label <label>      Pod selector label (default: ${APP_LABEL})"
  echo "  --port <number>          Local port for port-forward (default: ${LOCAL_PORT})"
  echo "  --timeout <seconds>      Timeout in seconds (default: ${TIMEOUT})"
  echo "  --quiet                  Suppress detailed output"
  echo "  --help                   Display this help message and exit"
  echo
}

# Parse command-line arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --namespace)
      NAMESPACE="$2"
      shift 2
      ;;
    --app-label)
      APP_LABEL="$2"
      shift 2
      ;;
    --port)
      LOCAL_PORT="$2"
      shift 2
      ;;
    --timeout)
      TIMEOUT="$2"
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

echo -e "${BLUE}=== VibeCode Kubernetes Health Probe Testing ===${NC}"
echo -e "Namespace: ${NAMESPACE}"
echo -e "App Label: ${APP_LABEL}"
echo -e "Local Port: ${LOCAL_PORT}"
echo -e "Timeout: ${TIMEOUT}s"
echo

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
  echo -e "${RED}kubectl is not installed or not in PATH${NC}"
  exit 1
fi

# Check if we can connect to the cluster
if ! kubectl cluster-info &> /dev/null; then
  echo -e "${RED}Cannot connect to Kubernetes cluster. Make sure kubectl is configured correctly.${NC}"
  exit 1
fi

# Check if namespace exists
if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
  echo -e "${RED}Namespace '$NAMESPACE' does not exist${NC}"
  exit 1
fi

# Get pods
PODS=$(kubectl get pods -n "$NAMESPACE" -l "$APP_LABEL" -o name 2>/dev/null)
if [ -z "$PODS" ]; then
  echo -e "${RED}No pods found with label '$APP_LABEL' in namespace '$NAMESPACE'${NC}"
  exit 1
fi

# Function to test an endpoint
test_endpoint() {
  local endpoint=$1
  local name=$2
  local url="http://localhost:${LOCAL_PORT}${endpoint}"
  local status_code=0
  local response=""
  local start_time=$(date +%s%3N)
  
  echo -e "  ${YELLOW}Testing ${name}: ${endpoint}${NC}"
  
  # Make the HTTP request
  response=$(curl -s -o - -w "%{http_code}" -m $TIMEOUT "$url" 2>/dev/null || echo "000")
  status_code=${response: -3}
  content=${response:0:${#response}-3}
  
  local end_time=$(date +%s%3N)
  local time_taken=$((end_time - start_time))
  
  if [[ $status_code =~ ^2[0-9][0-9]$ ]]; then
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
    
    return 0
  else
    echo -e "  ${RED}❌ Failed (${status_code}) - ${time_taken}ms${NC}"
    if [ "$VERBOSE" = true ] && [ -n "$content" ]; then
      echo -e "  ${BLUE}Response:${NC} $content"
    fi
    return 1
  fi
}

# Process each pod
success_count=0
failure_count=0
total_pods=0

for pod in $PODS; do
  pod_name=${pod#pod/}
  echo -e "${BLUE}Testing pod: ${pod_name}${NC}"
  total_pods=$((total_pods + 1))
  
  # Check if the pod is running
  pod_status=$(kubectl get pod "$pod_name" -n "$NAMESPACE" -o jsonpath='{.status.phase}' 2>/dev/null)
  if [ "$pod_status" != "Running" ]; then
    echo -e "${RED}Pod is not running (Status: $pod_status). Skipping...${NC}"
    failure_count=$((failure_count + 1))
    echo
    continue
  fi
  
  # Find the container port
  container_port=$(kubectl get pod "$pod_name" -n "$NAMESPACE" -o jsonpath='{.spec.containers[0].ports[0].containerPort}' 2>/dev/null || echo "3000")
  
  # Start port-forward
  echo -e "${YELLOW}Starting port-forward to pod ${pod_name} (${container_port} → ${LOCAL_PORT})...${NC}"
  kubectl port-forward -n "$NAMESPACE" "$pod_name" "${LOCAL_PORT}:${container_port}" &
  port_forward_pid=$!
  
  # Wait for port-forward to establish
  sleep 2
  
  # Test if port-forward is working
  if ! curl -s -o /dev/null -m 1 "http://localhost:${LOCAL_PORT}" &> /dev/null; then
    echo -e "${YELLOW}Waiting for port-forward to be ready...${NC}"
    sleep 3
  fi
  
  # Test all endpoints
  pod_success=true
  
  # Test liveness probe
  if ! test_endpoint "$LIVENESS_PROBE" "Liveness Probe"; then
    pod_success=false
  fi
  
  # Test readiness probe
  if ! test_endpoint "$READINESS_PROBE" "Readiness Probe"; then
    pod_success=false
  fi
  
  # Test health check
  if ! test_endpoint "$HEALTH_CHECK" "Health Check"; then
    pod_success=false
  fi
  
  # Check actual Kubernetes probe configuration
  echo -e "${YELLOW}Checking configured probes in Kubernetes:${NC}"
  
  # Get liveness probe configuration
  liveness_probe=$(kubectl get pod "$pod_name" -n "$NAMESPACE" -o jsonpath='{.spec.containers[0].livenessProbe}' 2>/dev/null)
  if [ -n "$liveness_probe" ]; then
    echo -e "  ${GREEN}✅ Liveness probe configured${NC}"
    if [ "$VERBOSE" = true ]; then
      # Pretty-print JSON if possible
      if command -v jq &> /dev/null; then
        echo "$liveness_probe" | jq . || echo "$liveness_probe"
      else
        echo "$liveness_probe"
      fi
    fi
  else
    echo -e "  ${RED}❌ No liveness probe configured${NC}"
    pod_success=false
  fi
  
  # Get readiness probe configuration
  readiness_probe=$(kubectl get pod "$pod_name" -n "$NAMESPACE" -o jsonpath='{.spec.containers[0].readinessProbe}' 2>/dev/null)
  if [ -n "$readiness_probe" ]; then
    echo -e "  ${GREEN}✅ Readiness probe configured${NC}"
    if [ "$VERBOSE" = true ]; then
      # Pretty-print JSON if possible
      if command -v jq &> /dev/null; then
        echo "$readiness_probe" | jq . || echo "$readiness_probe"
      else
        echo "$readiness_probe"
      fi
    fi
  else
    echo -e "  ${RED}❌ No readiness probe configured${NC}"
    pod_success=false
  fi
  
  # Kill port-forward
  kill $port_forward_pid &> /dev/null || true
  wait $port_forward_pid 2>/dev/null || true
  
  # Increment success/failure count
  if [ "$pod_success" = true ]; then
    success_count=$((success_count + 1))
    echo -e "${GREEN}✅ All health probes for ${pod_name} are working correctly${NC}"
  else
    failure_count=$((failure_count + 1))
    echo -e "${RED}❌ Some health probes for ${pod_name} failed${NC}"
  fi
  
  echo
done

# Summary
echo -e "${BLUE}=== Test Summary ===${NC}"
echo -e "Total pods tested: ${total_pods}"
echo -e "${GREEN}✅ Pods with all probes working: ${success_count}${NC}"
echo -e "${RED}❌ Pods with failing probes: ${failure_count}${NC}"

if [ $failure_count -eq 0 ]; then
  echo -e "${GREEN}All health probes are working correctly!${NC}"
  exit 0
else
  echo -e "${RED}Some health probes failed.${NC}"
  exit 1
fi