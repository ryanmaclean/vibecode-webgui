# TypeScript Error Reduction Roadmap

## Overview
This document tracks the expected error reduction at each step of the TypeScript consolidation process, providing visibility into progress and helping identify issues early.

**Baseline**: 775 TypeScript errors
**Target**: 0 TypeScript errors
**Total Reduction**: 775 errors
**Timeline**: 16-22 days (3-4 weeks)

---

## Progress Tracking

### Visual Progress Bar
```
Phase 1: [████████░░░░░░░░░░░░░░░░░░░░] 16% (125/775 errors fixed)
Phase 2: [████████████████░░░░░░░░░░░░] 52% (400/775 errors fixed)
Phase 3: [████████████████░░░░░░░░░░░░] 54% (416/775 errors fixed)
Phase 4: [████████████████████████░░░░] 74% (575/775 errors fixed)
Phase 5: [████████████████████████████░] 94% (725/775 errors fixed)
Phase 6: [████████████████████████████] 100% (775/775 errors fixed) ✅
```

---

## Error Reduction by Phase

### Phase 1: Critical Fixes (Days 1-3)

| Step | Action | Errors Before | Errors After | Reduction | % Complete |
|------|--------|---------------|--------------|-----------|------------|
| Baseline | Initial state | **775** | 775 | 0 | 0% |
| 1.1 | Clean working directory | 775 | 775 | 0 | 0% |
| 1.2 | Fix syntax errors | 775 | **770** | -5 | 1% |
| 1.3 | Apply stash@{0} | 770 | **650** | -120 | 16% |
| **Phase 1 Total** | | **775** | **650** | **-125** | **16%** |

#### Error Types Fixed in Phase 1
- TS1185: Merge conflict markers (~3 errors)
- TS1005: Syntax errors (duplicate catch blocks) (~2 errors)
- TS2304: Missing imports (logger, monitoring) (~30 errors)
- TS2339: Property access errors in DB code (~40 errors)
- TS2554: Function argument errors in routes (~20 errors)
- Various: Connection pool and logger related (~30 errors)

#### Key Files Modified
- `src/lib/db/connection-pool-types.ts`
- `src/lib/db/vector-connection-pool.ts`
- `src/lib/db/db-connectivity.ts`
- `src/lib/logger.ts`
- `src/app/api/*/route.ts` (multiple)

---

### Phase 2: Type Safety Improvements (Days 4-7)

| Step | Action | Errors Before | Errors After | Reduction | % Complete |
|------|--------|---------------|--------------|-----------|------------|
| 2.1 | Apply stash@{1} | 650 | **500** | -150 | 35% |
| 2.2 | Apply working dir fixes | 500 | **400** | -100 | 48% |
| **Phase 2 Total** | | **650** | **400** | **-250** | **48%** |

#### Error Types Fixed in Phase 2
- TS2339: Missing properties in interfaces (~80 errors)
- TS2345: Type mismatches in MFA provider (~30 errors)
- TS2322: Type assignment errors (~20 errors)
- TS7006: Implicit any types (~15 errors)
- TS2554: Missing function arguments (~25 errors)
- Vector DB types: Connection pool errors (~40 errors)
- Store types: Zustand middleware errors (~20 errors)
- Cache types: Valkey client errors (~20 errors)

#### Key Files Modified
- `src/lib/auth/mfa-provider.ts` (+249 lines)
- `src/lib/services/chat-mongodb.ts` (+419 lines)
- `src/stores/uiStore.ts`
- `src/stores/middleware/*.ts`
- `src/lib/vector-db/base-vector-database-adapter.ts`
- `src/lib/vector-db/postgres-vector-database-adapter.ts`
- `src/lib/cache/valkey-client.ts`
- `src/app/api/*/route.ts` (multiple)

---

### Phase 3: Next.js Route Parameters (Days 8-10)

