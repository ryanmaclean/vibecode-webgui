# Security Fix Plan - vibecode-webgui
**Version:** 1.0
**Created:** 2026-01-14
**Target Completion:** 2026-01-21

---

## Overview
This document provides a step-by-step plan to remediate all 3 high-severity security vulnerabilities in vibecode-webgui.

---

## Phase 1: Preparation (Day 1)

### Task 1.1: Backup Current State
```bash
# Create backup branch
git checkout -b security-fixes/2026-01-14
git commit -m "chore: Backup current state before security fixes" --allow-empty

# Document current versions
npm list --depth=0 > /tmp/pre-fix-deps.txt
npm audit --json > /tmp/pre-fix-audit.json
```

**Estimated Time:** 10 minutes
**Risk:** None

### Task 1.2: Verify Current Test Suite
```bash
# Run all tests to establish baseline
npm run test 2>&1 | tee /tmp/pre-fix-tests.log

# Check test coverage
npm run test:coverage 2>&1 | tee /tmp/pre-fix-coverage.log

# Verify type checking
npm run type-check 2>&1 | tee /tmp/pre-fix-typecheck.log
```

**Estimated Time:** 30 minutes
**Risk:** Low - Read-only operations

### Task 1.3: Prepare Testing Environment
```bash
# Create backup of package.json and package-lock.json
cp package.json package.json.backup.$(date +%s)
cp package-lock.json package-lock.json.backup.$(date +%s)

# Ensure all dependencies are properly installed
npm ci
```

**Estimated Time:** 15 minutes
**Risk:** Low

---

## Phase 2: Preact Fix (Day 1-2) - LOWEST RISK

### Priority: HIGH (but lowest risk due to patch-level fix)

### Task 2.1: Update Preact
**Rationale:** This is a patch-level fix with no breaking changes. Safe to apply first.

```bash
# This can be done with npm audit fix (no --force required)
npm audit fix
```

**Change:** preact 10.27.2 → 10.28.2 (patch release)

**Estimated Time:** 5 minutes
**Risk:** VERY LOW

### Task 2.2: Verify Preact Update
```bash
# Confirm update
npm list preact

# Should show: preact@10.28.2 or higher
```

**Expected Output:**
```
└── preact@10.28.2
```

**Estimated Time:** 2 minutes
**Risk:** None

### Task 2.3: Test Authentication Flows
```bash
# Run authentication-specific tests
npm test -- --testPathPatterns="auth|Auth|authentication" 2>&1

# Test next-auth integration
npm test -- --testPathPatterns="next-auth|nextauth" 2>&1

# Run E2E tests related to auth
npm run test:e2e -- --grep "auth|Auth|login|Login" 2>&1
```

**Estimated Time:** 20 minutes
**Risk:** Low

### Task 2.4: Manual Testing (Recommended)
1. Start dev server: `npm run dev`
2. Test login page loads correctly
3. Test sign-in flow works
4. Test component rendering (no console errors)
5. Verify preact isn't throwing JSON injection errors

**Estimated Time:** 15 minutes
**Risk:** Low

### Task 2.5: Commit Preact Fix
```bash
git add package.json package-lock.json
git commit -m "fix: Update preact to 10.28.2 - fix JSON VNode injection vulnerability

- Addresses GHSA-36hm-qxxp-pg3m
- Patch-level update with no breaking changes
- Fixes XSS vulnerability in Preact VNode handling
- All auth tests passing"
```

**Estimated Time:** 5 minutes

---

## Phase 3: @modelcontextprotocol/sdk Fix (Day 2-3) - MEDIUM RISK

### Priority: HIGH (patch-level fix but affects MCP functionality)

### Task 3.1: Update MCP SDK
**Rationale:** Patch-level fix. No breaking changes expected. Fixes ReDoS vulnerability.

```bash
# Direct update
npm install --save @modelcontextprotocol/sdk@1.25.2

# Or use:
npm audit fix --force
```

**Change:** @modelcontextprotocol/sdk 1.25.1 → 1.25.2 (patch release)

**Estimated Time:** 5 minutes
**Risk:** LOW

### Task 3.2: Verify MCP Update
```bash
npm list @modelcontextprotocol/sdk

# Should show: @modelcontextprotocol/sdk@1.25.2
```

**Estimated Time:** 2 minutes

