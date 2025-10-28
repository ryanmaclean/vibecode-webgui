#!/bin/bash
# Vibecode CLI - Monitoring & Observability Menu
# Provides comprehensive monitoring, metrics, and observability tools

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Get project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SCRIPTS_DIR="$PROJECT_ROOT/scripts"

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_section() {
    echo -e "\n${MAGENTA}=== $1 ===${NC}\n"
}

# Check if a command exists
command_exists() {
    command -v "$1" &> /dev/null
}

# Display menu header
show_header() {
    clear
    echo -e "${CYAN}"
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║                                                                ║"
    echo "║         VIBECODE CLI - MONITORING & OBSERVABILITY              ║"
    echo "║                                                                ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo -e "${BLUE}Comprehensive monitoring, metrics, and observability tools${NC}\n"
}

# Display menu options
show_menu() {
    echo -e "${YELLOW}DATADOG SETUP${NC}"
    echo "  1) Deploy Datadog Monitoring Stack"
    echo "  2) Setup Azure OpenAI Monitoring"
    echo "  3) Setup AKS Datadog Monitoring"
    echo "  4) Setup PostgreSQL Datadog Monitoring"
    echo "  5) Check Datadog DBM Metrics"
    echo "  6) Verify Datadog Metrics"
    echo ""
    echo -e "${YELLOW}PERFORMANCE BASELINES${NC}"
    echo "  7) Record Performance Baseline"
    echo "  8) View Performance Baselines"
    echo "  9) Compare Performance Baselines"
    echo " 10) Continuous Performance Monitor"
    echo ""
    echo -e "${YELLOW}LOG ANALYSIS${NC}"
    echo " 11) View Application Logs"
    echo " 12) Search Logs"
    echo " 13) Tail Live Logs"
    echo " 14) Test Datadog Logging"
    echo ""
    echo -e "${YELLOW}METRICS DASHBOARD${NC}"
    echo " 15) View System Metrics"
    echo " 16) View Application Metrics"
    echo " 17) Setup Production Monitoring"
    echo " 18) Validate Monitoring Setup"
    echo ""
    echo -e "${YELLOW}HEALTH CHECKS${NC}"
    echo " 19) Check System Health"
    echo " 20) Check Services Health"
    echo " 21) Validate Health Endpoints"
    echo " 22) Test K8s Health Probes"
    echo " 23) Validate PostgreSQL Monitoring"
    echo ""
    echo -e "${YELLOW}SECURITY MONITORING${NC}"
    echo " 24) Start Security Monitoring"
    echo " 25) Monitor with Error Tracking"
    echo ""
    echo -e "${YELLOW}SPECIALIZED MONITORING${NC}"
    echo " 26) Setup AgentAPI Monitoring"
    echo " 27) Apply AI Gateway Monitoring"
    echo " 28) Deploy Local Dev with Monitoring"
    echo ""
    echo -e "${RED}0) Back to Main Menu${NC}"
    echo ""
}

# Deploy monitoring stack
deploy_monitoring() {
    log_section "Deploy Datadog Monitoring Stack"

    if [ ! -f "$SCRIPTS_DIR/deploy-monitoring.sh" ]; then
        log_error "deploy-monitoring.sh not found"
        return 1
    fi

    echo -e "${YELLOW}Deploy methods:${NC}"
    echo "  1) Docker Compose (default)"
    echo "  2) Kubernetes"
    echo ""
    read -p "Select deployment method (1-2) [1]: " method_choice
    method_choice=${method_choice:-1}

    case $method_choice in
        1)
            read -p "Enter Datadog API key: " dd_api_key
            if [ -z "$dd_api_key" ]; then
                log_error "Datadog API key is required"
                return 1
            fi
            bash "$SCRIPTS_DIR/deploy-monitoring.sh" -d "$dd_api_key"
            ;;
        2)
            read -p "Enter Datadog API key: " dd_api_key
            read -p "Enter Kubernetes namespace [vibecode-monitoring]: " k8s_ns
            k8s_ns=${k8s_ns:-vibecode-monitoring}

            if [ -z "$dd_api_key" ]; then
                log_error "Datadog API key is required"
                return 1
            fi
            bash "$SCRIPTS_DIR/deploy-monitoring.sh" -m kubernetes -n "$k8s_ns" -d "$dd_api_key"
            ;;
        *)
            log_error "Invalid choice"
            return 1
            ;;
    esac

    log_success "Monitoring stack deployment completed"
}