| Step | Action | Errors Before | Errors After | Reduction | % Complete |
|------|--------|---------------|--------------|-----------|------------|
| 3.1-3.2 | Fix dynamic route params | 400 | **384** | -16 | 54% |
| **Phase 3 Total** | | **400** | **384** | **-16** | **54%** |

#### Error Types Fixed in Phase 3
- TS2344: Next.js route param type mismatches (16 errors)
  - `{ params: { id: string } }` → `{ params: Promise<{ id: string }> }`
  - Affects all routes with dynamic segments

#### Dynamic Routes Updated
1. `src/app/api/agents/[...path]/route.ts` (GET, POST, DELETE)
2. `src/app/api/containers/[id]/route.ts` (GET, DELETE)
3. `src/app/api/workspace/[id]/init-goose/route.ts` (POST)
4. `src/app/api/projects/[id]/route.ts` (if exists)
5. Other dynamic routes in `src/app/api/`

#### Example Fix
```typescript
// Before
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
}

// After
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
}
```

---

### Phase 4: Imports and Modules (Days 11-14)

| Step | Action | Errors Before | Errors After | Reduction | % Complete |
|------|--------|---------------|--------------|-----------|------------|
| 4.1 | Fix missing imports (TS2304) | 384 | **255** | -129 | 70% |
| 4.2 | Fix module resolution | 255 | **200** | -55 | 74% |
| **Phase 4 Total** | | **384** | **200** | **-184** | **74%** |

#### Error Types Fixed in Phase 4
- TS2304: Cannot find name (~129 errors)
  - logger (35 instances)
  - monitoring (30 instances)
  - cache/CacheKeys/CacheTTL (25 instances)
  - validateQueryParams (15 instances)
  - performanceBaselines (10 instances)
  - enhancedAlerting (8 instances)
  - Other utilities (6 instances)

- TS2307: Cannot find module (~30 errors)
- TS2614: Module not found (~25 errors)

#### Common Import Additions
```typescript
// Logger
import { logger } from '@/lib/logger';

// Monitoring
import { monitoring } from '@/lib/monitoring';
import { performanceBaselines } from '@/lib/monitoring/performance-baselines';
import { enhancedAlerting } from '@/lib/monitoring/enhanced-alerting';

// Cache
import { cache, CacheKeys, CacheTTL } from '@/lib/cache/valkey-client';

// Validation
import { validateQueryParams } from '@/lib/validation';
```

#### Module Resolution Fixes
- Rebuild `.next` directory types
- Verify all route files exist
- Fix tsconfig.json path mappings
- Remove references to deleted files

---

### Phase 5: Properties and Arguments (Days 15-19)

| Step | Action | Errors Before | Errors After | Reduction | % Complete |
|------|--------|---------------|--------------|-----------|------------|
| 5.1 | Fix property errors (TS2339) | 200 | **100** | -100 | 87% |
| 5.2 | Fix argument errors (TS2554/TS2345) | 100 | **50** | -50 | 94% |
| **Phase 5 Total** | | **200** | **50** | **-150** | **94%** |

#### Error Types Fixed in Phase 5
- TS2339: Property does not exist (~100 errors)
  - Component props (40 errors)
  - API response types (30 errors)
  - Store state properties (20 errors)
  - Miscellaneous (10 errors)

- TS2554: Expected N arguments (35 errors)
- TS2345: Argument type mismatch (42 errors)

#### Property Fix Patterns
```typescript
// Missing optional prop
interface ButtonProps {
  label: string;
  onClick?: () => void;  // Add optional
  disabled?: boolean;    // Add optional
}

// Wrong property name
// Before: props.handleClick
// After:  props.onClick

// Missing property in interface
interface ApiResponse {
  success: boolean;
  data: any;
  message?: string;  // Add if used
}
```

#### Argument Fix Patterns
```typescript
// Missing optional parameter
function log(message: string, context?: object) {}

// Type conversion
const id = "123";
getUser(parseInt(id));  // Convert string to number

// Object shape
interface UserInput {
  id: string;
  name: string;
}
createUser({ id: user.id, name: user.name });  // Exact shape
```

