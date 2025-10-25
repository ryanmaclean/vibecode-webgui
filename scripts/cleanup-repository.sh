#!/usr/bin/env bash

################################################################################
# Repository Cleanup Script
#
# Purpose: Clean up temporary files, logs, and organize historical documentation
#
# Features:
# - Removes root-level log files (build*.log, compose*.log, dev.log, kernel-build.log)
# - Cleans .git-rewrite/ directory if present
# - Creates docs/historical/ directory structure
# - Moves 30+ historical markdown files to docs/historical/
# - Creates comprehensive INDEX.md inventory
# - Optional: Clean artifacts/ directory (1.7GB) with confirmation
# - Dry-run mode for safe testing
#
# Usage:
#   ./scripts/cleanup-repository.sh           # Dry-run mode (shows what would happen)
#   ./scripts/cleanup-repository.sh --execute # Execute the cleanup
#   ./scripts/cleanup-repository.sh --help    # Show help
################################################################################

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DRY_RUN=true
CLEAN_ARTIFACTS=false
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HISTORICAL_DIR="${REPO_ROOT}/docs/historical"

# Counters
FILES_REMOVED=0
FILES_MOVED=0
DIRS_CREATED=0
BYTES_FREED=0

################################################################################
# Helper Functions
################################################################################

print_header() {
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
}

print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

show_help() {
    cat << EOF
Repository Cleanup Script

USAGE:
    $0 [OPTIONS]

OPTIONS:
    --execute           Execute cleanup (default is dry-run)
    --clean-artifacts   Also clean artifacts/ directory (requires confirmation)
    --help              Show this help message

DESCRIPTION:
    This script performs comprehensive repository cleanup:

    1. Removes temporary log files:
       - build*.log, compose*.log, dev.log, kernel-build.log

    2. Cleans .git-rewrite/ directory (if present)

    3. Organizes historical documentation:
       - Creates docs/historical/ directory
       - Moves 30+ historical .md files matching these patterns:
         * AGENT_*.md
         * BUG_FIXES_*.md
         * BUILD_*.md
         * CONSOLIDATION_*.md
         * CONTINUED_*.md
         * DEPLOYMENT_*.md
         * FINAL_*.md
         * INTEGRATION_*.md
         * M2_ULTRA_*.md
         * MERGE_*.md
         * PHASE1_*.md
         * SESSION_*.md
       - Creates comprehensive INDEX.md inventory

    4. Optional: Clean artifacts/ directory (~1.7GB)
       - Requires explicit --clean-artifacts flag
       - Prompts for confirmation before deletion

EXAMPLES:
    # Preview what will be cleaned (safe)
    $0

    # Execute the cleanup
    $0 --execute

    # Execute cleanup including artifacts
    $0 --execute --clean-artifacts

EOF
}

get_file_size() {
    local file="$1"
    if [[ -f "$file" ]]; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            stat -f%z "$file" 2>/dev/null || echo 0
        else
            stat -c%s "$file" 2>/dev/null || echo 0
        fi
    else
        echo 0
    fi
}

get_dir_size() {
    local dir="$1"
    if [[ -d "$dir" ]]; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            du -sk "$dir" 2>/dev/null | cut -f1 || echo 0
        else
            du -sb "$dir" 2>/dev/null | cut -f1 || echo 0
        fi
    else
        echo 0
    fi
}

format_bytes() {
    local bytes=$1
    if (( bytes < 1024 )); then
        echo "${bytes}B"
    elif (( bytes < 1048576 )); then
        echo "$((bytes / 1024))KB"
    elif (( bytes < 1073741824 )); then
        echo "$((bytes / 1048576))MB"
    else
        echo "$((bytes / 1073741824))GB"
    fi
}

remove_file() {
    local file="$1"
    local size=$(get_file_size "$file")

    if [[ -f "$file" ]]; then
        if [[ "$DRY_RUN" == true ]]; then
            print_info "[DRY-RUN] Would remove: $file ($(format_bytes $size))"
        else
            rm -f "$file"
            print_info "Removed: $file ($(format_bytes $size))"
        fi
        FILES_REMOVED=$((FILES_REMOVED + 1))
        BYTES_FREED=$((BYTES_FREED + size))
    fi
}

remove_directory() {
    local dir="$1"
    local size=$(get_dir_size "$dir")

    if [[ -d "$dir" ]]; then
        if [[ "$DRY_RUN" == true ]]; then
            print_info "[DRY-RUN] Would remove directory: $dir ($(format_bytes $size))"
        else
            rm -rf "$dir"
            print_info "Removed directory: $dir ($(format_bytes $size))"
        fi
        BYTES_FREED=$((BYTES_FREED + size))
    fi
}

