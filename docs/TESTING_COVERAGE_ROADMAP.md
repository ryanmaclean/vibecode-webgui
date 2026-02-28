# VibeCode Test Coverage Improvement Roadmap

This document outlines the strategic plan for improving test coverage from the current baseline (~34%) to the target of 80% across all critical code paths.

## Executive Summary

**Current Status (as of 2026-02-28):**
- Lines: 33.97% (24,152 / 71,081)
- Statements: 33.71% (25,158 / 74,616)
- Functions: 33.53% (5,035 / 15,013)
- Branches: 27.83% (13,170 / 47,307)

**Target Goal:**
- All metrics: 80%

**Estimated Timeline:**
- Phase 1 (Foundational): 2-3 weeks
- Phase 2 (Integration): 3-4 weeks
- Phase 3 (Edge Cases): 2-3 weeks
- Phase 4 (Refinement): 1-2 weeks
- **Total: 8-12 weeks**

## Coverage Analysis

### Current Gaps by Area

Based on the coverage summary analysis, the following areas require focused attention:

#### 1. Frontend/UI Components (0-50% coverage)

**Critical Files:**
- `src/app/layout.tsx` - 0% coverage
- `src/app/page.tsx` - 0% coverage
- `src/app/providers.tsx` - 0% coverage
- `src/middleware.ts` - 3.44% coverage
- `src/app/ai/agents/page.tsx` - 50.79% coverage

**Estimated Impact:** +15-20% overall coverage

#### 2. API Routes (0-60% coverage)

**Critical Files:**
- `src/app/api/agents/confirmations/` - 0% coverage
- `src/app/api/agent-builder/session/` - 0% coverage
- `src/app/api/ai/chat/route.ts` - 60.62% coverage

**Estimated Impact:** +10-15% overall coverage

#### 3. Infrastructure & Instrumentation (0-70% coverage)

**Critical Files:**
- `src/instrumentation.ts` - 0% coverage
- `src/instrument.ts` - 66.12% coverage
- Monitoring and observability modules

**Estimated Impact:** +8-12% overall coverage

#### 4. Library/Utility Functions

**Areas Needing Attention:**
- Vector database utilities
- Agent orchestration logic
- RAG system components
- Kubernetes integration

**Estimated Impact:** +12-18% overall coverage

## Phase 1: Foundational Coverage (Target: 50%)

**Timeline:** 2-3 weeks
**Goal:** Establish comprehensive unit test coverage for core functionality

### Week 1-2: Frontend Component Testing

#### Actions:
1. **Set up React Testing Library infrastructure**
   - Configure test environment for Next.js App Router
   - Add mock providers for context/state management
   - Create test utilities for common patterns

2. **Test critical page components**
   - [ ] `src/app/layout.tsx` - Root layout and providers
   - [ ] `src/app/page.tsx` - Homepage rendering
   - [ ] `src/app/providers.tsx` - Context providers
   - [ ] `src/app/ai/layout.tsx` - AI section layout

3. **Test API route handlers**
   - [ ] Agent CRUD operations
   - [ ] Confirmation workflow endpoints
   - [ ] Chat API streaming endpoints

**Example Test Pattern:**

```typescript
// tests/unit/app/layout.test.tsx
import { render } from '@testing-library/react';
import RootLayout from '@/app/layout';

describe('RootLayout', () => {
  it('should render children with providers', () => {
    const { getByTestId } = render(
      <RootLayout>
        <div data-testid="child">Test</div>
      </RootLayout>
    );
    expect(getByTestId('child')).toBeInTheDocument();
  });

  it('should include metadata configuration', () => {
    // Test metadata exports
  });
});
```

### Week 2-3: API Layer Testing

#### Actions:
1. **Mock Next.js request/response objects**
   - Create test helpers for NextRequest/NextResponse
   - Mock authentication/session handling
   - Create fixtures for common request patterns

2. **Test API routes with edge cases**
   - Happy path scenarios
   - Error handling (400, 401, 403, 404, 500)
   - Input validation
   - Rate limiting behavior

3. **Integration with backend services**
   - Mock external service calls
   - Test service layer integration
   - Verify error propagation

**Example Test Pattern:**

```typescript
// tests/unit/app/api/agents/route.test.ts
import { POST } from '@/app/api/agents/[id]/stop/route';
import { NextRequest } from 'next/server';

describe('POST /api/agents/:id/stop', () => {
  it('should stop a running agent', async () => {
    const req = new NextRequest('http://localhost/api/agents/123/stop', {
      method: 'POST',
    });

    const response = await POST(req, { params: { id: '123' } });
    expect(response.status).toBe(200);
  });

  it('should return 404 for non-existent agent', async () => {
    const req = new NextRequest('http://localhost/api/agents/999/stop', {
      method: 'POST',
    });

    const response = await POST(req, { params: { id: '999' } });
    expect(response.status).toBe(404);
  });
});
```

