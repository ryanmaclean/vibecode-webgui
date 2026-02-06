#!/usr/bin/env bash
# Cross-rig bead synchronization script
# Part of Issue #907 / #1161: Cross-Rig Bead Synchronization
#
# This script syncs beads between rigs (Kubernetes clusters) using:
# - kubectl to list/compare/apply beads
# - Kafka topics for sync event coordination
#
# Usage:
#   bead-sync.sh --source-rig <rig> --target-rig <rig> [options]
#
# Kafka Topics:
#   tundra-beads-sync-request   - Sync request events
#   tundra-beads-sync-complete  - Sync completion events
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/../lib/datadog-logging.sh" 2>/dev/null || true

# Configuration
NAMESPACE="${TUNDRA_NAMESPACE:-tundra-dome}"
KAFKA_BROKERS="${TD_KAFKA_BROKERS:-localhost:9092}"
SYNC_REQUEST_TOPIC="tundra-beads-sync-request"
SYNC_COMPLETE_TOPIC="tundra-beads-sync-complete"
DRY_RUN="${DRY_RUN:-false}"
SYNC_VERSION=$(date +%s)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

usage() {
    cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Cross-rig bead synchronization tool.

Required:
  --source-rig <name>      Source rig context (kubectl context name)
  --target-rig <name>      Target rig context (kubectl context name)

Options:
  --namespace <ns>         Kubernetes namespace (default: tundra-dome)
  --kafka-brokers <addr>   Kafka broker addresses (default: localhost:9092)
  --label-selector <sel>   Only sync beads matching label selector
  --lane <lane>            Only sync beads in specific lane (critical/standard/experimental)
  --dry-run                Show what would be synced without making changes
  --force                  Force sync even if target has newer version
  --conflict-resolution <strategy>
                           Conflict resolution: source-wins, target-wins, manual (default: source-wins)
  -h, --help               Show this help message

Examples:
  # Sync all beads from prod-rig to staging-rig
  $(basename "$0") --source-rig prod-rig --target-rig staging-rig

  # Sync only critical lane beads
  $(basename "$0") --source-rig prod-rig --target-rig staging-rig --lane critical

  # Dry run to see what would be synced
  $(basename "$0") --source-rig prod-rig --target-rig staging-rig --dry-run

Kafka Topics Used:
  $SYNC_REQUEST_TOPIC   - Published when sync starts
  $SYNC_COMPLETE_TOPIC  - Published when sync completes
EOF
    exit 0
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $*"
    dd_info "$*" "rig:bead-sync" 2>/dev/null || true
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $*"
    dd_info "$*" "rig:bead-sync,status:success" 2>/dev/null || true
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $*"
    dd_warn "$*" "rig:bead-sync" 2>/dev/null || true
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*"
    dd_error "$*" "rig:bead-sync" 2>/dev/null || true
}

# Publish sync event to Kafka
publish_sync_event() {
    local topic="$1"
    local event_type="$2"
    local payload="$3"

    local timestamp
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    local event_json
    event_json=$(cat <<EOF
{
  "type": "$event_type",
  "timestamp": "$timestamp",
  "sourceRig": "$SOURCE_RIG",
  "targetRig": "$TARGET_RIG",
  "namespace": "$NAMESPACE",
  "syncVersion": $SYNC_VERSION,
  "payload": $payload
}
EOF
)

    if command -v kafka-console-producer &>/dev/null; then
        echo "$event_json" | kafka-console-producer --broker-list "$KAFKA_BROKERS" --topic "$topic" 2>/dev/null || true
        log_info "Published $event_type event to $topic"
    elif command -v kcat &>/dev/null; then
        echo "$event_json" | kcat -P -b "$KAFKA_BROKERS" -t "$topic" 2>/dev/null || true
        log_info "Published $event_type event to $topic"
    else
        log_warn "No Kafka producer available, skipping event publication"
    fi
}

# Get beads from a rig
get_beads() {
    local context="$1"
    local selector="${2:-}"

    local cmd="kubectl --context=$context -n $NAMESPACE get beads -o json"
    if [[ -n "$selector" ]]; then
        cmd="$cmd -l $selector"
    fi

    eval "$cmd" 2>/dev/null || echo '{"items":[]}'
}

# Get a single bead by name
get_bead() {
    local context="$1"
    local name="$2"

    kubectl --context="$context" -n "$NAMESPACE" get bead "$name" -o json 2>/dev/null || echo ""
}

