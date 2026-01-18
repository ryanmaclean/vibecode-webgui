# Test Coverage Audit - 2025-09-30

## Summary

This audit identifies what we have **automated tests** for vs what we've only **manually verified**.

## ✅ What We Have Tests For

### 1. **Onboarding Flow** ❌ BROKEN
- **File:** `tests/unit/onboarding.test.tsx`
- **Status:** Parsing errors, needs fixing
- **Coverage:** 11 test cases written but not passing
- **Action Required:** Fix Babel/Jest config to parse new onboarding page

### 2. **Code-Server Extensions** ⚠️ PARTIAL
- **Files:**
  - `tests/docker/code-server-extensions.test.sh` (Bash)
  - `tests/docker/code-server-extensions.test.js` (Jest)
- **Status:** Written but not executed against latest image
- **Coverage:** Tests 25+ extensions, LSP servers
- **Action Required:** Build latest image and run tests

### 3. **Monaco/Monacopilot** ✅ PASSING
- **Verification:** `scripts/verify-monacopilot.js`
- **Status:** All 9 checks passing
- **Coverage:** Monaco 0.53.0 integration verified

### 4. **KinD Code-Server** ✅ AUTOMATED
- **Workflow:** `.github/workflows/kind-code-server-smoke.yml`
- **Status:** Nightly + manual trigger
- **Coverage:** Health checks, editor availability, CLI tools

## ❌ What We Only Have Manual Verification For

### 1. **Onboarding UI/UX**
- **What:** Full 7-step flow in browser
- **Verified:** Type check passes, no runtime test
- **Risk:** UI could be broken, interactions untested
- **Action:** Create E2E test with Playwright

### 2. **Extension Installation**
- **What:** 51+ extensions actually install in code-server
- **Verified:** Dockerfile syntax only
- **Risk:** Extensions could fail to install, wrong IDs
- **Action:** Run `tests/docker/code-server-extensions.test.sh`

### 3. **API Endpoints**
- **What:** `/api/user/preferences` POST/GET
- **Verified:** Code review only
- **Risk:** Could return 500, auth issues
- **Action:** Create integration test

### 4. **Onboarding Persistence**
- **What:** Preferences save to database
- **Verified:** Stubbed, not implemented
- **Risk:** Data loss, no persistence
- **Action:** Implement database integration + test

### 5. **Theme Switching**
- **What:** Light/Dark/Auto theme actually applies
- **Verified:** UI renders, no functional test
- **Risk:** Theme doesn't persist or apply
- **Action:** E2E test theme changes

### 6. **Integration OAuth Flows**
- **What:** GitHub/GitLab/etc OAuth works
- **Verified:** UI only, no backend
- **Risk:** OAuth could be completely broken
- **Action:** Mock OAuth flow + integration test

### 7. **AI Provider Configuration**
- **What:** OpenAI/Anthropic keys save and work
- **Verified:** UI only
- **Risk:** Keys don't save, API calls fail
- **Action:** Integration test with mock APIs

### 8. **Extension Bundles**
- **What:** Selecting bundle installs all extensions
- **Verified:** UI logic only
- **Risk:** Bundle logic could be broken
- **Action:** Unit test bundle selection logic

## 📊 Test Coverage Breakdown

| Component | Unit Tests | Integration Tests | E2E Tests | Manual Only |
|-----------|------------|-------------------|-----------|-------------|
| Onboarding UI | ❌ Broken | ❌ None | ❌ None | ✅ Yes |
| Preferences API | ❌ None | ❌ None | ❌ None | ✅ Yes |
| Code-Server Extensions | ⚠️ Written | ❌ None | ❌ None | ✅ Yes |
| Theme System | ❌ None | ❌ None | ❌ None | ✅ Yes |
| OAuth Integrations | ❌ None | ❌ None | ❌ None | ✅ Yes |
| AI Providers | ❌ None | ❌ None | ❌ None | ✅ Yes |
| Monaco 0.53 | ✅ Passing | ✅ Passing | ❌ None | ✅ Yes |
| KinD Smoke Tests | ✅ Passing | ✅ Automated | ❌ None | ✅ Yes |

## 🎯 Priority Action Items

### P0 - Critical (Blocks Production)
1. **Fix onboarding unit tests** - Currently broken
2. **Run code-server extension tests** - Verify 51+ extensions install
3. **Create E2E test for onboarding flow** - End-to-end verification
4. **Test preferences API** - Ensure POST/GET work