---

### Phase 6: Final Integration (Days 20-22)

| Step | Action | Errors Before | Errors After | Reduction | % Complete |
|------|--------|---------------|--------------|-----------|------------|
| 6.1 | Merge fix branch | 50 | **10** | -40 | 99% |
| 6.2 | Final cleanup | 10 | **0** | -10 | 100% |
| **Phase 6 Total** | | **50** | **0** | **-50** | **100%** ✅ |

#### Final Error Types
Remaining errors (typically 5-10):
- Edge case type mismatches
- Complex generic types
- Third-party library types
- Test file types

#### Merge Strategy
1. Merge `origin/fix/typescript-critical-errors`
2. Resolve conflicts (prefer our manual fixes)
3. Cherry-pick any missing fixes from branch
4. Fix any new errors introduced
5. Achieve zero errors

---

## Error Category Breakdown

### By Error Code (Baseline)

| Error Code | Count | Description | Fixed In |
|------------|-------|-------------|----------|
| **TS2339** | 207 | Property does not exist | Phase 5 |
| **TS2304** | 129 | Cannot find name | Phase 4 |
| **TS2614** | 54 | Module not found | Phase 4 |
| **TS2554** | 43 | Expected N arguments | Phase 5 |
| **TS2345** | 34 | Argument type mismatch | Phase 5 |
| **TS2724** | 24 | Import error | Phase 4 |
| **TS2322** | 23 | Type not assignable | Phase 2 |
| **TS2451** | 22 | Redeclared variable | Phase 1 |
| **TS2344** | 16 | Route param mismatch | Phase 3 |
| **TS7006** | 21 | Implicit any | Phase 2 |
| **TS2353** | 21 | Object literal errors | Phase 5 |
| **Others** | 181 | Various | Phases 1-6 |
| **Total** | **775** | | |

### By File Type

| File Pattern | Approx. Errors | Fixed In |
|--------------|----------------|----------|
| `.next/types/*.ts` | 20 | Phase 3, 4 |
| `src/app/api/**/route.ts` | 150 | Phases 1-4 |
| `src/lib/db/*.ts` | 80 | Phases 1-2 |
| `src/lib/vector-db/*.ts` | 60 | Phase 2 |
| `src/lib/cache/*.ts` | 40 | Phase 2 |
| `src/stores/*.ts` | 50 | Phase 2 |
| `src/lib/auth/*.ts` | 40 | Phase 2 |
| `src/lib/services/*.ts` | 50 | Phase 2 |
| `src/lib/monitoring/*.ts` | 35 | Phases 1, 4 |
| `src/components/**/*.tsx` | 100 | Phase 5 |
| `src/app/__tests__/*.tsx` | 30 | Phase 5 |
| `src/lib/**/*.ts` (other) | 120 | Phases 4-5 |
| **Total** | **~775** | |

---

## Daily Progress Targets

### Week 1 (Days 1-7)

| Day | Target Errors | Daily Reduction | Phase |
|-----|---------------|-----------------|-------|
| 1 | 750 | -25 | Phase 1 start |
| 2 | 680 | -70 | Phase 1 continue |
| 3 | 650 | -30 | Phase 1 complete |
| 4 | 600 | -50 | Phase 2 start |
| 5 | 530 | -70 | Phase 2 continue |
| 6 | 460 | -70 | Phase 2 continue |
| 7 | 400 | -60 | Phase 2 complete |

### Week 2 (Days 8-14)

| Day | Target Errors | Daily Reduction | Phase |
|-----|---------------|-----------------|-------|
| 8 | 390 | -10 | Phase 3 start |
| 9 | 386 | -4 | Phase 3 continue |
| 10 | 384 | -2 | Phase 3 complete |
| 11 | 340 | -44 | Phase 4 start |
| 12 | 300 | -40 | Phase 4 continue |
| 13 | 250 | -50 | Phase 4 continue |
| 14 | 200 | -50 | Phase 4 complete |

