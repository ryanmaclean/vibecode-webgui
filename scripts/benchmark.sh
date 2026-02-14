#!/bin/bash
set -euo pipefail

# VibeCode Benchmark Script
# Measures build times, test performance, bundle sizes, and project metrics
# Usage:
#   npm run benchmark         # Full benchmark (includes build + tests)
#   npm run benchmark:quick   # Quick benchmark (counts and sizes only)

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
QUICK_MODE=false
if [[ "${1:-}" == "--quick" ]]; then
    QUICK_MODE=true
fi

# Create benchmarks directory if needed
BENCHMARKS_DIR="benchmarks"
mkdir -p "${BENCHMARKS_DIR}"

# Timestamp for output file
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
OUTPUT_FILE="${BENCHMARKS_DIR}/benchmark-${TIMESTAMP}.json"

echo -e "${BLUE}=== VibeCode Benchmark ===${NC}"
echo -e "${BLUE}Timestamp: ${TIMESTAMP}${NC}"
echo ""

# Initialize result variables
API_ROUTE_COUNT=0
PAGE_COUNT=0
TEST_FILE_COUNT=0
DEMO_BANNER_COUNT=0
NODE_MODULES_SIZE="N/A"
TSC_TIME=0
TSC_ERRORS=0
BUILD_TIME="skipped"
BUNDLE_SIZE="skipped"
TEST_TIME="skipped"
TEST_SUITES="skipped"

# Helper function to format time
format_time() {
    local seconds=$1
    if (( $(echo "$seconds < 60" | bc -l) )); then
        printf "%.2fs" "$seconds"
    else
        local mins=$(echo "$seconds / 60" | bc)
        local secs=$(echo "$seconds % 60" | bc)
        printf "%dm %.0fs" "$mins" "$secs"
    fi
}

# Helper function to format size
format_size() {
    local size=$1
    if [[ "$size" =~ ^([0-9.]+)([KMGT]?)$ ]]; then
        echo "${size}"
    else
        echo "N/A"
    fi
}

# 1. Count API routes
echo -e "${YELLOW}Counting API routes...${NC}"
API_ROUTE_COUNT=$(find src/app/api -name 'route.ts' -o -name 'route.js' 2>/dev/null | wc -l | tr -d ' ')
echo -e "${GREEN}✓ API routes: ${API_ROUTE_COUNT}${NC}"

# 2. Count pages
echo -e "${YELLOW}Counting pages...${NC}"
PAGE_COUNT=$(find src/app -name 'page.tsx' -o -name 'page.ts' -o -name 'page.jsx' -o -name 'page.js' 2>/dev/null | wc -l | tr -d ' ')
echo -e "${GREEN}✓ Pages: ${PAGE_COUNT}${NC}"

# 3. Count test files
echo -e "${YELLOW}Counting test files...${NC}"
TEST_FILE_COUNT=$(find tests -name '*.test.ts' -o -name '*.test.tsx' -o -name '*.test.js' -o -name '*.test.jsx' 2>/dev/null | wc -l | tr -d ' ')
echo -e "${GREEN}✓ Test files: ${TEST_FILE_COUNT}${NC}"

# 4. Count pages with DemoBanner
echo -e "${YELLOW}Counting pages with DemoBanner...${NC}"
DEMO_BANNER_COUNT=$(grep -r "DemoBanner" src/app --include="*.tsx" --include="*.ts" --include="*.jsx" --include="*.js" 2>/dev/null | wc -l | tr -d ' ')
echo -e "${GREEN}✓ Pages with DemoBanner: ${DEMO_BANNER_COUNT}${NC}"

# 5. node_modules size
echo -e "${YELLOW}Measuring node_modules size...${NC}"
if [[ -d "node_modules" ]]; then
    NODE_MODULES_SIZE=$(du -sh node_modules 2>/dev/null | cut -f1 | tr -d ' ')
    echo -e "${GREEN}✓ node_modules size: ${NODE_MODULES_SIZE}${NC}"
else
    NODE_MODULES_SIZE="N/A"
    echo -e "${RED}✗ node_modules not found${NC}"
fi

# 6. TypeScript type checking (always run, it's fast)
echo ""
echo -e "${YELLOW}Running TypeScript type check...${NC}"
SECONDS=0
if npx tsc --noEmit > /tmp/tsc-output.txt 2>&1; then
    TSC_TIME=$SECONDS
    TSC_ERRORS=$(grep -c "error TS" /tmp/tsc-output.txt 2>/dev/null || true)
    if [[ -z "$TSC_ERRORS" || "$TSC_ERRORS" == "0" ]]; then
        TSC_ERRORS=0
    fi
    echo -e "${GREEN}✓ Type check complete: $(format_time $TSC_TIME) (${TSC_ERRORS} errors)${NC}"
else
    TSC_TIME=$SECONDS
    TSC_ERRORS=$(grep -c "error TS" /tmp/tsc-output.txt 2>/dev/null || true)
    if [[ -z "$TSC_ERRORS" || "$TSC_ERRORS" == "0" ]]; then
        TSC_ERRORS=0
    fi
    echo -e "${YELLOW}⚠ Type check finished with errors: $(format_time $TSC_TIME) (${TSC_ERRORS} errors)${NC}"
fi

