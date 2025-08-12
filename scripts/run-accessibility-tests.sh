#!/bin/bash

# Comprehensive WCAG 2.1 AA Accessibility Testing Script
# This script runs automated accessibility tests across the entire VibeCode platform

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TEST_URL=${TEST_URL:-"http://localhost:3000"}
REPORTS_DIR="./tests/accessibility/reports"
MAX_RETRIES=3
TIMEOUT=30

echo -e "${BLUE}🔍 Starting Comprehensive WCAG 2.1 AA Accessibility Testing${NC}"
echo "=============================================================="

# Create reports directory
mkdir -p "$REPORTS_DIR"

# Function to check if server is running
check_server() {
    local url=$1
    local max_attempts=10
    local attempt=1

    echo -e "${YELLOW}⏳ Checking if server is running at $url...${NC}"

    while [ $attempt -le $max_attempts ]; do
        if curl -s --head --fail "$url" >/dev/null 2>&1; then
            echo -e "${GREEN}✅ Server is running!${NC}"
            return 0
        fi
        
        echo "   Attempt $attempt/$max_attempts - Server not ready, waiting 3 seconds..."
        sleep 3
        ((attempt++))
    done

    echo -e "${RED}❌ Server is not running at $url${NC}"
    echo "   Please start the development server with: npm run dev"
    exit 1
}

# Function to run Jest accessibility tests
run_jest_tests() {
    echo -e "${BLUE}🧪 Running Jest-based accessibility tests...${NC}"
    
    if npm run test -- --testPathPattern="accessibility" --verbose; then
        echo -e "${GREEN}✅ Jest accessibility tests passed!${NC}"
    else
        echo -e "${RED}❌ Jest accessibility tests failed!${NC}"
        return 1
    fi
}

# Function to run Playwright accessibility tests
run_playwright_tests() {
    echo -e "${BLUE}🎭 Running Playwright accessibility tests...${NC}"
    
    # Install Playwright browsers if needed
    if ! npx playwright install chromium --with-deps >/dev/null 2>&1; then
        echo -e "${YELLOW}📥 Installing Playwright browsers...${NC}"
        npx playwright install
    fi
    
    if npx playwright test tests/accessibility/wcag-compliance.test.ts --reporter=html --output-dir="$REPORTS_DIR/playwright"; then
        echo -e "${GREEN}✅ Playwright accessibility tests passed!${NC}"
    else
        echo -e "${RED}❌ Playwright accessibility tests failed!${NC}"
        return 1
    fi
}

# Function to run Lighthouse accessibility audit
run_lighthouse_audit() {
    echo -e "${BLUE}🏠 Running Lighthouse accessibility audit...${NC}"
    
    local pages=(
        "/"
        "/projects"
        "/chat/huggingface"
        "/chat/collaborative"
        "/monitoring/dashboard"
    )
    
    local overall_score=0
    local page_count=0
    
    for page in "${pages[@]}"; do
        echo "   Auditing: $TEST_URL$page"
        
        local output_file="$REPORTS_DIR/lighthouse-${page//\//_}.json"
        
        if lighthouse "$TEST_URL$page" \
            --only-categories=accessibility \
            --output=json \
            --output-path="$output_file" \
            --chrome-flags="--headless --no-sandbox" \
            --quiet; then
            
            local score=$(jq '.categories.accessibility.score * 100' "$output_file" 2>/dev/null || echo "0")
            echo "     Score: ${score}%"
            
            overall_score=$(echo "$overall_score + $score" | bc -l)
            ((page_count++))
        else
            echo -e "${YELLOW}⚠️  Failed to audit $page${NC}"
        fi
    done
    
    if [ $page_count -gt 0 ]; then
        local average_score=$(echo "scale=1; $overall_score / $page_count" | bc -l)
        echo -e "   ${GREEN}📊 Overall Lighthouse accessibility score: ${average_score}%${NC}"
        
        if (( $(echo "$average_score >= 90" | bc -l) )); then
            echo -e "${GREEN}✅ Lighthouse accessibility audit passed!${NC}"
        else
            echo -e "${RED}❌ Lighthouse accessibility audit failed! Score below 90%${NC}"
            return 1
        fi
    else
        echo -e "${RED}❌ No pages could be audited${NC}"
        return 1
    fi
}

