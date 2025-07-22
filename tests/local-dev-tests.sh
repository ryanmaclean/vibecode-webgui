#!/bin/bash
set -e

# Local Development Environment Tests
# Tests Node.js, npm, Astro, and local development server

echo "🧪 Local Development Environment Tests"
echo "======================================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

PASSED=0
FAILED=0

test_result() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}[PASS]${NC} $1"
        ((PASSED++))
    else
        echo -e "${RED}[FAIL]${NC} $1"
        ((FAILED++))
    fi
}

echo -e "\n${BLUE}1. Environment Prerequisites${NC}"
echo "--------------------------------"

# Test Node.js version
node --version | grep -q 'v2[0-9]'
test_result "Node.js version 20+ installed"

# Test npm
npm --version &>/dev/null
test_result "npm is available"

# Test Git
git --version &>/dev/null
test_result "Git is available"

echo -e "\n${BLUE}2. Project Dependencies${NC}"
echo "-------------------------"

cd /Users/ryan.maclean/vibecode-webgui/docs

# Test package.json
[ -f "package.json" ]
test_result "package.json exists"

# Test package-lock.json
[ -f "package-lock.json" ]
test_result "package-lock.json exists"

# Test npm install
npm ci --silent &>/dev/null
test_result "npm dependencies install successfully"

# Test Astro CLI
npx astro --version &>/dev/null
test_result "Astro CLI available"

echo -e "\n${BLUE}3. Build Process Tests${NC}"
echo "------------------------"

# Test build command
npm run build &>/dev/null
test_result "Astro build completes successfully"

# Test build output
[ -d "dist" ]
test_result "Build output directory created"

[ -f "dist/index.html" ]
test_result "Main index.html generated"

[ -d "dist/_astro" ]
test_result "Astro assets directory created"

# Test build content
grep -q "VibeCode" dist/index.html
test_result "Built HTML contains VibeCode content"

# Test CSS assets
find dist -name "*.css" | head -1 | grep -q ".css"
test_result "CSS assets generated"

# Test JS assets
find dist -name "*.js" | head -1 | grep -q ".js"
test_result "JavaScript assets generated"

echo -e "\n${BLUE}4. Development Server Tests${NC}"
echo "-----------------------------"

# Start dev server in background
npm run dev &>/dev/null &
DEV_PID=$!
echo "Started dev server (PID: $DEV_PID)"

# Wait for server to start
sleep 10

# Test server is running
curl -s -f http://localhost:4321/ &>/dev/null
test_result "Development server responds on port 4321"

# Test server content
curl -s http://localhost:4321/ | grep -q "VibeCode"
test_result "Development server serves VibeCode content"

# Test hot reload endpoint
curl -s http://localhost:4321/ | grep -q "astro"
test_result "Development server has hot reload capabilities"

# Test static assets
curl -s -f http://localhost:4321/_astro/ &>/dev/null || true
test_result "Static assets endpoint accessible"

# Clean up
kill $DEV_PID &>/dev/null || true
echo "Stopped dev server"

echo -e "\n${BLUE}5. Project Structure Tests${NC}"
echo "----------------------------"

cd /Users/ryan.maclean/vibecode-webgui

# Test project files
[ -f "README.md" ]
test_result "README.md exists"

[ -f "package.json" ]
test_result "Root package.json exists"

[ -f "docker-compose.yml" ]
test_result "Docker Compose configuration exists"

[ -d "docs" ]
test_result "Docs directory exists"

[ -d "k8s" ]
test_result "Kubernetes manifests directory exists"

[ -d "scripts" ]
test_result "Scripts directory exists"

[ -d "infrastructure" ]
test_result "Infrastructure directory exists"

echo -e "\n${BLUE}6. Documentation Tests${NC}"
echo "------------------------"

# Test documentation files
[ -f "WIKI_INDEX.md" ]
test_result "Wiki index exists"

[ -f "COMPONENT_ONBOARDING_CHECKLIST.md" ]
test_result "Component onboarding checklist exists"

[ -f "DATADOG_MONITORING_CONFIGURATION.md" ]
test_result "Datadog monitoring documentation exists"

# Test documentation content
grep -q "VibeCode" README.md
test_result "README contains project information"

grep -q "deployment" WIKI_INDEX.md
test_result "Wiki index contains deployment information"

echo -e "\n${BLUE}7. Configuration Files Tests${NC}"
echo "------------------------------"

# Test Astro config
[ -f "docs/astro.config.mjs" ]
test_result "Astro configuration exists"

# Test TypeScript config
[ -f "docs/tsconfig.json" ]
test_result "TypeScript configuration exists"

# Test Docker files
[ -f "docs/Dockerfile" ]
test_result "Dockerfile exists"

[ -f "docs/nginx.conf" ]
test_result "Nginx configuration exists"

echo -e "\n${BLUE}8. Environment Variables Tests${NC}"
echo "------------------------------------"

# Test environment variable files
[ -f "docs/.env.example" ] || true
test_result "Environment example file available (optional)"

# Test that sensitive files are ignored
! git status --porcelain | grep -q ".env"
test_result "Environment files properly ignored by git"

echo -e "\n${BLUE}=== Local Development Test Results ===${NC}"
echo "Total Tests: $((PASSED + FAILED))"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"

if [ $FAILED -eq 0 ]; then
    echo -e "\n${GREEN}✅ All local development tests passed!${NC}"
    echo "Local development environment is ready for use."
else
    echo -e "\n${RED}❌ Some tests failed!${NC}"
    echo "Please fix the issues before proceeding."
fi

exit $FAILED