# Apply bead to target rig
apply_bead() {
    local context="$1"
    local bead_json="$2"
    local bead_name="$3"

    # Update sync status in the bead
    local updated_bead
    updated_bead=$(echo "$bead_json" | jq --arg rig "$SOURCE_RIG" --arg ts "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" --argjson ver "$SYNC_VERSION" --arg state "synced" '
        .status.sync = {
            sourceRig: $rig,
            lastSyncTimestamp: $ts,
            syncVersion: $ver,
            syncState: $state,
            syncedToRigs: ((.status.sync.syncedToRigs // []) + ["'"$TARGET_RIG"'"] | unique)
        } |
        # Remove resourceVersion for apply
        del(.metadata.resourceVersion) |
        del(.metadata.uid) |
        del(.metadata.creationTimestamp) |
        del(.metadata.generation) |
        del(.metadata.managedFields)
    ')

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY-RUN] Would apply bead: $bead_name"
        return 0
    fi

    echo "$updated_bead" | kubectl --context="$context" -n "$NAMESPACE" apply -f - >/dev/null 2>&1
}

# Compare bead versions and determine if sync is needed
should_sync_bead() {
    local source_bead="$1"
    local target_bead="$2"

    # If target doesn't exist, sync
    if [[ -z "$target_bead" || "$target_bead" == "null" ]]; then
        echo "missing"
        return 0
    fi

    # Compare sync versions
    local source_version
    local target_version
    source_version=$(echo "$source_bead" | jq -r '.status.sync.syncVersion // 0')
    target_version=$(echo "$target_bead" | jq -r '.status.sync.syncVersion // 0')

    # Compare last transition timestamps as fallback
    local source_transition
    local target_transition
    source_transition=$(echo "$source_bead" | jq -r '.status.lastTransition // "1970-01-01T00:00:00Z"')
    target_transition=$(echo "$target_bead" | jq -r '.status.lastTransition // "1970-01-01T00:00:00Z"')

    if [[ "$FORCE_SYNC" == "true" ]]; then
        echo "forced"
        return 0
    fi

    if [[ "$source_version" -gt "$target_version" ]]; then
        echo "newer_source"
        return 0
    fi

    if [[ "$source_version" -lt "$target_version" ]]; then
        echo "newer_target"
        return 1
    fi

    # Same version, check timestamps
    if [[ "$source_transition" > "$target_transition" ]]; then
        echo "updated_source"
        return 0
    fi

    echo "in_sync"
    return 1
}

# Main sync logic
sync_beads() {
    log_info "Starting cross-rig bead sync"
    log_info "  Source rig: $SOURCE_RIG"
    log_info "  Target rig: $TARGET_RIG"
    log_info "  Namespace:  $NAMESPACE"
    [[ -n "$LABEL_SELECTOR" ]] && log_info "  Selector:   $LABEL_SELECTOR"
    [[ -n "$LANE_FILTER" ]] && log_info "  Lane:       $LANE_FILTER"
    [[ "$DRY_RUN" == "true" ]] && log_warn "  DRY RUN MODE - no changes will be made"

    # Build selector
    local selector="$LABEL_SELECTOR"
    if [[ -n "$LANE_FILTER" ]]; then
        if [[ -n "$selector" ]]; then
            selector="$selector,tundra.dome/lane=$LANE_FILTER"
        else
            selector="tundra.dome/lane=$LANE_FILTER"
        fi
    fi

    # Publish sync request event
    local beads_info='{"selector": "'"${selector:-all}"'"}'
    publish_sync_event "$SYNC_REQUEST_TOPIC" "sync_started" "$beads_info"

    # Get beads from source rig
    log_info "Fetching beads from source rig..."
    local source_beads
    source_beads=$(get_beads "$SOURCE_RIG" "$selector")

    local source_count
    source_count=$(echo "$source_beads" | jq '.items | length')
    log_info "Found $source_count beads on source rig"

    if [[ "$source_count" -eq 0 ]]; then
        log_warn "No beads found matching criteria, nothing to sync"
        publish_sync_event "$SYNC_COMPLETE_TOPIC" "sync_completed" '{"synced": 0, "skipped": 0, "failed": 0}'
        return 0
    fi

    # Process each bead
    local synced=0
    local skipped=0
    local failed=0
    local conflicts=0

    while IFS= read -r bead_json; do
        local bead_name
        bead_name=$(echo "$bead_json" | jq -r '.metadata.name')

        log_info "Processing bead: $bead_name"

        # Get target bead if exists
        local target_bead
        target_bead=$(get_bead "$TARGET_RIG" "$bead_name")

        # Determine if sync is needed
        local sync_reason
        if sync_reason=$(should_sync_bead "$bead_json" "$target_bead"); then
            log_info "  Sync needed: $sync_reason"

            if apply_bead "$TARGET_RIG" "$bead_json" "$bead_name"; then
                log_success "  Synced: $bead_name"
                ((synced++))
            else
                log_error "  Failed to sync: $bead_name"
                ((failed++))
            fi
        else
            case "$sync_reason" in
                "newer_target")
                    if [[ "$CONFLICT_RESOLUTION" == "source-wins" && "$FORCE_SYNC" == "true" ]]; then
                        log_warn "  Target is newer, but forcing sync (source-wins)"
                        if apply_bead "$TARGET_RIG" "$bead_json" "$bead_name"; then
                            log_success "  Force synced: $bead_name"
                            ((synced++))
                        else
                            log_error "  Failed to force sync: $bead_name"
                            ((failed++))
                        fi
                    else
                        log_warn "  Target is newer, skipping (use --force to override)"
                        ((conflicts++))
                    fi
                    ;;
                "in_sync")
                    log_info "  Already in sync: $bead_name"
                    ((skipped++))
                    ;;
                *)
                    log_info "  Skipped: $bead_name ($sync_reason)"
                    ((skipped++))
                    ;;
            esac
        fi
    done < <(echo "$source_beads" | jq -c '.items[]')

    # Summary
    echo ""
    log_info "=== Sync Summary ==="
    log_success "Synced:    $synced"
    log_info "Skipped:   $skipped"
    [[ "$conflicts" -gt 0 ]] && log_warn "Conflicts: $conflicts"
    [[ "$failed" -gt 0 ]] && log_error "Failed:    $failed"

    # Record metrics
    dd_metric "bead.sync.synced" "$synced" "count" "source_rig:$SOURCE_RIG,target_rig:$TARGET_RIG" 2>/dev/null || true
    dd_metric "bead.sync.skipped" "$skipped" "count" "source_rig:$SOURCE_RIG,target_rig:$TARGET_RIG" 2>/dev/null || true
    dd_metric "bead.sync.failed" "$failed" "count" "source_rig:$SOURCE_RIG,target_rig:$TARGET_RIG" 2>/dev/null || true
    dd_metric "bead.sync.conflicts" "$conflicts" "count" "source_rig:$SOURCE_RIG,target_rig:$TARGET_RIG" 2>/dev/null || true

    # Publish sync complete event
    local complete_payload
    complete_payload=$(cat <<EOF
{
  "synced": $synced,
  "skipped": $skipped,
  "failed": $failed,
  "conflicts": $conflicts
}
EOF
)
    publish_sync_event "$SYNC_COMPLETE_TOPIC" "sync_completed" "$complete_payload"

    # Exit with error if any failures
    if [[ "$failed" -gt 0 ]]; then
        return 1
    fi
    return 0
}

