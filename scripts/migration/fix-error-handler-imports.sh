#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

set -euo pipefail


# Initialize log aggregation
init_log_aggregation

echo "========================================="
echo "Error Handler Import Consolidation"
echo "Phase 2 Priority 3: Error/Retry Handlers"
echo "========================================="
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Backup directory
BACKUP_DIR="./artifacts/error-handler-consolidation-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

print_status "$BLUE" "📦 Creating backup in: $BACKUP_DIR"

# Files to backup
FILES_TO_BACKUP=(
    "src/lib/vector-db/vector-retry-handler.ts"
    "src/lib/vector-db/vector-retry-handler-new.ts"
    "src/lib/vector-db/enhanced-vector-database-adapter.ts"
    "src/lib/vector-db/enhanced-vector-database-adapter-new.ts"
    "src/lib/vector-db/vector-db-error-handler-new.ts"
)

for file in "${FILES_TO_BACKUP[@]}"; do
    if [ -f "$file" ]; then
        cp "$file" "$BACKUP_DIR/$(basename $file)"
        print_status "$GREEN" "  ✓ Backed up: $file"
    fi
done

echo ""
print_status "$BLUE" "🔧 Step 1: Fixing broken import in vector-retry-handler.ts"

# Fix the broken import in vector-retry-handler.ts
if grep -q "from './vector-db-error-handler-new'" src/lib/vector-db/vector-retry-handler.ts 2>/dev/null; then
    sed -i.bak "s|from './vector-db-error-handler-new'|from './vector-db-error-handler'|g" \
        src/lib/vector-db/vector-retry-handler.ts
    print_status "$GREEN" "  ✓ Fixed import in vector-retry-handler.ts"
    rm -f src/lib/vector-db/vector-retry-handler.ts.bak
else
    print_status "$YELLOW" "  ⚠ Import already fixed or file not found"
fi

echo ""
print_status "$BLUE" "🔧 Step 2: Updating retry handler imports in adapter files"

# Update enhanced-vector-database-adapter.ts
if grep -q "from './vector-retry-handler-new'" src/lib/vector-db/enhanced-vector-database-adapter.ts 2>/dev/null; then
    sed -i.bak "s|from './vector-retry-handler-new'|from './vector-retry-handler'|g" \
        src/lib/vector-db/enhanced-vector-database-adapter.ts
    print_status "$GREEN" "  ✓ Updated: enhanced-vector-database-adapter.ts"
    rm -f src/lib/vector-db/enhanced-vector-database-adapter.ts.bak
else
    print_status "$YELLOW" "  ⚠ Import already updated in enhanced-vector-database-adapter.ts"
fi

# Update enhanced-vector-database-adapter-new.ts
if grep -q "from './vector-retry-handler-new'" src/lib/vector-db/enhanced-vector-database-adapter-new.ts 2>/dev/null; then
    sed -i.bak "s|from './vector-retry-handler-new'|from './vector-retry-handler'|g" \
        src/lib/vector-db/enhanced-vector-database-adapter-new.ts
    print_status "$GREEN" "  ✓ Updated: enhanced-vector-database-adapter-new.ts"
    rm -f src/lib/vector-db/enhanced-vector-database-adapter-new.ts.bak
else
    print_status "$YELLOW" "  ⚠ Import already updated in enhanced-vector-database-adapter-new.ts"
fi

echo ""
print_status "$BLUE" "🗑️  Step 3: Removing redundant/stub files"

# Delete merge conflict stub
if [ -f "src/lib/vector-db/vector-db-error-handler-new.ts" ]; then
    rm -f "src/lib/vector-db/vector-db-error-handler-new.ts"
    print_status "$GREEN" "  ✓ Deleted: vector-db-error-handler-new.ts (merge conflict stub)"
else
    print_status "$YELLOW" "  ⚠ File already deleted: vector-db-error-handler-new.ts"
fi

# Delete redundant retry handler
if [ -f "src/lib/vector-db/vector-retry-handler-new.ts" ]; then
    rm -f "src/lib/vector-db/vector-retry-handler-new.ts"
    print_status "$GREEN" "  ✓ Deleted: vector-retry-handler-new.ts (redundant duplicate)"
else
    print_status "$YELLOW" "  ⚠ File already deleted: vector-retry-handler-new.ts"
fi

# Clean up any remaining .bak files
find src -name "*.bak" -type f -delete 2>/dev/null || true

echo ""
print_status "$BLUE" "📊 Verification: Checking for remaining broken imports"

# Check for any remaining references to -new files
BROKEN_IMPORTS=$(grep -r "from '.*-new'" src/lib/vector-db/ 2>/dev/null | grep -v node_modules || true)

if [ -z "$BROKEN_IMPORTS" ]; then
    print_status "$GREEN" "  ✓ No broken imports found!"
else
    print_status "$RED" "  ✗ Warning: Found remaining -new imports:"
    echo "$BROKEN_IMPORTS"
fi

echo ""
print_status "$GREEN" "✅ Migration Complete!"
echo ""
echo "========================================="
echo "Summary of Changes"
echo "========================================="
echo ""
echo "Files Updated (3):"
echo "  • src/lib/vector-db/vector-retry-handler.ts"
echo "  • src/lib/vector-db/enhanced-vector-database-adapter.ts"
echo "  • src/lib/vector-db/enhanced-vector-database-adapter-new.ts"
echo ""
echo "Files Deleted (2):"
echo "  • src/lib/vector-db/vector-db-error-handler-new.ts"
echo "  • src/lib/vector-db/vector-retry-handler-new.ts"
echo ""
echo "Backup Location:"
echo "  • $BACKUP_DIR"
echo ""
echo "========================================="
echo "Next Steps"
echo "========================================="
echo ""
print_status "$YELLOW" "⚠️  Manual verification required:"
echo "  1. Review changes: git diff src/lib/vector-db/"
echo "  2. Run tests: npm test -- vector-db-error-handler"
echo "  3. Run tests: npm test -- vector-retry"
echo "  4. Check TypeScript: npm run typecheck"
echo "  5. If all pass, commit: git add . && git commit -m 'refactor: consolidate error/retry handlers'"
echo ""
print_status "$BLUE" "📚 Documentation updated:"
echo "  • claudedocs/DATABASE_CONSOLIDATION_PHASE2_ERRORS.md"
echo ""
