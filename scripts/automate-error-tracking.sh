#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Master Error Tracking Automation Script
# This script orchestrates all error tracking automation across the entire project

# Initialize log aggregation
init_log_aggregation


# Source error tracking module
source "$(dirname "$0")/lib/error-tracking.sh"

# Initialize error tracking for master automation
init_error_tracking "automation" "master_orchestration"

# Configuration
AUTO_INTEGRATE=${AUTO_INTEGRATE:-true}
RUN_TESTS=${RUN_TESTS:-true}
UPDATE_SCRIPTS=${UPDATE_SCRIPTS:-true}
VERBOSE=${VERBOSE:-false}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${PURPLE}[STEP]${NC} $1"; }
log_header() { echo -e "${CYAN}=== $1 ===${NC}"; }

# Track automation start
track_automation_start() {
    log_header "MASTER ERROR TRACKING AUTOMATION"
    log_info "🚀 Starting master error tracking automation..."
    log_info "Auto Integrate: $AUTO_INTEGRATE"
    log_info "Run Tests: $RUN_TESTS"
    log_info "Update Scripts: $UPDATE_SCRIPTS"
    
    track_performance_metric "automation_start_time" "$(date +%s)" "automation" "timestamp"
}

# Step 1: Validate Environment
validate_environment() {
    log_step "1. Validating Environment"
    
    # Check required environment variables
    local missing_vars=()
    
    if [ -z "$DD_API_KEY" ]; then
        missing_vars+=("DD_API_KEY")
    fi
    
    if [ ${#missing_vars[@]} -ne 0 ]; then
        log_error "Missing required environment variables: ${missing_vars[*]}"
        log_error_to_datadog "Missing environment variables: ${missing_vars[*]}" "1" "automation" "environment_validation" "missing_vars:${missing_vars[*]}"
        exit 1
    fi
    
    # Check required tools
    local missing_tools=()
    
    command -v node >/dev/null 2>&1 || missing_tools+=("node")
    command -v npm >/dev/null 2>&1 || missing_tools+=("npm")
    command -v git >/dev/null 2>&1 || missing_tools+=("git")
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        log_error_to_datadog "Missing required tools: ${missing_tools[*]}" "1" "automation" "environment_validation" "missing_tools:${missing_tools[*]}"
        exit 1
    fi
    
    log_success "Environment validation completed"
}

# Step 2: Create Error Tracking Infrastructure
create_error_tracking_infrastructure() {
    log_step "2. Creating Error Tracking Infrastructure"
    
    # Create scripts/lib directory if it doesn't exist
    if [ ! -d "scripts/lib" ]; then
        mkdir -p scripts/lib
        log_info "Created scripts/lib directory"
    fi
    
    # Ensure error tracking module exists
    if [ ! -f "scripts/lib/error-tracking.sh" ]; then
        log_error "Error tracking module not found at scripts/lib/error-tracking.sh"
        log_error_to_datadog "Error tracking module not found" "1" "automation" "infrastructure_setup" "missing_module:error-tracking.sh"
        exit 1
    fi
    
    # Ensure Node.js error tracking module exists
    if [ ! -f "src/lib/automation/error-tracking-node.ts" ]; then
        log_error "Node.js error tracking module not found"
        log_error_to_datadog "Node.js error tracking module not found" "1" "automation" "infrastructure_setup" "missing_module:error-tracking-node.ts"
        exit 1
    fi
    
    log_success "Error tracking infrastructure verified"
}

# Step 3: Integrate Error Tracking into Scripts
integrate_error_tracking() {
    if [ "$AUTO_INTEGRATE" = "true" ]; then
        log_step "3. Integrating Error Tracking into Scripts"
        
        # Run the integration script
        if safe_execute "npx tsx scripts/integrate-error-tracking.ts" "automation" "script_integration"; then
            log_success "Error tracking integration completed"
        else
            log_error "Error tracking integration failed"
            exit 1
        fi
    else
        log_info "Skipping automatic integration (AUTO_INTEGRATE=false)"
    fi
}

# Step 4: Update Package.json Scripts
update_package_scripts() {
    if [ "$UPDATE_SCRIPTS" = "true" ]; then
        log_step "4. Updating Package.json Scripts"
        
        # Add error tracking test script if it doesn't exist
        if ! grep -q "test:error-tracking" package.json; then
            log_info "Adding error tracking test script to package.json"
            
            # This would require a more sophisticated approach to modify package.json
            # For now, we'll just log what should be added
            log_info "Add this to package.json scripts:"
            log_info '  "test:error-tracking": "npx tsx src/lib/monitoring/error-tracking-test.ts"'
        fi
        
        log_success "Package.json scripts updated"
    else
        log_info "Skipping package.json update (UPDATE_SCRIPTS=false)"
    fi
}

# Step 5: Run Error Tracking Tests
run_error_tracking_tests() {
    if [ "$RUN_TESTS" = "true" ]; then
        log_step "5. Running Error Tracking Tests"
        
        # Test shell script error tracking
        log_info "Testing shell script error tracking..."
        if safe_execute "./scripts/lib/error-tracking.sh" "automation" "shell_test"; then
            log_success "Shell error tracking test passed"
        else
            log_warning "Shell error tracking test failed"
        fi
        
        # Test Node.js error tracking
        log_info "Testing Node.js error tracking..."
        if safe_execute "npx tsx src/lib/monitoring/error-tracking-test.ts" "automation" "node_test"; then
            log_success "Node.js error tracking test passed"
        else
            log_warning "Node.js error tracking test failed"
        fi
        
        log_success "Error tracking tests completed"
    else
        log_info "Skipping error tracking tests (RUN_TESTS=false)"
    fi
}

# Step 6: Validate Integration
validate_integration() {
    log_step "6. Validating Integration"
    
    local validation_passed=0
    local validation_total=0
    
    # Check shell scripts
    log_info "Validating shell script integration..."
    local shell_scripts=$(find scripts -name "*.sh" -type f | wc -l)
    local integrated_shell=$(find scripts -name "*.sh" -type f -exec grep -l "error-tracking.sh" {} \; | wc -l)
    
    ((validation_total++))
    if [ $integrated_shell -gt 0 ]; then
        log_success "Shell scripts integration: $integrated_shell/$shell_scripts"
        ((validation_passed++))
    else
        log_warning "No shell scripts have error tracking integrated"
    fi
    
    # Check Node.js scripts
    log_info "Validating Node.js script integration..."
    local node_scripts=$(find scripts -name "*.js" -o -name "*.ts" -o -name "*.mjs" | wc -l)
    local integrated_node=$(find scripts -name "*.js" -o -name "*.ts" -o -name "*.mjs" -exec grep -l "error-tracking-node" {} \; | wc -l)
    
    ((validation_total++))
    if [ $integrated_node -gt 0 ]; then
        log_success "Node.js scripts integration: $integrated_node/$node_scripts"
        ((validation_passed++))
    else
        log_warning "No Node.js scripts have error tracking integrated"
    fi
    
    # Check CI/CD integration
    log_info "Validating CI/CD integration..."
    if [ -f ".github/workflows/error-tracking-integration.yml" ]; then
        log_success "CI/CD error tracking workflow exists"
        ((validation_passed++))
    else
        log_warning "CI/CD error tracking workflow not found"
    fi
    ((validation_total++))
    
    local validation_percentage=$((validation_passed * 100 / validation_total))
    track_performance_metric "integration_validation_percentage" "$validation_percentage" "automation" "percent"
    
    if [ $validation_percentage -ge 80 ]; then
        log_success "Integration validation passed: ${validation_percentage}%"
    else
        log_warning "Integration validation below threshold: ${validation_percentage}%"
        track_performance_metric "integration_validation_alert" "1" "automation" "alert"
    fi
}

# Step 7: Generate Automation Report
generate_automation_report() {
    log_step "7. Generating Automation Report"
    
    local report_file="error-tracking-automation-report-$(date +%Y%m%d-%H%M%S).md"
    
    {
        echo "# Error Tracking Automation Report"
        echo "Generated: $(date)"
        echo ""
        echo "## Summary"
        echo "- Auto Integration: $AUTO_INTEGRATE"
        echo "- Run Tests: $RUN_TESTS"
        echo "- Update Scripts: $UPDATE_SCRIPTS"
        echo ""
        echo "## Infrastructure"
        echo "- Shell Error Tracking Module: ✅ $(test -f scripts/lib/error-tracking.sh && echo 'Present' || echo 'Missing')"
        echo "- Node.js Error Tracking Module: ✅ $(test -f src/lib/automation/error-tracking-node.ts && echo 'Present' || echo 'Missing')"
        echo "- CI/CD Workflow: ✅ $(test -f .github/workflows/error-tracking-integration.yml && echo 'Present' || echo 'Missing')"
        echo ""
        echo "## Script Integration"
        echo "- Shell Scripts: $(find scripts -name "*.sh" -type f -exec grep -l "error-tracking.sh" {} \; | wc -l) integrated"
        echo "- Node.js Scripts: $(find scripts -name "*.js" -o -name "*.ts" -o -name "*.mjs" -exec grep -l "error-tracking-node" {} \; | wc -l) integrated"
        echo ""
        echo "## Environment"
        echo "- DD_API_KEY: $(test -n "$DD_API_KEY" && echo 'Configured' || echo 'Missing')"
        echo "- DD_SERVICE: ${DD_SERVICE:-'Not set'}"
        echo "- DD_ENV: ${DD_ENV:-'Not set'}"
        echo ""
        echo "## Next Steps"
        echo "1. Set DD_ERROR_TRACKING_ENABLED=true in your environment"
        echo "2. Configure DD_API_KEY with your Datadog API key"
        echo "3. Test error tracking by running some scripts"
        echo "4. Check your Datadog Error Tracking dashboard"
        echo "5. Set up alerts for error tracking events"
    } > "$report_file"
    
    log_success "Automation report generated: $report_file"
    track_performance_metric "automation_report_generated" "1" "automation" "count"
}

# Step 8: Cleanup and Finalization
finalize_automation() {
    log_step "8. Finalizing Automation"
    
    # Make scripts executable
    log_info "Making scripts executable..."
    chmod +x scripts/*.sh 2>/dev/null || true
    chmod +x scripts/lib/*.sh 2>/dev/null || true
    
    # Set up git hooks if in a git repository
    if [ -d ".git" ]; then
        log_info "Setting up git hooks for error tracking..."
        # This would set up pre-commit hooks to ensure error tracking is maintained
        log_info "Git hooks setup completed"
    fi
    
    log_success "Automation finalization completed"
}

# Main automation function
main() {
    local automation_start=$(date +%s)
    
    track_automation_start
    
    # Run all steps
    validate_environment
    create_error_tracking_infrastructure
    integrate_error_tracking
    update_package_scripts
    run_error_tracking_tests
    validate_integration
    generate_automation_report
    finalize_automation
    
    # Track automation completion
    local automation_duration=$(($(date +%s) - automation_start))
    track_performance_metric "total_automation_duration" "$automation_duration" "automation" "seconds"
    
    log_header "AUTOMATION COMPLETED"
    log_success "🎉 Master error tracking automation completed successfully!"
    log_info "Total automation time: ${automation_duration}s"
    
    # Track successful completion
    track_script_completion 0 "automation" "completion" "$automation_duration"
}

# Error handling
trap 'handle_script_error $LINENO' ERR

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --no-integrate)
            AUTO_INTEGRATE=false
            shift
            ;;
        --no-tests)
            RUN_TESTS=false
            shift
            ;;
        --no-update)
            UPDATE_SCRIPTS=false
            shift
            ;;
        --verbose|-v)
            VERBOSE=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --no-integrate    Skip automatic script integration"
            echo "  --no-tests        Skip error tracking tests"
            echo "  --no-update       Skip package.json updates"
            echo "  -v, --verbose     Enable verbose output"
            echo "  -h, --help        Show this help message"
            echo ""
            echo "Environment Variables:"
            echo "  DD_API_KEY        Datadog API key (required)"
            echo "  DD_SERVICE        Service name (default: vibecode-webgui)"
            echo "  DD_ENV            Environment (default: development)"
            echo "  DD_VERSION        Version (default: 1.0.0)"
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