### Week 3 (Days 15-21)

| Day | Target Errors | Daily Reduction | Phase |
|-----|---------------|-----------------|-------|
| 15 | 170 | -30 | Phase 5 start |
| 16 | 140 | -30 | Phase 5 continue |
| 17 | 115 | -25 | Phase 5 continue |
| 18 | 90 | -25 | Phase 5 continue |
| 19 | 50 | -40 | Phase 5 complete |
| 20 | 25 | -25 | Phase 6 start |
| 21 | 10 | -15 | Phase 6 continue |

### Week 4 (Days 22+)

| Day | Target Errors | Daily Reduction | Phase |
|-----|---------------|-----------------|-------|
| 22 | 0 | -10 | Phase 6 complete ✅ |

---

## Milestone Celebrations

### 🎯 Major Milestones

- **< 700 errors**: First 10% reduction (Day 1-2)
- **< 500 errors**: 35% reduction - Type safety wins! (Day 7)
- **< 400 errors**: 50% reduction - Halfway there! (Day 7)
- **< 300 errors**: 60% reduction (Day 13)
- **< 200 errors**: 75% reduction - Final push! (Day 14)
- **< 100 errors**: 87% reduction - Almost done! (Day 18)
- **< 50 errors**: 94% reduction - Final stretch! (Day 19)
- **0 errors**: 100% COMPLETE! 🎉 (Day 22)

---

## Risk Indicators

### Green Status (On Track)
- Daily error reduction > 20
- No new error categories introduced
- Build continues to succeed
- Test pass rate stable or improving

### Yellow Status (Minor Issues)
- Daily error reduction < 20
- 1-2 new error categories introduced
- Build warnings increasing
- Some test failures

### Red Status (Blockers)
- Error count increasing
- Multiple new error categories
- Build fails
- Major test suite failures

### Recovery Actions

#### If Yellow Status
1. Review recent changes
2. Increase daily effort
3. Pair programming on complex files
4. Consider splitting phase into smaller steps

#### If Red Status
1. **Stop and rollback**: `git reset --hard backup/phase-N-complete`
2. Review what went wrong
3. Create smaller, more focused commits
4. Request team assistance
5. Update roadmap with revised estimates

---

## Success Metrics

### Code Health Indicators

| Metric | Baseline | Target | Current |
|--------|----------|--------|---------|
| TypeScript Errors | 775 | 0 | _____ |
| Build Time | _____ | <baseline | _____ |
| Bundle Size | _____ | ~baseline | _____ |
| Test Coverage | ___% | ≥baseline | ___% |
| Type Coverage | ~70% | >95% | ___% |
| ESLint Errors | _____ | 0 | _____ |

### Quality Gates

Before merging to main, ALL must pass:
- ✅ TypeScript: 0 errors
- ✅ Build: Success
- ✅ Tests: 100% passing
- ✅ Lint: 0 errors
- ✅ Type coverage: >95%
- ✅ No `any` types in new code
- ✅ Bundle size within 5% of baseline
- ✅ Build time within 10% of baseline

---

## Reporting Template

### Daily Status Report

```markdown
## TypeScript Consolidation - Day N

**Date**: YYYY-MM-DD
**Phase**: Phase N - [Name]
**Status**: 🟢 Green / 🟡 Yellow / 🔴 Red

### Progress
- **Errors Remaining**: XXX / 775
- **Errors Fixed Today**: XX
- **Total Errors Fixed**: XXX (XX%)
- **On Track**: Yes / No

### Completed Today
- [ ] Task 1
- [ ] Task 2
- [ ] Task 3

### Issues Encountered
- Issue 1: Description
- Issue 2: Description

### Tomorrow's Plan
- [ ] Task 1
- [ ] Task 2

### Metrics
- Build Time: X.Xs
- Test Pass Rate: XX%
- Commits Today: X
```

