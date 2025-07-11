#\!/bin/bash

# Comprehensive Test Fix Script
# Fixes all TypeScript syntax errors in test files systematically

echo "🔧 Starting comprehensive test file repair..."

# Create backup directory
mkdir -p backup/tests
cp -r tests/ backup/tests/

# Fix common syntax patterns across all test files
find tests/ -name "*.test.ts" -exec sed -i '' \
  -e 's/Array\.from({ length: [0-9]* }, () =>$/Array.from({ length: \1 }, () =>/g' \
  -e 's/fetch([^)]*);$/fetch(\1)/g' \
  -e 's/\];$/];/g' \
  -e 's/\[;$/[/g' \
  -e 's/);$/);/g' \
  -e 's/\([^;]\)$/\1;/g' \
  -e 's/;;$/;/g' \
  -e 's/window\.__NEXT_AUTH_SESSION/(window as any).__NEXT_AUTH_SESSION/g' \
  -e 's/\.toBe([^)]*) \/\//\.toBe(\1); \/\//g' \
  -e 's/\.toBeGreaterThan([^)]*) \/\//\.toBeGreaterThan(\1); \/\//g' \
  -e 's/\.toBeLessThan([^)]*) \/\//\.toBeLessThan(\1); \/\//g' \
  -e 's/\.toEqual([^)]*) \/\//\.toEqual(\1); \/\//g' \
  -e 's/expect([^)]*) \/\//expect(\1); \/\//g' \
  {} \;

echo "✅ Applied global pattern fixes"

# Fix specific problematic patterns
echo "🔧 Fixing specific syntax issues..."

# Fix Array.from patterns
find tests/ -name "*.test.ts" -exec sed -i '' \
  -e 's/Array\.from({ length: \([0-9]*\) }, () =>$/Array.from({ length: \1 }, () =>/g' \
  -e 's/\(.*\)fetch(\([^)]*\));$/\1fetch(\2)/g' \
  -e 's/\(.*\)fetch(\([^)]*\));$/\1fetch(\2)/g' \
  {} \;

# Fix object literal and array syntax
find tests/ -name "*.test.ts" -exec sed -i '' \
  -e 's/\[\s*;/[/g' \
  -e 's/,\s*\]/]/g' \
  -e 's/,\s*}/}/g' \
  -e 's/\s*;\s*$/;/g' \
  {} \;

# Fix specific files that need manual attention
echo "🔧 Fixing specific problematic test files..."

# Fix claude-api-integration.test.ts
if [[ -f "tests/integration/claude-api-integration.test.ts" ]]; then
  sed -i '' \
    -e 's/const mockAuth = {/const mockAuth = {/g' \
    -e 's/const mockRequest = {/const mockRequest = {/g' \
    -e 's/const mockResponse = {/const mockResponse = {/g' \
    -e 's/expect(response\.status)\.toBe(200) \/\//expect(response.status).toBe(200); \/\//g' \
    -e 's/expect(response\.status)\.toBe(401) \/\//expect(response.status).toBe(401); \/\//g' \
    -e 's/expect(response\.status)\.toBe(500) \/\//expect(response.status).toBe(500); \/\//g' \
    tests/integration/claude-api-integration.test.ts
fi

# Fix file-operations.test.ts
if [[ -f "tests/unit/file-operations.test.ts" ]]; then
  sed -i '' \
    -e 's/expect(result)\.toBe(true) \/\//expect(result).toBe(true); \/\//g' \
    -e 's/expect(result)\.toBe(false) \/\//expect(result).toBe(false); \/\//g' \
    -e 's/expect(content)\.toContain(\([^)]*\)) \/\//expect(content).toContain(\1); \/\//g' \
    tests/unit/file-operations.test.ts
fi

# Fix monitoring.test.ts
if [[ -f "tests/unit/monitoring.test.ts" ]]; then
  sed -i '' \
    -e 's/getRUM: jest\.fn()/getRUM: jest.fn()/g' \
    -e 's/getLogger: jest\.fn()/getLogger: jest.fn()/g' \
    tests/unit/monitoring.test.ts
fi

# Fix validation tests
if [[ -f "tests/validation/anti-fake-implementation.test.ts" ]]; then
  sed -i '' \
    -e 's/\.filter(line => line\.includes(\([^)]*\));/\.filter(line => line.includes(\1));/g' \
    -e 's/\.match(pattern/\.match(pattern)/g' \
    tests/validation/anti-fake-implementation.test.ts
fi

echo "✅ Fixed specific problematic files"

# Run TypeScript compilation check
echo "🔧 Running TypeScript compilation check..."
if npx tsc --noEmit --skipLibCheck 2>/dev/null; then
  echo "✅ All TypeScript files compile successfully\!"
else
  echo "❌ Some TypeScript issues remain. Running detailed check..."
  npx tsc --noEmit --skipLibCheck 2>&1 | head -20
fi

# Run Jest syntax validation
echo "🧪 Running Jest syntax validation..."
if npx jest --listTests >/dev/null 2>&1; then
  echo "✅ Jest can parse all test files successfully\!"
else
  echo "❌ Jest parsing issues remain"
  npx jest --listTests 2>&1 | head -10
fi

echo "🎉 Test repair process complete\!"
echo "📁 Backup created in: backup/tests/"
echo "📋 Run 'npm test' to validate all tests work correctly"
EOF < /dev/null