# Setup Azure OpenAI monitoring
setup_azure_openai_monitoring() {
    log_section "Setup Azure OpenAI Monitoring"

    if [ ! -f "$SCRIPTS_DIR/setup-azure-openai-monitoring.sh" ]; then
        log_error "setup-azure-openai-monitoring.sh not found"
        return 1
    fi

    log_info "This requires Azure credentials to be set in environment"
    log_info "Required: AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID, etc."

    read -p "Continue? (y/N): " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        log_info "Cancelled"
        return 0
    fi

    bash "$SCRIPTS_DIR/setup-azure-openai-monitoring.sh"
}

# Setup AKS monitoring
setup_aks_monitoring() {
    log_section "Setup AKS Datadog Monitoring"

    if [ ! -f "$SCRIPTS_DIR/setup-aks-datadog-monitoring.sh" ]; then
        log_error "setup-aks-datadog-monitoring.sh not found"
        return 1
    fi

    bash "$SCRIPTS_DIR/setup-aks-datadog-monitoring.sh"
}

# Setup PostgreSQL monitoring
setup_postgres_monitoring() {
    log_section "Setup PostgreSQL Datadog Monitoring"

    if [ ! -f "$SCRIPTS_DIR/setup-postgres-datadog-monitoring.sh" ]; then
        log_error "setup-postgres-datadog-monitoring.sh not found"
        return 1
    fi

    bash "$SCRIPTS_DIR/setup-postgres-datadog-monitoring.sh"
}

# Check Datadog DBM metrics
check_dbm_metrics() {
    log_section "Check Datadog DBM Metrics"

    if [ ! -f "$SCRIPTS_DIR/check-datadog-dbmon-metrics.sh" ]; then
        log_error "check-datadog-dbmon-metrics.sh not found"
        return 1
    fi

    bash "$SCRIPTS_DIR/check-datadog-dbmon-metrics.sh"
}

# Verify Datadog metrics
verify_datadog_metrics() {
    log_section "Verify Datadog Metrics"

    if [ ! -f "$SCRIPTS_DIR/verify-datadog-metrics.js" ]; then
        log_error "verify-datadog-metrics.js not found"
        return 1
    fi

    if ! command_exists node; then
        log_error "Node.js is required but not installed"
        return 1
    fi

    node "$SCRIPTS_DIR/verify-datadog-metrics.js"
}

# Record performance baseline
record_baseline() {
    log_section "Record Performance Baseline"

    read -p "Enter baseline name: " baseline_name
    if [ -z "$baseline_name" ]; then
        log_error "Baseline name is required"
        return 1
    fi

    BASELINES_DIR="$PROJECT_ROOT/.baselines"
    mkdir -p "$BASELINES_DIR"

    BASELINE_FILE="$BASELINES_DIR/${baseline_name}-$(date +%Y%m%d-%H%M%S).json"

    log_info "Recording system metrics..."

    # Gather system metrics
    cat > "$BASELINE_FILE" << EOF
{
  "name": "$baseline_name",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "system": {
    "cpu_usage": "$(top -l 1 | grep "CPU usage" | awk '{print $3}' || echo "N/A")",
    "memory_usage": "$(top -l 1 | grep "PhysMem" | awk '{print $2}' || echo "N/A")",
    "disk_usage": "$(df -h / | awk 'NR==2 {print $5}' || echo "N/A")"
  },
  "node": {
    "version": "$(node -v 2>/dev/null || echo "N/A")"
  }
}
EOF

    log_success "Baseline recorded: $BASELINE_FILE"
}

# View performance baselines
view_baselines() {
    log_section "View Performance Baselines"

    BASELINES_DIR="$PROJECT_ROOT/.baselines"

    if [ ! -d "$BASELINES_DIR" ] || [ -z "$(ls -A "$BASELINES_DIR" 2>/dev/null)" ]; then
        log_warn "No baselines found. Create one first using option 7."
        return 0
    fi

    echo -e "${BLUE}Available baselines:${NC}\n"
    ls -lh "$BASELINES_DIR" | tail -n +2
}