move_file() {
    local src="$1"
    local dest_dir="$2"

    if [[ -f "$src" ]]; then
        local filename=$(basename "$src")
        if [[ "$DRY_RUN" == true ]]; then
            print_info "[DRY-RUN] Would move: $filename -> $dest_dir/"
        else
            mv "$src" "$dest_dir/"
            print_info "Moved: $filename -> $dest_dir/"
        fi
        FILES_MOVED=$((FILES_MOVED + 1))
    fi
}

create_directory() {
    local dir="$1"

    if [[ ! -d "$dir" ]]; then
        if [[ "$DRY_RUN" == true ]]; then
            print_info "[DRY-RUN] Would create directory: $dir"
        else
            mkdir -p "$dir"
            print_info "Created directory: $dir"
        fi
        DIRS_CREATED=$((DIRS_CREATED + 1))
    fi
}

################################################################################
# Cleanup Functions
################################################################################

cleanup_log_files() {
    print_header "Cleaning Up Log Files"

    cd "$REPO_ROOT"

    # Build logs
    for log in build*.log; do
        [[ -f "$log" ]] && remove_file "$log"
    done

    # Compose logs
    for log in compose*.log; do
        [[ -f "$log" ]] && remove_file "$log"
    done

    # Specific logs
    [[ -f "dev.log" ]] && remove_file "dev.log"
    [[ -f "kernel-build.log" ]] && remove_file "kernel-build.log"
}

cleanup_git_rewrite() {
    print_header "Cleaning .git-rewrite Directory"

    local git_rewrite="${REPO_ROOT}/.git-rewrite"

    if [[ -d "$git_rewrite" ]]; then
        remove_directory "$git_rewrite"
    else
        print_info "Directory .git-rewrite does not exist (skipping)"
    fi
}

organize_historical_docs() {
    print_header "Organizing Historical Documentation"

    cd "$REPO_ROOT"

    # Create historical directory
    create_directory "$HISTORICAL_DIR"

    # Define patterns for historical files
    local patterns=(
        "AGENT_*.md"
        "BUG_FIXES_*.md"
        "BUILD_*.md"
        "CONSOLIDATION_*.md"
        "CONTINUED_*.md"
        "DEPLOYMENT_*.md"
        "FINAL_*.md"
        "INTEGRATION_*.md"
        "M2_ULTRA_*.md"
        "MERGE_*.md"
        "PHASE1_*.md"
        "SESSION_*.md"
    )

    # Move matching files
    local file_count=0
    for pattern in "${patterns[@]}"; do
        for file in $pattern; do
            if [[ -f "$file" ]]; then
                move_file "$file" "$HISTORICAL_DIR"
                file_count=$((file_count + 1))
            fi
        done
    done

    if [[ $file_count -eq 0 ]]; then
        print_warning "No historical markdown files found matching patterns"
    fi
}

