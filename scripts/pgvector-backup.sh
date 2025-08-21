#!/bin/bash

# pgvector Backup and Disaster Recovery Script
# Handles backup of PostgreSQL with pgvector data and indexes

set -euo pipefail

# Configuration
NAMESPACE="vibecode-webgui"
DEPLOYMENT="pgvector-vibecode-pgvector"
DATABASE="vibecode"
USERNAME="vibecode"
BACKUP_DIR="/tmp/pgvector-backups"
RETENTION_DAYS=7
DATE=$(date +%Y%m%d_%H%M%S)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        error "kubectl not found. Please install kubectl."
    fi
    
    # Check if deployment exists
    if ! kubectl get deployment "$DEPLOYMENT" -n "$NAMESPACE" &> /dev/null; then
        error "Deployment $DEPLOYMENT not found in namespace $NAMESPACE"
    fi
    
    # Check if pod is running
    local pod_status=$(kubectl get pods -n "$NAMESPACE" -l "app.kubernetes.io/name=vibecode-pgvector" --no-headers | awk '{print $3}' | head -1)
    if [[ "$pod_status" != "Running" ]]; then
        error "pgvector pod is not running. Current status: $pod_status"
    fi
    
    log "Prerequisites check passed"
}

create_backup_dir() {
    log "Creating backup directory: $BACKUP_DIR"
    mkdir -p "$BACKUP_DIR"
}

backup_database() {
    local backup_file="$BACKUP_DIR/pgvector_backup_${DATE}.sql"
    local metadata_file="$BACKUP_DIR/pgvector_metadata_${DATE}.json"
    
    log "Starting database backup..."
    
    # Create database dump with pgvector data
    kubectl exec -n "$NAMESPACE" deployment/"$DEPLOYMENT" -- pg_dump \
        -U "$USERNAME" \
        -d "$DATABASE" \
        --verbose \
        --no-owner \
        --no-privileges \
        --format=plain \
        --file=/tmp/backup.sql
    
    # Copy backup file from pod
    kubectl cp "$NAMESPACE/$(kubectl get pods -n "$NAMESPACE" -l "app.kubernetes.io/name=vibecode-pgvector" --no-headers | awk '{print $1}' | head -1):/tmp/backup.sql" "$backup_file"
    
    # Create metadata file
    cat > "$metadata_file" << EOF
{
    "backup_date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "database": "$DATABASE",
    "namespace": "$NAMESPACE",
    "deployment": "$DEPLOYMENT",
    "backup_file": "$(basename "$backup_file")",
    "backup_size_bytes": $(stat -f%z "$backup_file" 2>/dev/null || stat -c%s "$backup_file" 2>/dev/null || echo "0"),
    "embedding_stats": $(get_embedding_stats)
}
EOF
    
    log "Database backup completed: $backup_file"
    log "Metadata saved: $metadata_file"
    
    # Compress backup
    gzip "$backup_file"
    log "Backup compressed: ${backup_file}.gz"
}

get_embedding_stats() {
    kubectl exec -n "$NAMESPACE" deployment/"$DEPLOYMENT" -- psql \
        -U "$USERNAME" \
        -d "$DATABASE" \
        -t \
        -c "SELECT json_build_object(
            'total_embeddings', (SELECT COUNT(*) FROM embeddings),
            'by_content_type', (SELECT json_object_agg(content_type, count) FROM (SELECT content_type, COUNT(*) as count FROM embeddings GROUP BY content_type) t),
            'by_language', (SELECT json_object_agg(language, count) FROM (SELECT metadata->>'language' as language, COUNT(*) as count FROM embeddings WHERE metadata->>'language' IS NOT NULL GROUP BY metadata->>'language') t),
            'index_size', (SELECT pg_size_pretty(pg_total_relation_size('idx_embeddings_hnsw')) WHERE EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_embeddings_hnsw')),
            'table_size', (SELECT pg_size_pretty(pg_total_relation_size('embeddings')))
        )" | tr -d ' \n'
}

backup_indexes() {
    local index_backup_file="$BACKUP_DIR/pgvector_indexes_${DATE}.sql"
    
    log "Backing up pgvector indexes..."
    
    # Extract index definitions
    kubectl exec -n "$NAMESPACE" deployment/"$DEPLOYMENT" -- psql \
        -U "$USERNAME" \
        -d "$DATABASE" \
        -c "SELECT indexdef FROM pg_indexes WHERE tablename = 'embeddings' AND indexname LIKE '%embedding%'" \
        -t > "$index_backup_file"
    
    log "Index definitions backed up: $index_backup_file"
}

