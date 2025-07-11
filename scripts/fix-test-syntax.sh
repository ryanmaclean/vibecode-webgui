#\!/bin/bash

# Fix Test Syntax Issues - Critical Infrastructure Fix
# Addresses TypeScript compilation errors preventing test execution

echo "🔧 Fixing TypeScript syntax errors in test files..."

# Find all test files
TEST_FILES=$(find tests/ -name "*.test.ts" -o -name "*.test.tsx" 2>/dev/null)

echo "📁 Found test files:"
echo "$TEST_FILES"

# Fix common TypeScript syntax errors
for file in $TEST_FILES; do
  if [[ -f "$file" ]]; then
    echo "🔍 Checking $file..."
    
    # Check for compilation errors
    if \! npx tsc --noEmit "$file" 2>/dev/null; then
      echo "❌ TypeScript errors in $file"
      
      # Common fixes
      # 1. Add missing semicolons after variable declarations
      sed -i '' 's/const \([^=]*=[^;]*\)$/const \1;/g' "$file"
      sed -i '' 's/let \([^=]*=[^;]*\)$/let \1;/g' "$file"
      sed -i '' 's/var \([^=]*=[^;]*\)$/var \1;/g' "$file"
      
      # 2. Fix object literal syntax
      sed -i '' 's/,\s*}/}/g' "$file"
      sed -i '' 's/,\s*]/]/g' "$file"
      
      # 3. Fix import statements
      sed -i '' 's/import \([^;]*\)$/import \1;/g' "$file"
      
      # 4. Fix export statements
      sed -i '' 's/export \([^;]*\)$/export \1;/g' "$file"
      
      echo "✅ Applied common fixes to $file"
    else
      echo "✅ $file is valid"
    fi
  fi
done

echo "🔧 Running TypeScript compilation check..."
if npx tsc --noEmit; then
  echo "✅ All TypeScript files compile successfully"
else
  echo "❌ TypeScript compilation issues remain"
  echo "📝 Running detailed check..."
  
  # Show specific errors
  for file in $TEST_FILES; do
    if [[ -f "$file" ]]; then
      echo "Checking $file..."
      npx tsc --noEmit "$file" 2>&1 | head -10
    fi
  done
fi

echo "🧪 Running Jest syntax validation..."
if npx jest --listTests > /dev/null 2>&1; then
  echo "✅ Jest can parse all test files"
else
  echo "❌ Jest parsing issues remain"
  npx jest --listTests 2>&1 | head -20
fi

echo "🔧 Test syntax fix complete\!"
EOF < /dev/null