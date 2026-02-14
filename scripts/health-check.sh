#!/usr/bin/env bash
# Project Health Check - VibeCode Platform
# Generates automated stats that replace manual MEMORY.md tracking

set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Parse arguments
QUICK_MODE=false
while [[ $# -gt 0 ]]; do
  case $1 in
    --quick)
      QUICK_MODE=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--quick]"
      exit 1
      ;;
  esac
done

echo "=== VibeCode Project Health Report ==="
echo "Date: $(date -u '+%Y-%m-%d %H:%M UTC')"
echo ""

# 1. Test stats
echo "--- Tests ---"
TEST_FILES=$(find src -type f \( -name "*.test.ts" -o -name "*.test.tsx" -o -name "*.test.js" \) 2>/dev/null | wc -l | tr -d ' ')
echo "Test files: $TEST_FILES"

# Run jest to get actual test count (if not in quick mode)
if [ "$QUICK_MODE" = false ]; then
  # Try to extract test count from jest dry-run
  JEST_OUTPUT=$(npm test -- --listTests 2>/dev/null | wc -l | tr -d ' ') || JEST_OUTPUT="N/A"
  echo "Jest test suites: $JEST_OUTPUT"
fi

# 2. TypeScript errors (skip in quick mode - slow)
echo ""
echo "--- TypeScript ---"
if [ "$QUICK_MODE" = false ]; then
  # Run tsc with timeout to prevent hanging
  TS_OUTPUT=$(timeout 60s npx tsc --noEmit 2>&1 || true)
  if [ $? -eq 124 ]; then
    echo "TS errors: (timeout - check manually with 'npm run type-check')"
  else
    TS_ERRORS=$(echo "$TS_OUTPUT" | grep "error TS" | wc -l | tr -d ' ')
    if [ "$TS_ERRORS" = "0" ]; then
      echo -e "TS errors: ${GREEN}$TS_ERRORS${NC}"
    else
      echo -e "TS errors: ${RED}$TS_ERRORS${NC}"
    fi
  fi
else
  echo "TS errors: (skipped in quick mode)"
fi

# 3. API route count
echo ""
echo "--- API Routes ---"
API_ROUTES=$(find src/app/api -type f -name "route.ts" 2>/dev/null | wc -l | tr -d ' ')
echo "API routes: $API_ROUTES"

# Count route types by checking for common patterns
REAL_ROUTES=$(grep -r "createServiceLogger\|NextResponse\|NextRequest" src/app/api --include="route.ts" -l 2>/dev/null | wc -l | tr -d ' ')
echo "Routes with handlers: $REAL_ROUTES"

# 4. Page count
echo ""
echo "--- Pages ---"
PAGE_FILES=$(find src/app -type f -name "page.tsx" 2>/dev/null | wc -l | tr -d ' ')
echo "Total pages: $PAGE_FILES"

# 5. DemoBanner pages
DEMO_PAGES=$(grep -r "DemoBanner\|from.*DemoBanner" src/app --include="page.tsx" -l 2>/dev/null | wc -l | tr -d ' ')
echo "Pages with DemoBanner: $DEMO_PAGES"

# 6. GitHub Issues (requires gh CLI)
echo ""
echo "--- GitHub ---"
if command -v gh &> /dev/null; then
  OPEN_ISSUES=$(gh issue list --state open --limit 1000 --json number 2>/dev/null | jq 'length' || echo "N/A")
  OPEN_PRS=$(gh pr list --state open --limit 1000 --json number 2>/dev/null | jq 'length' || echo "N/A")

  echo "Open issues: $OPEN_ISSUES"
  echo "Open PRs: $OPEN_PRS"

  # 7. Dependabot alerts (requires gh CLI + auth)
  DEPENDABOT_ALERTS=$(gh api /repos/:owner/:repo/dependabot/alerts --jq 'length' 2>/dev/null || echo "N/A")
  if [ "$DEPENDABOT_ALERTS" != "N/A" ]; then
    echo "Dependabot alerts: $DEPENDABOT_ALERTS"

    # Break down by severity
    HIGH_ALERTS=$(gh api /repos/:owner/:repo/dependabot/alerts --jq '[.[] | select(.security_advisory.severity == "high")] | length' 2>/dev/null || echo "0")
    MEDIUM_ALERTS=$(gh api /repos/:owner/:repo/dependabot/alerts --jq '[.[] | select(.security_advisory.severity == "medium")] | length' 2>/dev/null || echo "0")
    LOW_ALERTS=$(gh api /repos/:owner/:repo/dependabot/alerts --jq '[.[] | select(.security_advisory.severity == "low")] | length' 2>/dev/null || echo "0")
    echo "  - High: $HIGH_ALERTS, Medium: $MEDIUM_ALERTS, Low: $LOW_ALERTS"
  else
    echo "Dependabot alerts: (unable to fetch - check gh auth)"
  fi