# Parse arguments
SOURCE_RIG=""
TARGET_RIG=""
LABEL_SELECTOR=""
LANE_FILTER=""
FORCE_SYNC="false"
CONFLICT_RESOLUTION="source-wins"

while [[ $# -gt 0 ]]; do
    case $1 in
        --source-rig)
            SOURCE_RIG="$2"
            shift 2
            ;;
        --target-rig)
            TARGET_RIG="$2"
            shift 2
            ;;
        --namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        --kafka-brokers)
            KAFKA_BROKERS="$2"
            shift 2
            ;;
        --label-selector)
            LABEL_SELECTOR="$2"
            shift 2
            ;;
        --lane)
            LANE_FILTER="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN="true"
            shift
            ;;
        --force)
            FORCE_SYNC="true"
            shift
            ;;
        --conflict-resolution)
            CONFLICT_RESOLUTION="$2"
            shift 2
            ;;
        -h|--help)
            usage
            ;;
        *)
            log_error "Unknown option: $1"
            usage
            ;;
    esac
done

# Validate required arguments
if [[ -z "$SOURCE_RIG" ]]; then
    log_error "Missing required argument: --source-rig"
    usage
fi

if [[ -z "$TARGET_RIG" ]]; then
    log_error "Missing required argument: --target-rig"
    usage
fi

# Validate conflict resolution strategy
case "$CONFLICT_RESOLUTION" in
    source-wins|target-wins|manual)
        ;;
    *)
        log_error "Invalid conflict resolution strategy: $CONFLICT_RESOLUTION"
        log_error "Valid options: source-wins, target-wins, manual"
        exit 1
        ;;
esac

# Validate contexts exist
if ! kubectl config get-contexts "$SOURCE_RIG" &>/dev/null; then
    log_error "Source rig context not found: $SOURCE_RIG"
    log_info "Available contexts:"
    kubectl config get-contexts -o name
    exit 1
fi

if ! kubectl config get-contexts "$TARGET_RIG" &>/dev/null; then
    log_error "Target rig context not found: $TARGET_RIG"
    log_info "Available contexts:"
    kubectl config get-contexts -o name
    exit 1
fi

# Run sync
sync_beads
