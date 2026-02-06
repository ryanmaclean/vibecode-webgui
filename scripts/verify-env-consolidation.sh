#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# =============================================================================
# Environment Consolidation Verification Script
# =============================================================================
#
# PURPOSE:
#   Validates the .env consolidation work for Issue #447
#   Ensures configuration management cleanup is complete and correct
#
# USAGE:
#   ./scripts/verify-env-consolidation.sh [--verbose]
#
# OPTIONS:
#   --verbose    Show detailed output for all checks
#
# CHECKS PERFORMED:
#   1. .env.example exists and has required variables
#   2. Redundant template files are removed (.env.template, .env.local.template)
#   3. No duplicate variable definitions in .env.example
#   4. Documentation references point to .env.example
#   5. No orphaned .env files that should have been cleaned up
#   6. Variable naming consistency (no mixed conventions)
#   7. Security patterns (no hardcoded secrets)
#
# EXIT CODES:
#   0 - All checks passed
#   1 - One or more checks failed
#
# SAFETY:
#   This script is READ-ONLY and makes no modifications to your system
#
# ISSUE:
#   https://github.com/vibecode/webgui/issues/447
#
# =============================================================================

# Initialize log aggregation
init_log_aggregation


set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
VERBOSE=false
FAILED_CHECKS=0
PASSED_CHECKS=0
WARNING_COUNT=0

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --verbose)
            VERBOSE=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--verbose]"
            exit 1
            ;;
    esac
done

# Helper functions
print_header() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_check() {
    echo -e "\n${YELLOW}[CHECK]${NC} $1"
}

print_pass() {
    echo -e "${GREEN}✅ PASS:${NC} $1"
    ((PASSED_CHECKS++))
}

print_fail() {
    echo -e "${RED}❌ FAIL:${NC} $1"
    ((FAILED_CHECKS++))
}

print_warning() {
    echo -e "${YELLOW}⚠️  WARN:${NC} $1"
    ((WARNING_COUNT++))
}

print_info() {
    if [[ "$VERBOSE" == "true" ]]; then
        echo -e "${BLUE}ℹ️  INFO:${NC} $1"
    fi
}

# Required variables in .env.example
REQUIRED_VARS=(
    "NODE_ENV"
    "BASE_URL"
    "NEXTAUTH_URL"
    "NEXTAUTH_SECRET"
    "DATABASE_URL"
    "REDIS_URL"
    "OPENAI_API_KEY"
    "DD_API_KEY"
    "GITHUB_ID"
    "GITHUB_SECRET"
)

# Redundant files that should NOT exist
REDUNDANT_FILES=(
    ".env.template"
    ".env.local.template"
    ".env.local.example"
    ".env.development.template"
    ".env.production.template"
)

# Documentation files that should reference .env.example
DOCUMENTATION_FILES=(
    "README.md"
    "docs/CONFIGURATION_MIGRATION.md"
    "docs/DEVELOPMENT.md"
    "docs/DEPLOYMENT_GUIDE.md"
)

# =============================================================================
# CHECK 1: Verify .env.example exists and has content
# =============================================================================
check_env_example_exists() {
    print_check "Verify .env.example exists and has required variables"

    if [[ ! -f "${PROJECT_ROOT}/.env.example" ]]; then
        print_fail ".env.example does not exist at ${PROJECT_ROOT}/.env.example"
        return
    fi

    print_pass ".env.example exists"

    # Check file size
    local file_size=$(wc -c < "${PROJECT_ROOT}/.env.example" | tr -d ' ')
    if [[ $file_size -lt 1000 ]]; then
        print_fail ".env.example is suspiciously small (${file_size} bytes)"
        return
    fi

    print_pass ".env.example has substantial content (${file_size} bytes)"

    # Check for required variables
    local missing_vars=()
    for var in "${REQUIRED_VARS[@]}"; do
        if ! grep -q "^${var}=" "${PROJECT_ROOT}/.env.example" 2>/dev/null; then
            missing_vars+=("$var")
        fi
    done

    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        print_fail "Missing required variables: ${missing_vars[*]}"
    else
        print_pass "All required variables present (${#REQUIRED_VARS[@]} checked)"
    fi

    # Check for documentation header
    if grep -q "VibeCode WebGUI Environment Variables" "${PROJECT_ROOT}/.env.example"; then
        print_pass "Contains documentation header"
    else
        print_warning "Missing clear documentation header"
    fi
}

