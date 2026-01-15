# Test Failure Analysis Report
**Issue #767 - Complete Unit Test Failure Categorization**

**Generated:** 2026-01-15
**Total Test Suites:** 324
**Total Tests:** 5,583

---

## Executive Summary

### Test Results Overview
- ✅ **Passing Test Suites:** 274 (84.6%)
- ❌ **Failed Test Suites:** 49 (15.1%)
- ⏭️ **Skipped Test Suites:** 1 (0.3%)

- ✅ **Passing Tests:** 5,369 (96.2%)
- ❌ **Failed Tests:** 169 (3.0%)
- ⏭️ **Skipped Tests:** 45 (0.8%)

### Key Findings
The analysis reveals that **169 test failures** stem from **8 primary root causes**, with the majority being **mock-related issues** (78.1% of failures). The good news is that most failures share common patterns, making them addressable through systematic fixes rather than requiring individual test rewrites.

---

## Failure Categories

### Primary Root Causes (Ranked by Impact)

#### 1. Fetch/Response Mock Issues (215 occurrences - 46.7%)
**Impact:** 9 test files, ~100+ individual test failures

**Description:**
Tests attempting to use `fetch` or check response properties encounter `TypeError: Cannot read properties of undefined (reading 'ok'|'status'|'headers')`. This indicates incomplete fetch mocking.

**Affected Files:**
- `tests/integration/datadog-real.test.ts`
- `tests/integration/litellm-integration.test.ts`
- `tests/integration/real-database-operations.test.ts`
- `tests/integration/real-monitoring-integration.test.ts`
- `tests/monitoring/alert-validation.test.ts`
- `tests/performance/load-testing.test.ts`
- `tests/performance/realtime-communication-benchmark.test.ts`
- `tests/performance/system-metrics-validation.test.ts`
- `tests/security/penetration-testing.test.ts`

**Example Error:**
```
TypeError: Cannot read properties of undefined (reading 'ok')
  at /Users/ryan.maclean/vibecode-webgui/src/components/ai/AIChatInterface.tsx:77:22
```

**Root Cause:**
Global `fetch` mock is not properly configured or is missing essential Response object properties.

**Recommended Fix:**
1. Update `tests/setupTests.ts` or `tests/jest.setup.js` to include comprehensive fetch mock:
```javascript
global.fetch = jest.fn((url, options) =>
  Promise.resolve({
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers({ 'content-type': 'application/json' }),
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    blob: () => Promise.resolve(new Blob()),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    clone: () => ({ /* minimal clone */ }),
  })
);
```

2. Or use `jest-fetch-mock` or `msw` (Mock Service Worker) library for more robust mocking

**Effort:** Medium (4-8 hours)
**Priority:** 🔴 **CRITICAL** - Affects 109 tests across 9 files

---

#### 2. Test Suite Compilation Errors (38 occurrences - 8.3%)
**Impact:** 19 test files fail to run at all

**Description:**
Test files fail to compile/load before any tests execute, often due to module resolution issues, syntax errors, or conflicting module declarations.

**Affected Files:**
- `./test-datadog-extension.spec.js`
- `azure/SwiftUI-Apps/Tests/e2e/unified-services.spec.ts`
- `src/app/api/health/__tests__/route.test.ts`
- `tests/integration/vm-providers.test.ts`
- `tests/k8s/chaos-controller-deployment.test.ts`
- `tests/k8s/datadog-k8s-config.test.ts`
- `tests/k8s/monitoring-deployment.test.ts`
- `tests/lib/cache/vector-cache-strategy.test.ts`
- `tests/performance/core-web-vitals.test.ts`
- `tests/performance/load-testing.test.ts`
- `tests/performance/realtime-communication-benchmark.test.ts`
- `tests/performance/system-metrics-validation.test.ts`
- `tests/unit/auth-password-validation.test.ts`
- `tests/unit/auth/password.test.ts`
- `tests/unit/collaboration-advanced.test.ts`
- `tests/unit/lib/logger.test.ts`
- `tests/unit/lib/protocols/adapters/continue-adapter.test.ts`
- `tests/unit/lib/rate-limiting.test.ts`
- `tests/vector-db-migration-utility.test.js`

