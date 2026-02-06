#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Comprehensive Monitoring Script with Error Tracking
# This script monitors all aspects of the application and infrastructure

# Initialize log aggregation
init_log_aggregation


# Source error tracking module
source "$(dirname "$0")/lib/error-tracking.sh"

# Initialize error tracking for monitoring
init_error_tracking "monitoring" "health_monitoring"

# Configuration
MONITORING_INTERVAL=${MONITORING_INTERVAL:-60}
ALERT_THRESHOLD=${ALERT_THRESHOLD:-80}
VERBOSE=${VERBOSE:-false}
CONTINUOUS=${CONTINUOUS:-false}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Track monitoring start
track_monitoring_start() {
    log_info "📊 Starting monitoring process..."
    log_info "Monitoring Interval: ${MONITORING_INTERVAL}s"
    log_info "Alert Threshold: ${ALERT_THRESHOLD}%"
    log_info "Continuous Mode: $CONTINUOUS"
    
    track_performance_metric "monitoring_start_time" "$(date +%s)" "monitoring" "timestamp"
}

# Check application health
check_application_health() {
    log_info "🩺 Checking application health..."
    
    local health_endpoints=(
        "http://localhost:3000/api/health"
        "http://localhost:3000/api/monitoring/dashboard"
        "http://localhost:3000/api/monitoring/metrics"
    )
    
    local health_passed=0
    local health_total=${#health_endpoints[@]}
    
    for endpoint in "${health_endpoints[@]}"; do
        if curl -f -s "$endpoint" >/dev/null 2>&1; then
            log_success "Health check passed: $endpoint"
            ((health_passed++))
        else
            log_error "Health check failed: $endpoint"
            log_error_to_datadog "Health check failed: $endpoint" "1" "monitoring" "health_check" "endpoint:$endpoint"
        fi
    done
    
    local health_percentage=$((health_passed * 100 / health_total))
    track_performance_metric "health_check_percentage" "$health_percentage" "monitoring" "percent"
    
    if [ $health_percentage -lt $ALERT_THRESHOLD ]; then
        log_warning "Health check percentage below threshold: ${health_percentage}%"
        track_performance_metric "health_check_alert" "1" "monitoring" "alert"
    fi
    
    return $health_percentage
}

# Check database health
check_database_health() {
    log_info "🗄️ Checking database health..."
    
    # Check PostgreSQL connection
    if command -v psql >/dev/null 2>&1; then
        if psql "$DATABASE_URL" -c "SELECT 1;" >/dev/null 2>&1; then
            log_success "PostgreSQL connection healthy"
        else
            log_error "PostgreSQL connection failed"
            log_error_to_datadog "PostgreSQL connection failed" "1" "monitoring" "database_check" "database:postgresql"
            return 1
        fi
    else
        log_warning "psql not available, skipping PostgreSQL check"
    fi
    
    # Check Redis connection
    if command -v redis-cli >/dev/null 2>&1; then
        if redis-cli -u "$REDIS_URL" ping >/dev/null 2>&1; then
            log_success "Redis connection healthy"
        else
            log_error "Redis connection failed"
            log_error_to_datadog "Redis connection failed" "1" "monitoring" "database_check" "database:redis"
            return 1
        fi
    else
        log_warning "redis-cli not available, skipping Redis check"
    fi
    
    return 0
}

# Check Kubernetes cluster health
check_kubernetes_health() {
    log_info "☸️ Checking Kubernetes cluster health..."
    
    if ! command -v kubectl >/dev/null 2>&1; then
        log_warning "kubectl not available, skipping Kubernetes check"
        return 0
    fi
    
    # Check cluster connectivity
    if ! kubectl cluster-info >/dev/null 2>&1; then
        log_error "Kubernetes cluster not accessible"
        log_error_to_datadog "Kubernetes cluster not accessible" "1" "monitoring" "k8s_check" "cluster_connectivity_failed"
        return 1
    fi
    
    # Check node status
    local unhealthy_nodes=$(kubectl get nodes --no-headers | grep -v "Ready" | wc -l)
    if [ $unhealthy_nodes -gt 0 ]; then
        log_warning "Found $unhealthy_nodes unhealthy nodes"
        track_performance_metric "unhealthy_nodes_count" "$unhealthy_nodes" "monitoring" "count"
    else
        log_success "All nodes are healthy"
    fi
    
    # Check pod status
    local failed_pods=$(kubectl get pods --all-namespaces --no-headers | grep -v "Running\|Completed" | wc -l)
    if [ $failed_pods -gt 0 ]; then
        log_warning "Found $failed_pods failed pods"
        track_performance_metric "failed_pods_count" "$failed_pods" "monitoring" "count"
    else
        log_success "All pods are running"
    fi
    
    return 0
}

# Check system resources
check_system_resources() {
    log_info "💻 Checking system resources..."
    
    # Check CPU usage
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | awk -F'%' '{print $1}')
    track_performance_metric "cpu_usage_percent" "$cpu_usage" "monitoring" "percent"
    
    if (( $(echo "$cpu_usage > $ALERT_THRESHOLD" | bc -l) )); then
        log_warning "High CPU usage: ${cpu_usage}%"
        track_performance_metric "cpu_usage_alert" "1" "monitoring" "alert"
    fi
    
    # Check memory usage
    local memory_usage=$(free | grep Mem | awk '{printf "%.1f", $3/$2 * 100.0}')
    track_performance_metric "memory_usage_percent" "$memory_usage" "monitoring" "percent"
    
    if (( $(echo "$memory_usage > $ALERT_THRESHOLD" | bc -l) )); then
        log_warning "High memory usage: ${memory_usage}%"
        track_performance_metric "memory_usage_alert" "1" "monitoring" "alert"
    fi
    
    # Check disk usage
    local disk_usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    track_performance_metric "disk_usage_percent" "$disk_usage" "monitoring" "percent"
    
    if [ $disk_usage -gt $ALERT_THRESHOLD ]; then
        log_warning "High disk usage: ${disk_usage}%"
        track_performance_metric "disk_usage_alert" "1" "monitoring" "alert"
    fi
    
    log_success "System resource check completed"
}

