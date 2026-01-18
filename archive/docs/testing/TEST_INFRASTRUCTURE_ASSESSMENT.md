# Test Infrastructure Assessment

**Assessment Date**: 2025-10-01
**Assessor**: Testing & CI/CD Engineer
**Related Issues**: #501 (Coverage CI), #496 (Tauri E2E)
**Status**: COMPLETE

---

## Executive Summary

Comprehensive assessment of vibecode-webgui test infrastructure reveals a mature web testing foundation with strategic gaps in desktop application testing and CI coverage tracking. Current state demonstrates 58.89% statement coverage with operational Jest, Playwright, and Bats test suites. Two strategic initiatives identified: (1) CI coverage integration for quality visibility, (2) Tauri E2E testing for desktop application validation.

**Overall Health**: GOOD
**Strategic Gaps**: 2 (Coverage CI, Tauri E2E)
**Recommendation**: Proceed with planned enhancements per issue #501 and #496

---

## 1. Current Test Infrastructure

### 1.1 Test Framework Matrix

| Framework | Purpose | Status | Test Count | CI Integration |
|-----------|---------|--------|------------|----------------|
| **Jest** | Unit & Integration | ✅ Operational | ~100+ files | ✅ main-branch-ci.yml |
| **Playwright** | Web E2E | ✅ Operational | 18 specs | ✅ Configurable |
| **Bats** | Shell Scripts | ✅ Operational | 12 cases | ✅ main-branch-ci.yml |
| **Testing Library** | React Components | ✅ Operational | Integrated with Jest | ✅ Via Jest |
| **Axe-core** | Accessibility | ✅ Operational | Via Playwright | ✅ Via Playwright |
| **MSW** | API Mocking | ✅ Available | Dev dependency | N/A (test utility) |
| **Supertest** | API Testing | ✅ Available | Dev dependency | ✅ Integration tests |
| **Testcontainers** | Integration | ✅ Available | Dev dependency | Limited usage |

**Assessment**: Comprehensive test framework coverage for web application testing. No gaps in framework availability.

### 1.2 Test Coverage Baseline

**Current Coverage** (2025-10-01):
```
Statements   : 58.89% (threshold: 55%)
Branches     : 38.06% (threshold: 35%)
Functions    : 62.17% (threshold: 60%)
Lines        : 59.68% (threshold: 55%)
```

**Coverage Status**: ✅ ALL THRESHOLDS MET

**Coverage Configuration**:
- **Jest Config**: `/Users/ryan.maclean/vibecode-webgui/jest.config.mjs`
- **Test Environment**: jsdom (browser simulation)
- **Coverage Output**: `coverage/lcov.info`, `coverage/coverage-summary.json`
- **Coverage Ignore**: Minimal (no major exclusions)

**Analysis**:
- Statement coverage solid at 58.89% (3.89% above threshold)
- Branch coverage weakest at 38.06% (3.06% above threshold)
- Function coverage strongest at 62.17% (2.17% above threshold)
- All metrics exceeding thresholds indicates quality baseline established

**Coverage Trends**: Not tracked (no historical data available - gap identified)

### 1.3 Test Organization

**Directory Structure**:
```
tests/
├── __mocks__/                    # Mock implementations
├── accessibility/                # Accessibility tests
├── api/                          # API tests
├── complete/                     # Complete workflow tests
├── e2e/                          # Playwright E2E tests (18 specs)
│   ├── accessibility.test.ts
│   ├── ai-features.test.ts
│   ├── auth-flow.test.ts
│   ├── critical-user-journeys.test.ts
│   ├── health-check.spec.ts
│   ├── mcp-integration.spec.ts
│   └── ... (12 more specs)
├── integration/                  # Integration tests
├── unit/                         # Unit tests (~100+ files)
├── scripts/                      # Bats shell script tests
├── jest.polyfills.js             # Test polyfills
├── jest.setup.js                 # Test setup
└── [additional test files]       # Root-level tests
```

**Organization Quality**: ✅ GOOD
- Clear separation between test types (unit, integration, e2e)
- Logical grouping by feature area
- Consistent naming conventions

**Playwright E2E Test Coverage**:
- Accessibility compliance (WCAG 2.1 AA)
- AI features integration
- Authentication flows
- Critical user journeys
- Health checks
- MCP integration
- Enhanced chat features
- API testing

