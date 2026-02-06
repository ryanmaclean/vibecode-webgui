#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

echo "Starting VibeCode Infinite Loop..."
echo "Press Ctrl+C to stop."


# Initialize log aggregation
init_log_aggregation

while true; do
    echo "--- Cycle Start: $(date) ---"
    
    # 1. Run Ralph Loop (Validation)
    python3 scripts/ralph_loop.py
    
    # 2. Check for Polecats (Automated Merges)
    # python3 scripts/merge_polecats.py --check-only
    
    echo "--- Cycle End ---"
    sleep 30
done
