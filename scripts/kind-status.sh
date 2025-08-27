#!/bin/bash
# KIND Cluster Status and Management Script
# Provides comprehensive status information and management commands

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
PURPLE='\033[0;35m'
NC='\033[0m'

print_header() { echo -e "${PURPLE}$1${NC}"; }
print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

show_cluster_status() {
    print_header "🚀 VibeCode KIND Cluster Status"
    echo "================================"
    
    # Check if cluster exists
    if ! kind get clusters 2>/dev/null | grep -q "vibecode-monitoring"; then
        print_error "KIND cluster 'vibecode-monitoring' not found"
        echo ""
        echo "Create cluster with: ./scripts/kind-datadog-core.sh"
        return 1
    fi
    
    print_success "KIND cluster 'vibecode-monitoring' found"
    
    # Cluster info
    print_header "\n📊 Cluster Information"
    echo "======================"
    kubectl cluster-info --context kind-vibecode-monitoring
    
    # Node status
    print_header "\n🖥️  Node Status"
    echo "==============="
    kubectl get nodes -o wide
    
    # Namespace summary
    print_header "\n📦 Namespace Summary"
    echo "==================="
    kubectl get namespaces --show-labels
    
    # Pod status by namespace
    print_header "\n🚀 Pod Status by Namespace"
    echo "=========================="
    
    echo ""
    print_status "Datadog System:"
    kubectl get pods -n datadog-system -o wide || echo "  No Datadog pods found"
    
    echo ""
    print_status "VibeCode Application:"
    kubectl get pods -n vibecode -o wide || echo "  No VibeCode pods found"
    
    echo ""
    print_status "Ingress System:"
    kubectl get pods -n ingress-nginx -o wide || echo "  No Ingress pods found"
    
    # Service status
    print_header "\n🌐 Service Status"
    echo "================="
    kubectl get services --all-namespaces
    
    # Resource usage
    print_header "\n📈 Resource Usage"
    echo "================="
    if kubectl top nodes >/dev/null 2>&1; then
        kubectl top nodes
        echo ""
        kubectl top pods --all-namespaces | head -10
    else
        print_warning "Metrics server not available (normal for KIND)"
    fi
}

show_monitoring_status() {
    print_header "🔍 Monitoring Status"
    echo "===================="
    
    # Check Datadog agent
    if kubectl get pods -n datadog-system >/dev/null 2>&1; then
        print_status "Datadog Agent Status:"
        kubectl get pods -n datadog-system
        
        # Check if agent is ready
        if kubectl get pods -n datadog-system | grep -q "1/1.*Running"; then
            print_success "Datadog agent is running and ready"
        elif kubectl get pods -n datadog-system | grep -q "Running"; then
            print_warning "Datadog agent is running but may still be initializing"
        else
            print_warning "Datadog agent is not ready yet"
        fi
        
        # Show recent logs
        echo ""
        print_status "Recent Datadog Agent logs:"
        kubectl logs -l app=datadog-agent -n datadog-system --tail=5 --prefix=true || print_warning "Could not retrieve logs"
    else
        print_error "Datadog namespace not found"
    fi
}

show_application_status() {
    print_header "📱 Application Status"
    echo "====================="
    
    if kubectl get pods -n vibecode >/dev/null 2>&1; then
        print_status "VibeCode Application Status:"
        kubectl get pods -n vibecode -o wide
        
        # Check if application is ready
        if kubectl get pods -n vibecode | grep -q "1/1.*Running"; then
            print_success "VibeCode sample application is running"
            
            # Test application health
            if kubectl get service vibecode-sample -n vibecode >/dev/null 2>&1; then
                print_status "Testing application health..."
                kubectl run test-pod --rm -i --restart=Never --image=curlimages/curl -- \
                    curl -s http://vibecode-sample.vibecode.svc.cluster.local/health || \
                    print_warning "Health check failed or service not ready"
            fi
        else
            print_warning "VibeCode application is not ready yet"
        fi
    else
        print_warning "No VibeCode applications found"
    fi
}

show_endpoints() {
    print_header "🌐 Access Endpoints"
    echo "==================="
    
    echo "📊 Monitoring:"
    echo "  • Datadog: https://app.datadoghq.com (if real API key configured)"
    echo "  • Kubernetes Dashboard: kubectl proxy (then http://localhost:8001/api/v1/namespaces/kubernetes-dashboard/services/https:kubernetes-dashboard:/proxy/)"
    
    echo ""
    echo "🚀 Applications:"
    if kubectl get ingress -n vibecode >/dev/null 2>&1; then
        echo "  • Ingress routes:"
        kubectl get ingress -n vibecode
    else
        echo "  • Direct service access: kubectl port-forward service/vibecode-sample -n vibecode 8080:80"
        echo "    Then access: http://localhost:8080"
    fi
    
    echo ""
    echo "🔧 Management:"
    echo "  • Cluster info: kubectl cluster-info"
    echo "  • Delete cluster: kind delete cluster --name vibecode-monitoring"
    echo "  • Recreate cluster: ./scripts/kind-datadog-core.sh"
}

show_logs() {
    print_header "📝 Recent Logs"
    echo "==============="
    
    print_status "Datadog Agent logs (last 10 lines):"
    kubectl logs -l app=datadog-agent -n datadog-system --tail=10 --prefix=true || print_warning "No Datadog logs available"
    
    echo ""
    print_status "VibeCode Application logs (last 10 lines):"
    kubectl logs -l app=vibecode-sample -n vibecode --tail=10 --prefix=true || print_warning "No application logs available"
    
    echo ""
    print_status "Ingress Controller logs (last 5 lines):"
    kubectl logs -l app.kubernetes.io/component=controller -n ingress-nginx --tail=5 --prefix=true || print_warning "No ingress logs available"
}

cleanup_cluster() {
    print_warning "This will delete the entire KIND cluster!"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Deleting KIND cluster..."
        kind delete cluster --name vibecode-monitoring
        print_success "Cluster deleted"
    else
        print_status "Cleanup cancelled"
    fi
}

restart_datadog() {
    print_status "Restarting Datadog agent..."
    kubectl rollout restart daemonset/datadog-agent -n datadog-system || print_error "Failed to restart Datadog"
    print_success "Datadog restart initiated"
}

# Command handling
case "${1:-status}" in
    "status"|"")
        show_cluster_status
        ;;
    "monitoring")
        show_monitoring_status
        ;;
    "app"|"application")
        show_application_status
        ;;
    "endpoints"|"urls")
        show_endpoints
        ;;
    "logs")
        show_logs
        ;;
    "cleanup"|"delete")
        cleanup_cluster
        ;;
    "restart-datadog")
        restart_datadog
        ;;
    "full"|"all")
        show_cluster_status
        echo ""
        show_monitoring_status
        echo ""
        show_application_status
        echo ""
        show_endpoints
        ;;
    "help"|"-h"|"--help")
        echo "VibeCode KIND Cluster Management"
        echo "==============================="
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  status (default)   - Show cluster status"
        echo "  monitoring        - Show monitoring status"
        echo "  app               - Show application status"  
        echo "  endpoints         - Show access endpoints"
        echo "  logs              - Show recent logs"
        echo "  cleanup           - Delete the cluster"
        echo "  restart-datadog   - Restart Datadog agent"
        echo "  full              - Show all information"
        echo "  help              - Show this help"
        exit 0
        ;;
    *)
        print_error "Unknown command: $1"
        echo "Run '$0 help' for usage information"
        exit 1
        ;;
esac