create_historical_index() {
    print_header "Creating Historical Documentation Index"

    local index_file="${HISTORICAL_DIR}/INDEX.md"

    if [[ "$DRY_RUN" == true ]]; then
        print_info "[DRY-RUN] Would create: $index_file"
        return
    fi

    # Generate index content
    cat > "$index_file" << 'EOF'
# Historical Documentation Index

This directory contains historical documentation files that were previously in the repository root. These documents represent various stages of development, debugging sessions, and project milestones.

## Purpose

These files have been moved here to:
- Keep the repository root clean and organized
- Preserve historical context and development progress
- Maintain searchable documentation of past issues and solutions
- Provide reference for similar problems in the future

## Document Categories

### Agent Task Documentation
EOF

    # List AGENT_* files
    cd "$HISTORICAL_DIR"
    local agent_files=(AGENT_*.md)
    if [[ -f "${agent_files[0]}" ]]; then
        for file in "${agent_files[@]}"; do
            echo "- [$file]($file)" >> "$index_file"
        done
    else
        echo "- None" >> "$index_file"
    fi

    cat >> "$index_file" << 'EOF'

### Bug Fixes and Issues
EOF

    local bug_files=(BUG_FIXES_*.md CONTINUED_*.md)
    local has_bug_files=false
    for file in "${bug_files[@]}"; do
        if [[ -f "$file" ]]; then
            echo "- [$file]($file)" >> "$index_file"
            has_bug_files=true
        fi
    done
    [[ "$has_bug_files" == false ]] && echo "- None" >> "$index_file"

    cat >> "$index_file" << 'EOF'

### Build and Deployment
EOF

    local build_files=(BUILD_*.md DEPLOYMENT_*.md)
    local has_build_files=false
    for file in "${build_files[@]}"; do
        if [[ -f "$file" ]]; then
            echo "- [$file]($file)" >> "$index_file"
            has_build_files=true
        fi
    done
    [[ "$has_build_files" == false ]] && echo "- None" >> "$index_file"

    cat >> "$index_file" << 'EOF'

### Project Milestones and Sessions
EOF

    local session_files=(FINAL_*.md SESSION_*.md PHASE1_*.md)
    local has_session_files=false
    for file in "${session_files[@]}"; do
        if [[ -f "$file" ]]; then
            echo "- [$file]($file)" >> "$index_file"
            has_session_files=true
        fi
    done
    [[ "$has_session_files" == false ]] && echo "- None" >> "$index_file"

    cat >> "$index_file" << 'EOF'

### Merge and Integration
EOF

    local merge_files=(MERGE_*.md INTEGRATION_*.md CONSOLIDATION_*.md)
    local has_merge_files=false
    for file in "${merge_files[@]}"; do
        if [[ -f "$file" ]]; then
            echo "- [$file]($file)" >> "$index_file"
            has_merge_files=true
        fi
    done
    [[ "$has_merge_files" == false ]] && echo "- None" >> "$index_file"

    cat >> "$index_file" << 'EOF'

### M2 Ultra Mac Specific
EOF

    local m2_files=(M2_ULTRA_*.md)
    if [[ -f "${m2_files[0]}" ]]; then
        for file in "${m2_files[@]}"; do
            echo "- [$file]($file)" >> "$index_file"
        done
    else
        echo "- None" >> "$index_file"
    fi

    cat >> "$index_file" << 'EOF'

### All Files (Alphabetical)

EOF

    # List all markdown files alphabetically
    for file in *.md; do
        if [[ -f "$file" && "$file" != "INDEX.md" ]]; then
            echo "- [$file]($file)" >> "$index_file"
        fi
    done

    cat >> "$index_file" << 'EOF'

## Usage

These documents are kept for:
1. **Reference**: Understanding past decisions and solutions
2. **Debugging**: Finding patterns in historical issues
3. **Context**: Providing background for current development
4. **Compliance**: Maintaining audit trail of changes

## Maintenance

- Do not delete these files without team approval
- Add new historical documents following the existing naming patterns
- Update this index when adding significant documentation

---

*Last updated: $(date +%Y-%m-%d)*
*Organized by: Repository Cleanup Script*
EOF

    print_info "Created: INDEX.md with comprehensive inventory"
}

cleanup_artifacts() {
    print_header "Cleaning Artifacts Directory"

    local artifacts_dir="${REPO_ROOT}/artifacts"

    if [[ ! -d "$artifacts_dir" ]]; then
        print_info "Directory artifacts/ does not exist (skipping)"
        return
    fi

    local size=$(get_dir_size "$artifacts_dir")
    print_warning "Artifacts directory size: $(format_bytes $size)"

    if [[ "$DRY_RUN" == true ]]; then
        print_info "[DRY-RUN] Would prompt for confirmation to delete artifacts/"
        return
    fi

    # Prompt for confirmation
    read -p "Are you sure you want to delete artifacts/ directory? (yes/NO): " confirm
    if [[ "$confirm" == "yes" ]]; then
        remove_directory "$artifacts_dir"
    else
        print_info "Skipped: artifacts/ directory (user cancelled)"
    fi
}

################################################################################
# Main Execution
################################################################################

main() {
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --execute)
                DRY_RUN=false
                shift
                ;;
            --clean-artifacts)
                CLEAN_ARTIFACTS=true
                shift
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done

    # Show mode
    echo ""
    if [[ "$DRY_RUN" == true ]]; then
        print_header "DRY RUN MODE (No Changes Will Be Made)"
        print_info "Run with --execute to perform actual cleanup"
    else
        print_header "EXECUTING CLEANUP"
        print_warning "This will make permanent changes!"
    fi
    echo ""

    # Execute cleanup steps
    cleanup_log_files
    echo ""

    cleanup_git_rewrite
    echo ""

    organize_historical_docs
    echo ""

    create_historical_index
    echo ""

    if [[ "$CLEAN_ARTIFACTS" == true ]]; then
        cleanup_artifacts
        echo ""
    fi

    # Summary
    print_header "Cleanup Summary"
    echo -e "${GREEN}Files removed:${NC}      $FILES_REMOVED"
    echo -e "${GREEN}Files moved:${NC}        $FILES_MOVED"
    echo -e "${GREEN}Directories created:${NC} $DIRS_CREATED"
    echo -e "${GREEN}Space freed:${NC}        $(format_bytes $BYTES_FREED)"
    echo ""

    if [[ "$DRY_RUN" == true ]]; then
        print_info "This was a dry run. Use --execute to perform actual cleanup."
    else
        print_info "Cleanup complete!"
        print_info "Next steps:"
        echo "  1. Review changes: git status"
        echo "  2. Commit changes: git add -A && git commit -m 'chore: Clean up logs and organize historical docs'"
        echo "  3. Push changes: git push"
    fi
}

# Run main function
main "$@"
