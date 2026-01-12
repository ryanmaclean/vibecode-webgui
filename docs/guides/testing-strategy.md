# Testing Strategy and Coverage Improvement

This document consolidates testing work from Waves 9-10 and provides guidance for continued test expansion.

## Current Status

**As of Wave 10 (AGENT 91)**:
- **Total Tests**: 4,565 (up from 4,243 at start of Wave 9)
- **Coverage**: 23.5% lines (up from 22.66% at start of Wave 9)
- **Passing Rate**: 97.4% (4,453 passing, 12 failing, 44 skipped, 56 todos)
- **Test Suites**: 264 total (255 passing, 9 failing)

## Coverage Journey

### Wave 9: AGENT 86 (CoverageImprovementEngineer)
**Goal**: 22.66% → 25-30%
**Achievement**: 22.66% → 23.06% (+0.40%)

**Tests Added**: 87 new tests across 6 files
**Focus Areas**:
- Monitoring APIs (RUM, performance, web vitals, page load): 90-95% coverage
- File security validation: 85% coverage
- Local cache fallback: 95% coverage

**Files Created**:
- `tests/integration/monitoring/rum-route.test.ts` (18 tests)
- `tests/integration/monitoring/performance-route.test.ts` (12 tests)
- `tests/integration/monitoring/web-vitals-route.test.ts` (14 tests)
- `tests/integration/monitoring/page-load-route.test.ts` (11 tests)
- `tests/unit/utils/security/file-validation.test.ts` (21 tests)
- `tests/unit/utils/caching/local-cache-fallback.test.ts` (11 tests)

**Grade**: B+ (High-quality tests, comprehensive coverage of critical paths, but missed stretch goal)

### Wave 10: AGENT 91 (CoverageExpander)
**Goal**: 23.06% → 25%
**Achievement**: 23.06% → 23.5% (+0.44%)

**Tests Added**: 106 new tests across 7 files
**Focus Areas**:
- Health check endpoints (overview, database, cache, AI): 59 tests
- AI utilities (SSE decoder, stream utilities): 47 tests

**Files Created**:
- `tests/unit/api/health/overview/route.test.ts` (17 tests)
- `tests/unit/api/health/database/route.test.ts` (23 tests) - **12 failing**
- `tests/unit/api/health/cache/route.test.ts` (8 tests)
- `tests/unit/api/health/ai/route.test.ts` (11 tests)
- `tests/unit/utils/ai/sse-decoder.test.ts` (16 tests)
- `tests/unit/utils/ai/stream-utils.test.ts` (19 tests)
- `tests/unit/utils/ai/prompt-manager.test.ts` (12 tests)

**Grade**: B (Solid work, comprehensive tests, but target missed and 12 tests failing)

## Path to 25% Coverage

**Current**: 23.5% | **Target**: 25% | **Gap**: 1.5%

### Recommended Next Targets (from AGENT 91)

1. **Prompt Manager Tests** (+0.3% estimated)
   - Effort: 2-3 hours
   - Files: `src/app/api/ai/utils/prompt-manager.ts`
   - Tests needed: Template loading, validation, variable substitution

2. **Vector Search Tests** (+0.4% estimated)
   - Effort: 3-4 hours
   - Files: `src/app/api/ai/vector-search/*.ts`
   - Tests needed: Embedding generation, similarity search, chunking

3. **Remaining Health Routes** (+0.3% estimated)
   - Effort: 2-3 hours
   - Files: `/api/health/network`, `/api/health/disk`
   - Tests needed: Happy paths, error handling

4. **AI Provider Tests** (+0.5% estimated)
   - Effort: 4-5 hours
   - Files: `src/app/api/ai/providers/*.ts`
   - Tests needed: Provider initialization, fallback logic, rate limiting

**Total Estimated Effort**: 11-15 hours to reach 25%

## Known Issues

### Active Blockers

1. **12 Database Health Tests Failing** (CRITICAL - P1)
   - File: `tests/unit/api/health/database/route.test.ts`
   - Root Cause: Strict Zod validation in test assertions
   - Impact: Blocks CI green status
   - Effort: 1-2 hours
   - Fix: Investigate Zod schema mismatches, adjust test expectations

