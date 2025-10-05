#!/bin/bash

# Setup Branch Protection Rules for Release Branch Strategy
# This script configures GitHub branch protection rules to enforce the release branch workflow

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REPO_OWNER="ryan-maclean"  # Update this with your GitHub username
REPO_NAME="vibecode-webgui"
MAIN_BRANCH="main"

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅${NC} $1"
}

warning() {
    echo -e "${YELLOW}⚠️${NC} $1"
}

error() {
    echo -e "${RED}❌${NC} $1"
}

# Check if GitHub CLI is installed
if ! command -v gh &> /dev/null; then
    error "GitHub CLI (gh) is not installed. Please install it first:"
    echo "  brew install gh"
    echo "  or visit: https://cli.github.com/"
    exit 1
fi

# Check if user is authenticated
if ! gh auth status &> /dev/null; then
    error "Not authenticated with GitHub CLI. Please run:"
    echo "  gh auth login"
    exit 1
fi

log "Setting up branch protection rules for ${REPO_OWNER}/${REPO_NAME}..."

# Function to create or update branch protection rule
setup_main_branch_protection() {
    log "Configuring protection rules for main branch..."
    
    # Enable branch protection for main branch
    gh api \
        --method PUT \
        -H "Accept: application/vnd.github+json" \
        -H "X-GitHub-Api-Version: 2022-11-28" \
        "/repos/${REPO_OWNER}/${REPO_NAME}/branches/${MAIN_BRANCH}/protection" \
        --input - <<EOF
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "lint-and-security",
      "unit-tests",
      "cost-monitor"
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "require_last_push_approval": false
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true,
  "lock_branch": false,
  "allow_fork_syncing": true
}
EOF
    
    success "Main branch protection rules configured"
}

# Function to create branch protection rule for release branches
setup_release_branch_protection() {
    log "Configuring protection rules for release/* branches..."
    
    # Note: GitHub doesn't support wildcard branch protection via API for release/*
    # This would need to be set up manually in the GitHub UI or when release branches are created
    warning "Release branch protection must be configured manually for each release branch"
    warning "Or set up in GitHub UI under Settings > Branches with pattern 'release/*'"
    
    echo
    log "Recommended release branch protection settings:"
    echo "  - Require pull request reviews: 1 reviewer minimum"
    echo "  - Require status checks to pass before merging"
    echo "  - Required checks: validate-ci-config, code-quality, test-suite, build-and-performance, security-comprehensive"
    echo "  - Require linear history"
    echo "  - Do not allow force pushes"
    echo "  - Do not allow deletions"
}

# Function to create CODEOWNERS file
create_codeowners() {
    log "Creating CODEOWNERS file..."
    
    mkdir -p .github
    
    cat > .github/CODEOWNERS <<EOF
# CODEOWNERS file for vibecode-webgui
# This file defines who owns different parts of the codebase

# Global owners (for all files)
* @${REPO_OWNER}

# GitHub Actions and CI/CD
/.github/ @${REPO_OWNER}
/scripts/ @${REPO_OWNER}

# Core infrastructure
/src/lib/ @${REPO_OWNER}
/src/middleware/ @${REPO_OWNER}

# Database and migrations
/prisma/ @${REPO_OWNER}
/migrations/ @${REPO_OWNER}

# Configuration files
*.config.js @${REPO_OWNER}
*.config.ts @${REPO_OWNER}
package.json @${REPO_OWNER}
package-lock.json @${REPO_OWNER}
EOF
    
    success "CODEOWNERS file created"
}

# Function to create pull request template
create_pr_template() {
    log "Creating pull request template..."
    
    mkdir -p .github
    
    cat > .github/pull_request_template.md <<EOF
## Description
Brief description of the changes in this PR.

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Code refactoring

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] E2E tests pass (if applicable)
- [ ] Manual testing completed

## Checklist
- [ ] My code follows the project's style guidelines
- [ ] I have performed a self-review of my code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] Any dependent changes have been merged and published