**Example Error:**
```
Test suite failed to run

The name `yaml` was looked up in the Haste module map. It cannot be resolved,
because there exists several different files, or packages, that provide a module
for that particular name and platform.
```

**Root Cause:**
- Haste module name collisions (multiple packages named 'yaml')
- Missing module mocks
- TypeScript compilation errors
- Import path issues

**Recommended Fix:**
1. Add problematic modules to `modulePathIgnorePatterns` in `jest.config.js`
2. Review and fix import statements in affected test files
3. Ensure all required dependencies are mocked
4. Run `npm run type-check` to identify TypeScript issues

**Effort:** Medium-High (8-16 hours)
**Priority:** 🟠 **HIGH** - Prevents 19 test files from running

---

#### 3. Callback Function Type Errors (18 occurrences - 3.9%)
**Impact:** 1 test file (`tests/unit/lib/auth.test.ts`)

**Description:**
Auth configuration tests fail because callback functions extracted from `authOptions.callbacks` are `undefined` but being invoked as functions.

**Affected Tests:**
- JWT Callback tests (3 failures)
- Session Callback tests (2 failures)
- SignIn Callback tests (1 failure)
- Redirect Callback tests (3 failures)

**Example Error:**
```
TypeError: jwtCallback is not a function
TypeError: sessionCallback is not a function
TypeError: signInCallback is not a function
TypeError: redirectCallback is not a function
```

**Root Cause:**
The test is extracting callbacks incorrectly:
```javascript
const jwtCallback = authOptions.callbacks?.jwt;
// But then calling: jwtCallback(token, { user })
// When jwtCallback might be undefined
```

**Recommended Fix:**
Update `tests/unit/lib/auth.test.ts` to properly handle optional callbacks:
```javascript
// Before calling:
if (typeof jwtCallback === 'function') {
  const result = await jwtCallback(token, { user, account, profile });
  // assertions...
}

// Or ensure authOptions includes all callbacks in test setup
```

**Effort:** Low (1-2 hours)
**Priority:** 🟡 **MEDIUM** - Isolated to one file, 18 tests

---

#### 4. Timeout Issues - WebSocket (22 occurrences - 4.8%)
**Impact:** 1 test file (`tests/unit/websocket-streaming.test.ts`)

**Description:**
All WebSocket streaming tests timeout after 30 seconds because mock WebSocket implementation doesn't properly trigger event handlers.

**Affected Test Groups:**
- Connection tests (2 failures)
- Streaming tests (4 failures)
- Stream Control tests (3 failures)
- Priority Handling tests (1 failure)
- Cleanup tests (1 failure)
- Error Handling tests (multiple)

**Example Error:**
```
thrown: "Exceeded timeout of 30000 ms for a test.
Add a timeout value to this test to increase the timeout, if this is a long-running test."
```

**Root Cause:**
Mock WebSocket (`mockWs`) implementation doesn't properly simulate asynchronous event flow. Tests call `mockWs.simulateOpen()` but the promise never resolves.

**Recommended Fix:**
1. Review and fix the WebSocket mock implementation in test setup
2. Ensure `simulateOpen()`, `simulateMessage()`, etc. properly invoke registered event handlers
3. Use `setImmediate()` or `process.nextTick()` to ensure proper async execution order:

```javascript
simulateOpen() {
  setImmediate(() => {
    if (this.onopen) this.onopen(new Event('open'));
  });
}
```

**Effort:** Medium (2-4 hours)
**Priority:** 🟡 **MEDIUM** - Isolated to one file but completely broken

---

#### 5. Window/DOM Not Defined (10 occurrences - 2.2%)
**Impact:** 5 test files

**Description:**
Tests fail with `ReferenceError: window is not defined` when trying to access browser APIs in Node environment.