---

## Contingency Plans

### If Timeline Slips

**Acceptable Delays**:
- 1-2 days: Adjust daily targets
- 3-5 days: Re-evaluate phase estimates
- >5 days: Consider breaking into smaller PRs

**Mitigation Options**:
1. **Parallel Workstreams**:
   - Developer A: Phases 1-3
   - Developer B: Phases 4-5
   - Merge carefully

2. **Incremental Merges**:
   - Merge after each phase
   - Reduce merge conflict risk
   - Allow partial deployment

3. **Postpone Non-Critical**:
   - Focus on blocking errors first
   - Defer cosmetic fixes
   - Address remaining errors in follow-up PR

---

## Historical Context

### Previous Error Counts
- **2025-10-01**: ~1200 errors
- **2025-10-15**: 900 errors (after initial cleanup)
- **2025-10-23**: 775 errors (current baseline)
- **2025-10-XX**: 0 errors (target)

### Improvement Rate
- **Phase 1**: 125 errors / 3 days = 42 errors/day
- **Phase 2**: 250 errors / 4 days = 62 errors/day
- **Phase 3**: 16 errors / 3 days = 5 errors/day (focused fixes)
- **Phase 4**: 184 errors / 4 days = 46 errors/day
- **Phase 5**: 150 errors / 5 days = 30 errors/day
- **Phase 6**: 50 errors / 3 days = 17 errors/day

**Average**: ~37 errors/day

---

## Dependencies and Blockers

### Internal Dependencies
- None (can proceed independently)

### External Dependencies
- None (no breaking API changes expected)

### Known Blockers
- None currently identified

### Risks
1. **Merge Conflicts**: Mitigated by frequent commits
2. **Test Failures**: Mitigated by running tests after each phase
3. **Build Breakage**: Mitigated by incremental validation
4. **Team Availability**: Mitigated by clear documentation

---

## Lessons Learned (Post-Completion)

_To be filled in after completion_

### What Went Well
-

### What Could Be Improved
-

### Unexpected Challenges
-

### Time Savers
-

### Recommended Practices
-

---

## Appendix: Error Tracking Commands

### Check Current Error Count
```bash
npm run type-check 2>&1 | grep -c "error TS"
```

### Error Count by Type
```bash
npm run type-check 2>&1 | grep "error TS" | \
  sed 's/.*error TS\([0-9]*\):.*/TS\1/' | \
  sort | uniq -c | sort -rn
```

### Error Count by File
```bash
npm run type-check 2>&1 | grep "error TS" | \
  cut -d"(" -f1 | sort | uniq -c | sort -rn | head -20
```

### Error Count by Directory
```bash
npm run type-check 2>&1 | grep "error TS" | \
  sed 's/^\([^/]*\/[^/]*\/[^/]*\).*/\1/' | \
  sort | uniq -c | sort -rn
```

### Progress Chart
```bash
#!/bin/bash
# Save to scripts/error-progress.sh

DATE=$(date +%Y-%m-%d)
ERRORS=$(npm run type-check 2>&1 | grep -c "error TS")
echo "$DATE,$ERRORS" >> logs/error-progress.csv

echo "Error Progress:"
cat logs/error-progress.csv
```

---

**Document Version**: 1.0
**Created**: 2025-10-23
**Last Updated**: 2025-10-23
**Next Review**: After each phase completion
**Status**: Active Tracking Document

---

## Quick Reference

### Current Status (Update Daily)

| Metric | Value |
|--------|-------|
| Current Errors | _____ |
| Baseline | 775 |
| Reduction | _____ |
| % Complete | ___% |
| Days Elapsed | ___ |
| Current Phase | Phase ___ |
| Status | 🟢/🟡/🔴 |

### Next Steps
1. _____________________
2. _____________________
3. _____________________

---

*End of Roadmap*