# Compare performance baselines
compare_baselines() {
    log_section "Compare Performance Baselines"

    BASELINES_DIR="$PROJECT_ROOT/.baselines"

    if [ ! -d "$BASELINES_DIR" ] || [ -z "$(ls -A "$BASELINES_DIR" 2>/dev/null)" ]; then
        log_warn "No baselines found. Create some first using option 7."
        return 0
    fi

    log_info "Available baselines:"
    ls -1 "$BASELINES_DIR"
    echo ""

    read -p "Enter first baseline filename: " baseline1
    read -p "Enter second baseline filename: " baseline2

    if [ ! -f "$BASELINES_DIR/$baseline1" ] || [ ! -f "$BASELINES_DIR/$baseline2" ]; then
        log_error "One or both baseline files not found"
        return 1
    fi

    echo -e "\n${YELLOW}Baseline 1:${NC}"
    cat "$BASELINES_DIR/$baseline1" | jq . 2>/dev/null || cat "$BASELINES_DIR/$baseline1"

    echo -e "\n${YELLOW}Baseline 2:${NC}"
    cat "$BASELINES_DIR/$baseline2" | jq . 2>/dev/null || cat "$BASELINES_DIR/$baseline2"
}

# Continuous performance monitor
continuous_monitor() {
    log_section "Continuous Performance Monitor"

    if [ ! -f "$SCRIPTS_DIR/vfkit/continuous-performance-monitor.sh" ]; then
        log_error "continuous-performance-monitor.sh not found"
        return 1
    fi

    log_warn "This will start a continuous monitoring process."
    log_info "Press Ctrl+C to stop monitoring."

    read -p "Continue? (y/N): " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        return 0
    fi

    bash "$SCRIPTS_DIR/vfkit/continuous-performance-monitor.sh"
}

# View application logs
view_logs() {
    log_section "View Application Logs"

    LOG_DIRS=(
        "/var/log/vibecode"
        "$PROJECT_ROOT/logs"
        "$PROJECT_ROOT/.next/logs"
    )

    for dir in "${LOG_DIRS[@]}"; do
        if [ -d "$dir" ]; then
            log_info "Logs in $dir:"
            ls -lh "$dir" 2>/dev/null || true
            echo ""
        fi
    done

    read -p "Enter log file path to view (or press Enter to skip): " log_file
    if [ -n "$log_file" ] && [ -f "$log_file" ]; then
        less "$log_file"
    fi
}

# Search logs
search_logs() {
    log_section "Search Logs"

    read -p "Enter search pattern: " pattern
    if [ -z "$pattern" ]; then
        log_error "Search pattern is required"
        return 1
    fi

    read -p "Enter log directory [$PROJECT_ROOT/logs]: " log_dir
    log_dir=${log_dir:-"$PROJECT_ROOT/logs"}

    if [ ! -d "$log_dir" ]; then
        log_error "Directory not found: $log_dir"
        return 1
    fi

    log_info "Searching for: $pattern"
    grep -r "$pattern" "$log_dir" --color=auto || log_warn "No matches found"
}

# Tail live logs
tail_logs() {
    log_section "Tail Live Logs"

    LOG_FILES=(
        "$PROJECT_ROOT/logs/combined.log"
        "$PROJECT_ROOT/logs/error.log"
        "/var/log/vibecode/combined.log"
    )

    echo -e "${BLUE}Available log files:${NC}"
    for i in "${!LOG_FILES[@]}"; do
        if [ -f "${LOG_FILES[$i]}" ]; then
            echo "  $((i+1))) ${LOG_FILES[$i]}"
        fi
    done
    echo ""

    read -p "Enter log file number or path: " choice

    if [[ "$choice" =~ ^[0-9]+$ ]] && [ "$choice" -ge 1 ] && [ "$choice" -le "${#LOG_FILES[@]}" ]; then
        log_file="${LOG_FILES[$((choice-1))]}"
    else
        log_file="$choice"
    fi

    if [ ! -f "$log_file" ]; then
        log_error "Log file not found: $log_file"
        return 1
    fi

    log_info "Tailing: $log_file (Ctrl+C to stop)"
    tail -f "$log_file"
}