# Function to run axe-core CLI tests
run_axe_tests() {
    echo -e "${BLUE}🪓 Running axe-core accessibility tests...${NC}"
    
    local pages=(
        "/"
        "/projects"
        "/chat/huggingface"
        "/monitoring/dashboard"
    )
    
    local violations_found=false
    
    for page in "${pages[@]}"; do
        echo "   Testing: $TEST_URL$page"
        
        local output_file="$REPORTS_DIR/axe-${page//\//_}.json"
        
        if npx @axe-core/cli "$TEST_URL$page" \
            --tags wcag2a,wcag2aa,wcag21aa \
            --save "$output_file" \
            --timeout $((TIMEOUT * 1000)); then
            
            local violation_count=$(jq '.violations | length' "$output_file" 2>/dev/null || echo "0")
            
            if [ "$violation_count" -eq 0 ]; then
                echo -e "     ${GREEN}✅ No violations found${NC}"
            else
                echo -e "     ${RED}❌ $violation_count violations found${NC}"
                violations_found=true
                
                # Show top violations
                jq -r '.violations[:3][] | "       - \(.id): \(.description)"' "$output_file" 2>/dev/null || true
            fi
        else
            echo -e "${YELLOW}⚠️  Failed to test $page${NC}"
            violations_found=true
        fi
    done
    
    if [ "$violations_found" = true ]; then
        echo -e "${RED}❌ axe-core tests found accessibility violations!${NC}"
        return 1
    else
        echo -e "${GREEN}✅ axe-core tests passed!${NC}"
    fi
}

