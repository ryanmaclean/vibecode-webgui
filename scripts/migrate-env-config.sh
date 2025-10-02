#!/usr/bin/env bash
# Migration script for consolidating .env configuration
# See docs/CONFIGURATION_MIGRATION.md for full details

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="$PROJECT_ROOT/.env-backup-$(date +%Y%m%d-%H%M%S)"
DRY_RUN=false
VERBOSE=false

log_info() { echo -e "${BLUE}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $*"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

print_header() {
    echo ""
    echo "============================================================================="
    echo "$1"
    echo "============================================================================="
    echo ""
}

# Core deprecated files to archive
DEPRECATED_FILES=(
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

main() {
    if [[ "${1:-}" == "--dry-run" || "${1:-}" == "-d" ]]; then
        DRY_RUN=true
        log_warning "DRY RUN MODE - No changes will be made"
    fi
    
    if [[ "${1:-}" == "--verbose" || "${1:-}" == "-v" ]] || [[ "${2:-}" == "--verbose" || "${2:-}" == "-v" ]]; then
        VERBOSE=true
    fi
    
    print_header "VibeCode Configuration Migration"
    
    # Create backup
    if [ "$DRY_RUN" = false ]; then
        mkdir -p "$BACKUP_DIR"
        log_info "Creating backup at: $BACKUP_DIR"
        cd "$PROJECT_ROOT"
        for file in .env*; do
            if [ -f "$file" ]; then
                cp "$file" "$BACKUP_DIR/" 2>/dev/null || true
                [ "$VERBOSE" = true ] && log_info "Backed up: $file"
            fi
        done
        log_success "Backup created"
    else
        log_info "[DRY RUN] Would create backup at: $BACKUP_DIR"
    fi
    
    # Archive deprecated files
    print_header "Archiving Deprecated Files"
    local archived=0
    cd "$PROJECT_ROOT"
    
    for file in "${DEPRECATED_FILES[@]}"; do
        if [ -f "$file" ]; then
            if [ "$DRY_RUN" = false ]; then
                mv "$file" "$BACKUP_DIR/" 2>/dev/null || true
                log_info "Archived: $file"
            else
                log_info "[DRY RUN] Would archive: $file"
            fi
            archived=$((archived + 1))
        fi
    done
    
    if [ "$DRY_RUN" = false ]; then
        log_success "Archived $archived files"
        
        # Generate report
        cat > "$BACKUP_DIR/MIGRATION_REPORT.md" << EOF
# Configuration Migration Report

Date: $(date)
Backup Location: $BACKUP_DIR

## Files Archived
EOF
        for file in "${DEPRECATED_FILES[@]}"; do
            if [ -f "$BACKUP_DIR/$file" ]; then
                echo "- $file" >> "$BACKUP_DIR/MIGRATION_REPORT.md"
            fi
        done
        
        cat >> "$BACKUP_DIR/MIGRATION_REPORT.md" << EOF

## Rollback Instructions
\`\`\`bash
cp $BACKUP_DIR/.env* $PROJECT_ROOT/
\`\`\`

## Next Steps
1. Test application: npm run dev
2. Run health checks: curl http://localhost:3000/api/health
3. Validate integrations
EOF
        log_success "Migration report generated"
    else
        log_info "[DRY RUN] Would archive $archived files"
    fi
    
    print_header "Migration Complete"
    if [ "$DRY_RUN" = true ]; then
        log_success "Dry run completed. No changes made."
        log_info "Run without --dry-run to execute migration"
    else
        log_success "Migration completed successfully!"
        log_info "Backup: $BACKUP_DIR"
        log_info "Report: $BACKUP_DIR/MIGRATION_REPORT.md"
        echo ""
        echo "Next steps:"
        echo "  1. Test application: npm run dev"
        echo "  2. Run health checks"
        echo "  3. Verify integrations"
        echo "  4. Review: $BACKUP_DIR/MIGRATION_REPORT.md"
    fi
}

main "$@"