**Assessment**: Comprehensive E2E coverage for web application. Gap: No desktop (Tauri) E2E tests.

### 1.4 CI/CD Integration

**Active Workflows**:

1. **main-branch-ci.yml** (Lightweight)
   - ✅ Lint code
   - ✅ Type check
   - ✅ Run unit tests (`npm run test:unit`)
   - ✅ Run Bats script tests (`npm run test:scripts`)
   - ✅ Security checks (npm audit, TruffleHog)
   - ✅ Build validation
   - ❌ **NO coverage collection**
   - ❌ **NO coverage reporting**

2. **ci-simplified.yml** (Full Pipeline)
   - ✅ Code quality checks
   - ✅ Security audit
   - ✅ Lint markdown
   - ✅ Secret scanning
   - ❌ **NO test execution** (relies on main-branch-ci)

3. **release-branch-ci.yml**
   - ✅ Full test suite execution
   - ✅ Performance testing hooks
   - ❌ **NO coverage reporting**

**CI Test Execution**:
```yaml
# main-branch-ci.yml (line 95-99)
- name: Run fast unit tests only
  run: npm run test:unit
  env:
    NODE_ENV: test
    CI: true
```

**Assessment**: Tests execute in CI but coverage not captured or tracked. Strategic gap for visibility and quality gates.

### 1.5 Test Commands

**Available Commands** (from `package.json`):
```bash
# Jest Tests
npm run test                      # All Jest tests
npm run test:watch               # Watch mode
npm run test:coverage            # With coverage
npm run test:unit                # Unit tests only
npm run test:integration         # Integration tests only
npm run test:ws                  # WebSocket tests
npm run test:monitoring          # Monitoring tests
npm run test:security            # Security tests

# Playwright Tests
npm run test:e2e                 # Playwright E2E
npm run test:e2e:headed         # Headed mode
npm run test:e2e:production     # Against production

# Shell Script Tests
npm run test:scripts             # Bats tests

# Special Purpose
npm run test:root                # Root-level tests
npm run test:complete           # Complete workflow
npm run test:k8s                # Kubernetes tests
npm run test:performance        # Performance tests
```

**Assessment**: ✅ Comprehensive test command coverage. Clear separation by test type and purpose.

---

## 2. Identified Gaps & Recommendations

### 2.1 Critical Gap: CI Coverage Tracking

**Issue**: #501 - Integrate Test Coverage Reporting into CI/CD Pipeline

**Current State**:
- ❌ Coverage generated locally only
- ❌ No coverage reports uploaded to tracking service
- ❌ No coverage diff comments on PRs
- ❌ No coverage badges in README
- ❌ No historical coverage data

**Impact**:
- Coverage regressions undetected until local run
- No visibility into coverage trends over time
- New code may reduce overall coverage without detection
- Team lacks coverage awareness during code review

**Recommendation**: **HIGH PRIORITY**
- Implement Codecov integration (free for open source)
- Add coverage upload to `main-branch-ci.yml`
- Enable PR coverage comments
- Configure quality gates (fail if coverage drops >2%)
- Set up coverage trend dashboards

**Plan**: Complete strategy at `docs/testing/COVERAGE_CI_PLAN.md`
**Timeline**: 3 weeks (15 engineering days)
**Risk**: LOW - Additive feature, no breaking changes

### 2.2 Critical Gap: Tauri Desktop Application Testing

**Issue**: #496 - [Tauri] E2E Tests

**Current State**:
- ✅ Tauri application exists (`src-tauri/`)
- ✅ Basic Rust code: `main.rs`, `commands.rs`, `docker.rs`
- ❌ NO Tauri-specific E2E tests
- ❌ NO Docker integration validation
- ❌ NO cross-platform compatibility tests
- ❌ NO IPC command testing

**Impact**:
- Desktop-specific bugs undetected
- Docker integration untested
- Platform-specific issues invisible
- IPC communication failures unvalidated

**Recommendation**: **HIGH PRIORITY**
- Extend Playwright for Tauri desktop testing
- Implement 97 test cases across 5 categories
- Add CI matrix testing (macOS, Windows, Linux)
- Create Rust unit tests for IPC commands
- Validate Docker integration workflows

**Plan**: Complete strategy at `docs/testing/TAURI_E2E_STRATEGY.md`
**Timeline**: 4 weeks (20 engineering days)
**Risk**: MEDIUM - New testing domain, platform-specific challenges

