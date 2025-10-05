#!/usr/bin/env bash
#===============================================================================
# migrate-tests.sh - Automated Test File Migration Script
#===============================================================================
# Purpose: Move test files from /src to /tests with import path conversion
# Issue: #446 - Fix Test Coverage - Move Tests from /src to /tests
#
# Features:
# - Safe dry-run mode by default
# - Converts relative imports to absolute @/ imports
# - Preserves git history with git mv
# - Creates backup before actual moves
# - Validates import conversions
# - Supports batch processing
#
# Usage:
#   ./migrate-tests.sh <source_dir> [--execute]
#
# Examples:
#   # Dry-run (shows what will happen)
#   ./migrate-tests.sh src/components
#
#   # Execute actual migration
#   ./migrate-tests.sh src/components --execute
#
#   # Batch examples for Phase 2
#   ./migrate-tests.sh src/components --execute
#   ./migrate-tests.sh src/lib --execute
#   ./migrate-tests.sh src/hooks --execute
#   ./migrate-tests.sh src/utils --execute
#
# Author: Automated migration tool for issue #446
# Date: 2025-10-01
#===============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TESTS_DIR="${PROJECT_ROOT}/tests"
BACKUP_DIR="${PROJECT_ROOT}/.test-migration-backup"
DRY_RUN=true

#===============================================================================
# Helper Functions
#===============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $*"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $*"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $*"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*"
}

#===============================================================================
# Validation Functions
#===============================================================================

validate_environment() {
    log_info "Validating environment..."

    # Check if git repository
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        log_error "Not a git repository"
        exit 1
    fi

    # Check for uncommitted changes
    if ! git diff-index --quiet HEAD -- 2>/dev/null; then
        log_warning "Uncommitted changes detected. Consider committing first."
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi

    # Check if source directory exists
    if [[ ! -d "$1" ]]; then
        log_error "Source directory does not exist: $1"
        exit 1
    fi

    log_success "Environment validation passed"
}

#===============================================================================
# Import Conversion Functions
#===============================================================================

convert_relative_to_absolute() {
    local file="$1"
    local temp_file="${file}.tmp"

    log_info "Converting imports in: $(basename "$file")"

    # Convert relative imports to absolute @/ imports
    # Patterns to match:
    # - import { X } from '../../../lib/foo'
    # - import X from '../../utils/bar'
    # - import type { X } from '../types'

    sed -E \
        -e "s|from ['\"](\\.\\./)+components/|from '@/components/|g" \
        -e "s|from ['\"](\\.\\./)+lib/|from '@/lib/|g" \
        -e "s|from ['\"](\\.\\./)+utils/|from '@/utils/|g" \
        -e "s|from ['\"](\\.\\./)+hooks/|from '@/hooks/|g" \
        -e "s|from ['\"](\\.\\./)+types/|from '@/types/|g" \
        -e "s|from ['\"](\\.\\./)+config/|from '@/config/|g" \
        -e "s|from ['\"](\\.\\./)+services/|from '@/services/|g" \
        -e "s|from ['\"](\\.\\./)+constants/|from '@/constants/|g" \
        -e "s|from ['\"]\\./([^'\"]+)['\"]|from '@/\\1'|g" \
        "$file" > "$temp_file"

    # Show diff if in dry-run mode
    if [[ "$DRY_RUN" == true ]]; then
        if ! diff -u "$file" "$temp_file" > /dev/null 2>&1; then
            log_info "Import changes for $(basename "$file"):"
            diff -u "$file" "$temp_file" || true
            echo ""
        fi
    fi

    echo "$temp_file"
}

validate_imports() {
    local file="$1"
    local issues=0

    # Check for remaining relative imports (except same-directory)
    if grep -E "from ['\"]\.\./" "$file" > /dev/null 2>&1; then
        log_warning "Remaining relative imports in $(basename "$file")"
        grep -n "from ['\"]\.\./" "$file" || true
        ((issues++))
    fi

    # Check for common import issues
    if grep -E "from ['\"]@/\.\." "$file" > /dev/null 2>&1; then
        log_error "Malformed absolute import in $(basename "$file")"
        ((issues++))
    fi

    return "$issues"
}

#===============================================================================
# Migration Functions
#===============================================================================

determine_target_path() {
    local source_file="$1"
    local source_dir="$2"

    # Remove project root and source dir from path
    local rel_path="${source_file#${PROJECT_ROOT}/}"
    rel_path="${rel_path#${source_dir}/}"

    # Determine subdirectory based on file patterns
    local subdir="unit"

    if [[ "$source_file" == *".integration.test."* ]] || [[ "$source_file" == *".int.test."* ]]; then
        subdir="integration"
    elif [[ "$source_file" == *".e2e.test."* ]] || [[ "$source_file" == *".spec."* ]]; then
        subdir="e2e"
    fi

    # Construct target path
    echo "${TESTS_DIR}/${subdir}/${rel_path}"
}

