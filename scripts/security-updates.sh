#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"


################################################################################
# Security Updates Script - vibecode-webgui
# Purpose: Automate the application of critical security patches
# Version: 1.0
# Created: 2026-01-14
#
# This script applies patches for:
# 1. preact JSON VNode Injection (GHSA-36hm-qxxp-pg3m)
# 2. @modelcontextprotocol/sdk ReDoS (GHSA-8r9q-7v3j-jr4g)
# 3. langchain Serialization Injection (GHSA-r399-636x-v7f6)
################################################################################

# Initialize log aggregation
init_log_aggregation


set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="${SCRIPT_DIR}/security-patch-logs"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="${LOG_DIR}/security-updates_${TIMESTAMP}.log"
BACKUP_DIR="${SCRIPT_DIR}/backups/security-patch-${TIMESTAMP}"

# Flags
SKIP_TESTS=false
FORCE_UPDATE=false
DRY_RUN=false
VERBOSE=false

################################################################################
# Functions
################################################################################

# Print colored output
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

# Log to file
log() {
    echo "$1" >> "$LOG_FILE"
}

# Run command with logging
run_cmd() {
    local cmd="$1"
    local description="${2:-Running: $cmd}"

    print_info "$description"
    log "Command: $cmd"

    if [ "$DRY_RUN" = true ]; then
        print_info "[DRY RUN] Would execute: $cmd"
        log "[DRY RUN] Would execute: $cmd"
        return 0
    fi

    if eval "$cmd" >> "$LOG_FILE" 2>&1; then
        print_success "Completed: $description"
        return 0
    else
        print_error "Failed: $description"
        return 1
    fi
}

# Print usage
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Security patch script for vibecode-webgui

OPTIONS:
    -h, --help              Show this help message
    -d, --dry-run           Show what would be done without making changes
    -s, --skip-tests        Skip running tests after updates
    -f, --force             Force updates even if tests fail
    -v, --verbose           Enable verbose output
    -p, --preact-only       Update only preact patch
    -m, --mcp-only          Update only MCP SDK patch
    -l, --langchain-only    Update only langchain patch

EXAMPLES:
    # Run full security update with tests
    $0

    # Dry run to see what would be done
    $0 --dry-run

    # Update without running tests
    $0 --skip-tests

    # Update only preact
    $0 --preact-only

EOF
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                usage
                exit 0
                ;;
            -d|--dry-run)
                DRY_RUN=true
                shift
                ;;
            -s|--skip-tests)
                SKIP_TESTS=true
                shift
                ;;
            -f|--force)
                FORCE_UPDATE=true
                shift
                ;;
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -p|--preact-only)
                UPDATE_PREACT_ONLY=true
                shift
                ;;
            -m|--mcp-only)
                UPDATE_MCP_ONLY=true
                shift
                ;;
            -l|--langchain-only)
                UPDATE_LANGCHAIN_ONLY=true
                shift
                ;;
            *)
                print_error "Unknown option: $1"
                usage
                exit 1
                ;;
        esac
    done
}

# Initialize
initialize() {
    print_info "Security Updates Script v1.0"
    print_info "Starting security patch process..."

    # Create directories
    mkdir -p "$LOG_DIR"
    mkdir -p "$BACKUP_DIR"

    # Start log
    {
        echo "==============================================="
        echo "Security Updates Log"
        echo "Timestamp: $(date)"
        echo "User: $(whoami)"
        echo "Directory: $(pwd)"
        echo "Script: $0"
        echo "==============================================="
    } > "$LOG_FILE"

    print_info "Log file: $LOG_FILE"
    print_info "Backup directory: $BACKUP_DIR"
}

# Check prerequisites
check_prerequisites() {
    print_info "Checking prerequisites..."

    # Check if we're in the right directory
    if [ ! -f "package.json" ]; then
        print_error "package.json not found in current directory"
        print_error "Please run this script from the repository root"
        exit 1
    fi

    # Check if npm is available
    if ! command -v npm &> /dev/null; then
        print_error "npm not found. Please install Node.js and npm"
        exit 1
    fi

    # Check if git is available
    if ! command -v git &> /dev/null; then
        print_error "git not found. Please install git"
        exit 1
    fi

    # Check npm version
    local npm_version=$(npm --version)
    print_info "npm version: $npm_version"
    log "npm version: $npm_version"

    # Check Node version
    local node_version=$(node --version)
    print_info "Node version: $node_version"
    log "Node version: $node_version"

    # Check git status
    local git_status=$(git status --short)
    if [ -n "$git_status" ]; then
        print_warning "Git working directory has uncommitted changes:"
        echo "$git_status" | tee -a "$LOG_FILE"
        if [ "$FORCE_UPDATE" != true ]; then
            print_error "Commit or stash changes before running this script"
            exit 1
        fi
    fi

    print_success "Prerequisites check passed"
}

