#!/usr/bin/env bash
# =============================================================================
# VibeCode Configuration Migration Script
# =============================================================================
# Purpose: Safely migrate from 31 .env files to consolidated configuration
# Version: 1.0.0
# Date: 2025-10-01
#
# IMPORTANT: This script creates backups and validates before making changes
# Run with --dry-run first to see what would happen
# =============================================================================

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="$PROJECT_ROOT/.env-backup-$(date +%Y%m%d-%H%M%S)"
DRY_RUN=false
VERBOSE=false

# Files to preserve (will be consolidated)
CORE_ENV_FILES=(
    ".env"
    ".env.local"
    ".env.development.local"
)

# Files to deprecate (move to backup)
DEPRECATED_ENV_FILES=(
    ".env.azure"
    ".env.demo.example"
    ".env.docker"
    ".env.docker.fixed"
    ".env.local.template"
    ".env.production.test"
    ".env.test-db"
    ".env.test-external-db"
    ".env.valkey"
)

# Template files to keep
TEMPLATE_FILES=(
    ".env.example"
    ".env.local.example"
    ".env.template"
)

# =============================================================================
# Helper Functions
# =============================================================================

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

print_header() {
    echo ""
    echo "============================================================================="
    echo "$1"
    echo "============================================================================="
    echo ""
}

# =============================================================================
# Validation Functions
# =============================================================================

