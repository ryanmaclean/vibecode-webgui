#!/usr/bin/env bash
# Track MiniVim CI run results automatically
set -euo pipefail

RESULTS_DIR="artifacts/minivim/ci-results"
SUMMARY_FILE="$RESULTS_DIR/summary.json"
WORKFLOW_NAME="minivim-build.yml"

# Ensure results directory exists
mkdir -p "$RESULTS_DIR"

# Initialize summary file if it doesn't exist
if [[ ! -f "$SUMMARY_FILE" ]]; then
  echo '{"runs": [], "stats": {"total": 0, "success": 0, "failure": 0}, "last_check": null}' > "$SUMMARY_FILE"
fi

echo "Fetching MiniVim CI run results..."

# Fetch recent workflow runs (requires gh CLI)
if ! command -v gh &> /dev/null; then
  echo "Error: gh CLI required. Install: brew install gh"
  exit 1
fi

# Get last 10 workflow runs
RUNS=$(gh run list --workflow "$WORKFLOW_NAME" --limit 10 --json databaseId,conclusion,createdAt,displayTitle,headBranch)

# Process each run
echo "$RUNS" | jq -c '.[]' | while read -r run; do
  RUN_ID=$(echo "$run" | jq -r '.databaseId')
  CONCLUSION=$(echo "$run" | jq -r '.conclusion')
  CREATED_AT=$(echo "$run" | jq -r '.createdAt')
  TITLE=$(echo "$run" | jq -r '.displayTitle')
  BRANCH=$(echo "$run" | jq -r '.headBranch')
  
  # Check if we've already tracked this run
  ALREADY_TRACKED=$(jq --arg id "$RUN_ID" '.runs | any(.run_id == ($id | tonumber))' "$SUMMARY_FILE")
  
  if [[ "$ALREADY_TRACKED" == "true" ]]; then
    continue
  fi
  
  echo "📝 Tracking new run: $RUN_ID ($CONCLUSION)"
  
  # Fetch detailed logs
  LOG_FILE="$RESULTS_DIR/run-$RUN_ID.log"
  gh run view "$RUN_ID" --log > "$LOG_FILE" 2>&1 || echo "Failed to fetch logs for run $RUN_ID"
  
  # Extract metrics from logs
  BUILD_TIME=$(grep -o "Build completed in [0-9]*s" "$LOG_FILE" | grep -o "[0-9]*" || echo "0")
  KERNEL_SIZE=$(grep -o "Kernel size: [0-9]* bytes" "$LOG_FILE" | grep -o "[0-9]*" || echo "0")
  
  # Add to summary
  jq --arg run_id "$RUN_ID" \
     --arg conclusion "$CONCLUSION" \
     --arg created_at "$CREATED_AT" \
     --arg title "$TITLE" \
     --arg branch "$BRANCH" \
     --arg build_time "$BUILD_TIME" \
     --arg kernel_size "$KERNEL_SIZE" \
     --arg check_date "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
     '.runs += [{
        run_id: ($run_id | tonumber),
        conclusion: $conclusion,
        created_at: $created_at,
        title: $title,
        branch: $branch,
        build_time_seconds: ($build_time | tonumber),
        kernel_size_bytes: ($kernel_size | tonumber),
        tracked_at: $check_date
     }] | .last_check = $check_date' \
     "$SUMMARY_FILE" > "$SUMMARY_FILE.tmp"
  mv "$SUMMARY_FILE.tmp" "$SUMMARY_FILE"
done

# Update statistics
jq '.stats.total = (.runs | length) |
    .stats.success = (.runs | map(select(.conclusion == "success")) | length) |
    .stats.failure = (.runs | map(select(.conclusion == "failure")) | length) |
    .stats.success_rate = ((.stats.success / .stats.total * 100) | round)' \
   "$SUMMARY_FILE" > "$SUMMARY_FILE.tmp"
mv "$SUMMARY_FILE.tmp" "$SUMMARY_FILE"

# Display summary
echo ""
echo "📊 MiniVim CI Summary:"
jq -r '"Total Runs: \(.stats.total)
Success: \(.stats.success) (\(.stats.success_rate)%)
Failure: \(.stats.failure)
Last Check: \(.last_check)"' "$SUMMARY_FILE"

# Check for concerning trends
RECENT_FAILURES=$(jq '.runs[-5:] | map(select(.conclusion == "failure")) | length' "$SUMMARY_FILE")
if [[ "$RECENT_FAILURES" -ge 3 ]]; then
  echo ""
  echo "⚠️  WARNING: $RECENT_FAILURES failures in last 5 runs!"
  echo "Creating alert issue..."
  
  gh issue create \
    --title "[ALERT] MiniVim CI: Multiple recent failures detected" \
    --body "MiniVim CI health check detected concerning failure rate:

**Recent Performance**:
- Failures in last 5 runs: $RECENT_FAILURES/5
- Overall success rate: $(jq -r '.stats.success_rate' "$SUMMARY_FILE")%

**Action Required**:
1. Review failed run logs in \`$RESULTS_DIR\`
2. Investigate root cause
3. Fix build or test issues
4. Restore CI health

**Automated by**: scripts/track-minivim-ci.sh" \
    --label "bug,high-priority,ci-cd,virtualization" || echo "Failed to create alert issue"
fi

echo ""
echo "✓ Results saved to: $RESULTS_DIR"
echo "✓ Summary updated: $SUMMARY_FILE"
