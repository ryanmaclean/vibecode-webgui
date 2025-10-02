#!/usr/bin/env bash
#
# Branch Protection Enablement Script
#
# Purpose: Programmatically enable GitHub branch protection rules
# Usage: ./scripts/security/enable-branch-protection.sh [branch-name] [profile]
# Profiles: minimal, recommended, high-security
# Requirements: gh CLI installed and authenticated with repo admin access
#

set -euo pipefail

OWNER="${GITHUB_OWNER:-ryanmaclean}"
REPO="${GITHUB_REPO:-vibecode-webgui}"
BRANCH="${1:-main}"
PROFILE="${2:-recommended}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

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

check_permissions() {
    log_info "Verifying repository permissions..."
    local permission
    permission=$(gh api "repos/${OWNER}/${REPO}" --jq '.permissions.admin // false')
    if [[ "$permission" != "true" ]]; then
        log_error "Insufficient permissions. Repository admin access required."
        exit 2
    fi
    log_success "Admin permissions confirmed"
}

apply_minimal_profile() {
    log_info "Applying minimal security profile..."
    cat <<'EOF' | gh api --method PUT -H "Accept: application/vnd.github+json" --input - "repos/${OWNER}/${REPO}/branches/${BRANCH}/protection"
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["validate-ci-config", "quick-validation", "security-check", "build-check"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "required_approving_review_count": 1
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_signatures": false
}
EOF
}

apply_recommended_profile() {
    log_info "Applying recommended security profile..."
    cat <<'EOF' | gh api --method PUT -H "Accept: application/vnd.github+json" --input - "repos/${OWNER}/${REPO}/branches/${BRANCH}/protection"
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "validate-ci-config",
      "quick-validation",
      "security-check",
      "build-check",
      "code-quality",
      "root-tests",
      "build-test"
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "required_approving_review_count": 1
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_signatures": true
}
EOF
    log_warning "Signed commits enabled. Team members must configure GPG keys."
    echo "See: https://docs.github.com/en/authentication/managing-commit-signature-verification"
}

apply_high_security_profile() {
    log_info "Applying high security profile..."
    cat <<'EOF' | gh api --method PUT -H "Accept: application/vnd.github+json" --input - "repos/${OWNER}/${REPO}/branches/${BRANCH}/protection"
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "validate-ci-config",
      "quick-validation",
      "security-check",
      "build-check",
      "code-quality",
      "root-tests",
      "build-test"
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": true,
    "required_approving_review_count": 2,
    "require_last_push_approval": true
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_signatures": true,
  "required_linear_history": true,
  "required_conversation_resolution": true
}
EOF
    log_warning "High security profile requires:"
    echo "  - CODEOWNERS file in repository root"
    echo "  - Team members configured with GPG keys"
    echo "  - Team comfortable with rebase workflows (linear history)"
}

main() {
    echo ""
    echo "Branch Protection Enablement"
    echo "Repository: ${OWNER}/${REPO}"
    echo "Branch: ${BRANCH}"
    echo "Profile: ${PROFILE}"
    echo ""
    
    check_dependencies
    check_permissions
    
    case "$PROFILE" in
        minimal) apply_minimal_profile ;;
        recommended) apply_recommended_profile ;;
        high-security) apply_high_security_profile ;;
        *) 
            log_error "Invalid profile: ${PROFILE}"
            echo "Valid profiles: minimal, recommended, high-security"
            exit 1
            ;;
    esac
    
    log_success "Branch protection configuration complete"
    
    echo ""
    echo "Verify configuration:"
    echo "  ./scripts/security/check-branch-protection.sh ${BRANCH}"
}

main
