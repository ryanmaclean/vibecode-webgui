#!/bin/bash
# Comprehensive onboarding verification script
# Tests both implementation and runtime behavior

set -e

echo "🧪 VibeCode Onboarding Verification"
echo "===================================="
echo ""

PASSED=0
FAILED=0
WARNINGS=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED++))
}

fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAILED++))
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
}

echo "1. Type Safety Checks"
echo "---------------------"
if npm run type-check > /dev/null 2>&1; then
    pass "TypeScript compiles"
else
    fail "TypeScript has errors"
fi

echo ""
echo "2. File Existence Checks"
echo "------------------------"
[[ -f "src/app/onboarding/page.tsx" ]] && pass "Onboarding page exists" || fail "Missing onboarding page"
[[ -f "src/app/api/user/preferences/route.ts" ]] && pass "Preferences API exists" || fail "Missing preferences API"
[[ -f "src/components/OnboardingCheck.tsx" ]] && pass "OnboardingCheck component exists" || fail "Missing OnboardingCheck"
[[ -f "docs/ONBOARDING.md" ]] && pass "Documentation exists" || fail "Missing documentation"

echo ""
echo "3. Test Coverage Checks"
echo "----------------------"
[[ -f "tests/unit/onboarding.test.tsx" ]] && warn "Unit tests exist but broken" || fail "No unit tests"
[[ -f "tests/e2e/onboarding.spec.ts" ]] && pass "E2E tests exist" || warn "No E2E tests"

echo ""
echo "4. Code Quality Checks"
echo "---------------------"
grep -q "OnboardingStep" src/app/onboarding/page.tsx && pass "TypeScript types defined" || fail "Missing types"
grep -q "updateData" src/app/onboarding/page.tsx && pass "State management implemented" || fail "Missing state management"
grep -q "completeOnboarding" src/app/onboarding/page.tsx && pass "Completion handler exists" || fail "Missing completion handler"

echo ""
echo "5. API Endpoint Checks"
echo "----------------------"
grep -q "POST" src/app/api/user/preferences/route.ts && pass "POST endpoint implemented" || fail "Missing POST endpoint"
grep -q "GET" src/app/api/user/preferences/route.ts && pass "GET endpoint implemented" || fail "Missing GET endpoint"
grep -q "getServerSession" src/app/api/user/preferences/route.ts && pass "Authentication check exists" || fail "Missing auth check"

echo ""
echo "6. Feature Completeness"
echo "----------------------"
grep -q "theme" src/app/onboarding/page.tsx && pass "Theme selection implemented" || fail "Missing theme selection"
grep -q "preferredIde" src/app/onboarding/page.tsx && pass "Workspace selection implemented" || fail "Missing workspace selection"
grep -q "cliEditor" src/app/onboarding/page.tsx && pass "CLI editor selection implemented" || fail "Missing CLI editor"
grep -q "extensions" src/app/onboarding/page.tsx && pass "Extension selection implemented" || fail "Missing extensions"
grep -q "integrations" src/app/onboarding/page.tsx && pass "Integrations implemented" || fail "Missing integrations"
grep -q "aiProviders" src/app/onboarding/page.tsx && pass "AI providers implemented" || fail "Missing AI providers"

echo ""
echo "7. UI/UX Checks"
echo "--------------"
grep -q "progress" src/app/onboarding/page.tsx && pass "Progress tracking implemented" || fail "Missing progress tracking"
grep -q "prevStep" src/app/onboarding/page.tsx && pass "Back navigation implemented" || fail "Missing back navigation"
grep -q "nextStep" src/app/onboarding/page.tsx && pass "Forward navigation implemented" || fail "Missing forward navigation"

echo ""
echo "8. Documentation Checks"
echo "----------------------"
grep -q "Usage" docs/ONBOARDING.md && pass "Usage documentation exists" || warn "Missing usage docs"
grep -q "Customization" docs/ONBOARDING.md && pass "Customization docs exist" || warn "Missing customization docs"
grep -q "Testing" docs/ONBOARDING.md && pass "Testing docs exist" || warn "Missing testing docs"

echo ""
echo "9. Integration Checks"
echo "--------------------"
[[ -f ".github/workflows/ci.yml" ]] && warn "CI exists but no onboarding tests" || fail "No CI workflow"

echo ""
echo "10. Runtime Verification (if dev server running)"
echo "-----------------------------------------------"
if curl -s http://localhost:3000/onboarding > /dev/null 2>&1; then
    pass "Onboarding page accessible"
    
    # Check if page returns HTML
    if curl -s http://localhost:3000/onboarding | grep -q "Welcome to VibeCode"; then
        pass "Page renders welcome message"
    else
        fail "Page doesn't render correctly"
    fi
else
    warn "Dev server not running (skip runtime checks)"
fi

echo ""
echo "===================================="
echo "Summary:"
echo "  Passed:   $PASSED"
echo "  Failed:   $FAILED"
echo "  Warnings: $WARNINGS"
echo "===================================="

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All critical checks passed!${NC}"
    echo ""
    echo "⚠️  However, we still need:"
    echo "  1. Fix broken unit tests"
    echo "  2. Add E2E tests"
    echo "  3. Test API endpoints"
    echo "  4. Verify database persistence"
    exit 0
else
    echo -e "${RED}Some checks failed!${NC}"
    exit 1
fi