# Check Docker health
check_docker_health() {
    log_info "🐳 Checking Docker health..."
    
    if ! command -v docker >/dev/null 2>&1; then
        log_warning "Docker not available, skipping Docker check"
        return 0
    fi
    
    # Check Docker daemon
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker daemon not running"
        log_error_to_datadog "Docker daemon not running" "1" "monitoring" "docker_check" "daemon_not_running"
        return 1
    fi
    
    # Check running containers
    local running_containers=$(docker ps --format "table {{.Names}}" | tail -n +2 | wc -l)
    track_performance_metric "running_containers_count" "$running_containers" "monitoring" "count"
    
    # Check for unhealthy containers
    local unhealthy_containers=$(docker ps --format "table {{.Names}}\t{{.Status}}" | grep -v "Up" | wc -l)
    if [ $unhealthy_containers -gt 0 ]; then
        log_warning "Found $unhealthy_containers unhealthy containers"
        track_performance_metric "unhealthy_containers_count" "$unhealthy_containers" "monitoring" "count"
    else
        log_success "All containers are healthy"
    fi
    
    return 0
}

# Check Datadog agent
check_datadog_agent() {
    log_info "🐕 Checking Datadog agent..."
    
    if ! command -v datadog-agent >/dev/null 2>&1; then
        log_warning "Datadog agent not available, skipping agent check"
        return 0
    fi
    
    # Check agent status
    if datadog-agent status >/dev/null 2>&1; then
        log_success "Datadog agent is running"
    else
        log_error "Datadog agent is not running"
        log_error_to_datadog "Datadog agent is not running" "1" "monitoring" "datadog_check" "agent_not_running"
        return 1
    fi
    
    # Check agent configuration
    if [ -n "$DD_API_KEY" ]; then
        log_success "Datadog API key is configured"
    else
        log_warning "Datadog API key not configured"
    fi
    
    return 0
}