## Release Branch Strategy
- [ ] This PR targets the correct branch (main for hotfixes, release/* for features)
- [ ] CI/CD costs have been considered (comprehensive tests only run on release branches)
- [ ] Breaking changes are documented and communicated

## Screenshots (if applicable)
Add screenshots to help explain your changes.

## Additional Notes
Any additional information that reviewers should know.
EOF
    
    success "Pull request template created"
}

# Function to update repository settings
update_repo_settings() {
    log "Updating repository settings..."
    
    # Update repository settings
    gh api \
        --method PATCH \
        -H "Accept: application/vnd.github+json" \
        -H "X-GitHub-Api-Version: 2022-11-28" \
        "/repos/${REPO_OWNER}/${REPO_NAME}" \
        --input - <<EOF
{
  "allow_squash_merge": true,
  "allow_merge_commit": false,
  "allow_rebase_merge": true,
  "allow_auto_merge": true,
  "delete_branch_on_merge": true,
  "allow_update_branch": true,
  "use_squash_pr_title_as_default": true
}
EOF
    
    success "Repository settings updated"
}

# Function to create branch protection summary
create_protection_summary() {
    log "Creating branch protection summary..."
    
    cat > BRANCH_PROTECTION_SETUP.md <<EOF
# Branch Protection Setup Summary

## Overview
This repository uses a release branch strategy to optimize CI/CD costs while maintaining code quality.

## Branch Strategy

### Main Branch (\`main\`)
- **Purpose**: Production-ready code, hotfixes only
- **Protection**: 
  - Requires 1 PR review
  - Requires status checks: lint-and-security, unit-tests, cost-monitor
  - Linear history required
  - No force pushes or deletions
- **CI/CD**: Lightweight pipeline (linting, basic tests, security scans)

### Release Branches (\`release/*\`)
- **Purpose**: Feature integration and comprehensive testing
- **Protection**: Manual setup required for each branch
- **CI/CD**: Full pipeline (unit, integration, E2E tests, performance, security)

### Feature Branches (\`feature/*\`, \`fix/*\`, etc.)
- **Purpose**: Development work
- **Protection**: None (developers can work freely)
- **CI/CD**: None (to minimize costs)

## Workflow

1. **Feature Development**: Create feature branches from \`main\`
2. **Release Preparation**: Create \`release/vX.Y.Z\` branch
3. **Feature Integration**: Merge features into release branch
4. **Comprehensive Testing**: Full CI/CD runs on release branch
5. **Release**: Merge release branch to \`main\` after all tests pass

## Cost Optimization

- **Main Branch**: ~$20-30/month (lightweight CI)
- **Release Branches**: ~$50-70/month (comprehensive CI, but only when releasing)
- **Feature Branches**: $0/month (no CI)
- **Total Savings**: ~70-80% reduction from previous $100/month

## Manual Setup Required

1. **Release Branch Protection**: Set up in GitHub UI for pattern \`release/*\`
2. **Required Status Checks**: Configure for release branches
3. **Team Permissions**: Ensure proper access controls

## Files Created

- \`.github/CODEOWNERS\`: Code ownership definitions
- \`.github/pull_request_template.md\`: PR template with release strategy context
- \`scripts/util/setup-branch-protection.sh\`: This setup script
- \`BRANCH_PROTECTION_SETUP.md\`: This documentation

## Next Steps

1. Run this script to apply main branch protection
2. Manually configure release branch protection in GitHub UI
3. Train team on new release branch workflow
4. Monitor CI/CD costs and adjust as needed

Generated on: $(date)
EOF
    
    success "Branch protection documentation created"
}

# Main execution
main() {
    echo
    log "🔒 GitHub Branch Protection Setup"
    echo "=================================="
    echo
    
    # Confirm repository details
    echo "Repository: ${REPO_OWNER}/${REPO_NAME}"
    echo "Main branch: ${MAIN_BRANCH}"
    echo
    
    read -p "Continue with branch protection setup? (y/N): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        warning "Setup cancelled by user"
        exit 0
    fi
    
    echo
    
    # Execute setup steps
    setup_main_branch_protection
    setup_release_branch_protection
    create_codeowners
    create_pr_template
    update_repo_settings
    create_protection_summary
    
    echo
    success "Branch protection setup completed!"
    echo
    log "Summary:"
    echo "  ✅ Main branch protection configured"
    echo "  ⚠️  Release branch protection needs manual setup"
    echo "  ✅ CODEOWNERS file created"
    echo "  ✅ PR template created"
    echo "  ✅ Repository settings updated"
    echo "  ✅ Documentation created"
    echo
    warning "IMPORTANT: You still need to manually configure release branch protection in GitHub UI"
    log "Visit: https://github.com/${REPO_OWNER}/${REPO_NAME}/settings/branches"
    echo
    log "Next: Create your first release branch with: ./create-release-branch.sh v1.0.0"
}

# Run main function
main "$@"