# =============================================================================
# CHECK 2: Verify redundant template files are removed
# =============================================================================
check_redundant_files_removed() {
    print_check "Verify redundant template files are removed"

    local found_redundant=()
    for file in "${REDUNDANT_FILES[@]}"; do
        if [[ -f "${PROJECT_ROOT}/${file}" ]]; then
            found_redundant+=("$file")
        fi
    done

    if [[ ${#found_redundant[@]} -gt 0 ]]; then
        print_fail "Found redundant template files that should be removed:"
        for file in "${found_redundant[@]}"; do
            echo "  - ${file}"
        done
    else
        print_pass "No redundant template files found (${#REDUNDANT_FILES[@]} checked)"
    fi
}

# =============================================================================
# CHECK 3: Validate no duplicate variable definitions
# =============================================================================
check_duplicate_variables() {
    print_check "Validate no duplicate variable definitions in .env.example"

    if [[ ! -f "${PROJECT_ROOT}/.env.example" ]]; then
        print_warning "Cannot check duplicates - .env.example does not exist"
        return
    fi

    # Extract variable names (lines starting with A-Z, up to =)
    local duplicates=$(grep -E '^[A-Z_]+=' "${PROJECT_ROOT}/.env.example" 2>/dev/null | \
                       cut -d= -f1 | \
                       sort | \
                       uniq -d || true)

    if [[ -n "$duplicates" ]]; then
        print_fail "Found duplicate variable definitions:"
        echo "$duplicates" | while read -r dup; do
            echo "  - $dup"
            if [[ "$VERBOSE" == "true" ]]; then
                grep -n "^${dup}=" "${PROJECT_ROOT}/.env.example" | head -5
            fi
        done
    else
        print_pass "No duplicate variable definitions found"
    fi
}

# =============================================================================
# CHECK 4: Documentation references point to .env.example
# =============================================================================
check_documentation_references() {
    print_check "Verify documentation references point to .env.example"

    local docs_checked=0
    local docs_with_issues=0

    for doc in "${DOCUMENTATION_FILES[@]}"; do
        local doc_path="${PROJECT_ROOT}/${doc}"
        if [[ ! -f "$doc_path" ]]; then
            print_info "Documentation file not found (skipping): ${doc}"
            continue
        fi

        ((docs_checked++))

        # Check for references to .env.example
        if grep -q "\.env\.example" "$doc_path" 2>/dev/null; then
            print_info "✓ ${doc} references .env.example"
        else
            print_warning "${doc} does not reference .env.example"
            ((docs_with_issues++))
        fi

        # Check for references to old template files
        local old_refs=$(grep -E '\.env\.(template|local\.template)' "$doc_path" 2>/dev/null | wc -l || echo "0")
        if [[ $old_refs -gt 0 ]]; then
            print_warning "${doc} still references old template files (${old_refs} occurrences)"
            ((docs_with_issues++))
            if [[ "$VERBOSE" == "true" ]]; then
                grep -n -E '\.env\.(template|local\.template)' "$doc_path" | head -5
            fi
        fi
    done

    if [[ $docs_checked -eq 0 ]]; then
        print_warning "No documentation files found to check"
    elif [[ $docs_with_issues -eq 0 ]]; then
        print_pass "All ${docs_checked} documentation files have correct references"
    else
        print_warning "${docs_with_issues}/${docs_checked} documentation files need updates"
    fi
}

# =============================================================================
# CHECK 5: No orphaned .env files
# =============================================================================
check_orphaned_env_files() {
    print_check "Check for orphaned .env files that should be cleaned up"

    # Find all .env* files
    local all_env_files=$(find "${PROJECT_ROOT}" -maxdepth 1 -name ".env*" -type f 2>/dev/null | sort)

    # Allowed files
    local allowed_files=(
        "${PROJECT_ROOT}/.env.example"
        "${PROJECT_ROOT}/.env.local"
        "${PROJECT_ROOT}/.env.production.local"
        "${PROJECT_ROOT}/.env.test.local"
    )

    # Convert to associative array for easy lookup
    declare -A allowed_map
    for file in "${allowed_files[@]}"; do
        allowed_map["$file"]=1
    done

    local orphaned_count=0
    local orphaned_list=()

    while IFS= read -r file; do
        if [[ -z "${allowed_map[$file]:-}" ]]; then
            ((orphaned_count++))
            orphaned_list+=("$(basename "$file")")
        fi
    done <<< "$all_env_files"

    if [[ $orphaned_count -gt 0 ]]; then
        print_warning "Found ${orphaned_count} potentially orphaned .env files:"
        for file in "${orphaned_list[@]}"; do
            echo "  - ${file}"
        done
        echo ""
        echo "  These files may be:"
        echo "  - Legacy files that should be removed"
        echo "  - Working copies that are gitignored (safe)"
        echo "  - Platform-specific configs (consider consolidating)"
    else
        print_pass "No orphaned .env files found"
    fi
}

# =============================================================================
# CHECK 6: Variable naming consistency
# =============================================================================
check_variable_naming_consistency() {
    print_check "Validate variable naming consistency"

    if [[ ! -f "${PROJECT_ROOT}/.env.example" ]]; then
        print_warning "Cannot check naming - .env.example does not exist"
        return
    fi

    # Check for inconsistent naming patterns
    local inconsistent_patterns=()

    # Check for mixed case in variable names (should be all caps)
    local mixed_case=$(grep -E '^[A-Za-z0-9_]+=.' "${PROJECT_ROOT}/.env.example" 2>/dev/null | \
                       grep -E '^[A-Z_]*[a-z]+' 2>/dev/null | \
                       cut -d= -f1 2>/dev/null || true)

    if [[ -n "$mixed_case" ]]; then
        inconsistent_patterns+=("mixed case variable names")
        if [[ "$VERBOSE" == "true" ]]; then
            echo "Mixed case variables found:"
            echo "$mixed_case" | head -5
        fi
    fi

    # Check for spaces around equals
    local spaces_in_assignment=$(grep -E '^[A-Z_]+ *= *' "${PROJECT_ROOT}/.env.example" 2>/dev/null | wc -l || echo "0")
    if [[ $spaces_in_assignment -gt 0 ]]; then
        inconsistent_patterns+=("spaces around equals (${spaces_in_assignment} found)")
    fi

    if [[ ${#inconsistent_patterns[@]} -gt 0 ]]; then
        print_warning "Found naming inconsistencies: ${inconsistent_patterns[*]}"
    else
        print_pass "Variable naming is consistent"
    fi
}

# =============================================================================
# CHECK 7: Security patterns
# =============================================================================
check_security_patterns() {
    print_check "Validate security patterns (no hardcoded secrets)"

    if [[ ! -f "${PROJECT_ROOT}/.env.example" ]]; then
        print_warning "Cannot check security - .env.example does not exist"
        return
    fi

    local security_issues=()

    # Check for actual secrets (should be placeholders)
    # Look for common patterns that indicate real credentials

    # Check for JWT tokens (starts with ey)
    if grep -q "^[A-Z_]*=ey[A-Za-z0-9]" "${PROJECT_ROOT}/.env.example" 2>/dev/null; then
        security_issues+=("potential JWT token found")
    fi

    # Check for long base64 strings (potential real secrets)
    local long_base64=$(grep -E '^[A-Z_]+=.{40,}$' "${PROJECT_ROOT}/.env.example" 2>/dev/null | \
                        grep -E '=[A-Za-z0-9+/]{40,}={0,2}$' 2>/dev/null | \
                        wc -l || echo "0")
    if [[ $long_base64 -gt 5 ]]; then
        security_issues+=("${long_base64} suspiciously long base64-like values")
    fi

    # Check for placeholder text presence
    if ! grep -q "your-.*-change-me" "${PROJECT_ROOT}/.env.example" 2>/dev/null; then
        security_issues+=("missing clear placeholder patterns (your-*-change-me)")
    fi

    if [[ ${#security_issues[@]} -gt 0 ]]; then
        print_warning "Security concerns: ${security_issues[*]}"
    else
        print_pass "Security patterns look good (uses placeholders)"
    fi
}

# =============================================================================
# CHECK 8: Verify .gitignore patterns
# =============================================================================
check_gitignore_patterns() {
    print_check "Verify .gitignore properly excludes secret files"

    if [[ ! -f "${PROJECT_ROOT}/.gitignore" ]]; then
        print_fail ".gitignore file not found"
        return
    fi

    local required_patterns=(
        ".env.local"
        ".env.production.local"
        ".env.test.local"
    )

    local missing_patterns=()
    for pattern in "${required_patterns[@]}"; do
        if ! grep -q "$pattern" "${PROJECT_ROOT}/.gitignore" 2>/dev/null; then
            missing_patterns+=("$pattern")
        fi
    done

    if [[ ${#missing_patterns[@]} -gt 0 ]]; then
        print_fail "Missing .gitignore patterns: ${missing_patterns[*]}"
    else
        print_pass "All secret file patterns in .gitignore"
    fi

    # Check that .env.example is NOT ignored
    if grep -q "^\.env\.example$" "${PROJECT_ROOT}/.gitignore" 2>/dev/null; then
        print_fail ".env.example should NOT be in .gitignore"
    else
        print_pass ".env.example is tracked (not ignored)"
    fi
}

# =============================================================================
# Main execution
# =============================================================================
main() {
    print_header "Environment Consolidation Verification"
    echo "Issue: #447 - Consolidate Configuration Management"
    echo "Project: ${PROJECT_ROOT}"
    echo "Mode: READ-ONLY (no modifications will be made)"

    # Run all checks
    check_env_example_exists
    check_redundant_files_removed
    check_duplicate_variables
    check_documentation_references
    check_orphaned_env_files
    check_variable_naming_consistency
    check_security_patterns
    check_gitignore_patterns

    # Summary
    print_header "Verification Summary"
    echo ""
    echo -e "${GREEN}✅ Passed checks: ${PASSED_CHECKS}${NC}"

    if [[ $WARNING_COUNT -gt 0 ]]; then
        echo -e "${YELLOW}⚠️  Warnings: ${WARNING_COUNT}${NC}"
    fi

    if [[ $FAILED_CHECKS -gt 0 ]]; then
        echo -e "${RED}❌ Failed checks: ${FAILED_CHECKS}${NC}"
        echo ""
        echo "Status: VERIFICATION FAILED"
        echo ""
        echo "Please review the failures above and make necessary corrections."
        echo "For guidance, see: docs/CONFIGURATION_MIGRATION.md"
        exit 1
    elif [[ $WARNING_COUNT -gt 0 ]]; then
        echo ""
        echo -e "${YELLOW}Status: PASSED WITH WARNINGS${NC}"
        echo ""
        echo "All critical checks passed, but there are warnings to review."
        echo "Consider addressing warnings for optimal configuration."
        exit 0
    else
        echo ""
        echo -e "${GREEN}Status: ALL CHECKS PASSED ✅${NC}"
        echo ""
        echo "Environment consolidation verification complete!"
        echo "Configuration management is properly consolidated."
        exit 0
    fi
}

# Run main function
main