# Test Datadog logging
test_datadog_logging() {
    log_section "Test Datadog Logging"

    if [ ! -f "$SCRIPTS_DIR/tests/datadog/test-datadog-logging.sh" ]; then
        log_error "test-datadog-logging.sh not found"
        return 1
    fi

    bash "$SCRIPTS_DIR/tests/datadog/test-datadog-logging.sh"
}

# View system metrics
view_system_metrics() {
    log_section "View System Metrics"

    echo -e "${YELLOW}CPU Usage:${NC}"
    top -l 1 | grep "CPU usage" || echo "N/A"
    echo ""

    echo -e "${YELLOW}Memory Usage:${NC}"
    top -l 1 | grep "PhysMem" || echo "N/A"
    echo ""

    echo -e "${YELLOW}Disk Usage:${NC}"
    df -h
    echo ""

    echo -e "${YELLOW}Network Connections:${NC}"
    netstat -an | grep ESTABLISHED | wc -l | xargs echo "Active connections:"
}

# View application metrics
view_app_metrics() {
    log_section "View Application Metrics"

    log_info "Checking application processes..."

    if pgrep -f "node.*next" > /dev/null; then
        log_success "Next.js application is running"
        ps aux | grep "node.*next" | grep -v grep
    else
        log_warn "Next.js application not running"
    fi
    echo ""

    if pgrep -f "docker" > /dev/null; then
        log_success "Docker is running"
        docker ps 2>/dev/null || true
    else
        log_warn "Docker not running"
    fi
}

# Setup production monitoring
setup_production_monitoring() {
    log_section "Setup Production Monitoring"

    if [ ! -f "$SCRIPTS_DIR/setup-production-monitoring.sh" ]; then
        log_error "setup-production-monitoring.sh not found"
        return 1
    fi

    bash "$SCRIPTS_DIR/setup-production-monitoring.sh"
}

# Validate monitoring setup
validate_monitoring() {
    log_section "Validate Monitoring Setup"

    if [ -f "$SCRIPTS_DIR/validate-monitoring.js" ]; then
        log_info "Running validation script..."
        node "$SCRIPTS_DIR/validate-monitoring.js"
    elif [ -f "$SCRIPTS_DIR/test-monitoring.sh" ]; then
        log_info "Running test monitoring script..."
        bash "$SCRIPTS_DIR/test-monitoring.sh"
    else
        log_error "No validation script found"
        return 1
    fi
}

# Check system health
check_system_health() {
    log_section "Check System Health"

    log_info "Checking system health..."

    # Check disk space
    DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ "$DISK_USAGE" -gt 90 ]; then
        log_error "Disk usage critical: ${DISK_USAGE}%"
    elif [ "$DISK_USAGE" -gt 80 ]; then
        log_warn "Disk usage high: ${DISK_USAGE}%"
    else
        log_success "Disk usage OK: ${DISK_USAGE}%"
    fi

    # Check if Docker is running
    if command_exists docker && docker info &> /dev/null; then
        log_success "Docker is healthy"
    else
        log_warn "Docker is not running or not accessible"
    fi

    # Check if application is running
    if pgrep -f "node.*next" > /dev/null; then
        log_success "Application is running"
    else
        log_warn "Application is not running"
    fi
}

# Check services health
check_services_health() {
    log_section "Check Services Health"

    if [ ! -f "$SCRIPTS_DIR/test-health-endpoints.sh" ]; then
        log_error "test-health-endpoints.sh not found"
        return 1
    fi

    bash "$SCRIPTS_DIR/test-health-endpoints.sh"
}

# Validate health endpoints
validate_health_endpoints() {
    log_section "Validate Health Endpoints"

    if [ ! -f "$SCRIPTS_DIR/validate-healthchecks.sh" ]; then
        log_error "validate-healthchecks.sh not found"
        return 1
    fi

    bash "$SCRIPTS_DIR/validate-healthchecks.sh"
}

# Test K8s health probes
test_k8s_health_probes() {
    log_section "Test K8s Health Probes"

    if [ ! -f "$SCRIPTS_DIR/test-k8s-health-probes.sh" ]; then
        log_error "test-k8s-health-probes.sh not found"
        return 1
    fi

    bash "$SCRIPTS_DIR/test-k8s-health-probes.sh"
}

