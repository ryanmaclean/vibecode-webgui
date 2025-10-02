#!/bin/bash
set -e

# GitHub Actions Workflow Monitoring Script
# Monitors codeserver-multiarch.yml workflow for Cline 3.32.6 & Continue 1.3.15 build

# Configuration
WORKFLOW="codeserver-multiarch.yml"
EXPECTED_DURATION_MIN=15
EXPECTED_DURATION_MAX=30
CHECK_INTERVAL=30

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}📊 GitHub Actions Workflow Monitor${NC}"
echo "========================================"
echo "Workflow: $WORKFLOW"
echo "Check interval: ${CHECK_INTERVAL}s"
echo ""

# Function to get latest run
get_latest_run() {
    gh run list --workflow="$WORKFLOW" --limit 1 --json databaseId,status,conclusion,createdAt,updatedAt 2>/dev/null || echo "[]"
}

# Function to format duration
format_duration() {
    local seconds=$1
    local minutes=$((seconds / 60))
    local remaining_seconds=$((seconds % 60))
    echo "${minutes}m ${remaining_seconds}s"
}

# Check if gh CLI is available
if ! command -v gh &> /dev/null; then
    echo -e "${RED}✗ GitHub CLI (gh) not found${NC}"
    echo ""
    echo "Please install gh CLI:"
    echo "  brew install gh"
    echo "  or visit: https://cli.github.com/"
    exit 1
fi

# Check authentication
if ! gh auth status &> /dev/null; then
    echo -e "${YELLOW}⚠ GitHub CLI not authenticated${NC}"
    echo ""
    echo "Please authenticate:"
    echo "  gh auth login"
    exit 1
fi

echo -e "${GREEN}✓ GitHub CLI ready${NC}"
echo ""

# Get latest run
echo "Fetching latest workflow run..."
RUN_DATA=$(get_latest_run)

if [ "$RUN_DATA" = "[]" ] || [ -z "$RUN_DATA" ]; then
    echo -e "${YELLOW}⚠ No workflow runs found for $WORKFLOW${NC}"
    echo ""
    echo "To trigger a build:"
    echo "  gh workflow run $WORKFLOW"
    exit 0
fi

# Parse run data
RUN_ID=$(echo "$RUN_DATA" | jq -r '.[0].databaseId')
STATUS=$(echo "$RUN_DATA" | jq -r '.[0].status')
CONCLUSION=$(echo "$RUN_DATA" | jq -r '.[0].conclusion')
CREATED_AT=$(echo "$RUN_DATA" | jq -r '.[0].createdAt')
UPDATED_AT=$(echo "$RUN_DATA" | jq -r '.[0].updatedAt')

echo -e "${BLUE}Latest Run:${NC}"
echo "  Run ID: $RUN_ID"
echo "  Status: $STATUS"
echo "  Conclusion: $CONCLUSION"
echo "  Created: $CREATED_AT"
echo "  Updated: $UPDATED_AT"
echo ""

# Calculate duration if completed
if [ "$STATUS" = "completed" ]; then
    CREATED_EPOCH=$(date -d "$CREATED_AT" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%SZ" "$CREATED_AT" +%s 2>/dev/null || echo 0)
    UPDATED_EPOCH=$(date -d "$UPDATED_AT" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%SZ" "$UPDATED_AT" +%s 2>/dev/null || echo 0)
    
    if [ "$CREATED_EPOCH" -gt 0 ] && [ "$UPDATED_EPOCH" -gt 0 ]; then
        DURATION=$((UPDATED_EPOCH - CREATED_EPOCH))
        DURATION_MIN=$((DURATION / 60))
        
        echo "Duration: $(format_duration $DURATION)"
        
        if [ $DURATION_MIN -ge $EXPECTED_DURATION_MIN ] && [ $DURATION_MIN -le $EXPECTED_DURATION_MAX ]; then
            echo -e "${GREEN}✓ Duration within expected range (${EXPECTED_DURATION_MIN}-${EXPECTED_DURATION_MAX} minutes)${NC}"
        else
            echo -e "${YELLOW}⚠ Duration outside expected range (${EXPECTED_DURATION_MIN}-${EXPECTED_DURATION_MAX} minutes)${NC}"
        fi
        echo ""
    fi
fi

# Check conclusion
if [ "$STATUS" = "completed" ]; then
    if [ "$CONCLUSION" = "success" ]; then
        echo -e "${GREEN}✓ Workflow completed successfully!${NC}"
        echo ""
        echo "Next steps:"
        echo "  1. Run verification script: ./scripts/verify-codeserver-extensions.sh"
        echo "  2. Pull latest image: docker pull ghcr.io/ryanmaclean/vibecode-codeserver:latest"
        echo "  3. Test extensions manually"
        echo "  4. Update CHANGELOG.md"
        echo "  5. Close tracking issue"
        exit 0
    else
        echo -e "${RED}✗ Workflow failed with conclusion: $CONCLUSION${NC}"
        echo ""
        echo "To debug:"
        echo "  gh run view $RUN_ID"
        echo "  gh run view $RUN_ID --log"
        echo "  gh run view $RUN_ID --log-failed"
        exit 1
    fi
elif [ "$STATUS" = "in_progress" ] || [ "$STATUS" = "queued" ]; then
    echo -e "${YELLOW}⏳ Workflow is $STATUS${NC}"
    echo ""
    echo "To watch progress:"
    echo "  gh run watch $RUN_ID"
    echo ""
    echo "To view details:"
    echo "  gh run view $RUN_ID"
    echo ""
    
    # Optional: continuously monitor
    if [ "${1:-}" = "--watch" ]; then
        echo "Monitoring workflow (press Ctrl+C to stop)..."
        echo ""
        
        while true; do
            RUN_DATA=$(get_latest_run)
            STATUS=$(echo "$RUN_DATA" | jq -r '.[0].status')
            
            if [ "$STATUS" = "completed" ]; then
                echo -e "${GREEN}✓ Workflow completed${NC}"
                exec "$0"  # Re-run script to show final status
            fi
            
            echo -e "$(date '+%Y-%m-%d %H:%M:%S') - Status: $STATUS"
            sleep $CHECK_INTERVAL
        done
    fi
else
    echo -e "${YELLOW}⚠ Unknown status: $STATUS${NC}"
fi
