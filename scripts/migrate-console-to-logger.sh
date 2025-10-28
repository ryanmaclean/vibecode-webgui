#!/usr/bin/env bash
#
# Migration Script: Console.log to Structured Logger
# Issue: #448 - Replace console.log with Structured Logging (1,219 instances)
#
# This script provides a template for migrating console statements to structured logging.
# Run with --dry-run first to preview changes before applying.
#

set -euo pipefail

# Configuration
DRY_RUN=false
BACKUP=true
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/src"
LOGGER_PATH="@/lib/monitoring/datadog-client"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --no-backup)
      BACKUP=false
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--dry-run] [--no-backup]"
      exit 1
      ;;
  esac
done

# Print header
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Console.log → Structured Logger Migration${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Source directory: $SRC_DIR"
echo "Dry run: $DRY_RUN"
echo "Backup: $BACKUP"
echo ""

# Count console statements by type
count_console_log=$(grep -r "console\.log" "$SRC_DIR" --include="*.ts" --include="*.tsx" | wc -l | tr -d ' ')
count_console_error=$(grep -r "console\.error" "$SRC_DIR" --include="*.ts" --include="*.tsx" | wc -l | tr -d ' ')
count_console_warn=$(grep -r "console\.warn" "$SRC_DIR" --include="*.ts" --include="*.tsx" | wc -l | tr -d ' ')
count_console_info=$(grep -r "console\.info" "$SRC_DIR" --include="*.ts" --include="*.tsx" | wc -l | tr -d ' ')
count_console_debug=$(grep -r "console\.debug" "$SRC_DIR" --include="*.ts" --include="*.tsx" | wc -l | tr -d ' ')
total_count=$((count_console_log + count_console_error + count_console_warn + count_console_info + count_console_debug))

echo -e "${YELLOW}Current console statement counts:${NC}"
echo "  console.log:   $count_console_log"
echo "  console.error: $count_console_error"
echo "  console.warn:  $count_console_warn"
echo "  console.info:  $count_console_info"
echo "  console.debug: $count_console_debug"
echo "  ─────────────────────"
echo "  TOTAL:         $total_count"
echo ""

# Categorization functions
categorize_file() {
  local file=$1

  # Check if file is in monitoring directory (keep console for now)
  if [[ $file == *"/lib/monitoring/"* ]] || [[ $file == *"/monitoring/"* ]]; then
    echo "MONITORING"
    return
  fi

  # Check if file is a test file (can be kept as is)
  if [[ $file == *".test.ts"* ]] || [[ $file == *".spec.ts"* ]] || [[ $file == *"/__tests__/"* ]]; then
    echo "TEST"
    return
  fi

  # Check if in API routes (high priority for structured logging)
  if [[ $file == *"/app/api/"* ]] || [[ $file == *"/api/"* ]]; then
    echo "API"
    return
  fi

  # Check if in lib directory (medium priority)
  if [[ $file == *"/lib/"* ]]; then
    echo "LIB"
    return
  fi

  # Check if in components (frontend - lower priority)
  if [[ $file == *"/components/"* ]] || [[ $file == *"/app/"* ]]; then
    echo "FRONTEND"
    return
  fi

  echo "OTHER"
}

# Analyze files by category
echo -e "${YELLOW}Analyzing files by category...${NC}"
api_files=()
lib_files=()
frontend_files=()
monitoring_files=()
test_files=()
other_files=()

while IFS= read -r file; do
  category=$(categorize_file "$file")
  case $category in
    API)
      api_files+=("$file")
      ;;
    LIB)
      lib_files+=("$file")
      ;;
    FRONTEND)
      frontend_files+=("$file")
      ;;
    MONITORING)
      monitoring_files+=("$file")
      ;;
    TEST)
      test_files+=("$file")
      ;;
    OTHER)
      other_files+=("$file")
      ;;
  esac
done < <(grep -rl "console\." "$SRC_DIR" --include="*.ts" --include="*.tsx")

echo ""
echo "Files by category:"
echo "  API routes:       ${#api_files[@]} files"
echo "  Lib modules:      ${#lib_files[@]} files"
echo "  Frontend/UI:      ${#frontend_files[@]} files"
echo "  Monitoring:       ${#monitoring_files[@]} files (exclude)"
echo "  Tests:            ${#test_files[@]} files (exclude)"
echo "  Other:            ${#other_files[@]} files"
echo ""

# Migration strategy
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}RECOMMENDED MIGRATION STRATEGY${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Phase 1: API Routes (${#api_files[@]} files) - High Priority"
echo "  - Most critical for production logging"
echo "  - Import monitoring logger"
echo "  - Replace console.error → logger.error"
echo "  - Replace console.warn → logger.warn"
echo "  - Remove debug console.log statements"
echo ""
echo "Phase 2: Lib Modules (${#lib_files[@]} files) - Medium Priority"
echo "  - Core business logic"
echo "  - Import monitoring logger"
echo "  - Structured error/warn logging"
echo "  - Remove or replace debug logs"
echo ""
echo "Phase 3: Frontend (${#frontend_files[@]} files) - Lower Priority"
echo "  - Client-side logging less critical"
echo "  - Consider browser console for dev"
echo "  - Use RUM for errors in production"
echo ""
echo "Exclude: Monitoring (${#monitoring_files[@]} files), Tests (${#test_files[@]} files)"
echo ""

# Example transformations
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}EXAMPLE TRANSFORMATIONS${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "1. Error logging:"
echo "   Before: console.error('Database connection failed', error)"
echo "   After:  logger.error('Database connection failed', { error })"
echo ""
echo "2. Warning logging:"
echo "   Before: console.warn('⚠️ Rate limit approaching', { count })"
echo "   After:  logger.warn('Rate limit approaching', { count })"
echo ""
echo "3. Debug logging (REMOVE in production code):"
echo "   Before: console.log('Debug user data', user)"
echo "   After:  // Remove or use logger.debug in development only"
echo ""
echo "4. Info logging:"
echo "   Before: console.log('✅ Migration complete')"
echo "   After:  logger.info('Migration complete')"
echo ""

# Import statement to add
echo -e "${YELLOW}Add to files needing logger:${NC}"
echo "  import { monitoring } from '@/lib/monitoring/datadog-client'"
echo "  // Use: monitoring.submitMetric(), or create logger wrapper"
echo ""

# Dry run preview
if [ "$DRY_RUN" = true ]; then
  echo -e "${YELLOW}========================================${NC}"
  echo -e "${YELLOW}DRY RUN - Sample API Route Migration${NC}"
  echo -e "${YELLOW}========================================${NC}"
  echo ""

  if [ ${#api_files[@]} -gt 0 ]; then
    sample_file="${api_files[0]}"
    echo "Sample file: $sample_file"
    echo ""
    echo "Console statements found:"
    grep -n "console\." "$sample_file" | head -5 || echo "  (none in first 5 lines)"
    echo ""
  fi

  echo -e "${GREEN}Run without --dry-run to apply changes${NC}"
  exit 0
fi

# Actual migration (TODO: implement after review)
echo -e "${RED}========================================${NC}"
echo -e "${RED}MIGRATION NOT IMPLEMENTED YET${NC}"
echo -e "${RED}========================================${NC}"
echo ""
echo "This script is a TEMPLATE for the migration."
echo "Next steps:"
echo "  1. Review categorization above"
echo "  2. Create logger utility wrapper"
echo "  3. Start with Phase 1 (API routes)"
echo "  4. Manual review of each file"
echo "  5. Test thoroughly"
echo ""
echo "Estimated effort: 2-3 days for full migration"
echo ""

exit 0