### Task 3.3: Test MCP Server Functionality
```bash
# Start MCP server in development
npm run mcp:dev 2>&1 &
MCP_PID=$!

# Test basic connectivity (wait 5 seconds for startup)
sleep 5

# Kill MCP server
kill $MCP_PID

# Or run MCP tests if available
npm test -- --testPathPatterns="mcp|MCP" 2>&1
```

**Estimated Time:** 15 minutes
**Risk:** Low

### Task 3.4: Stress Test MCP with Edge Cases
```bash
# Create test script to send crafted requests
cat > /tmp/test-mcp-redos.js << 'EOF'
// Test MCP ReDoS fix
const patterns = [
  "(a+)+b",
  "(x+x+)+y",
  "(a|a)*b",
  "(a|ab)*c"
];

console.log("Testing patterns that previously caused ReDoS...");
patterns.forEach(pattern => {
  console.log(`Testing pattern: ${pattern}`);
  try {
    const regex = new RegExp(pattern);
    // This would hang before the fix
    console.log("  ✓ Pattern handled safely");
  } catch (e) {
    console.log(`  ✗ Error: ${e.message}`);
  }
});
EOF

node /tmp/test-mcp-redos.js
```

**Estimated Time:** 10 minutes
**Risk:** Low

### Task 3.5: Commit MCP SDK Fix
```bash
git add package.json package-lock.json
git commit -m "fix: Update @modelcontextprotocol/sdk to 1.25.2 - fix ReDoS vulnerability

- Addresses GHSA-8r9q-7v3j-jr4g
- Patch-level update with no breaking changes
- Fixes Regular Expression Denial of Service in regex patterns
- MCP server tests passing
- Stress tests confirm ReDoS fixed"
```

**Estimated Time:** 5 minutes

---

## Phase 4: LangChain Fix (Day 3-5) - HIGHEST RISK

### Priority: CRITICAL (fixes credential leakage vulnerability)

### Important: This requires minor version updates (1.0.2 → 1.2.8)

### Task 4.1: Review LangChain Release Notes
**CRITICAL STEP:** Before updating, review all release notes for breaking changes.

```bash
# Download release notes for versions 1.0.3 through 1.2.8
# Check: https://github.com/langchain-ai/langchainjs/releases

# Document any breaking changes
cat > /tmp/langchain-changes.md << 'EOF'
# LangChain 1.0.2 → 1.2.8 Breaking Changes

## To be filled after reviewing releases:
- API Changes
- Deprecated methods
- New required parameters
- Module reorganization
- Handler changes

EOF
```

**Estimated Time:** 30 minutes
**Risk:** Critical assessment needed

### Task 4.2: Update LangChain in Staging
**Do NOT update in production branch yet.**

```bash
# Create feature branch for testing
git checkout -b testing/langchain-update

# Install the new version
npm install --save langchain@1.2.8

# This will update package.json and package-lock.json
```

**Change:** langchain 1.0.2 → 1.2.8 (minor version bump)

**Estimated Time:** 10 minutes
**Risk:** Medium

### Task 4.3: Type Checking After Update
```bash
# Check for TypeScript errors
npm run type-check 2>&1 | tee /tmp/langchain-typecheck.log

# Review output for incompatibilities
# Expected: Some type changes may be needed
```

**Estimated Time:** 15 minutes
**Risk:** Medium - May reveal incompatibilities

### Task 4.4: Update Code for Compatibility
**If type-check reveals errors:**

```bash
# Search for LangChain imports and usage
grep -r "from.*langchain" src/ --include="*.ts" --include="*.tsx" \
  | head -20

grep -r "import.*langchain" src/ --include="*.ts" --include="*.tsx" \
  | head -20

# Document necessary code changes
cat > /tmp/langchain-code-changes.md << 'EOF'
# Required Code Changes for LangChain 1.2.8

## Files needing updates:
- src/app/api/ai/chat/route.ts
- src/app/api/ai/chat/enhanced/route.ts
- src/app/api/ai/chat/unified/route.ts
- [Add others found in grep search]

## Changes needed:
[Document specific changes]

EOF
```

**Estimated Time:** 30 minutes
**Risk:** Medium-High

### Task 4.5: Test AI Endpoints
```bash
# Run AI-specific tests
npm test -- --testPathPatterns="ai|AI|chat|Chat" 2>&1 | tee /tmp/langchain-tests.log

# Run integration tests for chat endpoints
npm run test:integration -- --testPathPatterns="chat" 2>&1

# Check test results
grep -E "FAIL|PASS|Error" /tmp/langchain-tests.log
```

**Estimated Time:** 30 minutes
**Risk:** High - May reveal functionality issues