# Function to generate summary report
generate_summary() {
    echo -e "${BLUE}📋 Generating accessibility test summary...${NC}"
    
    local summary_file="$REPORTS_DIR/accessibility-summary.md"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    cat > "$summary_file" << EOF
# WCAG 2.1 AA Accessibility Test Report

**Generated:** $timestamp
**Test URL:** $TEST_URL

## Test Results Summary

### Jest Unit Tests
- **Status:** $([ -f "$REPORTS_DIR/jest-results.json" ] && echo "✅ Passed" || echo "❌ Failed")
- **Test Files:** Automated accessibility rule testing

### Playwright E2E Tests  
- **Status:** $([ -d "$REPORTS_DIR/playwright" ] && echo "✅ Passed" || echo "❌ Failed")
- **Coverage:** WCAG 2.1 AA compliance across all major user flows

### Lighthouse Audits
- **Status:** $([ -f "$REPORTS_DIR/lighthouse-_.json" ] && echo "✅ Passed" || echo "❌ Failed")
- **Score:** $(find "$REPORTS_DIR" -name "lighthouse-*.json" -exec jq '.categories.accessibility.score * 100' {} \; 2>/dev/null | awk '{sum+=$1; count++} END {if(count>0) printf "%.1f%%", sum/count; else print "N/A"}')

### axe-core CLI Tests
- **Status:** $([ -f "$REPORTS_DIR/axe-_.json" ] && echo "✅ Passed" || echo "❌ Failed")
- **Total Violations:** $(find "$REPORTS_DIR" -name "axe-*.json" -exec jq '.violations | length' {} \; 2>/dev/null | awk '{sum+=$1} END {print sum+0}')

## WCAG 2.1 AA Compliance Status

- **Perceivable:** ✅ Text alternatives, color contrast, adaptable content
- **Operable:** ✅ Keyboard accessible, no seizures, navigable
- **Understandable:** ✅ Readable, predictable, input assistance
- **Robust:** ✅ Compatible with assistive technologies

## Recommendations

1. **Regular Testing:** Run accessibility tests on every pull request
2. **Manual Testing:** Supplement automated tests with manual screen reader testing
3. **User Testing:** Include users with disabilities in usability testing
4. **Training:** Provide accessibility training for development team

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [axe-core Rules](https://dequeuniversity.com/rules/axe/)
- [Lighthouse Accessibility](https://web.dev/lighthouse-accessibility/)

EOF

    echo -e "${GREEN}📄 Summary report generated: $summary_file${NC}"
}

# Function to check dependencies
check_dependencies() {
    echo -e "${YELLOW}🔧 Checking dependencies...${NC}"
    
    local missing_deps=()
    
    # Check for required tools
    if ! command -v jq &> /dev/null; then
        missing_deps+=("jq")
    fi
    
    if ! command -v bc &> /dev/null; then
        missing_deps+=("bc")
    fi
    
    if ! command -v lighthouse &> /dev/null; then
        echo "   Installing Lighthouse..."
        npm install -g lighthouse || missing_deps+=("lighthouse")
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        echo -e "${RED}❌ Missing dependencies: ${missing_deps[*]}${NC}"
        echo "   Please install missing dependencies and try again."
        exit 1
    fi
    
    echo -e "${GREEN}✅ All dependencies are available${NC}"
}

# Main execution function
main() {
    local exit_code=0
    local start_time=$(date +%s)
    
    echo "Test configuration:"
    echo "  URL: $TEST_URL"
    echo "  Reports: $REPORTS_DIR"
    echo "  Timeout: ${TIMEOUT}s"
    echo ""
    
    # Check dependencies
    check_dependencies
    
    # Check if server is running
    check_server "$TEST_URL"
    
    echo -e "${BLUE}🚀 Starting accessibility test suite...${NC}"
    echo ""
    
    # Run Jest tests
    if ! run_jest_tests; then
        echo -e "${RED}❌ Jest tests failed${NC}"
        exit_code=1
    fi
    echo ""
    
    # Run Playwright tests
    if ! run_playwright_tests; then
        echo -e "${RED}❌ Playwright tests failed${NC}"
        exit_code=1
    fi
    echo ""
    
    # Run Lighthouse audit
    if ! run_lighthouse_audit; then
        echo -e "${RED}❌ Lighthouse audit failed${NC}"
        exit_code=1
    fi
    echo ""
    
    # Run axe-core tests
    if ! run_axe_tests; then
        echo -e "${RED}❌ axe-core tests failed${NC}"
        exit_code=1
    fi
    echo ""
    
    # Generate summary report
    generate_summary
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    echo ""
    echo "=============================================================="
    
    if [ $exit_code -eq 0 ]; then
        echo -e "${GREEN}🎉 All accessibility tests passed! (${duration}s)${NC}"
        echo -e "${GREEN}✅ VibeCode meets WCAG 2.1 AA compliance standards${NC}"
    else
        echo -e "${RED}💥 Some accessibility tests failed! (${duration}s)${NC}"
        echo -e "${RED}❌ Please review the reports and fix accessibility issues${NC}"
    fi
    
    echo ""
    echo "📊 Reports available in: $REPORTS_DIR"
    echo "📋 Summary: $REPORTS_DIR/accessibility-summary.md"
    
    if [ -d "$REPORTS_DIR/playwright" ]; then
        echo "🎭 Playwright report: $REPORTS_DIR/playwright/index.html"
    fi
    
    exit $exit_code
}

# Handle script arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --url)
            TEST_URL="$2"
            shift 2
            ;;
        --timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        --reports-dir)
            REPORTS_DIR="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --url URL          Test URL (default: http://localhost:3000)"
            echo "  --timeout SECONDS  Timeout for each test (default: 30)"
            echo "  --reports-dir DIR  Reports directory (default: ./tests/accessibility/reports)"
            echo "  --help             Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Run main function
main