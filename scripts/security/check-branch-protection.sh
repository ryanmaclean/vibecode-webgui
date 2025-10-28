#!/usr/bin/env bash
#
# Branch Protection Validation Script
#
# Purpose: Verify GitHub branch protection rules are correctly configured
# Usage: ./scripts/security/check-branch-protection.sh [branch-name]
# Requirements: gh CLI (GitHub CLI) installed and authenticated
#
# Exit codes:
#   0 - All protections correctly configured
#   1 - Missing or misconfigured protections
#   2 - Script error (missing dependencies, auth failure)
#

set -euo pipefail

# Configuration
OWNER="${GITHUB_OWNER:-ryanmaclean}"
REPO="${GITHUB_REPO:-vibecode-webgui}"
BRANCH="${1:-main}"
MIN_SCORE=7  # Minimum acceptable protection score out of 10

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Tracking
SCORE=0
MAX_SCORE=10
WARNINGS=()
ERRORS=()

# Functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
    WARNINGS+=("$1")
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
    ERRORS+=("$1")
}

check_dependencies() {
    log_info "Checking dependencies..."

    if ! command -v gh &> /dev/null; then
        log_error "GitHub CLI (gh) not found. Install: brew install gh"
        exit 2
    fi

    if ! gh auth status &> /dev/null; then
        log_error "GitHub CLI not authenticated. Run: gh auth login"
        exit 2
    fi

    log_success "Dependencies OK"
}

fetch_protection_rules() {
    log_info "Fetching branch protection rules for ${OWNER}/${REPO}:${BRANCH}..."

    # Check if branch protection exists
    if ! gh api "repos/${OWNER}/${REPO}/branches/${BRANCH}/protection" 2>/dev/null > /tmp/branch-protection.json; then
        log_error "Branch protection not enabled for ${BRANCH}"
        echo ""
        echo "To enable branch protection, see: docs/security/BRANCH_PROTECTION.md"
        exit 1
    fi

    log_success "Branch protection configuration retrieved"
}

check_pr_reviews() {
    log_info "Validating pull request review requirements..."

    local required_reviews
    required_reviews=$(jq -r '.required_pull_request_reviews.required_approving_review_count // 0' /tmp/branch-protection.json)

    if [[ "$required_reviews" -ge 1 ]]; then
        log_success "Pull request reviews required ($required_reviews approval(s))"
        ((SCORE++))

        # Check stale review dismissal
        local dismiss_stale
        dismiss_stale=$(jq -r '.required_pull_request_reviews.dismiss_stale_reviews // false' /tmp/branch-protection.json)

        if [[ "$dismiss_stale" == "true" ]]; then
            log_success "Stale review dismissal enabled"
            ((SCORE++))
        else
            log_warning "Stale review dismissal not enabled (PRs can merge with outdated approvals)"
        fi

        # Check code owner reviews
        local require_code_owners
        require_code_owners=$(jq -r '.required_pull_request_reviews.require_code_owner_reviews // false' /tmp/branch-protection.json)

        if [[ "$require_code_owners" == "true" ]]; then
            log_info "Code owner reviews required"
        fi
    else
        log_error "Pull request reviews not required (any contributor can merge without review)"
    fi
}