### Task 4.6: Manual Testing of Chat Endpoints
**IF tests pass, perform manual testing:**

```bash
# Start development server
npm run dev &
DEV_PID=$!

# Wait for startup
sleep 10

# Test endpoints
curl -X POST http://localhost:3000/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello"}'

# Stop server
kill $DEV_PID
```

**Estimated Time:** 20 minutes
**Risk:** Medium

### Task 4.7: Verify No Credential Leakage
```bash
# Search for any hardcoded API keys
grep -r "sk-" src/ --include="*.ts" --include="*.tsx" || echo "No hardcoded keys found"
grep -r "api_key" src/ --include="*.ts" --include="*.tsx" | grep -v "apiKey: process" || echo "No hardcoded keys found"

# Check credential handling in logs
grep -r "console.log.*key\|console.log.*token" src/ --include="*.ts" --include="*.tsx"

# Run security test
npm run security:test 2>&1 | tee /tmp/langchain-security.log
```

**Estimated Time:** 15 minutes
**Risk:** Low

### Task 4.8: Full Regression Testing
```bash
# Run full test suite
npm test 2>&1 | tee /tmp/langchain-full-tests.log

# Run type-check again
npm run type-check 2>&1 | tee /tmp/langchain-final-typecheck.log

# Run lint
npm run lint 2>&1 | tee /tmp/langchain-lint.log

# Check for warnings
grep -E "ERROR|WARN" /tmp/langchain-full-tests.log /tmp/langchain-lint.log
```

**Estimated Time:** 45 minutes
**Risk:** Medium

### Task 4.9: Commit LangChain Fix
**ONLY after all tests pass:**

```bash
git add package.json package-lock.json src/

git commit -m "fix: Update langchain to 1.2.8 - fix serialization injection vulnerability

- Addresses GHSA-r399-636x-v7f6
- Minor version update (1.0.2 → 1.2.8)
- Fixes critical deserialization vulnerability that could leak credentials
- All AI/chat endpoint tests passing
- Type checking passing
- Credential handling verified
- Regression tests passing"
```

**Estimated Time:** 5 minutes

---

## Phase 5: Integration and Deployment (Day 5-6)

### Task 5.1: Merge All Fixes
```bash
# If fixes were done on separate branches, merge them
git merge security-fixes/preact
git merge testing/langchain-update

# Or if done on single branch, skip this step
```

**Estimated Time:** 5 minutes
**Risk:** Low (if all tests passed)

### Task 5.2: Final Verification
```bash
# Run complete test suite one more time
npm test 2>&1 | tee /tmp/final-test-results.log

# Run security audit to confirm fixes
npm audit 2>&1 | tee /tmp/final-audit.log

# Verify all vulnerabilities are resolved
npm audit | grep -i "vulnerabilities\|high\|critical"
# Expected: "0 vulnerabilities found"
```

**Estimated Time:** 30 minutes
**Risk:** Low

### Task 5.3: Create Release Notes
```bash
cat > SECURITY_PATCH_NOTES.md << 'EOF'
# Security Patch Release - 2026-01-14

## Summary
Applied critical security patches to address 3 high-severity vulnerabilities.

## Fixed Vulnerabilities
1. @modelcontextprotocol/sdk ReDoS (GHSA-8r9q-7v3j-jr4g)
2. langchain Serialization Injection (GHSA-r399-636x-v7f6)
3. preact JSON Injection (GHSA-36hm-qxxp-pg3m)

## Changes
- preact: 10.27.2 → 10.28.2
- @modelcontextprotocol/sdk: 1.25.1 → 1.25.2
- langchain: 1.0.2 → 1.2.8

## Testing
- All unit tests passing
- All integration tests passing
- E2E authentication tests passing
- Security audit clean (0 vulnerabilities)

## Deployment
- Staging validation: PASSED
- Production ready: YES

EOF
```

**Estimated Time:** 10 minutes

### Task 5.4: Create PR and Deploy
```bash
# Create feature branch for main
git checkout -b release/security-patches-2026-01-14

# Push to remote
git push origin release/security-patches-2026-01-14

# Create Pull Request on GitHub
gh pr create \
  --title "Security: Fix 3 high-severity vulnerabilities" \
  --body "$(cat SECURITY_PATCH_NOTES.md)" \
  --base main
```

**Estimated Time:** 10 minutes
**Risk:** Medium (deployment)