### Expected Outcome
- Overall coverage: **~50%**
- All critical page components tested
- All API routes have basic tests
- Test infrastructure fully operational

## Phase 2: Integration & Service Layer (Target: 65%)

**Timeline:** 3-4 weeks
**Goal:** Add integration tests for service interactions and infrastructure

### Week 4-5: Service Layer Testing

#### Actions:
1. **Agent orchestration services**
   - [ ] Agent lifecycle management
   - [ ] Agent state transitions
   - [ ] Agent communication patterns

2. **RAG system components**
   - [ ] Vector database operations
   - [ ] Embedding generation
   - [ ] Retrieval and ranking
   - [ ] Context assembly

3. **Monitoring and observability**
   - [ ] Instrumentation modules
   - [ ] Datadog integration
   - [ ] Error tracking
   - [ ] Performance metrics

**Example Test Pattern:**

```typescript
// tests/integration/services/agent-orchestrator.test.ts
import { AgentOrchestrator } from '@/lib/services/agent-orchestrator';
import { mockRedis, mockPostgres } from '@/tests/helpers/mocks';

describe('AgentOrchestrator Integration', () => {
  let orchestrator: AgentOrchestrator;

  beforeEach(() => {
    orchestrator = new AgentOrchestrator({
      redis: mockRedis,
      db: mockPostgres,
    });
  });

  it('should create and start an agent', async () => {
    const agent = await orchestrator.createAgent({
      type: 'coder',
      config: { /* ... */ },
    });

    expect(agent.id).toBeDefined();
    expect(agent.status).toBe('running');
  });
});
```

### Week 6-7: Infrastructure Integration Tests

#### Actions:
1. **Database operations**
   - PostgreSQL with pgvector
   - MongoDB chat storage
   - Redis caching layer

2. **Kubernetes integration**
   - Pod lifecycle management
   - Service discovery
   - Resource management

3. **Docker operations**
   - Container lifecycle
   - Image management
   - Network configuration

### Expected Outcome
- Overall coverage: **~65%**
- All service layers tested
- Integration tests passing consistently
- Infrastructure dependencies mocked appropriately

## Phase 3: Edge Cases & Error Handling (Target: 75%)

**Timeline:** 2-3 weeks
**Goal:** Comprehensive error handling and edge case coverage

### Week 8-9: Error Scenarios

#### Actions:
1. **Error boundary testing**
   - React error boundaries
   - API error handlers
   - Service-level error handling

2. **Edge case scenarios**
   - Empty states
   - Maximum limits
   - Concurrent operations
   - Race conditions

3. **Security testing**
   - Input validation
   - Authentication/authorization
   - CSRF protection
   - XSS prevention

**Example Test Pattern:**

```typescript
// tests/unit/app/api/error-handling.test.ts
describe('API Error Handling', () => {
  it('should handle malformed JSON gracefully', async () => {
    const req = new NextRequest('http://localhost/api/agents', {
      method: 'POST',
      body: 'invalid json',
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: 'Invalid request body',
    });
  });
});
```

### Week 9-10: Branch Coverage Improvement

#### Actions:
1. **Identify low-coverage branches**
   - Run coverage report with branch details
   - Prioritize by criticality
   - Create targeted tests

2. **Test conditional logic**
   - All if/else branches
   - Switch statements
   - Ternary operators
   - Optional chaining

3. **Test async error paths**
   - Promise rejections
   - Timeout scenarios
   - Network failures

### Expected Outcome
- Overall coverage: **~75%**
- Branch coverage significantly improved
- All error paths tested
- Edge cases documented

## Phase 4: Refinement & Optimization (Target: 80%)

**Timeline:** 1-2 weeks
**Goal:** Reach 80% target and establish maintainability practices

### Week 11: Coverage Gap Analysis

#### Actions:
1. **Generate detailed coverage report**
   ```bash
   npm run test:coverage
   open coverage/lcov-report/index.html
   ```

2. **Identify remaining gaps**
   - Sort files by coverage percentage
   - Focus on files with 50-80% coverage
   - Identify uncovered lines in critical paths

3. **Prioritize remaining work**
   - High-impact, low-effort improvements first
   - Critical security/business logic
   - User-facing features

### Week 12: Final Push & Documentation

#### Actions:
1. **Write missing tests**
   - Target files below 80%
   - Focus on critical business logic
   - Add integration scenarios