if [[ "$QUICK_MODE" == true ]]; then
    echo ""
    echo -e "${YELLOW}Quick mode: Skipping build and tests${NC}"
    BUILD_TIME="skipped"
    BUNDLE_SIZE="skipped"
    TEST_TIME="skipped"
    TEST_SUITES="skipped"
else
    # 7. Next.js build time
    echo ""
    echo -e "${YELLOW}Building Next.js (this may take a while)...${NC}"
    echo -e "${BLUE}Cleaning .next cache...${NC}"
    rm -rf .next

    SECONDS=0
    if npm run build > /tmp/build-output.txt 2>&1; then
        BUILD_TIME=$SECONDS
        echo -e "${GREEN}✓ Build complete: $(format_time $BUILD_TIME)${NC}"
    else
        BUILD_TIME="failed"
        echo -e "${RED}✗ Build failed${NC}"
        tail -20 /tmp/build-output.txt
    fi

    # 8. Bundle size (after build)
    echo ""
    echo -e "${YELLOW}Measuring bundle size...${NC}"
    if [[ -d ".next/standalone" ]]; then
        BUNDLE_SIZE=$(du -sh .next/standalone 2>/dev/null | cut -f1 | tr -d ' ')
        echo -e "${GREEN}✓ Bundle size (.next/standalone): ${BUNDLE_SIZE}${NC}"
    else
        BUNDLE_SIZE="N/A"
        echo -e "${YELLOW}⚠ .next/standalone not found (standalone mode may not be enabled)${NC}"
    fi

    # 9. Test suite time
    echo ""
    echo -e "${YELLOW}Running test suite (with --maxWorkers=2 to avoid OOM)...${NC}"
    SECONDS=0
    if npx jest --maxWorkers=2 --passWithNoTests > /tmp/test-output.txt 2>&1; then
        TEST_TIME=$SECONDS
        TEST_SUITES=$(grep -o "[0-9]* passed" /tmp/test-output.txt | head -1 | cut -d' ' -f1 || echo "0")
        echo -e "${GREEN}✓ Tests complete: $(format_time $TEST_TIME) (${TEST_SUITES} suites passed)${NC}"
    else
        TEST_TIME=$SECONDS
        TEST_SUITES="failed"
        echo -e "${YELLOW}⚠ Tests finished with failures: $(format_time $TEST_TIME)${NC}"
    fi
fi

# Print summary table
echo ""
echo -e "${BLUE}=== Benchmark Results ===${NC}"
echo ""
printf "%-30s %s\n" "Metric" "Value"
printf "%-30s %s\n" "------------------------------" "------------------------------"
printf "%-30s %s\n" "API Routes" "${API_ROUTE_COUNT}"
printf "%-30s %s\n" "Pages" "${PAGE_COUNT}"
printf "%-30s %s\n" "Test Files" "${TEST_FILE_COUNT}"
printf "%-30s %s\n" "Pages with DemoBanner" "${DEMO_BANNER_COUNT}"
printf "%-30s %s\n" "node_modules Size" "${NODE_MODULES_SIZE}"

if [[ "${TSC_TIME}" != "0" ]]; then
    printf "%-30s %s (%s errors)\n" "TypeScript Check" "$(format_time ${TSC_TIME})" "${TSC_ERRORS}"
fi

if [[ "${BUILD_TIME}" != "skipped" ]]; then
    if [[ "${BUILD_TIME}" == "failed" ]]; then
        printf "%-30s %s\n" "Next.js Build" "FAILED"
    else
        printf "%-30s %s\n" "Next.js Build" "$(format_time ${BUILD_TIME})"
    fi
    printf "%-30s %s\n" "Bundle Size (.next/standalone)" "${BUNDLE_SIZE}"

    if [[ "${TEST_SUITES}" == "failed" ]]; then
        printf "%-30s %s\n" "Test Suite" "FAILED ($(format_time ${TEST_TIME}))"
    else
        printf "%-30s %s (%s suites)\n" "Test Suite" "$(format_time ${TEST_TIME})" "${TEST_SUITES}"
    fi
fi

# Write JSON output
echo ""
echo -e "${YELLOW}Writing results to ${OUTPUT_FILE}...${NC}"

cat > "${OUTPUT_FILE}" <<EOF
{
  "timestamp": "${TIMESTAMP}",
  "date": "$(date -Iseconds)",
  "quick_mode": ${QUICK_MODE},
  "metrics": {
    "counts": {
      "api_routes": ${API_ROUTE_COUNT},
      "pages": ${PAGE_COUNT},
      "test_files": ${TEST_FILE_COUNT},
      "demo_banner_pages": ${DEMO_BANNER_COUNT}
    },
    "sizes": {
      "node_modules": "${NODE_MODULES_SIZE}",
      "bundle": "${BUNDLE_SIZE}"
    },
    "timings": {
      "tsc_seconds": ${TSC_TIME},
      "tsc_errors": ${TSC_ERRORS},
      "build_seconds": "${BUILD_TIME}",
      "test_seconds": "${TEST_TIME}",
      "test_suites_passed": "${TEST_SUITES}"
    }
  }
}
EOF

echo -e "${GREEN}✓ Results saved to ${OUTPUT_FILE}${NC}"
echo ""
echo -e "${BLUE}=== Benchmark Complete ===${NC}"