else
  echo "Open issues: (gh CLI not installed)"
  echo "Open PRs: (gh CLI not installed)"
  echo "Dependabot alerts: (gh CLI not installed)"
fi

# 8. Remote branches
echo ""
echo "--- Git ---"
REMOTE_BRANCHES=$(git branch -r 2>/dev/null | grep -v '\->' | wc -l | tr -d ' ')
echo "Remote branches: $REMOTE_BRANCHES"

CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
echo "Current branch: $CURRENT_BRANCH"

# Check for uncommitted changes
UNCOMMITTED=$(git status --short 2>/dev/null | wc -l | tr -d ' ')
if [ "$UNCOMMITTED" -gt 0 ]; then
  echo -e "Uncommitted changes: ${YELLOW}$UNCOMMITTED files${NC}"
else
  echo -e "Uncommitted changes: ${GREEN}0${NC}"
fi

# 9. Lines of code estimate (parallel execution for speed)
echo ""
echo "--- Code Size ---"
if [ "$QUICK_MODE" = false ]; then
  # Count TypeScript/TSX lines
  TS_LINES=$(find src -type f \( -name "*.ts" -o -name "*.tsx" \) -not -path "*/node_modules/*" 2>/dev/null | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}' || echo "0")
  echo "TypeScript/TSX lines: $TS_LINES"

  # Count test lines
  TEST_LINES=$(find src -type f \( -name "*.test.ts" -o -name "*.test.tsx" -o -name "*.test.js" \) 2>/dev/null | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}' || echo "0")
  echo "Test lines: $TEST_LINES"

  # Production code (excluding tests)
  PROD_LINES=$((TS_LINES - TEST_LINES))
  echo "Production code lines: $PROD_LINES"
else
  # Quick estimate using parallel find
  FILE_COUNT=$(find src -type f \( -name "*.ts" -o -name "*.tsx" \) -not -path "*/node_modules/*" 2>/dev/null | wc -l | tr -d ' ')
  echo "TypeScript/TSX files: $FILE_COUNT (use --no-quick for line count)"
fi

# 10. Additional useful metrics
echo ""
echo "--- Dependencies ---"
NPM_DEPS=$(jq '.dependencies | length' package.json 2>/dev/null || echo "N/A")
NPM_DEV_DEPS=$(jq '.devDependencies | length' package.json 2>/dev/null || echo "N/A")
echo "Production dependencies: $NPM_DEPS"
echo "Dev dependencies: $NPM_DEV_DEPS"

# 11. Build artifacts
echo ""
echo "--- Build ---"
if [ -d ".next" ]; then
  NEXT_SIZE=$(du -sh .next 2>/dev/null | awk '{print $1}')
  echo ".next cache size: $NEXT_SIZE"
else
  echo ".next cache: not built"
fi

if [ -d "node_modules" ]; then
  NODE_MODULES_SIZE=$(du -sh node_modules 2>/dev/null | awk '{print $1}')
  echo "node_modules size: $NODE_MODULES_SIZE"
fi

# 12. Infrastructure status (if KIND is available)
echo ""
echo "--- Infrastructure ---"
if command -v kubectl &> /dev/null; then
  CONTEXTS=$(kubectl config get-contexts -o name 2>/dev/null | wc -l | tr -d ' ')
  CURRENT_CONTEXT=$(kubectl config current-context 2>/dev/null || echo "none")
  echo "Kubectl contexts: $CONTEXTS"
  echo "Current context: $CURRENT_CONTEXT"

  if [ "$CURRENT_CONTEXT" != "none" ]; then
    PODS=$(kubectl get pods --all-namespaces 2>/dev/null | wc -l | tr -d ' ')
    echo "Total pods (all namespaces): $((PODS - 1))" # Subtract header line
  fi
else
  echo "kubectl: not installed"
fi

# Summary footer
echo ""
echo "=== Health Check Complete ==="
if [ "$QUICK_MODE" = true ]; then
  echo "(Run without --quick for TypeScript error check and detailed metrics)"
fi