### 2.3 Improvement Opportunity: Branch Coverage

**Current State**:
- Branch coverage: 38.06% (weakest metric)
- 3.06% above threshold (minimal buffer)

**Impact**:
- Conditional logic paths may be untested
- Edge cases potentially unvalidated
- Higher risk of logic errors in production

**Recommendation**: **MEDIUM PRIORITY**
- Focus testing on conditional branches
- Increase branch coverage threshold to 45% (6-month goal)
- Add branch coverage tracking to quality gates
- Identify critical modules with low branch coverage

**Timeline**: Ongoing improvement (parallel to other work)

### 2.4 Enhancement Opportunity: Test Stability

**Current State**:
- No flake rate metrics available
- No explicit retry logic in tests
- No test stability monitoring

**Impact**:
- Flaky tests reduce CI reliability
- Developer confidence in test suite may suffer
- False positives waste engineering time

**Recommendation**: **LOW PRIORITY**
- Measure and track flake rate
- Add retry logic for network-dependent tests
- Implement test stability monitoring
- Target <5% flake rate

**Timeline**: Phase 4 of Tauri E2E strategy (Week 4)

---

## 3. Test Infrastructure Health Score

### 3.1 Scoring Matrix

| Category | Weight | Score | Weighted Score | Notes |
|----------|--------|-------|----------------|-------|
| **Framework Coverage** | 20% | 95/100 | 19.0 | Comprehensive frameworks, no gaps |
| **Test Organization** | 15% | 90/100 | 13.5 | Clear structure, good separation |
| **Coverage Baseline** | 20% | 75/100 | 15.0 | Meets thresholds, branch coverage weak |
| **CI Integration** | 20% | 60/100 | 12.0 | Tests run, but no coverage tracking |
| **Documentation** | 10% | 85/100 | 8.5 | Good docs, could improve Tauri coverage |
| **Test Diversity** | 15% | 70/100 | 10.5 | Strong web tests, missing desktop E2E |

**Overall Score**: **78.5/100** (GOOD)

**Assessment**: Mature test infrastructure with strategic gaps in CI coverage tracking and desktop application testing. Foundation is solid; enhancements will elevate to excellence.

### 3.2 Health Indicators

**Strengths**:
- ✅ Comprehensive test framework availability
- ✅ Clear test organization and separation
- ✅ All coverage thresholds exceeded
- ✅ Active CI integration with test execution
- ✅ Multiple test types (unit, integration, e2e, scripts)
- ✅ Accessibility testing integrated
- ✅ Security testing included

**Weaknesses**:
- ❌ No CI coverage tracking or reporting
- ❌ No desktop (Tauri) E2E tests
- ❌ Branch coverage weakest metric (38.06%)
- ❌ No historical coverage trends
- ❌ No quality gates for coverage regressions

**Opportunities**:
- 🔄 Codecov integration for visibility
- 🔄 Tauri E2E test suite development
- 🔄 Branch coverage improvement campaign
- 🔄 Test stability monitoring

---

## 4. Prioritized Recommendations

### 4.1 Priority 1: CI Coverage Integration (Issue #501)

**Timeline**: Weeks 1-3 (15 days)
**Impact**: HIGH - Enables continuous quality visibility
**Effort**: MEDIUM - Well-defined integration, low complexity
**Risk**: LOW - Additive feature, no breaking changes

**Phases**:
1. Week 1: Codecov setup, workflow integration, badge
2. Week 2: PR comments, status checks, critical module thresholds
3. Week 3: Trend tracking, incremental checks, documentation

**Success Criteria**:
- ✅ Coverage uploaded on every PR
- ✅ Coverage diff visible in PR comments
- ✅ Status checks enforce 2% drop threshold
- ✅ Trend data visible for 30+ days

### 4.2 Priority 2: Tauri E2E Testing (Issue #496)

**Timeline**: Weeks 1-4 (20 days)
**Impact**: HIGH - Validates desktop application functionality
**Effort**: HIGH - New testing domain, 97 test cases
**Risk**: MEDIUM - Platform-specific challenges, new patterns

**Phases**:
1. Week 1: Playwright + Tauri setup, Rust tests, CI integration
2. Week 2: Desktop + Docker tests (41 cases)
3. Week 3: IPC + cross-platform + security tests (56 cases)
4. Week 4: Stability, performance, documentation

