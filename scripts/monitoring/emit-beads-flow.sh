#!/usr/bin/env bash
set -euo pipefail

source scripts/lib/datadog-logging.sh
source scripts/lib/log-aggregation.sh

SCRIPT_NAME="emit-beads-flow"
log_script_start "$SCRIPT_NAME" "$*"

# Simple edge metrics for beads flow.
# Usage: FROM=Created TO="In Progress" COUNT=5 ./scripts/monitoring/emit-beads-flow.sh
FROM=${FROM:-Created}
TO=${TO:-In\ Progress}
COUNT=${COUNT:-1}

# Normalize tags
from_tag=$(echo "$FROM" | tr ' ' '_' | tr '[:upper:]' '[:lower:]')
to_tag=$(echo "$TO" | tr ' ' '_' | tr '[:upper:]' '[:lower:]')

metric="gastown.flow.edge"

# Emit edge metric
for i in $(seq 1 "$COUNT"); do
  dd_metric "$metric" 1 "count" "from:${from_tag}" "to:${to_tag}" "component:beads-flow"
  sleep 0.05
 done

dd_info "Emitted flow edge" "from:${from_tag}" "to:${to_tag}" "count:${COUNT}" "component:beads-flow"
dd_info "bead_provenance" "from:${from_tag}" "to:${to_tag}" "stage:${to_tag}" "source:beads-flow" "component:beads-flow"
log_script_end "$SCRIPT_NAME" 0 1