check_prerequisites() {
    print_header "Checking Prerequisites"

    local missing_tools=()

    # Check for required tools
    for tool in git diff grep; do
        if ! command -v "$tool" &> /dev/null; then
            missing_tools+=("$tool")
        fi
    done

    if [ ${#missing_tools[@]} -gt 0 ]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        exit 1
    fi

    # Check if we're in a git repository
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        log_error "Not in a git repository"
        exit 1
    fi

    # Check for uncommitted changes
    if ! git diff-index --quiet HEAD -- 2>/dev/null; then
        log_warning "You have uncommitted changes. Consider committing or stashing them first."
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi

    log_success "All prerequisites met"
}

validate_env_example() {
    print_header "Validating .env.example"

    if [ ! -f "$PROJECT_ROOT/.env.example" ]; then
        log_error ".env.example not found. Cannot proceed with migration."
        exit 1
    fi

    # Check for critical sections
    local required_sections=(
        "# Runtime"
        "# Database & Caching"
        "# Primary AI Provider"
        "# Observability & Datadog"
        "# Authentication Providers"
        "# Security & Rate Limiting"
    )

    local missing_sections=()
    for section in "${required_sections[@]}"; do
        if ! grep -q "$section" "$PROJECT_ROOT/.env.example"; then
            missing_sections+=("$section")
        fi
    done

    if [ ${#missing_sections[@]} -gt 0 ]; then
        log_error "Missing required sections in .env.example:"
        for section in "${missing_sections[@]}"; do
            echo "  - $section"
        done
        exit 1
    fi

    log_success ".env.example validated successfully"
}

# =============================================================================
# Backup Functions
# =============================================================================

create_backup() {
    print_header "Creating Backup"

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would create backup directory: $BACKUP_DIR"
        return 0
    fi

    mkdir -p "$BACKUP_DIR"
    log_info "Backup directory created: $BACKUP_DIR"

    # Backup all .env files
    local backed_up=0
    cd "$PROJECT_ROOT"

    for file in .env*; do
        if [ -f "$file" ] && [ ! -d "$file" ]; then
            cp "$file" "$BACKUP_DIR/"
            backed_up=$((backed_up + 1))
            [ "$VERBOSE" = true ] && log_info "Backed up: $file"
        fi
    done

    # Create backup manifest
    cat > "$BACKUP_DIR/MANIFEST.txt" << EOF
VibeCode Configuration Backup
=============================
Date: $(date)
Location: $BACKUP_DIR
Files backed up: $backed_up

To restore from this backup:
  cp $BACKUP_DIR/.env* $PROJECT_ROOT/

Original file locations:
EOF

    for file in .env*; do
        if [ -f "$file" ]; then
            echo "  $file" >> "$BACKUP_DIR/MANIFEST.txt"
        fi
    done

    log_success "Backed up $backed_up files to $BACKUP_DIR"
}

# =============================================================================
# Migration Functions
# =============================================================================

analyze_current_config() {
    print_header "Analyzing Current Configuration"

    cd "$PROJECT_ROOT"

    # Count files
    local total_env_files=$(find . -maxdepth 1 -name ".env*" -type f | wc -l)
    local core_files=0
    local deprecated_files=0
    local template_files=0

    for file in "${CORE_ENV_FILES[@]}"; do
        [ -f "$file" ] && core_files=$((core_files + 1))
    done

    for file in "${DEPRECATED_ENV_FILES[@]}"; do
        [ -f "$file" ] && deprecated_files=$((deprecated_files + 1))
    done

    for file in "${TEMPLATE_FILES[@]}"; do
        [ -f "$file" ] && template_files=$((template_files + 1))
    done

    log_info "Total .env files: $total_env_files"
    log_info "Core files (to consolidate): $core_files"
    log_info "Deprecated files (to archive): $deprecated_files"
    log_info "Template files (to keep): $template_files"

    # List deprecated files that exist
    echo ""
    log_info "Files to be archived:"
    for file in "${DEPRECATED_ENV_FILES[@]}"; do
        if [ -f "$file" ]; then
            echo "  - $file"
        fi
    done
}

consolidate_configs() {
    print_header "Consolidating Configuration Files"

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would consolidate configs (no actual changes)"
        return 0
    fi

    # Move deprecated files to backup
    local archived=0
    cd "$PROJECT_ROOT"

    for file in "${DEPRECATED_ENV_FILES[@]}"; do
        if [ -f "$file" ]; then
            log_info "Archiving: $file"
            mv "$file" "$BACKUP_DIR/"
            archived=$((archived + 1))
        fi
    done

    log_success "Archived $archived deprecated configuration files"
}

update_gitignore() {
    print_header "Updating .gitignore"

    local gitignore="$PROJECT_ROOT/.gitignore"

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would update .gitignore"
        return 0
    fi

    # Check if deprecated files are already ignored
    local needs_update=false

    # Ensure core .env files are properly ignored
    if ! grep -q "^\.env\.azure$" "$gitignore"; then
        needs_update=true
    fi

    if [ "$needs_update" = false ]; then
        log_info ".gitignore already up to date"
        return 0
    fi

    # Add deprecated patterns to gitignore
    cat >> "$gitignore" << 'EOF'

# Deprecated environment files (archived)
.env.azure
.env.demo.example
.env.docker
.env.docker.fixed
.env.local.template
.env.production.test
.env.test-db
.env.test-external-db
.env.valkey
EOF

    log_success ".gitignore updated"
}

generate_migration_report() {
    print_header "Generating Migration Report"

    local report_file="$BACKUP_DIR/MIGRATION_REPORT.md"

    cat > "$report_file" << EOF
# Configuration Migration Report

**Date:** $(date)
**Backup Location:** \`$BACKUP_DIR\`
**Status:** ${DRY_RUN:+DRY RUN - No changes made}${DRY_RUN:-COMPLETED}

## Summary

### Files Consolidated
- **Before:** $(find "$PROJECT_ROOT" -maxdepth 1 -name ".env*" -type f 2>/dev/null | wc -l) .env files
- **After:** 3 core files + templates

### Core Configuration Files (Active)
EOF

    for file in "${CORE_ENV_FILES[@]}"; do
        if [ -f "$PROJECT_ROOT/$file" ]; then
            echo "- \`$file\` - $(wc -l < "$PROJECT_ROOT/$file") lines" >> "$report_file"
        fi
    done

    cat >> "$report_file" << EOF

### Template Files (Reference)
EOF

    for file in "${TEMPLATE_FILES[@]}"; do
        if [ -f "$PROJECT_ROOT/$file" ]; then
            echo "- \`$file\` - $(wc -l < "$PROJECT_ROOT/$file") lines" >> "$report_file"
        fi
    done

    cat >> "$report_file" << EOF

### Archived Files
EOF

    for file in "${DEPRECATED_ENV_FILES[@]}"; do
        if [ -f "$BACKUP_DIR/$file" ]; then
            echo "- \`$file\` → \`$BACKUP_DIR/$file\`" >> "$report_file"
        fi
    done

    cat >> "$report_file" << EOF

## Rollback Instructions

To rollback this migration:

\`\`\`bash
# Restore all files from backup
cp $BACKUP_DIR/.env* $PROJECT_ROOT/

# Verify restoration
git status
\`\`\`

## Next Steps

1. Review consolidated configuration files
2. Update environment-specific values in \`.env.local\`
3. Test application startup
4. Run health checks: \`npm run test:health\`
5. Validate all integrations (DB, Redis, AI providers)
6. Commit changes if everything works

## Testing Checklist

- [ ] Application starts successfully
- [ ] Database connection works
- [ ] Redis/Valkey connection works
- [ ] AI provider authentication works
- [ ] Datadog monitoring active (if enabled)
- [ ] Health checks pass
- [ ] Integration tests pass

## Support

If you encounter issues, restore from backup and check:
- \`$BACKUP_DIR/MANIFEST.txt\` for original file locations
- This report for rollback instructions
- GitHub issue #447 for migration discussion
EOF

    log_success "Migration report generated: $report_file"

    if [ "$DRY_RUN" = false ]; then
        echo ""
        log_info "Review the migration report:"
        cat "$report_file"
    fi
}

# =============================================================================
# Main Execution
# =============================================================================

show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Migrate VibeCode configuration from 31 .env files to consolidated structure.

OPTIONS:
    -d, --dry-run       Show what would be done without making changes
    -v, --verbose       Show detailed output
    -h, --help          Show this help message

EXAMPLES:
    # Preview migration without making changes
    $0 --dry-run

    # Perform actual migration
    $0

    # Verbose migration
    $0 --verbose

MIGRATION PROCESS:
    1. Check prerequisites
    2. Validate .env.example
    3. Create backup of all .env files
    4. Analyze current configuration
    5. Archive deprecated files
    6. Update .gitignore
    7. Generate migration report

ROLLBACK:
    All original files are backed up to:
    $BACKUP_DIR

    To restore: cp $BACKUP_DIR/.env* $PROJECT_ROOT/

SUPPORT:
    GitHub Issue: #447
    Docs: docs/CONFIGURATION.md
EOF
}

main() {
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -d|--dry-run)
                DRY_RUN=true
                shift
                ;;
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -h|--help)
                show_usage
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done

    # Show banner
    print_header "VibeCode Configuration Migration Tool"

    if [ "$DRY_RUN" = true ]; then
        log_warning "DRY RUN MODE - No changes will be made"
    fi

    # Execute migration steps
    check_prerequisites
    validate_env_example
    create_backup
    analyze_current_config
    consolidate_configs
    update_gitignore
    generate_migration_report

    # Final summary
    print_header "Migration ${DRY_RUN:+Preview }Complete"

    if [ "$DRY_RUN" = true ]; then
        log_success "Dry run completed successfully. No changes were made."
        log_info "Run without --dry-run to perform actual migration"
    else
        log_success "Configuration migration completed successfully!"
        log_info "Backup location: $BACKUP_DIR"
        log_info "Next steps:"
        echo "  1. Review migration report: $BACKUP_DIR/MIGRATION_REPORT.md"
        echo "  2. Test application: npm run dev"
        echo "  3. Run health checks: npm run test:health"
        echo "  4. Commit changes if everything works"
    fi
}

# Run main function
main "$@"