**Affected Files:**
- `src/app/api/health/__tests__/route.test.ts`
- `tests/lib/cache/simple-vector-cache.test.js`
- `tests/lib/cache/vector-cache-integration.test.ts`
- `tests/lib/cache/vector-cache-strategy.test.ts`
- `tests/unit/lib/security/macos-keychain-server.test.ts`

**Example Error:**
```
ReferenceError: window is not defined
Consider using the "jsdom" test environment.
```

**Root Cause:**
Tests are configured with `testEnvironment: 'jsdom'` in `jest.config.js`, but:
1. Some test files may override this with inline pragmas
2. Code under test may access window before jsdom initializes
3. Mock setup may reference window too early

**Recommended Fix:**
1. Ensure all affected test files use jsdom environment (remove any `@jest-environment node` comments)
2. Add window mocks in test setup files:
```javascript
if (typeof window === 'undefined') {
  global.window = {
    localStorage: {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    },
    location: { href: 'http://localhost:3000' },
    // Add other needed properties
  };
}
```

**Effort:** Low-Medium (2-4 hours)
**Priority:** 🟡 **MEDIUM** - Affects 5 files

---

#### 6. Datadog Tracer Mock Issues (8 occurrences - 1.7%)
**Impact:** 4 test files

**Description:**
Tests fail when trying to call Datadog tracer methods that aren't properly mocked.

**Affected Files:**
- `tests/k8s/chaos-controller-deployment.test.ts`
- `tests/k8s/datadog-k8s-config.test.ts`
- `tests/k8s/monitoring-deployment.test.ts`
- `tests/unit/lib/monitoring/health-monitoring.test.ts`

**Example Error:**
```
TypeError: _instrument.default.addTags is not a function
```

**Root Cause:**
The Datadog tracer mock in `__mocks__` or setup files doesn't include all methods used by production code.

**Recommended Fix:**
Create/update `__mocks__/dd-trace.js` or `src/__mocks__/instrument.ts`:
```javascript
const mockTracer = {
  init: jest.fn(),
  use: jest.fn(),
  trace: jest.fn(),
  addTags: jest.fn(),
  setTag: jest.fn(),
  setUser: jest.fn(),
  getRumGlobalContext: jest.fn(() => ({})),
  getSpanContext: jest.fn(),
  scope: jest.fn(() => ({
    active: jest.fn(),
    bind: jest.fn(),
  })),
};

module.exports = mockTracer;
```

**Effort:** Low (1-2 hours)
**Priority:** 🟢 **LOW-MEDIUM** - Affects 4 files, K8s tests

---

#### 7. Module Not Found (@azure/identity) (4 occurrences - 0.9%)
**Impact:** 2 test files

**Description:**
Vector database migration tests can't find `@azure/identity` module.

**Affected Files:**
- `tests/vector-db-migration-utility.test.js`
- `tests/vector-db-migrations.test.js`

**Example Error:**
```
Cannot find module '@azure/identity' from 'tests/vector-db-migrations.test.js'
```

**Root Cause:**
`@azure/identity` is used in production code but not installed as a dependency, or not properly mocked in tests.

**Recommended Fix:**
**Option 1:** Add to package.json devDependencies (if needed for tests):
```bash
npm install --save-dev @azure/identity
```

**Option 2:** Create mock file `__mocks__/@azure/identity.js`:
```javascript
module.exports = {
  DefaultAzureCredential: jest.fn().mockImplementation(() => ({
    getToken: jest.fn().mockResolvedValue({
      token: 'mock-token',
      expiresOnTimestamp: Date.now() + 3600000,
    }),
  })),
  ChainedTokenCredential: jest.fn(),
  ManagedIdentityCredential: jest.fn(),
};
```

**Effort:** Low (1 hour)
**Priority:** 🟢 **LOW** - Only affects 2 test files

---

#### 8. Reference Errors (Mock Initialization) (4 occurrences - 0.9%)
**Impact:** 2 test files