2. **Update test documentation**
   - Document test patterns
   - Create testing guidelines
   - Update TESTING_GUIDE.md

3. **Configure coverage enforcement**
   - Update jest.config.js thresholds
   - Configure pre-commit hooks
   - Set up CI coverage checks

### Expected Outcome
- Overall coverage: **80%+**
- Coverage thresholds enforced
- Documentation complete
- Team trained on testing practices

## Coverage Enforcement Strategy

### Progressive Threshold Updates

Update `jest.config.js` coverage thresholds incrementally:

**Current (Baseline):**
```javascript
coverageThreshold: {
  global: {
    branches: 25,
    functions: 30,
    lines: 30,
    statements: 30,
  },
},
```

**After Phase 1 (Week 3):**
```javascript
coverageThreshold: {
  global: {
    branches: 40,
    functions: 45,
    lines: 48,
    statements: 48,
  },
},
```

**After Phase 2 (Week 7):**
```javascript
coverageThreshold: {
  global: {
    branches: 55,
    functions: 60,
    lines: 63,
    statements: 63,
  },
},
```

**After Phase 3 (Week 10):**
```javascript
coverageThreshold: {
  global: {
    branches: 68,
    functions: 72,
    lines: 73,
    statements: 73,
  },
},
```

**Final Target (Week 12):**
```javascript
coverageThreshold: {
  global: {
    branches: 80,
    functions: 80,
    lines: 80,
    statements: 80,
  },
},
```

### Per-Directory Thresholds

Consider setting stricter thresholds for critical areas:

```javascript
coverageThreshold: {
  global: {
    branches: 80,
    functions: 80,
    lines: 80,
    statements: 80,
  },
  './src/lib/': {
    branches: 85,
    functions: 85,
    lines: 85,
    statements: 85,
  },
  './src/app/api/': {
    branches: 90,
    functions: 90,
    lines: 90,
    statements: 90,
  },
},
```

## Testing Best Practices

### 1. Test Organization

```
tests/
├── unit/                    # Pure unit tests (no I/O)
│   ├── app/                # Next.js app directory tests
│   ├── lib/                # Library/utility tests
│   └── components/         # React component tests
├── integration/            # Integration tests (require infrastructure)
│   ├── api/               # API integration tests
│   ├── services/          # Service integration tests
│   └── database/          # Database integration tests
└── e2e/                   # End-to-end tests
    └── flows/             # User flow tests
```

### 2. Naming Conventions

- Test files: `*.test.ts` or `*.test.tsx`
- Test suites: Describe the module/component being tested
- Test cases: Start with "should" for clarity

```typescript
describe('UserService', () => {
  describe('createUser', () => {
    it('should create a new user with valid data', () => {});
    it('should throw an error for duplicate email', () => {});
    it('should validate required fields', () => {});
  });
});
```

### 3. Test Data Management

- Use factories for test data creation
- Keep fixtures in `tests/fixtures/`
- Use `faker` for random but realistic data

```typescript
// tests/factories/user.factory.ts
import { faker } from '@faker-js/faker';

export const createUserData = (overrides = {}) => ({
  email: faker.internet.email(),
  name: faker.person.fullName(),
  role: 'user',
  ...overrides,
});
```

### 4. Mocking Strategy

- Mock external dependencies (APIs, databases)
- Use `jest.mock()` for module mocking
- Use `jest.spyOn()` for method spying
- Clear mocks between tests

```typescript
import { jest } from '@jest/globals';

jest.mock('@/lib/services/email-service', () => ({
  sendEmail: jest.fn().mockResolvedValue({ success: true }),
}));
```

### 5. Async Testing Patterns

```typescript
// Using async/await (preferred)
it('should fetch user data', async () => {
  const user = await userService.getUser('123');
  expect(user).toBeDefined();
});

// Testing promises
it('should reject with error', () => {
  return expect(userService.getUser('invalid'))
    .rejects
    .toThrow('User not found');
});

// Testing callbacks
it('should call callback with data', (done) => {
  userService.getUser('123', (err, user) => {
    expect(err).toBeNull();
    expect(user).toBeDefined();
    done();
  });
});
```

### 6. Coverage Quality Over Quantity

**Good Coverage:**
- Tests verify behavior, not implementation
- Tests are readable and maintainable
- Tests catch real bugs
- Tests document expected behavior

**Bad Coverage:**
- Tests just call functions without assertions
- Tests tightly coupled to implementation
- Tests that always pass
- Snapshot tests without review

## Monitoring & Reporting

### CI/CD Integration