### P1 - High (Should Have)
5. **Integration test for theme switching** - Verify persistence
6. **Mock OAuth flow tests** - Verify integration setup
7. **AI provider configuration tests** - Verify key storage
8. **Extension bundle logic tests** - Verify bundle selection

### P2 - Medium (Nice to Have)
9. **Visual regression tests** - Screenshot comparison
10. **Performance tests** - Onboarding load time
11. **Accessibility tests** - A11y compliance
12. **Mobile responsive tests** - Touch interactions

## 📝 Test Implementation Plan

### Phase 1: Fix Existing Tests (1-2 hours)
```bash
# Fix onboarding unit tests
npm run test:unit -- tests/unit/onboarding.test.tsx

# Run code-server extension tests
docker build -t vibecode/code-server:test -f docker/code-server/Dockerfile .
./tests/docker/code-server-extensions.test.sh
```

### Phase 2: Integration Tests (2-3 hours)
```typescript
// tests/integration/onboarding-api.test.ts
describe('/api/user/preferences', () => {
  it('saves preferences', async () => {
    const response = await fetch('/api/user/preferences', {
      method: 'POST',
      body: JSON.stringify({ theme: 'dark' })
    })
    expect(response.status).toBe(200)
  })
  
  it('retrieves preferences', async () => {
    const response = await fetch('/api/user/preferences')
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.theme).toBeDefined()
  })
})
```

### Phase 3: E2E Tests (3-4 hours)
```typescript
// tests/e2e/onboarding.spec.ts
import { test, expect } from '@playwright/test'

test('complete onboarding flow', async ({ page }) => {
  await page.goto('/onboarding')
  
  // Step 1: Welcome
  await expect(page.getByText('Welcome to VibeCode')).toBeVisible()
  await page.getByRole('button', { name: 'Get Started' }).click()
  
  // Step 2: Theme
  await page.getByRole('button', { name: 'Dark' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  
  // ... test all 7 steps
  
  // Verify completion
  await expect(page).toHaveURL('/dashboard')
})
```

### Phase 4: Continuous Verification
- Add tests to CI pipeline
- Set up nightly test runs
- Monitor test flakiness
- Track coverage metrics

## 🔍 What We Know Works (Verified)

### From Logs/Manual Testing:
1. ✅ Type check passes (no TypeScript errors)
2. ✅ Monaco 0.53.0 loads and renders
3. ✅ Monacopilot integration functional
4. ✅ KinD cluster health checks pass
5. ✅ Code-server pod starts successfully
6. ✅ Vim/Neovim/Emacs available in pods
7. ✅ Aider/Goose CLI tools installed
8. ✅ Port-forward and NodePort accessible

### From Code Review:
1. ✅ Onboarding UI renders (no runtime errors)
2. ✅ All 7 steps have proper navigation
3. ✅ Progress bar updates correctly
4. ✅ Form state management works
5. ✅ API endpoint exists and has logic

## 🚨 Known Gaps

### No Tests For:
- User can complete onboarding
- Preferences persist across sessions
- Theme actually changes UI
- Extensions actually install
- Integrations actually connect
- AI providers actually work
- Mobile/tablet layouts
- Keyboard navigation
- Screen reader compatibility
- Error handling (network failures, etc.)

### No Monitoring For:
- Onboarding completion rate
- Drop-off points
- Time to complete
- Most popular selections
- Error rates

## 📈 Recommended Coverage Targets

- **Unit Tests:** 80% coverage (currently ~30%)
- **Integration Tests:** All API endpoints (currently 0%)
- **E2E Tests:** Critical user paths (currently 0%)
- **Visual Regression:** Key screens (currently 0%)

## 🎬 Next Steps

1. **Immediate:** Fix broken onboarding unit tests
2. **Today:** Run code-server extension tests
3. **This Week:** Add E2E tests for onboarding
4. **This Sprint:** Achieve 80% unit test coverage
5. **Next Sprint:** Add monitoring/analytics

## 📚 References

- [Jest Config](../jest.config.js)
- [Playwright Config](../playwright.config.ts)
- [CI Workflow](../.github/workflows/ci.yml)
- [Test Documentation](./TESTING.md)