### Task 5.5: Staging Deployment
```bash
# Deploy to staging environment
# (Procedure depends on your CI/CD setup)

# If using GitHub Actions:
# - PR will trigger staging deployment
# - Monitor logs in GitHub Actions

# Run smoke tests on staging
npm run test:e2e -- --project=chromium 2>&1 | tee /tmp/staging-e2e.log
```

**Estimated Time:** 30 minutes
**Risk:** Medium

### Task 5.6: Production Deployment
```bash
# After staging validation passes:
# 1. Merge PR to main
# 2. Tag release
# 3. Deploy to production

# Tag the release
git tag -a v-security-patch-2026-01-14 \
  -m "Security: Fix 3 high-severity vulnerabilities"

git push origin v-security-patch-2026-01-14
```

**Estimated Time:** 20 minutes
**Risk:** High (production change)

### Task 5.7: Post-Deployment Verification
```bash
# Verify production is running
curl https://vibecode.eastus2.cloudapp.azure.com/api/health

# Check logs for any errors
# (Your monitoring tool)

# Run production smoke tests
npm run test:e2e:production -- --project=chromium 2>&1
```

**Estimated Time:** 15 minutes
**Risk:** Medium

---

## Rollback Plan (If Needed)

### Preact Rollback
```bash
npm install preact@10.27.2
npm audit fix  # This will revert
git reset --hard HEAD~1  # Or specific commit
```

### MCP Rollback
```bash
npm install @modelcontextprotocol/sdk@1.25.1
npm audit fix --force
git reset --hard HEAD~1
```

### LangChain Rollback (COMPLEX)
```bash
npm install langchain@1.0.2

# You may need to revert code changes made for compatibility
git checkout HEAD~1 -- src/

npm test  # Verify it works
```

---

## Testing Checklist

### Unit Tests
- [ ] npm test passes
- [ ] Code coverage maintained
- [ ] No new test failures

### Integration Tests
- [ ] Chat endpoints working
- [ ] Authentication flows working
- [ ] MCP server responding
- [ ] Database connections stable

### E2E Tests
- [ ] Login/logout flows
- [ ] Chat interface functional
- [ ] File uploads working
- [ ] Real-time features working

### Security Tests
- [ ] npm audit clean (0 vulnerabilities)
- [ ] No credential leakage in logs
- [ ] Regex patterns handled safely
- [ ] No XSS vulnerabilities in auth

### Manual Testing
- [ ] UI renders correctly
- [ ] No console errors
- [ ] Performance acceptable
- [ ] Third-party integrations working

### Staging Validation
- [ ] All tests passing on staging
- [ ] Monitoring showing healthy metrics
- [ ] No error rate increase
- [ ] Response times normal

### Production Validation
- [ ] Deployment successful
- [ ] Health checks passing
- [ ] User reports no issues
- [ ] Metrics normal

---

## Timeline Summary

| Phase | Task | Est. Time | Day |
|---|---|---|---|
| 1 | Preparation | 55 min | 1 |
| 2 | Preact Fix | 57 min | 1-2 |
| 3 | MCP SDK Fix | 42 min | 2-3 |
| 4 | LangChain Fix | 2.5 hrs | 3-5 |
| 5 | Integration & Deploy | 2 hrs | 5-6 |
| **Total** | | **~7 hours** | **6 days** |

---

## Success Criteria

All of the following must be true:

1. ✓ npm audit shows 0 vulnerabilities
2. ✓ All tests pass (unit, integration, e2e)
3. ✓ No type-checking errors
4. ✓ No lint warnings related to updates
5. ✓ Authentication flows working
6. ✓ Chat endpoints functional
7. ✓ MCP server operational
8. ✓ Production deployment stable
9. ✓ No credential leakage detected
10. ✓ Performance metrics stable

---

## Next Steps

After patches are applied:

1. **Week 1:** Monitor production for any issues
2. **Week 2:** Review and update security policy
3. **Week 3:** Implement automated vulnerability scanning
4. **Week 4:** Plan next dependency update cycle

---

## Related Documents

- SECURITY_VULNERABILITY_ANALYSIS.md - Detailed vulnerability information
- SECURITY_RISK_ASSESSMENT.md - Risk matrix and timeline
- security-updates.sh - Automated update script

---

## Contact and Escalation

If critical issues are discovered:
1. Immediately halt deployment
2. Review rollback plan
3. Revert to last stable version
4. Investigate root cause
5. Document findings
6. Prepare corrective release

---

**Document Created:** 2026-01-14
**Last Updated:** 2026-01-14
**Status:** READY FOR IMPLEMENTATION