**Success Criteria**:
- ✅ 97 test cases passing
- ✅ <5% flake rate
- ✅ <10 minute suite runtime
- ✅ Cross-platform parity

### 4.3 Priority 3: Branch Coverage Improvement

**Timeline**: Ongoing (parallel to other work)
**Impact**: MEDIUM - Reduces logic error risk
**Effort**: MEDIUM - Requires targeted test writing
**Risk**: LOW - Incremental improvement

**Approach**:
- Focus new tests on conditional branches
- Identify low-coverage modules
- Increase threshold to 45% (6-month goal)
- Track improvement in coverage dashboards

**Success Criteria**:
- ✅ Branch coverage ≥45% (6 months)
- ✅ Critical modules ≥75% branch coverage
- ✅ Coverage improvement visible in trends

### 4.4 Priority 4: Test Stability Monitoring

**Timeline**: Week 4 of Tauri E2E (opportunistic)
**Impact**: MEDIUM - Improves CI reliability
**Effort**: LOW - Monitoring and retry logic
**Risk**: LOW - Non-critical enhancement

**Approach**:
- Measure and track flake rate
- Add retry logic for network-dependent tests
- Implement test isolation mechanisms
- Target <5% flake rate

**Success Criteria**:
- ✅ Flake rate tracked and reported
- ✅ <5% flake rate achieved
- ✅ Retry logic documented and tested

---

## 5. Resource Requirements

### 5.1 Engineering Effort

**Total Effort**: 35 engineering days (7 weeks)

| Initiative | Duration | Effort | Parallelizable |
|------------|----------|--------|----------------|
| CI Coverage Integration | 3 weeks | 15 days | Yes |
| Tauri E2E Testing | 4 weeks | 20 days | Partially |
| Branch Coverage Improvement | Ongoing | N/A | Yes |
| Test Stability Monitoring | 1 week | 5 days | Yes (opportunistic) |