# Check network connectivity
check_network_connectivity() {
    log_info "🌐 Checking network connectivity..."
    
    local connectivity_tests=(
        "google.com:80"
        "github.com:443"
        "datadoghq.com:443"
    )
    
    local connectivity_passed=0
    local connectivity_total=${#connectivity_tests[@]}
    
    for test in "${connectivity_tests[@]}"; do
        local host=$(echo $test | cut -d: -f1)
        local port=$(echo $test | cut -d: -f2)
        
        if nc -z "$host" "$port" 2>/dev/null; then
            log_success "Network connectivity OK: $test"
            ((connectivity_passed++))
        else
            log_error "Network connectivity failed: $test"
            log_error_to_datadog "Network connectivity failed: $test" "1" "monitoring" "network_check" "host:$host,port:$port"
        fi
    done
    
    local connectivity_percentage=$((connectivity_passed * 100 / connectivity_total))
    track_performance_metric "network_connectivity_percentage" "$connectivity_percentage" "monitoring" "percent"
    
    return $connectivity_percentage
}

# Generate monitoring report
generate_monitoring_report() {
    log_info "📋 Generating monitoring report..."
    
    local report_file="monitoring-report-$(date +%Y%m%d-%H%M%S).txt"
    
    {
        echo "VibeCode Monitoring Report"
        echo "Generated: $(date)"
        echo "=========================="
        echo ""
        echo "System Information:"
        echo "Hostname: $(hostname)"
        echo "Uptime: $(uptime)"
        echo "Load Average: $(cat /proc/loadavg 2>/dev/null || echo 'N/A')"
        echo ""
        echo "Resource Usage:"
        echo "CPU: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' 2>/dev/null || echo 'N/A')"
        echo "Memory: $(free -h | grep Mem | awk '{print $3 "/" $2}' 2>/dev/null || echo 'N/A')"
        echo "Disk: $(df -h / | tail -1 | awk '{print $5}' 2>/dev/null || echo 'N/A')"
        echo ""
        echo "Application Status:"
        echo "Health Endpoints: $(curl -f -s http://localhost:3000/api/health >/dev/null 2>&1 && echo 'OK' || echo 'FAILED')"
        echo ""
        echo "Container Status:"
        if command -v docker >/dev/null 2>&1; then
            echo "Running Containers: $(docker ps --format "table {{.Names}}" | tail -n +2 | wc -l)"
        else
            echo "Docker not available"
        fi
        echo ""
        echo "Kubernetes Status:"
        if command -v kubectl >/dev/null 2>&1; then
            echo "Cluster: $(kubectl cluster-info --request-timeout=5s 2>/dev/null | head -1 || echo 'Not accessible')"
            echo "Nodes: $(kubectl get nodes --no-headers 2>/dev/null | wc -l || echo 'N/A')"
        else
            echo "kubectl not available"
        fi
    } > "$report_file"
    
    log_success "Monitoring report generated: $report_file"
    track_performance_metric "monitoring_report_generated" "1" "monitoring" "count"
}

# Main monitoring function
run_monitoring_cycle() {
    local cycle_start=$(date +%s)
    local overall_health=0
    
    log_info "🔄 Starting monitoring cycle..."
    
    # Run all health checks
    check_application_health && ((overall_health++))
    check_database_health && ((overall_health++))
    check_kubernetes_health && ((overall_health++))
    check_system_resources
    check_docker_health && ((overall_health++))
    check_datadog_agent && ((overall_health++))
    check_network_connectivity && ((overall_health++))
    
    # Track overall health
    local health_percentage=$((overall_health * 100 / 7))
    track_performance_metric "overall_health_percentage" "$health_percentage" "monitoring" "percent"
    
    local cycle_duration=$(($(date +%s) - cycle_start))
    track_performance_metric "monitoring_cycle_duration" "$cycle_duration" "monitoring" "seconds"
    
    if [ $health_percentage -ge $ALERT_THRESHOLD ]; then
        log_success "Overall health: ${health_percentage}% (Good)"
    else
        log_warning "Overall health: ${health_percentage}% (Below threshold)"
        track_performance_metric "overall_health_alert" "1" "monitoring" "alert"
    fi
    
    log_info "Monitoring cycle completed in ${cycle_duration}s"
}

# Main function
main() {
    local monitoring_start=$(date +%s)
    
    track_monitoring_start
    
    if [ "$CONTINUOUS" = "true" ]; then
        log_info "🔄 Starting continuous monitoring mode..."
        while true; do
            run_monitoring_cycle
            log_info "⏳ Waiting ${MONITORING_INTERVAL}s before next cycle..."
            sleep $MONITORING_INTERVAL
        done
    else
        run_monitoring_cycle
        generate_monitoring_report
        
        local monitoring_duration=$(($(date +%s) - monitoring_start))
        track_performance_metric "total_monitoring_duration" "$monitoring_duration" "monitoring" "seconds"
        
        log_success "🎉 Monitoring completed successfully!"
        log_info "Total monitoring time: ${monitoring_duration}s"
    fi
    
    # Track monitoring completion
    track_script_completion 0 "monitoring" "completion" "$(($(date +%s) - monitoring_start))"
}

# Error handling
trap 'handle_script_error $LINENO' ERR

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --continuous|-c)
            CONTINUOUS=true
            shift
            ;;
        --interval|-i)
            MONITORING_INTERVAL="$2"
            shift 2
            ;;
        --threshold|-t)
            ALERT_THRESHOLD="$2"
            shift 2
            ;;
        --verbose|-v)
            VERBOSE=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  -c, --continuous    Run in continuous monitoring mode"
            echo "  -i, --interval      Monitoring interval in seconds (default: 60)"
            echo "  -t, --threshold     Alert threshold percentage (default: 80)"
            echo "  -v, --verbose       Enable verbose output"
            echo "  -h, --help          Show this help message"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Run main function
main
