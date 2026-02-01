#!/bin/bash
echo "Starting VibeCode Infinite Loop..."
echo "Press Ctrl+C to stop."

while true; do
    echo "--- Cycle Start: $(date) ---"
    
    # 1. Run Ralph Loop (Validation)
    python3 scripts/ralph_loop.py
    
    # 2. Check for Polecats (Automated Merges)
    # python3 scripts/merge_polecats.py --check-only
    
    echo "--- Cycle End ---"
    sleep 30
done
