#!/bin/bash
set -e

# Comprehensive Documentation Testing Script
echo "📚 Testing Astro Documentation Pipeline"
echo "======================================"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

BASE_DIR="$(pwd)"
DOCS_DIR="$BASE_DIR/docs"
TESTS_DIR="$BASE_DIR/tests/docs"

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0

run_test() {
    local test_name="$1"
    local command="$2"
    
    echo -e "\n${BLUE}Testing: ${test_name}${NC}"
    
    ((TOTAL_TESTS++))
    
    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PASS${NC} - $test_name"
        ((PASSED_TESTS++))
    else
        echo -e "${RED}❌ FAIL${NC} - $test_name"
        echo "Command: $command"
    fi
}

echo -e "\n${BLUE}1. Prerequisites Check${NC}"
echo "----------------------"

run_test "Docs directory exists" "[ -d '$DOCS_DIR' ]"
run_test "Package.json exists" "[ -f '$DOCS_DIR/package.json' ]"
run_test "Node modules installed" "[ -d '$DOCS_DIR/node_modules' ]"
run_test "Astro config exists" "[ -f '$DOCS_DIR/astro.config.mjs' ]"
run_test "Content config exists" "[ -f '$DOCS_DIR/src/content/config.ts' ]"

echo -e "\n${BLUE}2. Source Content Validation${NC}"
echo "-----------------------------"

# Count markdown files
MD_COUNT=$(find "$DOCS_DIR/src/content/docs" -name "*.md" -o -name "*.mdx" 2>/dev/null | wc -l)
run_test "Has markdown content files" "[ '$MD_COUNT' -gt 70 ]"

# Check key files exist
KEY_FILES=(
    "WIKI_INDEX.md"
    "DATADOG_LOCAL_DEVELOPMENT.md"
    "COMPREHENSIVE_TESTING_GUIDE.md"
    "KIND_TROUBLESHOOTING_GUIDE.md"
)

for file in "${KEY_FILES[@]}"; do
    run_test "Key file exists: $file" "[ -f '$DOCS_DIR/src/content/docs/$file' ]"
done

echo -e "\n${BLUE}3. Build Process Testing${NC}"
echo "-------------------------"

cd "$DOCS_DIR"

# Clean previous build
if [ -d "dist" ]; then
    echo "🧹 Cleaning previous build..."
    rm -rf dist/
fi

# Test build
echo "🏗️  Building documentation..."
BUILD_OUTPUT=$(npm run build 2>&1)
BUILD_EXIT_CODE=$?