2. **44 Tests Intentionally Skipped**
   - Infrastructure-gated tests (require real database, Redis, etc.)
   - Expected behavior, not a blocker

## AI Endpoint Testing (Wave 10: AGENT 90)

### Coverage Summary
**Tests Added**: 74 comprehensive tests across 4 critical AI endpoints
**Coverage Per Endpoint**: 88-95%
**Grade**: A (Exceeded expectations)

### Endpoints Tested

| Endpoint | Tests | Coverage | Status |
|----------|-------|----------|--------|
| `/api/ai/chat` | 15 | 88% | ✅ All passing |
| `/api/ai/chat/stream` | 29 | 95% | ✅ All passing |
| `/api/ai/provider-health` | 17 | 90% | ✅ All passing |
| `/api/ai/model-selection` | 13 | 92% | ✅ All passing |

### Test Characteristics
- **Execution Time**: 3.28 seconds (fast)
- **Mocking**: 100% mocked (no real API calls)
- **Test Types**: Happy paths, error handling, edge cases, validation
- **Mock Files**: `tests/__mocks__/ai-providers.ts` (comprehensive provider mocks)

### Untested AI Endpoints (Future Work)
- `/api/ai/function-call` - Function calling and tool use
- `/api/ai/upload` - File upload handling
- `/api/ai/generate-project` - Project scaffolding

## Testing Best Practices

### Test Structure
```typescript
describe('Feature/Endpoint Name', () => {
  describe('Happy Paths', () => {
    it('should handle valid input correctly', () => {
      // Test valid scenarios
    });
  });

  describe('Error Handling', () => {
    it('should return 400 for invalid input', () => {
      // Test error cases
    });
  });

  describe('Edge Cases', () => {
    it('should handle boundary conditions', () => {
      // Test edge cases
    });
  });
});
```

### Mocking Strategy
- **AI Providers**: Mock all external API calls (OpenRouter, OpenAI, Anthropic)
- **Databases**: Use in-memory implementations or mocks
- **Network Requests**: Mock with `jest.mock()` or `nock`
- **File System**: Mock fs operations

### Coverage Targets
- **Critical Paths**: 90%+ (monitoring, security, authentication)
- **Business Logic**: 80%+ (AI, data processing)
- **Utilities**: 70%+ (helpers, formatters)
- **Overall Project**: 25% (current), 30% (6-month goal)

## Test Performance

### Baseline (Wave 9 start)
- **Total Time**: ~2m 30s
- **Parallelization**: Limited

### After AGENT 87 Optimizations
- **Total Time**: ~2m 20s (-6.3%)
- **Improvements**:
  - Jest parallelization enabled
  - Custom test sequencer (fast tests first)
  - Optimized setup/teardown
  - Reduced module loading overhead

## CI/CD Integration

### GitHub Actions Workflow
- **Trigger**: Pull requests, push to main
- **Test Command**: `npm test --coverage`
- **Coverage Thresholds**:
  - Lines: 23%
  - Branches: 18%
  - Functions: 20%
  - Statements: 23%

### Coverage Reporting
- **Tool**: Jest with `coverage-summary.json`
- **Reports**: HTML, JSON, LCOV
- **Location**: `.coverage/` directory

## Next Steps

### Wave 11 Priorities (from AGENT 93)

1. **Fix 12 Failing Tests** (P1 - CRITICAL)
   - Time: 1-2 hours
   - Blocker for CI green status

2. **Reach 25% Coverage** (P2 - HIGH)
   - Time: 11-15 hours
   - Follow recommended targets above

3. **Test Remaining AI Endpoints** (P3 - MEDIUM)
   - `/api/ai/function-call`
   - `/api/ai/upload`
   - `/api/ai/generate-project`
   - Time: 6-8 hours

## References

- [Wave 9 Comprehensive Hardening Report](../sessions/wave-09-comprehensive-hardening.md)
- [Wave 10 Validation & Foundation Report](../sessions/wave-10-validation-foundation.md)
- [AI API Documentation](../api/ai-endpoints.md)
- [Performance Optimization Guide](./performance-optimization.md)

---

*Last Updated: Wave 10 (AGENT 94) - 2026-01-12*