1. **Run coverage on every PR:**
   ```yaml
   # .github/workflows/test.yml
   - name: Run tests with coverage
     run: npm run test:coverage

   - name: Upload coverage to Codecov
     uses: codecov/codecov-action@v3
     with:
       files: ./coverage/lcov.info
   ```

2. **Enforce minimum thresholds:**
   - Fail CI if coverage drops below threshold
   - Require coverage report on PR comments
   - Block merge if coverage decreases

3. **Track coverage trends:**
   - Use Codecov, Coveralls, or similar
   - Set up Datadog dashboard for coverage metrics
   - Review coverage in team retrospectives

### Weekly Progress Tracking

Create a weekly coverage report:

```bash
#!/bin/bash
# scripts/weekly-coverage-report.sh

npm run test:coverage -- --json --outputFile=coverage/coverage.json

echo "# Weekly Coverage Report - $(date +%Y-%m-%d)" > weekly-coverage.md
echo "" >> weekly-coverage.md
node scripts/generate-coverage-summary.js >> weekly-coverage.md
```

### Coverage Dashboard

Track progress with key metrics:

- **Overall coverage percentage** (all metrics)
- **Coverage trend** (week-over-week change)
- **Files below threshold** (prioritization list)
- **Test execution time** (performance monitoring)
- **Test stability** (flakiness detection)

## Common Challenges & Solutions

### Challenge 1: Testing Next.js App Router

**Problem:** App Router components use server components and new patterns

**Solution:**
- Use `@testing-library/react` with Next.js test utilities
- Mock Next.js modules (`next/navigation`, `next/headers`)
- Test client components separately from server components

### Challenge 2: Testing API Routes

**Problem:** Next.js route handlers have unique signature

**Solution:**
- Create test helpers for NextRequest/NextResponse
- Mock authentication middleware
- Test routes in isolation with mocked dependencies

### Challenge 3: Async Testing Complexity

**Problem:** Lots of async code with promises, streams, and callbacks

**Solution:**
- Use `async/await` consistently
- Set appropriate timeouts for slow tests
- Use `jest.useFakeTimers()` for time-dependent code

### Challenge 4: Flaky Tests

**Problem:** Tests pass/fail inconsistently

**Solution:**
- Identify and fix race conditions
- Use proper async waiting (avoid `setTimeout`)
- Clean up resources in `afterEach` hooks
- Run tests multiple times to identify flakiness

### Challenge 5: Slow Test Suite

**Problem:** Tests take too long to run

**Solution:**
- Parallelize test execution
- Use `test:unit` for fast feedback loop
- Move slow tests to integration suite
- Optimize test setup/teardown
- Consider test sharding for CI

## Resources & Tools

### Documentation
- [Jest Documentation](https://jestjs.io/)
- [React Testing Library](https://testing-library.com/react)
- [Next.js Testing](https://nextjs.org/docs/app/building-your-application/testing)
- [VibeCode Testing Guide](./tests/TESTING_GUIDE.md)

### Tools
- **Coverage Analysis:** `npm run test:coverage`
- **Coverage Visualization:** Open `coverage/lcov-report/index.html`
- **Watch Mode:** `npm run test:watch`
- **Debugging:** `node --inspect-brk node_modules/.bin/jest`

### Libraries
- `@testing-library/react` - React component testing
- `@testing-library/jest-dom` - DOM matchers
- `@testing-library/user-event` - User interaction simulation
- `msw` - API mocking
- `@faker-js/faker` - Test data generation

## Success Metrics

### Primary Metrics
- [ ] Overall line coverage ≥ 80%
- [ ] Overall statement coverage ≥ 80%
- [ ] Overall function coverage ≥ 80%
- [ ] Overall branch coverage ≥ 80%

### Secondary Metrics
- [ ] Zero tolerance for coverage regression
- [ ] Test execution time < 5 minutes for unit tests
- [ ] Test flakiness rate < 1%
- [ ] All critical paths have integration tests
- [ ] All API endpoints have tests

### Process Metrics
- [ ] 100% of new PRs include tests
- [ ] Coverage reports on all PRs
- [ ] Weekly coverage review in team meeting
- [ ] Testing guidelines documented
- [ ] Team trained on testing practices

## Next Steps

1. **Week 1:** Begin Phase 1 - Frontend component testing
2. **Set up tracking:** Configure coverage dashboard and reporting
3. **Team alignment:** Review roadmap with team, assign owners
4. **Create tickets:** Break down phases into actionable tickets
5. **Establish cadence:** Weekly coverage review meetings

---

**Document Owner:** Testing Infrastructure Team
**Last Updated:** 2026-02-28
**Next Review:** Weekly during coverage improvement initiative