check_status_checks() {
    log_info "Validating required status checks..."

    local has_checks
    has_checks=$(jq -r '.required_status_checks != null' /tmp/branch-protection.json)

    if [[ "$has_checks" == "true" ]]; then
        log_success "Status checks required"
        ((SCORE++))

        # Check strict mode
        local strict_mode
        strict_mode=$(jq -r '.required_status_checks.strict // false' /tmp/branch-protection.json)

        if [[ "$strict_mode" == "true" ]]; then
            log_success "Strict status check mode enabled (branch must be up-to-date)"
            ((SCORE++))
        else
            log_warning "Strict mode disabled (PRs can merge without being up-to-date with base)"
        fi

        # List required checks
        local check_count
        check_count=$(jq -r '.required_status_checks.contexts | length' /tmp/branch-protection.json)

        if [[ "$check_count" -gt 0 ]]; then
            log_success "Required status checks configured: ${check_count}"

            # Show individual checks
            log_info "Status checks:"
            jq -r '.required_status_checks.contexts[]' /tmp/branch-protection.json | while read -r check; do
                echo "    - ${check}"
            done

            # Validate expected checks are present
            local expected_checks=("validate-ci-config" "quick-validation" "security-check" "build-check")
            local missing_checks=()

            for expected in "${expected_checks[@]}"; do
                if ! jq -r --arg check "$expected" '.required_status_checks.contexts | contains([$check])' /tmp/branch-protection.json | grep -q true; then
                    missing_checks+=("$expected")
                fi
            done

            if [[ ${#missing_checks[@]} -gt 0 ]]; then
                log_warning "Missing recommended status checks: ${missing_checks[*]}"
            fi
        else
            log_warning "No status checks configured (CI/CD will not block merges)"
        fi
    else
        log_error "Status checks not required (untested code can be merged)"
    fi
}

check_force_push_protection() {
    log_info "Validating force push protection..."

    local allow_force_pushes
    allow_force_pushes=$(jq -r '.allow_force_pushes.enabled // false' /tmp/branch-protection.json)

    if [[ "$allow_force_pushes" == "false" ]]; then
        log_success "Force pushes disabled"
        ((SCORE++))
    else
        log_error "Force pushes allowed (history can be rewritten)"
    fi
}

check_deletion_protection() {
    log_info "Validating branch deletion protection..."

    local allow_deletions
    allow_deletions=$(jq -r '.allow_deletions.enabled // false' /tmp/branch-protection.json)

    if [[ "$allow_deletions" == "false" ]]; then
        log_success "Branch deletions disabled"
        ((SCORE++))
    else
        log_error "Branch deletions allowed (branch can be accidentally deleted)"
    fi
}

check_signed_commits() {
    log_info "Validating signed commit requirement..."

    local require_signatures
    require_signatures=$(jq -r '.required_signatures.enabled // false' /tmp/branch-protection.json)

    if [[ "$require_signatures" == "true" ]]; then
        log_success "Signed commits required"
        ((SCORE++))
    else
        log_warning "Signed commits not required (commit authentication not enforced)"
    fi
}

check_admin_enforcement() {
    log_info "Validating admin enforcement..."

    local enforce_admins
    enforce_admins=$(jq -r '.enforce_admins.enabled // false' /tmp/branch-protection.json)

    if [[ "$enforce_admins" == "true" ]]; then
        log_success "Admin enforcement enabled (rules apply to administrators)"
        ((SCORE++))
    else
        log_warning "Admin enforcement disabled (admins can bypass protection rules)"
    fi
}

check_linear_history() {
    log_info "Validating linear history requirement..."

    local require_linear
    require_linear=$(jq -r '.required_linear_history.enabled // false' /tmp/branch-protection.json)

    if [[ "$require_linear" == "true" ]]; then
        log_info "Linear history required (merge commits prevented)"
    else
        log_info "Linear history not required (merge commits allowed)"
    fi
}

check_conversation_resolution() {
    log_info "Validating conversation resolution requirement..."

    local require_resolution
    require_resolution=$(jq -r '.required_conversation_resolution.enabled // false' /tmp/branch-protection.json)

    if [[ "$require_resolution" == "true" ]]; then
        log_info "Conversation resolution required"
    else
        log_info "Conversation resolution not required"
    fi
}

generate_summary() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Branch Protection Summary"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Repository: ${OWNER}/${REPO}"
    echo "Branch: ${BRANCH}"
    echo ""

    # Calculate percentage
    local percentage
    percentage=$(awk "BEGIN {printf \"%.0f\", ($SCORE/$MAX_SCORE)*100}")

    # Determine security level
    local security_level
    if [[ $SCORE -ge 9 ]]; then
        security_level="${GREEN}STRONG${NC}"
    elif [[ $SCORE -ge 7 ]]; then
        security_level="${YELLOW}MODERATE${NC}"
    else
        security_level="${RED}WEAK${NC}"
    fi

    echo -e "Branch Protection Score: ${SCORE}/${MAX_SCORE} (${percentage}%) - ${security_level}"
    echo ""

    # Show warnings
    if [[ ${#WARNINGS[@]} -gt 0 ]]; then
        echo -e "${YELLOW}Warnings (${#WARNINGS[@]}):${NC}"
        for warning in "${WARNINGS[@]}"; do
            echo "  - $warning"
        done
        echo ""
    fi

    # Show errors
    if [[ ${#ERRORS[@]} -gt 0 ]]; then
        echo -e "${RED}Errors (${#ERRORS[@]}):${NC}"
        for error in "${ERRORS[@]}"; do
            echo "  - $error"
        done
        echo ""
    fi

    # Recommendations
    echo "Recommendations:"

    if [[ $SCORE -lt $MIN_SCORE ]]; then
        echo "  - Branch protection is insufficient for production use"
        echo "  - Review docs/security/BRANCH_PROTECTION.md for configuration guide"
        echo "  - Enable at minimum: PR reviews, status checks, force push protection"
    fi

    if [[ ${#WARNINGS[@]} -gt 0 ]]; then
        echo "  - Address warnings to improve security posture"

        if grep -q "Signed commits" <<< "${WARNINGS[*]}"; then
            echo "  - Consider enabling signed commits for enhanced commit authentication"
        fi

        if grep -q "Strict mode" <<< "${WARNINGS[*]}"; then
            echo "  - Enable strict status check mode to prevent race conditions"
        fi
    fi

    if [[ $SCORE -eq $MAX_SCORE ]]; then
        echo "  - Branch protection is optimally configured"
    fi

    echo ""
    echo "Documentation: docs/security/BRANCH_PROTECTION.md"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# Main execution
main() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Branch Protection Validation Script"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    check_dependencies
    fetch_protection_rules

    echo ""

    # Run all validation checks
    check_pr_reviews
    check_status_checks
    check_force_push_protection
    check_deletion_protection
    check_signed_commits
    check_admin_enforcement
    check_linear_history
    check_conversation_resolution

    # Generate summary
    generate_summary

    # Exit with appropriate code
    if [[ $SCORE -lt $MIN_SCORE ]]; then
        exit 1
    fi

    exit 0
}

# Cleanup on exit
trap 'rm -f /tmp/branch-protection.json' EXIT

# Run main function
main "$@"