# Validate PostgreSQL monitoring
validate_postgres_monitoring() {
    log_section "Validate PostgreSQL Monitoring"

    if [ ! -f "$SCRIPTS_DIR/validate-postgres-monitoring.sh" ]; then
        log_error "validate-postgres-monitoring.sh not found"
        return 1
    fi

    bash "$SCRIPTS_DIR/validate-postgres-monitoring.sh"
}

# Start security monitoring
start_security_monitoring() {
    log_section "Start Security Monitoring"

    if [ ! -f "$SCRIPTS_DIR/security-monitoring.sh" ]; then
        log_error "security-monitoring.sh not found"
        return 1
    fi

    log_warn "This will start a continuous security monitoring process."
    log_info "It will monitor for threats, vulnerabilities, and suspicious activity."
    log_info "Press Ctrl+C to stop monitoring."

    read -p "Continue? (y/N): " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        return 0
    fi

    bash "$SCRIPTS_DIR/security-monitoring.sh"
}

# Monitor with error tracking
monitor_error_tracking() {
    log_section "Monitor with Error Tracking"

    if [ ! -f "$SCRIPTS_DIR/monitor-with-error-tracking.sh" ]; then
        log_error "monitor-with-error-tracking.sh not found"
        return 1
    fi

    bash "$SCRIPTS_DIR/monitor-with-error-tracking.sh"
}

# Setup AgentAPI monitoring
setup_agentapi_monitoring() {
    log_section "Setup AgentAPI Monitoring"

    if [ ! -f "$SCRIPTS_DIR/setup-agentapi-monitoring.ts" ]; then
        log_error "setup-agentapi-monitoring.ts not found"
        return 1
    fi

    if ! command_exists npx; then
        log_error "npx is required but not installed"
        return 1
    fi

    npx ts-node "$SCRIPTS_DIR/setup-agentapi-monitoring.ts"
}

# Apply AI gateway monitoring
apply_ai_gateway_monitoring() {
    log_section "Apply AI Gateway Monitoring"

    if [ ! -f "$SCRIPTS_DIR/apply-ai-gateway-monitoring.ts" ]; then
        log_error "apply-ai-gateway-monitoring.ts not found"
        return 1
    fi

    if ! command_exists npx; then
        log_error "npx is required but not installed"
        return 1
    fi

    npx ts-node "$SCRIPTS_DIR/apply-ai-gateway-monitoring.ts"
}

# Deploy local dev with monitoring
deploy_local_dev_monitoring() {
    log_section "Deploy Local Dev with Monitoring"

    if [ ! -f "$SCRIPTS_DIR/setup-local-dev-with-monitoring.sh" ]; then
        log_error "setup-local-dev-with-monitoring.sh not found"
        return 1
    fi

    bash "$SCRIPTS_DIR/setup-local-dev-with-monitoring.sh"
}

# Main menu loop
main() {
    while true; do
        show_header
        show_menu

        read -p "Enter your choice: " choice

        case $choice in
            1) deploy_monitoring ;;
            2) setup_azure_openai_monitoring ;;
            3) setup_aks_monitoring ;;
            4) setup_postgres_monitoring ;;
            5) check_dbm_metrics ;;
            6) verify_datadog_metrics ;;
            7) record_baseline ;;
            8) view_baselines ;;
            9) compare_baselines ;;
            10) continuous_monitor ;;
            11) view_logs ;;
            12) search_logs ;;
            13) tail_logs ;;
            14) test_datadog_logging ;;
            15) view_system_metrics ;;
            16) view_app_metrics ;;
            17) setup_production_monitoring ;;
            18) validate_monitoring ;;
            19) check_system_health ;;
            20) check_services_health ;;
            21) validate_health_endpoints ;;
            22) test_k8s_health_probes ;;
            23) validate_postgres_monitoring ;;
            24) start_security_monitoring ;;
            25) monitor_error_tracking ;;
            26) setup_agentapi_monitoring ;;
            27) apply_ai_gateway_monitoring ;;
            28) deploy_local_dev_monitoring ;;
            0)
                log_info "Returning to main menu..."
                exit 0
                ;;
            *)
                log_error "Invalid choice. Please try again."
                ;;
        esac

        echo ""
        read -p "Press Enter to continue..."
    done
}

# Run main function
main "$@"