create_backup() {
    log_info "Creating backup..."

    if [[ -d "$BACKUP_DIR" ]]; then
        log_warning "Backup directory already exists. Removing old backup..."
        rm -rf "$BACKUP_DIR"
    fi

    mkdir -p "$BACKUP_DIR"

    # Create a timestamped backup
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_archive="${BACKUP_DIR}/tests_backup_${timestamp}.tar.gz"

    tar -czf "$backup_archive" -C "$PROJECT_ROOT" \
        --exclude='node_modules' \
        --exclude='.git' \
        src/ tests/ 2>/dev/null || true

    log_success "Backup created: $backup_archive"
}

migrate_file() {
    local source_file="$1"
    local source_dir="$2"
    local target_file
    target_file=$(determine_target_path "$source_file" "$source_dir")
    local target_dir
    target_dir=$(dirname "$target_file")

    log_info "Processing: $(basename "$source_file")"

    # Convert imports
    local converted_file
    converted_file=$(convert_relative_to_absolute "$source_file")

    # Validate imports
    if ! validate_imports "$converted_file"; then
        log_warning "Import validation issues detected (see above)"
    fi

    if [[ "$DRY_RUN" == true ]]; then
        log_info "Would move: $source_file"
        log_info "        to: $target_file"
        rm -f "$converted_file"
    else
        # Create target directory
        mkdir -p "$target_dir"

        # Apply import changes
        mv "$converted_file" "$source_file"

        # Use git mv to preserve history
        git mv "$source_file" "$target_file"

        log_success "Migrated: $(basename "$source_file") → $target_file"
    fi
}

#===============================================================================
# Main Migration Logic
#===============================================================================

migrate_tests() {
    local source_dir="$1"

    log_info "Searching for test files in: $source_dir"

    # Find all test files
    local test_files=()
    while IFS= read -r -d '' file; do
        test_files+=("$file")
    done < <(find "$source_dir" -type f \( -name "*.test.ts" -o -name "*.test.tsx" -o -name "*.spec.ts" -o -name "*.spec.tsx" \) -print0)

    local total_files=${#test_files[@]}

    if [[ $total_files -eq 0 ]]; then
        log_warning "No test files found in $source_dir"
        return 0
    fi

    log_info "Found $total_files test file(s)"
    echo ""

    # Show summary
    log_info "Migration summary:"
    for file in "${test_files[@]}"; do
        local target
        target=$(determine_target_path "$file" "$source_dir")
        echo "  $(basename "$file") → ${target#${PROJECT_ROOT}/}"
    done
    echo ""

    if [[ "$DRY_RUN" == true ]]; then
        log_warning "DRY-RUN MODE: No changes will be made"
        log_info "Run with --execute to perform actual migration"
        echo ""
    else
        # Confirm before execution
        log_warning "About to migrate $total_files test file(s)"
        read -p "Continue? (y/N) " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Migration cancelled"
            exit 0
        fi

        # Create backup
        create_backup
    fi

    # Process each file
    local success_count=0
    local failure_count=0

    for file in "${test_files[@]}"; do
        if migrate_file "$file" "$source_dir"; then
            ((success_count++))
        else
            ((failure_count++))
            log_error "Failed to migrate: $file"
        fi
    done

    echo ""
    log_info "Migration complete!"
    log_info "Success: $success_count"

    if [[ $failure_count -gt 0 ]]; then
        log_warning "Failures: $failure_count"
    fi

    if [[ "$DRY_RUN" == false ]]; then
        log_info ""
        log_info "Next steps:"
        log_info "1. Review changes: git status"
        log_info "2. Update jest.config.mjs if needed"
        log_info "3. Run tests: npm test"
        log_info "4. Commit: git commit -m 'test: migrate tests from $source_dir to /tests'"
        log_info ""
        log_info "Backup location: $BACKUP_DIR"
    fi
}

#===============================================================================
# Entry Point
#===============================================================================

main() {
    # Parse arguments
    if [[ $# -lt 1 ]]; then
        log_error "Usage: $0 <source_dir> [--execute]"
        echo ""
        echo "Examples:"
        echo "  $0 src/components           # Dry-run"
        echo "  $0 src/components --execute # Execute migration"
        exit 1
    fi

    local source_dir="${PROJECT_ROOT}/$1"
    shift

    # Check for --execute flag
    if [[ $# -gt 0 ]] && [[ "$1" == "--execute" ]]; then
        DRY_RUN=false
    fi

    # Validate environment
    validate_environment "$source_dir"

    # Run migration
    migrate_tests "$source_dir"
}

# Run main function
main "$@"
