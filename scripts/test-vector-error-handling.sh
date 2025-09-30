#!/bin/bash
# Script to run tests for the standardized vector database error handling

set -e

echo "Vector Database Error Handling Validation"
echo "========================================="

# Get the directory of the script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Define paths
TEST_FILE="${ROOT_DIR}/tests/unit/vector-db-error-handling.test.ts"
VECTOR_DB_DIR="${ROOT_DIR}/src/lib/vector-db"
MIGRATION_SCRIPT="${ROOT_DIR}/scripts/standardize-vector-error-handling-v2.sh"

# Check file existence
function check_file {
  local file=$1
  local description=$2
  
  if [ -f "$file" ]; then
    echo "✅ Found $description"
  else
    echo "❌ Missing $description: $file"
    missing_files=true
  fi
}

# 1. Verify all required files exist
echo "1. Verifying required files..."
missing_files=false

check_file "$TEST_FILE" "test file"
check_file "${VECTOR_DB_DIR}/vector-db-error-handler-new.ts" "new error handler"
check_file "${VECTOR_DB_DIR}/vector-retry-handler-new.ts" "new retry handler"
check_file "${VECTOR_DB_DIR}/postgres-vector-database-adapter-new.ts" "new Postgres adapter"
check_file "$MIGRATION_SCRIPT" "migration script"
check_file "${VECTOR_DB_DIR}/ERROR_HANDLING_SUMMARY.md" "documentation"
check_file "${VECTOR_DB_DIR}/ERROR_HANDLING_TEST_PLAN.md" "test plan"

if [ "$missing_files" = true ]; then
  echo "❌ Missing files detected. Please address the issues above."
  exit 1
fi

# 2. Run static analysis
echo -e "\n2. Running static analysis..."
if command -v npx &> /dev/null; then
  echo "Running TypeScript validation..."
  
  # Create temporary tsconfig
  temp_tsconfig=$(mktemp)
  cat > "$temp_tsconfig" << EOF
{
  "compilerOptions": {
    "target": "es2016",
    "module": "commonjs",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true
  },
  "include": [
    "${VECTOR_DB_DIR}/*-new.ts"
  ]
}
EOF
  
  if npx tsc --noEmit --project "$temp_tsconfig"; then
    echo "✅ TypeScript validation passed"
  else
    echo "❌ TypeScript validation failed"
    rm "$temp_tsconfig"
    exit 1
  fi
  
  rm "$temp_tsconfig"
else
  echo "⚠️ npx not found, skipping TypeScript validation"
fi

# 3. Run unit tests
echo -e "\n3. Running unit tests..."
if command -v npx &> /dev/null; then
  if npx jest "$TEST_FILE" --verbose; then
    echo "✅ Unit tests passed"
  else
    echo "❌ Unit tests failed"
    exit 1
  fi
else
  echo "⚠️ npx not found, skipping unit tests"
fi

# 4. Verify script functionality
echo -e "\n4. Verifying migration script functionality..."
if [ -x "$MIGRATION_SCRIPT" ]; then
  echo "Attempting dry run of migration script..."
  if bash "$MIGRATION_SCRIPT" --dry-run; then
    echo "✅ Migration script dry run passed"
  else
    echo "❌ Migration script dry run failed"
    exit 1
  fi
else
  echo "⚠️ Migration script is not executable, skipping verification"
  echo "   Run: chmod +x $MIGRATION_SCRIPT"
fi

# 5. Final summary
echo -e "\n========================================="
echo "🎉 Validation completed successfully!"
echo "Next steps:"
echo "1. Run the migration script to update all adapters:"
echo "   $ bash $MIGRATION_SCRIPT --backup"
echo "2. Test the changes in a development environment"
echo "3. Follow the gradual migration strategy in ERROR_HANDLING_SUMMARY.md"
echo "4. Monitor for any issues during deployment"
echo "=========================================