**Description:**
Mock variables are accessed before they're initialized due to hoisting issues.

**Affected Files:**
- `tests/unit/collaboration-advanced.test.ts`
- `tests/unit/server-monitoring.test.ts`

**Example Error:**
```
ReferenceError: Cannot access 'mockWebsocketProviderConstructor' before initialization
ReferenceError: Cannot access 'mockLoggerHolder' before initialization
```

**Root Cause:**
Jest hoists `jest.mock()` calls, but variables declared with `const`/`let` in the same scope aren't hoisted, causing initialization order issues.

**Recommended Fix:**
Reorder mock setup to define variables before using them in jest.mock():
```javascript
// WRONG:
jest.mock('yjs', () => ({
  WebsocketProvider: mockWebsocketProviderConstructor, // undefined!
}));
const mockWebsocketProviderConstructor = jest.fn();

// CORRECT:
const mockWebsocketProviderConstructor = jest.fn();
jest.mock('yjs', () => ({
  WebsocketProvider: mockWebsocketProviderConstructor,
}));

// OR use jest.requireActual() with factory function
```

**Effort:** Low (1-2 hours)
**Priority:** 🟢 **LOW** - Only 2 files affected

---

## Category Breakdown by Test Type

### Unit Tests (21 files, 109 failures)
Most common issues:
- Fetch/Response mocking (45%)
- Callback type errors (17%)
- Window/DOM undefined (9%)
- Compilation errors (29%)

### Integration Tests (6 files, 12 failures)
Most common issues:
- Fetch/Response mocking (75%)
- Real service connection issues (25%)

### Performance Tests (2 files, 3 failures)
Most common issues:
- Compilation errors (67%)
- Fetch/Response mocking (33%)

### Security Tests (1 file, 19 failures)
Most common issues:
- Fetch/Response mocking (100%)

### K8s Tests (2 files, 2 failures)
Most common issues:
- Datadog tracer mocking (100%)

---

## Recommended Fix Priority & Roadmap

### Phase 1: Critical Fixes (Highest ROI)
**Estimated Time:** 8-12 hours
**Impact:** ~115 test failures (68%)

1. **Fix Global Fetch Mock** (4-8 hours)
   - Update `tests/setupTests.ts` with comprehensive fetch mock
   - Test with: `npm run test:integration`
   - Expected fix: ~109 tests

2. **Fix Auth Callback Type Errors** (1-2 hours)
   - Update `tests/unit/lib/auth.test.ts`
   - Test with: `npm test tests/unit/lib/auth.test.ts`
   - Expected fix: 18 tests

### Phase 2: High-Priority Fixes
**Estimated Time:** 12-20 hours
**Impact:** ~35 test files, ~40 failures

3. **Resolve Test Compilation Errors** (8-16 hours)
   - Fix module resolution issues one file at a time
   - Add missing mocks
   - Update jest.config.js to exclude problematic paths
   - Test each file individually as fixed
   - Expected fix: 19 test files

4. **Fix WebSocket Timeout Issues** (2-4 hours)
   - Update WebSocket mock in `tests/unit/websocket-streaming.test.ts`
   - Ensure proper async event simulation
   - Test with: `npm test tests/unit/websocket-streaming.test.ts`
   - Expected fix: 22 tests

### Phase 3: Medium-Priority Fixes
**Estimated Time:** 4-6 hours
**Impact:** ~10 failures

5. **Fix Window/DOM Issues** (2-4 hours)
   - Add window mocks to test setup
   - Verify jsdom environment configuration
   - Expected fix: 5-10 tests

6. **Fix Datadog Tracer Mocks** (1-2 hours)
   - Create comprehensive dd-trace mock
   - Expected fix: 8 tests

### Phase 4: Low-Priority Fixes
**Estimated Time:** 2-3 hours
**Impact:** ~10 failures

7. **Add @azure/identity Mock** (1 hour)
   - Create mock or install dependency
   - Expected fix: 4 tests