test_backup() {
    local backup_file="$BACKUP_DIR/pgvector_backup_${DATE}.sql.gz"
    
    log "Testing backup integrity..."
    
    # Test gzip integrity
    if ! gzip -t "$backup_file"; then
        error "Backup file is corrupted: $backup_file"
    fi
    
    # Test SQL syntax (basic check)
    if ! zcat "$backup_file" | head -100 | grep -q "CREATE EXTENSION.*vector"; then
        warn "pgvector extension not found in backup header"
    fi
    
    log "Backup integrity test passed"
}

cleanup_old_backups() {
    log "Cleaning up backups older than $RETENTION_DAYS days..."
    
    find "$BACKUP_DIR" -name "pgvector_backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete
    find "$BACKUP_DIR" -name "pgvector_metadata_*.json" -mtime +$RETENTION_DAYS -delete
    find "$BACKUP_DIR" -name "pgvector_indexes_*.sql" -mtime +$RETENTION_DAYS -delete
    
    log "Cleanup completed"
}

restore_database() {
    local restore_file="$1"
    
    if [[ -z "$restore_file" ]]; then
        error "Please specify backup file to restore"
    fi
    
    if [[ ! -f "$restore_file" ]]; then
        error "Backup file not found: $restore_file"
    fi
    
    log "Starting database restore from: $restore_file"
    
    # Confirm restore operation
    read -p "This will overwrite the current database. Are you sure? (yes/no): " confirm
    if [[ "$confirm" != "yes" ]]; then
        log "Restore cancelled"
        exit 0
    fi
    
    # Copy backup to pod
    local pod_name=$(kubectl get pods -n "$NAMESPACE" -l "app.kubernetes.io/name=vibecode-pgvector" --no-headers | awk '{print $1}' | head -1)
    
    if [[ "$restore_file" == *.gz ]]; then
        zcat "$restore_file" | kubectl exec -i -n "$NAMESPACE" "$pod_name" -- psql -U "$USERNAME" -d "$DATABASE"
    else
        kubectl cp "$restore_file" "$NAMESPACE/$pod_name:/tmp/restore.sql"
        kubectl exec -n "$NAMESPACE" "$pod_name" -- psql -U "$USERNAME" -d "$DATABASE" -f /tmp/restore.sql
    fi
    
    log "Database restore completed"
    
    # Verify restore
    local restored_count=$(kubectl exec -n "$NAMESPACE" deployment/"$DEPLOYMENT" -- psql -U "$USERNAME" -d "$DATABASE" -t -c "SELECT COUNT(*) FROM embeddings" | tr -d ' \n')
    log "Restored $restored_count embeddings"
}

show_usage() {
    echo "Usage: $0 [backup|restore|list|cleanup]"
    echo ""
    echo "Commands:"
    echo "  backup   - Create a full backup of pgvector database"
    echo "  restore  - Restore database from backup file"
    echo "  list     - List available backups"
    echo "  cleanup  - Remove old backups"
    echo ""
    echo "Examples:"
    echo "  $0 backup"
    echo "  $0 restore /tmp/pgvector-backups/pgvector_backup_20250821_153000.sql.gz"
    echo "  $0 list"
    echo "  $0 cleanup"
}

list_backups() {
    log "Available backups in $BACKUP_DIR:"
    
    if [[ ! -d "$BACKUP_DIR" ]]; then
        warn "Backup directory does not exist: $BACKUP_DIR"
        return
    fi
    
    local backups=$(find "$BACKUP_DIR" -name "pgvector_backup_*.sql.gz" -type f | sort -r)
    
    if [[ -z "$backups" ]]; then
        warn "No backups found"
        return
    fi
    
    echo ""
    printf "%-30s %-15s %-20s\n" "BACKUP FILE" "SIZE" "DATE"
    printf "%-30s %-15s %-20s\n" "----------" "----" "----"
    
    for backup in $backups; do
        local filename=$(basename "$backup")
        local size=$(ls -lh "$backup" | awk '{print $5}')
        local date=$(stat -f%Sm -t%Y-%m-%d\ %H:%M "$backup" 2>/dev/null || stat -c%y "$backup" 2>/dev/null | cut -d' ' -f1-2)
        printf "%-30s %-15s %-20s\n" "$filename" "$size" "$date"
    done
    echo ""
}

main() {
    local command="${1:-}"
    
    case "$command" in
        backup)
            check_prerequisites
            create_backup_dir
            backup_database
            backup_indexes
            test_backup
            cleanup_old_backups
            log "Backup operation completed successfully"
            ;;
        restore)
            check_prerequisites
            restore_database "${2:-}"
            ;;
        list)
            list_backups
            ;;
        cleanup)
            cleanup_old_backups
            ;;
        *)
            show_usage
            exit 1
            ;;
    esac
}

main "$@"