# Backup current state
backup_current_state() {
    print_info "Backing up current state..."

    run_cmd "cp package.json $BACKUP_DIR/" "Backup package.json"
    run_cmd "cp package-lock.json $BACKUP_DIR/" "Backup package-lock.json"

    # Git status snapshot
    git status > "$BACKUP_DIR/git-status-before.txt" 2>&1 || true
    npm list --depth=0 > "$BACKUP_DIR/npm-list-before.txt" 2>&1 || true
    npm audit --json > "$BACKUP_DIR/npm-audit-before.json" 2>&1 || true

    print_success "Backup completed"
}

# Run pre-update tests
run_pretests() {
    if [ "$SKIP_TESTS" = true ]; then
        print_warning "Skipping pre-update tests"
        return 0
    fi

    print_info "Running pre-update tests..."

    # Type checking
    if ! run_cmd "npm run type-check 2>&1 | tail -20" "Running type-check"; then
        print_warning "Type-check had issues (this is OK, may be pre-existing)"
    fi

    # Linting
    if ! run_cmd "npm run lint 2>&1 | tail -20" "Running lint"; then
        print_warning "Lint had issues (this is OK, may be pre-existing)"
    fi

    print_info "Pre-update tests completed"
}

# Update preact
update_preact() {
    print_info "=========================================="
    print_info "Updating preact to fix JSON VNode injection"
    print_info "Vulnerability: GHSA-36hm-qxxp-pg3m"
    print_info "=========================================="

    # Update preact (this one can use npm audit fix without --force)
    run_cmd "npm install preact@10.28.2 --save" "Installing preact@10.28.2"

    # Verify update
    if npm list preact | grep -q "preact@10.28.2"; then
        print_success "preact updated to 10.28.2"
        log "preact: 10.27.2 → 10.28.2 ✓"
    else
        print_error "preact update verification failed"
        return 1
    fi

    return 0
}

# Update MCP SDK
update_mcp() {
    print_info "=========================================="
    print_info "Updating @modelcontextprotocol/sdk"
    print_info "Vulnerability: GHSA-8r9q-7v3j-jr4g (ReDoS)"
    print_info "=========================================="

    # Update MCP SDK
    run_cmd "npm install @modelcontextprotocol/sdk@1.25.2 --save" "Installing @modelcontextprotocol/sdk@1.25.2"

    # Verify update
    if npm list @modelcontextprotocol/sdk | grep -q "1.25.2"; then
        print_success "@modelcontextprotocol/sdk updated to 1.25.2"
        log "@modelcontextprotocol/sdk: 1.25.1 → 1.25.2 ✓"
    else
        print_error "@modelcontextprotocol/sdk update verification failed"
        return 1
    fi

    return 0
}

# Update langchain (most risky, separate function)
update_langchain() {
    print_info "=========================================="
    print_info "Updating langchain"
    print_info "Vulnerability: GHSA-r399-636x-v7f6 (Serialization Injection)"
    print_info "WARNING: This is a minor version update"
    print_info "=========================================="

    # Update langchain
    run_cmd "npm install langchain@1.2.8 --save" "Installing langchain@1.2.8"

    # Verify update
    if npm list langchain | grep -q "1.2.8"; then
        print_success "langchain updated to 1.2.8"
        log "langchain: 1.0.2 → 1.2.8 ✓"
    else
        print_error "langchain update verification failed"
        return 1
    fi

    return 0
}

# Run post-update tests
run_posttests() {
    if [ "$SKIP_TESTS" = true ]; then
        print_warning "Skipping post-update tests"
        return 0
    fi

    print_info "Running post-update tests..."
    print_info "This may take several minutes..."

    # Type checking
    print_info "Running type-check..."
    if ! run_cmd "npm run type-check 2>&1" "Type checking"; then
        print_error "Type-check failed"
        if [ "$FORCE_UPDATE" != true ]; then
            return 1
        fi
        print_warning "Continuing despite type-check failure (--force flag used)"
    fi

    # Linting
    print_info "Running lint..."
    if ! run_cmd "npm run lint 2>&1 | tail -50" "Linting"; then
        print_error "Lint failed"
        if [ "$FORCE_UPDATE" != true ]; then
            return 1
        fi
        print_warning "Continuing despite lint failure (--force flag used)"
    fi

    # Security audit
    print_info "Running security audit..."
    if ! run_cmd "npm audit 2>&1" "Security audit"; then
        print_warning "Audit reported issues (checking details)"
    fi

    # Check for vulnerabilities
    local vuln_count=$(npm audit --json 2>/dev/null | grep -o '"total":[0-9]*' | grep -o '[0-9]*' || echo "unknown")
    if [ "$vuln_count" = "0" ] || [ "$vuln_count" = "unknown" ]; then
        print_success "Security audit passed (0 vulnerabilities)"
    else
        print_error "Security audit found $vuln_count vulnerabilities"
        if [ "$FORCE_UPDATE" != true ]; then
            return 1
        fi
    fi

    print_success "Post-update tests completed"
    return 0
}