**Parallelization Opportunity**: CI Coverage Integration (Issue #501) and Tauri E2E Testing (Issue #496) can run in parallel with minimal coordination required.

### 5.2 Infrastructure Requirements

**Existing Infrastructure** (Sufficient):
- ✅ GitHub Actions runners (Ubuntu, macOS, Windows)
- ✅ Jest, Playwright, Bats frameworks
- ✅ Test coverage tools (Jest built-in)
- ✅ Node.js 22.11.0 environment

**New Infrastructure Required**:
- Codecov account (free for open source)
- CODECOV_TOKEN GitHub secret
- Tauri build artifacts (CI matrix for macOS, Windows, Linux)
- Rust toolchain in CI (already available)

**Cost Estimate**: $0 (leveraging free tier and existing infrastructure)

### 5.3 Team Requirements

**Skills Needed**:
- ✅ Jest testing (existing team knowledge)
- ✅ Playwright E2E testing (existing team knowledge)
- 🔄 Codecov configuration (quick learning curve)
- 🔄 Rust testing (new, training recommended)
- 🔄 Tauri desktop testing (new, research required)

**Training Required**:
- Codecov integration and usage (2 hours)
- Rust testing fundamentals (4 hours)
- Tauri E2E testing patterns (8 hours)
- Coverage quality gate workflows (2 hours)

**Total Training**: 16 hours (2 days)

---

## 6. Risk Assessment

### 6.1 Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Codecov service outage | LOW | MEDIUM | Cache coverage locally, GitHub artifact backup |
| Playwright ↔ Tauri compatibility | MEDIUM | HIGH | Research alternatives, fallback to Rust tests |
| Docker not available in CI | LOW | HIGH | Docker-in-Docker, mock Docker for tests |
| Platform-specific test failures | HIGH | MEDIUM | Matrix testing, platform skip logic |
| Test suite performance degradation | MEDIUM | LOW | Optimize parallelization, test caching |

### 6.2 Process Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Team resistance to coverage requirements | LOW | MEDIUM | Start low thresholds, gradual increases |
| PR delays due to coverage work | MEDIUM | MEDIUM | Allow overrides, focus on critical modules |
| Insufficient Tauri test coverage | MEDIUM | HIGH | Define critical paths upfront, prioritize |
| Flaky Tauri tests | HIGH | MEDIUM | Explicit waits, retry logic, isolation |

### 6.3 Quality Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Coverage inflation without quality | MEDIUM | HIGH | Code review for test quality, branch coverage focus |
| Over-reliance on mocks (Tauri) | LOW | MEDIUM | Test with real Docker where possible |
| Poor test maintainability | MEDIUM | MEDIUM | Clear structure, reusable fixtures, documentation |

**Overall Risk Level**: **MEDIUM** - Manageable with proper planning and mitigation

---

## 7. Success Metrics & KPIs

### 7.1 Coverage Metrics

**Baseline** (2025-10-01):
```
Statements: 58.89%
Branches:   38.06%
Functions:  62.17%
Lines:      59.68%
```

**6-Month Goals**:
```
Statements: 65% (+6.32%)
Branches:   45% (+6.94%)
Functions:  65% (+2.83%)
Lines:      65% (+5.32%)
```

**12-Month Goals**:
```
Statements: 75%
Branches:   60%
Functions:  75%
Lines:      75%
Critical Modules: 90%
```

### 7.2 Test Suite Metrics

**Current**:
- Total test files: ~118 (unit, integration, e2e, scripts)
- E2E test specs: 18 (web only)
- Playwright tests: 18 specs
- Bats script tests: 12 cases

**6-Month Targets**:
- Total test files: ~150 (+32)
- E2E test specs: 36 (+18 for Tauri)
- Tauri E2E tests: 97 cases (new)
- Test suite runtime: <15 minutes (full suite)

### 7.3 Quality Metrics

**Targets**:
- Flake rate: <5%
- CI pass rate: >95%
- Coverage regression PRs: <2% of total
- New code coverage: >80%
- Critical module coverage: >75%

### 7.4 Process Metrics

**Targets**:
- PR merge time: No increase >10% due to coverage
- Coverage discussion in PRs: >50%
- Team coverage awareness: 100% (survey)
- Test documentation completeness: 100%

---

## 8. Implementation Timeline

### 8.1 Gantt Chart Overview

```
Week 1    [=== Coverage CI Setup ===][========= Tauri Setup =========]
Week 2    [=== Coverage PR Integration ===][=== Tauri Core Tests ===]
Week 3    [=== Coverage Monitoring ===][=== Tauri Advanced Tests ===]
Week 4                                   [=== Tauri Polish & Docs ===]
Ongoing   [============== Branch Coverage Improvement ==============]
```

### 8.2 Milestone Schedule

| Milestone | Target Date | Deliverables |
|-----------|-------------|--------------|
| **Coverage CI Setup** | Week 1 End | Codecov integrated, badge live |
| **Coverage PR Integration** | Week 2 End | PR comments, status checks active |
| **Coverage Monitoring** | Week 3 End | Trends tracked, dashboards operational |
| **Tauri Foundation** | Week 1 End | Test infrastructure operational |
| **Tauri Core Tests** | Week 2 End | 41 desktop + Docker tests passing |
| **Tauri Advanced Tests** | Week 3 End | 56 IPC + platform + security tests passing |
| **Tauri Complete** | Week 4 End | 97 total tests, docs complete |

### 8.3 Critical Path

**Critical Path Items** (blockers for downstream work):
1. Codecov account setup (Day 1) → Coverage CI integration
2. Playwright + Tauri research (Days 1-2) → Tauri test development
3. Rust test framework setup (Days 3-4) → IPC test development
4. CI matrix testing configuration (Day 5) → Platform validation

**Parallel Work Opportunities**:
- Coverage CI and Tauri E2E can proceed simultaneously
- Branch coverage improvement ongoing throughout
- Documentation updates can happen in parallel with implementation

---

## 9. Documentation Requirements

### 9.1 New Documentation Needed

**Created**:
- ✅ `docs/testing/COVERAGE_CI_PLAN.md` - Complete coverage CI integration plan
- ✅ `docs/testing/TAURI_E2E_STRATEGY.md` - Complete Tauri E2E testing strategy
- ✅ `docs/testing/TEST_INFRASTRUCTURE_ASSESSMENT.md` - This assessment document

**Needed**:
- [ ] `docs/testing/TAURI_TESTING_GUIDE.md` - Tauri test writing guide (Week 4)
- [ ] `docs/testing/COVERAGE_TROUBLESHOOTING.md` - Coverage issue resolution (Week 3)
- [ ] Update `CONTRIBUTING.md` with coverage policy (Week 2)
- [ ] Update `docs/testing/E2E_TESTING.md` with Tauri section (Week 4)

### 9.2 Existing Documentation Updates

**Files to Update**:
- [ ] `README.md` - Add coverage badge (Week 1)
- [ ] `.github/PULL_REQUEST_TEMPLATE.md` - Add coverage checklist (Week 2)
- [ ] `docs/testing/README.md` - Add Tauri section (Week 4)
- [ ] `docs/testing/TEST_PATTERNS.md` - Add Tauri patterns (Week 4)

---

## 10. Approval & Sign-off

### 10.1 Stakeholder Review

**Reviewers**:
- [ ] Engineering Manager - Approve resource allocation
- [ ] Technical Lead - Approve technical approach
- [ ] QA Lead - Approve testing strategy
- [ ] DevOps Engineer - Approve CI integration

### 10.2 Decision Points

**Key Decisions Needed**:
1. Approve Codecov as coverage service (vs alternatives)
2. Approve Playwright for Tauri E2E (vs Tauri WebDriver)
3. Approve 3-week timeline for coverage CI integration
4. Approve 4-week timeline for Tauri E2E testing
5. Approve resource allocation (35 engineering days)

**Approval Status**: PENDING REVIEW

---

## Appendix A: Test File Inventory

### A.1 Unit Tests (tests/unit/)
- `auth.test.ts` - Authentication logic
- `credentials-provider.test.ts` - Credentials provider
- `password.test.ts` - Password utilities
- `middleware/*.test.ts` - Middleware validation (3 files)
- `vector-db-*.test.ts` - Vector DB operations (3 files)
- `file-sync/*.test.ts` - File synchronization (3 files)
- `monitoring/*.test.ts` - Monitoring utilities
- ... (~100+ files total)

### A.2 Integration Tests (tests/integration/)
- `websocket/*.test.ts` - WebSocket communication
- `monitoring-api.test.ts` - Monitoring API
- `user-provisioning.test.ts` - User provisioning
- ... (multiple files)

### A.3 E2E Tests (tests/e2e/)
- `accessibility.test.ts` - WCAG compliance (13 KB)
- `ai-features.test.ts` - AI feature integration (8 KB)
- `auth-flow.test.ts` - Authentication flows (6 KB)
- `critical-user-journeys.test.ts` - Critical paths (15 KB)
- `health-check.spec.ts` - Health endpoints (6 KB)
- `mcp-integration.spec.ts` - MCP integration (8 KB)
- `enhanced-chat/` - Enhanced chat features
- `monitoring/` - Monitoring dashboard tests
- ... (18 specs total)

### A.4 Script Tests (tests/scripts/)
- Bats shell script tests (12 cases)
- Build script validation
- Deployment script validation

---

## Appendix B: Configuration Files

**Jest Configuration**: `jest.config.mjs`
```javascript
{
  testEnvironment: 'jest-environment-jsdom',
  coveragePathIgnorePatterns: [],
  setupFilesAfterEnv: ['<rootDir>/tests/jest.setup.js'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' }
}
```

**Playwright Configuration**: `playwright.config.ts`
```typescript
{
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: ['html', 'json', 'junit'],
  webServer: {
    command: 'npm run dev:simple',
    url: 'http://localhost:3000',
    timeout: 300000
  }
}
```

**Tauri Configuration**: `src-tauri/tauri.conf.json`
```json
{
  "productName": "VibeCode",
  "version": "0.1.0",
  "identifier": "com.vibecode.app",
  "bundle": { "category": "DeveloperTool" }
}
```

---

## Appendix C: Test Command Reference

**Quick Reference**:
```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suites
npm run test:unit                # Jest unit tests
npm run test:integration         # Jest integration tests
npm run test:e2e                 # Playwright E2E tests
npm run test:scripts             # Bats script tests

# Run Playwright with UI
npm run test:e2e:headed

# Run specific test file
npm test -- path/to/test.test.ts

# Watch mode
npm run test:watch

# Future: Tauri tests (after implementation)
npm run test:tauri               # All Tauri E2E tests
npm run test:tauri:headed        # Tauri tests with UI
npm run test:tauri -- --project=macos  # Platform-specific
```

---

**Assessment Status**: COMPLETE
**Next Steps**: Begin implementation of Issue #501 and Issue #496 per planning documents
**Last Updated**: 2025-10-01
