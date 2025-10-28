#!/usr/bin/env bash
# Datadog Orchestrator Integration Diagnostic Script
# Troubleshoots clusterAgentClient connection issues

set -euo pipefail

# Configuration
DD_NAMESPACE=${DD_NAMESPACE:-datadog}
CLUSTER_NAME=${CLUSTER_NAME:-vibecode-aks}

log() {
  printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*"
}

error() {
  printf '[%s] ERROR: %s\n' "$(date +%H:%M:%S)" "$*" >&2
}

success() {
  printf '[%s] ✅ %s\n' "$(date +%H:%M:%S)" "$*"
}

warning() {
  printf '[%s] ⚠️  %s\n' "$(date +%H:%M:%S)" "$*"
}

log "🔍 Diagnosing Datadog Orchestrator Integration Issues"
log "Cluster: $CLUSTER_NAME, Namespace: $DD_NAMESPACE"
echo

# 1. Check cluster agent pod status
log "1. Checking cluster agent pod status..."
if kubectl -n "$DD_NAMESPACE" get pods -l app=datadog-cluster-agent --no-headers | grep -q Running; then
  success "Cluster agent pods are running"
else
  error "Cluster agent pods are not running properly"
  kubectl -n "$DD_NAMESPACE" get pods -l app=datadog-cluster-agent
fi

# 2. Check cluster agent logs for errors
log "2. Checking cluster agent logs for orchestrator errors..."
CLUSTER_AGENT_POD=$(kubectl -n "$DD_NAMESPACE" get pods -l app=datadog-cluster-agent -o jsonpath='{.items[0].metadata.name}')
if [ -n "$CLUSTER_AGENT_POD" ]; then
  log "Cluster agent pod: $CLUSTER_AGENT_POD"
  
  # Check for orchestrator-related errors
  if kubectl -n "$DD_NAMESPACE" logs "$CLUSTER_AGENT_POD" --tail=50 | grep -i "orchestrator\|clusterAgentClient\|temporary failure"; then
    warning "Found orchestrator-related errors in logs"
    kubectl -n "$DD_NAMESPACE" logs "$CLUSTER_AGENT_POD" --tail=20 | grep -i "orchestrator\|clusterAgentClient\|temporary failure"
  else
    success "No obvious orchestrator errors in recent logs"
  fi
else
  error "Could not find cluster agent pod"
fi

# 3. Verify RBAC permissions
log "3. Verifying RBAC permissions for orchestrator integration..."
if kubectl auth can-i get pods --as=system:serviceaccount:$DD_NAMESPACE:datadog-cluster-agent; then
  success "Cluster agent has pod read permissions"
else
  error "Cluster agent lacks pod read permissions"
fi

if kubectl auth can-i get nodes --as=system:serviceaccount:$DD_NAMESPACE:datadog-cluster-agent; then
  success "Cluster agent has node read permissions"
else
  error "Cluster agent lacks node read permissions"
fi

if kubectl auth can-i get deployments --as=system:serviceaccount:$DD_NAMESPACE:datadog-cluster-agent; then
  success "Cluster agent has deployment read permissions"
else
  error "Cluster agent lacks deployment read permissions"
fi

# 4. Check API connectivity
log "4. Testing API connectivity from cluster agent..."
if [ -n "$CLUSTER_AGENT_POD" ]; then
  log "Testing connectivity to Datadog API..."
  if kubectl -n "$DD_NAMESPACE" exec "$CLUSTER_AGENT_POD" -- curl -s -o /dev/null -w "%{http_code}" https://api.datadoghq.com/api/v1/validate; then
    success "API connectivity test passed"
  else
    error "API connectivity test failed"
  fi
fi

# 5. Check orchestrator explorer configuration
log "5. Checking orchestrator explorer configuration..."
if kubectl -n "$DD_NAMESPACE" get configmap datadog-cluster-agent-config -o yaml 2>/dev/null | grep -q "DD_ORCHESTRATOR_EXPLORER_ENABLED.*true"; then
  success "Orchestrator explorer is enabled"
else
  warning "Orchestrator explorer configuration not found or disabled"
fi

# 6. Check API key configuration
log "6. Verifying API key configuration..."
if kubectl -n "$DD_NAMESPACE" get secret datadog-secret -o jsonpath='{.data.api-key}' 2>/dev/null | base64 -d | wc -c | grep -q "40"; then
  success "API key is properly configured (40 characters)"
else
  error "API key is missing or invalid"
fi

# 7. Check cluster agent authentication token
log "7. Checking cluster agent authentication token..."
if kubectl -n "$DD_NAMESPACE" get secret datadog-cluster-agent-token -o jsonpath='{.data.token}' 2>/dev/null | base64 -d | wc -c | grep -q "32"; then
  success "Cluster agent token is properly configured (32 characters)"
else
  error "Cluster agent token is missing or invalid"
fi

# 8. Check for version compatibility
log "8. Checking version compatibility..."
CLUSTER_AGENT_VERSION=$(kubectl -n "$DD_NAMESPACE" get pod "$CLUSTER_AGENT_POD" -o jsonpath='{.spec.containers[0].image}' | cut -d: -f2)
NODE_AGENT_VERSION=$(kubectl -n "$DD_NAMESPACE" get daemonset datadog-agent -o jsonpath='{.spec.template.spec.containers[0].image}' | cut -d: -f2)
log "Cluster agent version: $CLUSTER_AGENT_VERSION"
log "Node agent version: $NODE_AGENT_VERSION"

# 9. Generate recommendations
log "9. Generating recommendations..."
echo
log "📋 RECOMMENDATIONS:"
echo

if kubectl -n "$DD_NAMESPACE" logs "$CLUSTER_AGENT_POD" --tail=100 | grep -q "temporary failure in clusterAgentClient"; then
  log "🔧 IMMEDIATE ACTIONS:"
  log "   1. Restart cluster agent: kubectl -n $DD_NAMESPACE rollout restart deployment/datadog-cluster-agent"
  log "   2. Check network policies: kubectl get networkpolicies -n $DD_NAMESPACE"
  log "   3. Verify DNS resolution: kubectl -n $DD_NAMESPACE exec $CLUSTER_AGENT_POD -- nslookup api.datadoghq.com"
  echo
fi

log "🔧 CONFIGURATION FIXES:"
log "   1. Ensure orchestrator explorer is enabled in cluster agent"
log "   2. Verify API key has orchestrator permissions in Datadog console"
log "   3. Check for rate limiting in Datadog API"
log "   4. Consider increasing cluster agent resources if under pressure"
echo

log "🔧 MONITORING:"
log "   1. Monitor cluster agent logs: kubectl -n $DD_NAMESPACE logs -f deployment/datadog-cluster-agent"
log "   2. Check Datadog dashboard for orchestrator metrics"
log "   3. Verify cluster agent health endpoint: kubectl -n $DD_NAMESPACE port-forward svc/datadog-cluster-agent 5005:5005"
echo

log "✅ Diagnostic complete!"