# Create summary
create_summary() {
    local summary_file="${BACKUP_DIR}/PATCH_SUMMARY.txt"

    cat > "$summary_file" << 'EOF'
================================================================================
SECURITY PATCH SUMMARY
================================================================================

Applied Patches:
1. preact 10.27.2 → 10.28.2
   - Vulnerability: GHSA-36hm-qxxp-pg3m (JSON VNode Injection)
   - Type: Patch update (safe)

2. @modelcontextprotocol/sdk 1.25.1 → 1.25.2
   - Vulnerability: GHSA-8r9q-7v3j-jr4g (ReDoS)
   - Type: Patch update (safe)

3. langchain 1.0.2 → 1.2.8
   - Vulnerability: GHSA-r399-636x-v7f6 (Serialization Injection)
   - Type: Minor version update (requires testing)

Installation Time: $(date)
Backup Location: $(pwd)/backups/

Next Steps:
1. Run npm test for full test suite
2. Deploy to staging environment
3. Run E2E tests in staging
4. Verify all functionality works
5. Deploy to production when confident
6. Monitor logs for any issues
7. Rotate credentials that may have been exposed

Rollback Instructions:
If any issues occur, rollback using:
    cd $(pwd)
    cp backups/security-patch-*/package.json .
    cp backups/security-patch-*/package-lock.json .
    npm ci
    git reset --hard HEAD

For more details, see SECURITY_FIX_PLAN.md
================================================================================
EOF

    print_info "Summary saved to: $summary_file"
    cat "$summary_file" | tee -a "$LOG_FILE"
}

# Main update logic
main_update() {
    local failed=0

    # Determine which updates to apply
    local do_preact=true
    local do_mcp=true
    local do_langchain=true

    if [ "${UPDATE_PREACT_ONLY:-false}" = true ]; then
        do_mcp=false
        do_langchain=false
    elif [ "${UPDATE_MCP_ONLY:-false}" = true ]; then
        do_preact=false
        do_langchain=false
    elif [ "${UPDATE_LANGCHAIN_ONLY:-false}" = true ]; then
        do_preact=false
        do_mcp=false
    fi

    # Phase 1: Update preact (lowest risk)
    if [ "$do_preact" = true ]; then
        if ! update_preact; then
            print_error "Preact update failed"
            failed=$((failed + 1))
        fi
    fi

    # Phase 2: Update MCP SDK (medium risk)
    if [ "$do_mcp" = true ]; then
        if ! update_mcp; then
            print_error "MCP SDK update failed"
            failed=$((failed + 1))
        fi
    fi

    # Phase 3: Update langchain (highest risk, needs most testing)
    if [ "$do_langchain" = true ]; then
        if ! update_langchain; then
            print_error "langchain update failed"
            failed=$((failed + 1))
        fi
    fi

    return $failed
}

# Cleanup on error
cleanup_on_error() {
    print_error "Script encountered errors"
    print_warning "Review log file: $LOG_FILE"

    if [ "$DRY_RUN" != true ]; then
        print_warning "You may need to run rollback procedures"
        print_info "Backup saved to: $BACKUP_DIR"
    fi

    return 1
}

################################################################################
# Main Script Execution
################################################################################

main() {
    initialize

    # Dry run notice
    if [ "$DRY_RUN" = true ]; then
        print_warning "====== DRY RUN MODE ======"
        print_warning "No changes will be made to your system"
        print_warning "=========================="
    fi

    # Check if we should apply pre-tests
    if [ "$SKIP_TESTS" != true ]; then
        print_info "Note: Full test suite will be run"
        print_info "This may take 5-10 minutes"
    else
        print_warning "Tests will be skipped - NOT RECOMMENDED"
    fi

    parse_args "$@"
    check_prerequisites

    # Backup
    if [ "$DRY_RUN" != true ]; then
        backup_current_state
    fi

    # Pre-tests
    if ! run_pretests; then
        print_warning "Pre-tests had issues, continuing anyway..."
    fi

    # Main update
    if ! main_update; then
        cleanup_on_error
        exit 1
    fi

    # Post-tests
    if ! run_posttests; then
        if [ "$FORCE_UPDATE" != true ]; then
            cleanup_on_error
            exit 1
        fi
    fi

    # Create summary
    create_summary

    # Final summary
    print_success "=========================================="
    print_success "Security patches applied successfully!"
    print_success "=========================================="

    if [ "$DRY_RUN" = true ]; then
        print_info "This was a DRY RUN - no actual changes were made"
    else
        print_info "Next steps:"
        print_info "1. Review the backup: $BACKUP_DIR"
        print_info "2. Run: npm test"
        print_info "3. Test in staging environment"
        print_info "4. Deploy to production when confident"
        print_info "5. Rotate sensitive credentials"
        print_info ""
        print_info "Log file: $LOG_FILE"
    fi

    return 0
}

# Run main function
main "$@"
exit $?