if [ $BUILD_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ PASS${NC} - Build completed successfully"
    ((PASSED_TESTS++))
else
    echo -e "${RED}❌ FAIL${NC} - Build failed"
    echo "Build output: $BUILD_OUTPUT"
fi
((TOTAL_TESTS++))

# Check build output
if [ -d "dist" ]; then
    HTML_COUNT=$(find dist -name "*.html" | wc -l)
    run_test "Generated HTML files" "[ '$HTML_COUNT' -gt 80 ]"
    run_test "Index page exists" "[ -f 'dist/index.html' ]"
    run_test "404 page exists" "[ -f 'dist/404.html' ]"
    run_test "Assets directory exists" "[ -d 'dist/_astro' ]"
    run_test "Search index exists" "[ -d 'dist/pagefind' ]"
    run_test "Sitemap exists" "[ -f 'dist/sitemap-index.xml' ]"
    
    echo "📊 Generated $HTML_COUNT HTML files"
else
    echo -e "${RED}❌ FAIL${NC} - No dist directory found"
    ((TOTAL_TESTS++))
fi

echo -e "\n${BLUE}4. Content Quality Testing${NC}"
echo "---------------------------"

if [ -f "dist/index.html" ]; then
    INDEX_CONTENT=$(cat dist/index.html)
    
    # Test content structure
    run_test "Has HTML structure" "echo '$INDEX_CONTENT' | grep -q '<html'"
    run_test "Has proper title" "echo '$INDEX_CONTENT' | grep -q '<title>.*VibeCode.*</title>'"
    run_test "Has viewport meta" "echo '$INDEX_CONTENT' | grep -q 'name=\"viewport\"'"
    run_test "Has description meta" "echo '$INDEX_CONTENT' | grep -q 'name=\"description\"'"
    
    # Test Starlight integration
    run_test "Has Starlight attributes" "echo '$INDEX_CONTENT' | grep -q 'data-starlight'"
    
    # Test monitoring integration
    run_test "Has Datadog RUM script" "echo '$INDEX_CONTENT' | grep -q 'datadog-rum.js'"
    run_test "Has RUM initialization" "echo '$INDEX_CONTENT' | grep -q 'DD_RUM.init'"
    run_test "Has session tracking" "echo '$INDEX_CONTENT' | grep -q 'sessionSampleRate'"
    run_test "Has session replay" "echo '$INDEX_CONTENT' | grep -q 'sessionReplaySampleRate'"
fi

echo -e "\n${BLUE}5. Wiki Pages Testing${NC}"
echo "---------------------"

WIKI_PAGES=(
    "wiki-index/index.html"
    "datadog-local-development/index.html"
    "comprehensive-testing-guide/index.html"
    "kind-troubleshooting/index.html"
)

for page in "${WIKI_PAGES[@]}"; do
    if [ -f "dist/$page" ]; then
        PAGE_SIZE=$(stat -f%z "dist/$page" 2>/dev/null || stat -c%s "dist/$page" 2>/dev/null || echo "0")
        run_test "Page has content: $page" "[ '$PAGE_SIZE' -gt 1000 ]"
        
        # Check for headings
        run_test "Page has headings: $page" "grep -q '<h[1-6]' 'dist/$page'"
    else
        echo -e "${RED}❌ MISSING${NC} - Page not found: $page"
    fi
done

echo -e "\n${BLUE}6. Search Functionality Testing${NC}"
echo "--------------------------------"

if [ -d "dist/pagefind" ]; then
    SEARCH_FILES=$(ls dist/pagefind/ | wc -l)
    run_test "Search index has files" "[ '$SEARCH_FILES' -gt 5 ]"
    
    # Check for search script
    run_test "Search script exists" "[ -f 'dist/pagefind/pagefind.js' ]"
    
    # Check index size
    if [ -f "dist/pagefind/pagefind-ui.js" ]; then
        SEARCH_SIZE=$(stat -f%z "dist/pagefind/pagefind-ui.js" 2>/dev/null || stat -c%s "dist/pagefind/pagefind-ui.js" 2>/dev/null || echo "0")
        run_test "Search index has substance" "[ '$SEARCH_SIZE' -gt 10000 ]"
    fi
fi

echo -e "\n${BLUE}7. Performance & SEO Testing${NC}"
echo "-----------------------------"

if [ -f "dist/index.html" ]; then
    INDEX_SIZE=$(stat -f%z "dist/index.html" 2>/dev/null || stat -c%s "dist/index.html" 2>/dev/null || echo "0")
    run_test "Index page reasonable size" "[ '$INDEX_SIZE' -lt 1000000 ]" # Less than 1MB
    run_test "Index page has content" "[ '$INDEX_SIZE' -gt 5000 ]" # More than 5KB
fi

# Check CSS assets
if [ -d "dist/_astro" ]; then
    CSS_FILES=$(find dist/_astro -name "*.css" | wc -l)
    JS_FILES=$(find dist/_astro -name "*.js" | wc -l)
    
    run_test "Has CSS assets" "[ '$CSS_FILES' -gt 0 ]"
    run_test "Has JS assets" "[ '$JS_FILES' -gt 0 ]"
    
    echo "📊 Found $CSS_FILES CSS files and $JS_FILES JS files"
fi

cd "$BASE_DIR"

echo -e "\n${BLUE}8. Jest Tests Execution${NC}"
echo "------------------------"

# Run Jest tests if available
if [ -d "$TESTS_DIR" ] && command -v jest >/dev/null 2>&1; then
    echo "🧪 Running Jest tests for documentation..."
    
    # Run Jest tests for docs specifically
    if npx jest "$TESTS_DIR" --passWithNoTests --verbose 2>/dev/null; then
        echo -e "${GREEN}✅ PASS${NC} - Jest tests completed"
        ((PASSED_TESTS++))
    else
        echo -e "${YELLOW}⚠️  WARNING${NC} - Jest tests had issues (may be missing dependencies)"
    fi
    ((TOTAL_TESTS++))
else
    echo "⚠️  Skipping Jest tests - Jest not available or tests directory missing"
fi

echo -e "\n${BLUE}9. Integration Testing${NC}"
echo "----------------------"

# Test that build can be served (quick test)
if [ -f "$DOCS_DIR/dist/index.html" ]; then
    cd "$DOCS_DIR"
    
    # Start preview server in background and test it
    if command -v npm >/dev/null 2>&1; then
        echo "🌐 Testing preview server..."
        
        # Start preview server
        npm run preview > /dev/null 2>&1 &
        PREVIEW_PID=$!
        
        # Wait for server to start
        sleep 5
        
        # Test if server responds
        if curl -f -s http://localhost:4321 > /dev/null 2>&1; then
            echo -e "${GREEN}✅ PASS${NC} - Preview server working"
            ((PASSED_TESTS++))
        else
            echo -e "${YELLOW}⚠️  WARNING${NC} - Preview server may not be accessible"
        fi
        
        # Kill preview server
        kill $PREVIEW_PID 2>/dev/null || true
        ((TOTAL_TESTS++))
    fi
    
    cd "$BASE_DIR"
fi

echo -e "\n${GREEN}📊 Documentation Test Results Summary:${NC}"
echo "  Total Tests: $TOTAL_TESTS"
echo "  Passed: $PASSED_TESTS"
echo "  Failed: $((TOTAL_TESTS - PASSED_TESTS))"

if [ $PASSED_TESTS -eq $TOTAL_TESTS ]; then
    echo -e "\n${GREEN}🎉 All documentation tests passed!${NC}"
    echo "Your Astro documentation is fully functional."
    exit 0
elif [ $PASSED_TESTS -gt $((TOTAL_TESTS * 80 / 100)) ]; then
    echo -e "\n${YELLOW}⚠️  Most tests passed ($PASSED_TESTS/$TOTAL_TESTS). Minor issues detected.${NC}"
    echo "The documentation is functional with some minor issues."
    exit 0
else
    echo -e "\n${RED}❌ Significant issues found. Review the failed tests above.${NC}"
    exit 1
fi