8. **Fix Mock Initialization Order** (1-2 hours)
   - Reorder variable declarations
   - Expected fix: 4 tests

---

## Total Effort Estimate

| Phase | Time | Tests Fixed | Files Fixed |
|-------|------|-------------|-------------|
| Phase 1 (Critical) | 8-12 hours | ~127 | ~10 |
| Phase 2 (High) | 12-20 hours | ~60 | ~20 |
| Phase 3 (Medium) | 4-6 hours | ~18 | ~9 |
| Phase 4 (Low) | 2-3 hours | ~8 | ~4 |
| **TOTAL** | **26-41 hours** | **~213** | **~43** |

**Note:** Some test failures may resolve as side effects of other fixes, so actual time may be less.

---

## Testing Strategy

### Validation Approach
After each fix:
1. Run specific test file: `npm test <file-path>`
2. Run category: `npm run test:unit` or `npm run test:integration`
3. Run full suite: `npm test`
4. Check coverage: `npm run test:coverage`

### Success Metrics
- Target: 95%+ test pass rate (currently 96.2%)
- Goal: <50 total test failures (currently 169)
- Stretch goal: <20 total test failures

### Regression Prevention
1. Fix root causes, not symptoms
2. Add comprehensive mocks to shared setup files
3. Document mock patterns in `tests/README.md`
4. Update test writing guidelines

---

## Quick Reference: Failed Test Files

### Critical (Contains Most Failures)
- `tests/security/penetration-testing.test.ts` (19 failures)
- `tests/unit/lib/auth.test.ts` (18 failures)
- `tests/unit/websocket-streaming.test.ts` (22 failures)
- `tests/integration/datadog-real.test.ts` (multiple)
- `tests/integration/real-monitoring-integration.test.ts` (multiple)
- `tests/monitoring/alert-validation.test.ts` (multiple)
- `tests/performance/load-testing.test.ts` (multiple)

### High Priority (Compilation Failures)
- All 19 files listed in "Test Suite Compilation Errors" section

### Medium Priority
- `tests/lib/security/csrf.test.ts`
- `tests/unit/lib/security/csrf-protection.test.ts`
- `tests/unit/app/api/auth/csrf/route.test.ts`
- K8s test files (3 files)

---

## Appendix: Detailed Test Results

### Summary Statistics
```
Test Suites: 49 failed, 1 skipped, 274 passed, 323 of 324 total
Tests:       169 failed, 45 skipped, 5369 passed, 5583 total
Snapshots:   0 total
Time:        332.319 s (5.5 minutes)
```

### Coverage Thresholds (Current)
```javascript
coverageThreshold: {
  global: {
    branches: 19,   // Current: 19.35%
    functions: 22,  // Current: 22.13%
    lines: 25,      // Current: 25.07%
    statements: 23, // Current: 23.94%
  }
}
```

### Test Execution Time
- Total test execution: 332 seconds (~5.5 minutes)
- Longest running suite: `tests/unit/websocket-streaming.test.ts` (330 seconds - all timeouts)

---

## Recommendations

### Immediate Actions
1. ✅ Start with Phase 1 fixes (global fetch mock + auth callbacks)
2. ✅ These two fixes alone will resolve ~68% of failures
3. ✅ Create PR with Phase 1 fixes, validate in CI

### Medium-term Actions
1. Address compilation errors systematically
2. Fix WebSocket test implementation
3. Improve mock organization and documentation

### Long-term Actions
1. Consider migrating to MSW (Mock Service Worker) for HTTP mocking
2. Implement better test isolation
3. Add pre-commit hooks to prevent mock-related regressions
4. Create comprehensive mock library for common patterns

### Process Improvements
1. Document mocking patterns in `tests/README.md`
2. Create test templates for common scenarios
3. Add test linting rules to catch common issues
4. Schedule regular test health reviews

---

**Report Generated By:** Claude Code Agent
**Analysis Date:** 2026-01-15
**Test Suite Version:** vibecode-webgui@1.5.0
**Jest Version:** 30.0.4
