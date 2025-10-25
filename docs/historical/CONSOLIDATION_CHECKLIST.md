# TypeScript Consolidation Checklist

## Overview
This checklist provides step-by-step instructions for consolidating all TypeScript fixes from multiple sources (branches, stashes, PRs, and working directory) into the main branch.

**Start Date**: _____________
**Target Completion**: _____________
**Current Error Count**: 775 errors
**Target Error Count**: 0 errors

---

## Pre-Consolidation Setup

### Prerequisites
- [ ] Git working directory is clean (or changes are stashed)
- [ ] All team members notified of consolidation effort
- [ ] Development environment ready (`node_modules` installed)
- [ ] Test suite is passing on current main branch
- [ ] Backup of current state created

### Initial Setup
```bash
# 1. Verify you're on main branch
[ ] git checkout main
[ ] git pull origin main

# 2. Create consolidation branch
[ ] git checkout -b consolidate/typescript-fixes-$(date +%Y%m%d)

# 3. Create initial backup
[ ] git tag backup/pre-consolidation-$(date +%Y-%m-%d)
[ ] git push origin backup/pre-consolidation-$(date +%Y-%m-%d)

# 4. Record baseline metrics
[ ] npm run type-check 2>&1 | tee logs/baseline-errors.txt
[ ] grep -c "error TS" logs/baseline-errors.txt > logs/baseline-count.txt
[ ] echo "Baseline: $(cat logs/baseline-count.txt) errors"

# 5. Create logs directory
[ ] mkdir -p logs
```

---

## Phase 1: Critical Fixes (Days 1-3)

### Step 1.1: Clean Working Directory ✓
**Goal**: Start with a clean slate

```bash
# Save any uncommitted work
[ ] git status
[ ] git stash push -m "Pre-consolidation WIP $(date +%Y-%m-%d)"

# Verify clean state
[ ] git status
# Expected output: "nothing to commit, working tree clean"
```

**Validation**:
- [ ] No modified files in `git status`
- [ ] No untracked files (except .code/, node_modules/)

---

### Step 1.2: Fix Immediate Syntax Errors ✓
**Goal**: Eliminate merge conflicts and syntax errors

#### 1.2.1: Identify Syntax Errors
```bash
[ ] npm run type-check 2>&1 | grep -E "TS1185|TS1005" | tee logs/syntax-errors.txt
```

#### 1.2.2: Fix Merge Conflict Markers (TS1185)
```bash
# Find all files with merge conflict markers
[ ] grep -r "^<<<<<<< " src/ || echo "No conflicts found"
[ ] grep -r "^=======$" src/ || echo "No conflicts found"
[ ] grep -r "^>>>>>>> " src/ || echo "No conflicts found"

# For each file with conflicts:
#   1. Open in editor
#   2. Choose correct version (see MERGE_STRATEGY.md Section 4.2)
#   3. Remove conflict markers
#   4. Save file
```

**Files to check** (based on previous errors):
- [ ] `src/stores/uiStore.ts`
- [ ] Any files in `logs/syntax-errors.txt`

#### 1.2.3: Fix Duplicate Catch Blocks (TS1005)
```bash
# Check health route
[ ] cat src/app/api/health/route.ts | grep -A 5 "} catch"
```

**Fix required**:
- [ ] `src/app/api/health/route.ts` - Remove duplicate catch block at line ~97

#### 1.2.4: Validate Syntax Fixes
```bash
[ ] npm run type-check 2>&1 | grep -c "error TS" > logs/after-syntax-fixes.txt
[ ] echo "Errors after syntax fixes: $(cat logs/after-syntax-fixes.txt)"
```

**Commit Changes**:
```bash
[ ] git add -A
[ ] git commit -m "fix: resolve syntax errors and merge conflicts

- Remove merge conflict markers
- Fix duplicate catch blocks
- Remove syntax errors (TS1185, TS1005)

Error count: $(cat logs/baseline-count.txt) → $(cat logs/after-syntax-fixes.txt)"
```

**Expected Error Reduction**: 775 → ~770 errors

---

### Step 1.3: Apply Stash@{0} Database Connection Fixes ✓
**Goal**: Improve database connection pool and logger

#### 1.3.1: Review Stash Contents
```bash
[ ] git stash list
[ ] git stash show -p stash@{0} | head -100 > logs/stash0-preview.txt
```

#### 1.3.2: Apply Stash
```bash
[ ] git stash apply stash@{0}

# If conflicts occur:
[ ] git status
# Resolve each conflict:
#   1. Open conflicted file
#   2. Choose best version (see MERGE_STRATEGY.md Section 4)
#   3. Mark as resolved: git add <file>
```

**Key Files Changed**:
- [ ] `src/lib/db/connection-pool-types.ts`
- [ ] `src/lib/db/vector-connection-pool.ts`
- [ ] `src/lib/db/db-connectivity.ts`
- [ ] `src/lib/logger.ts`
- [ ] `src/app/api/**/route.ts` (multiple files)

#### 1.3.3: Validate Changes
```bash
[ ] npm run type-check 2>&1 | grep -c "error TS" > logs/after-stash0.txt
[ ] echo "Errors after stash@{0}: $(cat logs/after-stash0.txt)"

# Check for new errors
[ ] npm run type-check 2>&1 | grep "error TS" | head -20
```

#### 1.3.4: Test Database Connections
```bash
# If database is available:
[ ] npm run test -- --testPathPattern=connection-pool
[ ] npm run test -- --testPathPattern=database
```

#### 1.3.5: Commit Changes
```bash
[ ] git add -A
[ ] git commit -m "feat: apply database connection pool improvements

Source: stash@{0} - Database fixes

Changes:
- Enhance vector connection pool management
- Improve database connectivity error handling
- Update logger with performance tracking
- Clean up API route database calls

Error count: $(cat logs/after-syntax-fixes.txt) → $(cat logs/after-stash0.txt)"
```

**Expected Error Reduction**: 770 → ~650 errors

---

### Step 1.4: Create Phase 1 Checkpoint ✓
```bash
[ ] git tag backup/phase-1-complete-$(date +%Y-%m-%d)
[ ] git push origin consolidate/typescript-fixes-$(date +%Y%m%d)
[ ] git push origin backup/phase-1-complete-$(date +%Y-%m-%d)
```

**Phase 1 Validation**:
- [ ] Error count reduced by ~120-125 errors
- [ ] No syntax errors (TS1xxx)
- [ ] All changes committed
- [ ] Backup tag created

---

## Phase 2: Type Safety Improvements (Days 4-7)

### Step 2.1: Apply Stash@{1} Type Safety Fixes ✓

#### 2.1.1: Review Stash Contents
```bash
[ ] git stash show -p stash@{1} | head -100 > logs/stash1-preview.txt
```

#### 2.1.2: Apply Stash
```bash
[ ] git stash apply stash@{1}

# Expect conflicts with stash@{0} changes
# Priority: stash@{1} > stash@{0} for type definitions
```

**Key Files Changed**:
- [ ] `src/lib/auth/mfa-provider.ts` (major enhancement)
- [ ] `src/lib/services/chat-mongodb.ts` (major enhancement)
- [ ] `src/stores/uiStore.ts`
- [ ] `src/stores/middleware/*.ts`
- [ ] `src/app/api/**/route.ts`

#### 2.1.3: Resolve Conflicts
For each conflict:
```bash
[ ] git status | grep "both modified"
# For each file:
#   1. Review conflict in editor
#   2. Combine best parts from both stashes
#   3. git add <file>
```

**Common Conflicts**:
- [ ] `src/stores/uiStore.ts` - Keep stash@{1} version (has type fixes)
- [ ] `src/app/api/**/route.ts` - Merge both (combine DB + type fixes)

#### 2.1.4: Validate Changes
```bash
[ ] npm run type-check 2>&1 | grep -c "error TS" > logs/after-stash1.txt
[ ] echo "Errors after stash@{1}: $(cat logs/after-stash1.txt)"

# Check Zustand store types
[ ] npm run type-check 2>&1 | grep "uiStore\|middleware" | tee logs/store-errors.txt
```

#### 2.1.5: Test Store Functionality
```bash
[ ] npm run test -- --testPathPattern=store
[ ] npm run test -- --testPathPattern=middleware
```

#### 2.1.6: Commit Changes
```bash
[ ] git add -A
[ ] git commit -m "feat: apply type safety improvements

Source: stash@{1} - Type safety enhancements

Changes:
- Enhance MFA provider with full type coverage
- Improve Chat MongoDB service types
- Fix Zustand store middleware types
- Update API route type signatures
- Add comprehensive test type definitions

Error count: $(cat logs/after-stash0.txt) → $(cat logs/after-stash1.txt)"
```

**Expected Error Reduction**: 650 → ~500 errors

---

### Step 2.2: Apply Working Directory Fixes ✓

#### 2.2.1: Check Current Modifications
```bash
[ ] git status --porcelain > logs/working-dir-changes.txt
[ ] cat logs/working-dir-changes.txt
```

#### 2.2.2: Review Modified Files
```bash
# Check each modified file
[ ] git diff src/lib/cache/valkey-client.ts | head -50
[ ] git diff src/lib/vector-db/base-vector-database-adapter.ts | head -50
[ ] git diff src/lib/vector-db/postgres-vector-database-adapter.ts | head -50
[ ] git diff src/lib/db/connection-pool-types.ts | head -50
[ ] git diff src/lib/db/vector-connection-pool.ts | head -50
```

#### 2.2.3: Stage and Validate Each File
```bash
# Vector DB files
[ ] git add src/lib/vector-db/base-vector-database-adapter.ts
[ ] git add src/lib/vector-db/postgres-vector-database-adapter.ts
[ ] npm run type-check 2>&1 | grep "vector-db" | tee logs/vector-db-errors.txt

# Cache files
[ ] git add src/lib/cache/valkey-client.ts
[ ] npm run type-check 2>&1 | grep "cache\|valkey" | tee logs/cache-errors.txt

# Connection pool files
[ ] git add src/lib/db/connection-pool-types.ts
[ ] git add src/lib/db/vector-connection-pool.ts
[ ] npm run type-check 2>&1 | grep "connection-pool" | tee logs/pool-errors.txt

# New API route
[ ] git add src/app/api/ai/web-search/route.ts
[ ] npm run type-check 2>&1 | grep "web-search" | tee logs/web-search-errors.txt
```

#### 2.2.4: Validate All Working Directory Changes
```bash
[ ] npm run type-check 2>&1 | grep -c "error TS" > logs/after-working-dir.txt
[ ] echo "Errors after working dir: $(cat logs/after-working-dir.txt)"
```

#### 2.2.5: Commit Changes
```bash
[ ] git commit -m "feat: apply vector DB and cache improvements

Source: Working directory fixes

Changes:
- Enhance base vector database adapter with connection pooling
- Improve PostgreSQL vector adapter performance
- Update Valkey client with better type safety
- Fix connection pool type definitions
- Add AI web search route

Error count: $(cat logs/after-stash1.txt) → $(cat logs/after-working-dir.txt)"
```

**Expected Error Reduction**: 500 → ~400 errors

---

### Step 2.3: Create Phase 2 Checkpoint ✓
```bash
[ ] git tag backup/phase-2-complete-$(date +%Y-%m-%d)
[ ] git push origin consolidate/typescript-fixes-$(date +%Y%m%d)
[ ] git push origin backup/phase-2-complete-$(date +%Y-%m-%d)
```

**Phase 2 Validation**:
- [ ] Error count reduced to ~400 errors
- [ ] All stashes applied successfully
- [ ] Working directory changes committed
- [ ] Tests passing

---

## Phase 3: Next.js Route Parameter Fixes (Days 8-10)

### Step 3.1: Identify Dynamic Routes ✓

```bash
# Find all dynamic route files
[ ] find src/app/api -name "route.ts" -path "*\[*\]*" | tee logs/dynamic-routes.txt
[ ] cat logs/dynamic-routes.txt
```

**Expected Files** (~10-15 files):
- `src/app/api/agents/[...path]/route.ts`
- `src/app/api/containers/[id]/route.ts`
- `src/app/api/workspace/[id]/init-goose/route.ts`
- Others...

---

### Step 3.2: Fix Route Parameter Types ✓

For each file in `logs/dynamic-routes.txt`:

#### 3.2.1: Review Current Implementation
```bash
[ ] cat src/app/api/agents/[...path]/route.ts | grep "export async function"
```

#### 3.2.2: Update Route Handlers
Apply this pattern to ALL exported route handlers (GET, POST, PUT, DELETE, PATCH):

**Before (Next.js 14)**:
```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  // ...
}
```

**After (Next.js 15+)**:
```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // ...
}
```

**Checklist per file**:
- [ ] File: `src/app/api/agents/[...path]/route.ts`
  - [ ] GET handler updated
  - [ ] POST handler updated
  - [ ] DELETE handler updated
  - [ ] File tested: `npm run type-check 2>&1 | grep "agents/\[...path\]"`

- [ ] File: `src/app/api/containers/[id]/route.ts`
  - [ ] GET handler updated
  - [ ] DELETE handler updated
  - [ ] File tested

- [ ] File: `src/app/api/workspace/[id]/init-goose/route.ts`
  - [ ] POST handler updated
  - [ ] File tested

[Continue for all dynamic routes...]

#### 3.2.3: Batch Validation
```bash
[ ] npm run type-check 2>&1 | grep "TS2344" | tee logs/route-param-errors.txt
[ ] echo "TS2344 errors remaining: $(wc -l < logs/route-param-errors.txt)"
```

#### 3.2.4: Commit Route Fixes
```bash
[ ] git add src/app/api/**/route.ts
[ ] git commit -m "fix: update route handlers for Next.js 15 async params

Convert all dynamic route params to Promise-based access:
- Update [id] routes to await params.id
- Update [...path] routes to await params.path
- Fix TS2344 errors (param type mismatches)

Files updated: $(find src/app/api -name "route.ts" -path "*\[*\]*" | wc -l)
Error count: $(cat logs/after-working-dir.txt) → [run type-check and update]"
```

**Expected Error Reduction**: 400 → ~384 errors (16 TS2344 errors fixed)

---

### Step 3.3: Create Phase 3 Checkpoint ✓
```bash
[ ] npm run type-check 2>&1 | grep -c "error TS" > logs/after-phase3.txt
[ ] git tag backup/phase-3-complete-$(date +%Y-%m-%d)
[ ] git push origin consolidate/typescript-fixes-$(date +%Y%m%d)
```

---

## Phase 4: Import and Module Resolution (Days 11-14)

### Step 4.1: Fix Missing Imports (TS2304) ✓

#### 4.1.1: Identify Missing Imports
```bash
[ ] npm run type-check 2>&1 | grep "TS2304" | tee logs/missing-names.txt
[ ] cat logs/missing-names.txt | cut -d"'" -f2 | sort -u | tee logs/missing-names-unique.txt
```

#### 4.1.2: Common Import Fixes

**Create import fix script**:
```bash
[ ] cat > scripts/fix-imports.sh << 'EOF'
#!/bin/bash
# Common import fixes

# Fix logger imports
find src -name "*.ts" -o -name "*.tsx" | while read file; do
  if grep -q "logger\." "$file" && ! grep -q "import.*logger" "$file"; then
    echo "Adding logger import to $file"
    sed -i '' '1s/^/import { logger } from '\''@\/lib\/logger'\'';\n/' "$file"
  fi
done

# Fix monitoring imports
find src -name "*.ts" -o -name "*.tsx" | while read file; do
  if grep -q "monitoring\." "$file" && ! grep -q "import.*monitoring" "$file"; then
    echo "Adding monitoring import to $file"
    sed -i '' '1s/^/import { monitoring } from '\''@\/lib\/monitoring'\'';\n/' "$file"
  fi
done

# Fix cache imports
find src -name "*.ts" -o -name "*.tsx" | while read file; do
  if grep -q "cache\." "$file" && ! grep -q "import.*cache" "$file"; then
    echo "Adding cache import to $file"
    sed -i '' '1s/^/import { cache } from '\''@\/lib\/cache\/valkey-client'\'';\n/' "$file"
  fi
done
EOF
[ ] chmod +x scripts/fix-imports.sh
```

#### 4.1.3: Run Import Fixes
```bash
[ ] ./scripts/fix-imports.sh | tee logs/import-fixes-applied.txt
[ ] npm run type-check 2>&1 | grep "TS2304" | tee logs/remaining-ts2304.txt
```

#### 4.1.4: Manual Import Fixes
For remaining TS2304 errors, fix manually:
```bash
[ ] cat logs/remaining-ts2304.txt
# For each unique missing name:
#   1. Identify correct import source
#   2. Add import to file
#   3. Test: npm run type-check 2>&1 | grep "<filename>"
```

**Common Patterns**:
- `logger` → `import { logger } from '@/lib/logger'`
- `monitoring` → `import { monitoring } from '@/lib/monitoring'`
- `cache`, `CacheKeys`, `CacheTTL` → `import { cache, CacheKeys, CacheTTL } from '@/lib/cache/valkey-client'`
- `validateQueryParams` → `import { validateQueryParams } from '@/lib/validation'`
- `performanceBaselines` → `import { performanceBaselines } from '@/lib/monitoring/performance-baselines'`
- `enhancedAlerting` → `import { enhancedAlerting } from '@/lib/monitoring/enhanced-alerting'`

#### 4.1.5: Validate Import Fixes
```bash
[ ] npm run type-check 2>&1 | grep -c "TS2304" > logs/ts2304-after.txt
[ ] echo "TS2304 errors remaining: $(cat logs/ts2304-after.txt)"
```

#### 4.1.6: Commit Import Fixes
```bash
[ ] git add -A
[ ] git commit -m "fix: add missing imports throughout codebase

Fix TS2304 'Cannot find name' errors:
- Add logger imports to route handlers
- Add monitoring imports to API routes
- Add cache imports where needed
- Add validation helper imports
- Add performance monitoring imports

Errors fixed: ~129 TS2304 errors
Error count: $(cat logs/after-phase3.txt) → [update after type-check]"
```

**Expected Error Reduction**: 384 → ~255 errors

---

### Step 4.2: Fix Module Resolution (TS2307, TS2614) ✓

#### 4.2.1: Identify Module Errors
```bash
[ ] npm run type-check 2>&1 | grep -E "TS2307|TS2614" | tee logs/module-errors.txt
```

#### 4.2.2: Clean and Rebuild Next.js Types
```bash
[ ] rm -rf .next
[ ] npm run build 2>&1 | tee logs/build-output.txt
[ ] npm run type-check 2>&1 | grep -E "TS2307|TS2614" | tee logs/module-errors-after-rebuild.txt
```

#### 4.2.3: Fix Missing Route Files
If any routes are missing:
```bash
[ ] cat logs/module-errors-after-rebuild.txt | grep "Cannot find module" | cut -d"'" -f2
# For each missing module:
#   1. Verify file exists
#   2. If missing, create placeholder or remove reference
```

#### 4.2.4: Verify tsconfig Paths
```bash
[ ] cat tsconfig.json | jq '.compilerOptions.paths'
# Verify all @ aliases are correct
```

#### 4.2.5: Commit Module Fixes
```bash
[ ] git add -A
[ ] git commit -m "fix: resolve module resolution errors

- Rebuild Next.js type definitions
- Fix missing route file references
- Verify tsconfig path mappings

Errors fixed: TS2307, TS2614
Error count: [update after type-check]"
```

**Expected Error Reduction**: 255 → ~200 errors

---

### Step 4.3: Create Phase 4 Checkpoint ✓
```bash
[ ] npm run type-check 2>&1 | grep -c "error TS" > logs/after-phase4.txt
[ ] git tag backup/phase-4-complete-$(date +%Y-%m-%d)
[ ] git push origin consolidate/typescript-fixes-$(date +%Y%m%d)
```

---

## Phase 5: Property and Type Mismatches (Days 15-19)

### Step 5.1: Fix Property Does Not Exist (TS2339) ✓

#### 5.1.1: Categorize TS2339 Errors
```bash
[ ] npm run type-check 2>&1 | grep "TS2339" | tee logs/ts2339-all.txt
[ ] cat logs/ts2339-all.txt | awk -F"Property '" '{print $2}' | cut -d"'" -f1 | sort | uniq -c | sort -rn | tee logs/ts2339-by-property.txt
```

#### 5.1.2: Fix Component Props
```bash
# Find all component prop errors
[ ] grep "\.tsx" logs/ts2339-all.txt | tee logs/ts2339-components.txt

# For each component:
#   1. Review prop interface
#   2. Add missing properties
#   3. Fix incorrect property names
#   4. Test component
```

**Common Patterns**:
```typescript
// Missing optional properties
interface Props {
  value: string;
  onChange?: (value: string) => void;  // Add ? for optional
}

// Incorrect property name (typo)
props.onClick  // Fix: props.handleClick

// Missing property in interface
interface User {
  id: string;
  name: string;
  email: string;  // Add this if used
}
```

#### 5.1.3: Fix API Response Types
```bash
[ ] grep "\.response\." logs/ts2339-all.txt | tee logs/ts2339-responses.txt

# Common fixes:
# - Add response type interfaces
# - Use type guards for runtime checks
# - Add optional chaining (?.) where appropriate
```

#### 5.1.4: Fix Store/State Access
```bash
[ ] grep "state\." logs/ts2339-all.txt | tee logs/ts2339-state.txt

# Review Zustand stores and state interfaces
# Add missing properties to store types
```

#### 5.1.5: Batch Validation
```bash
[ ] npm run type-check 2>&1 | grep -c "TS2339" > logs/ts2339-after.txt
[ ] echo "TS2339 errors remaining: $(cat logs/ts2339-after.txt)"
```

#### 5.1.6: Commit Property Fixes
```bash
[ ] git add -A
[ ] git commit -m "fix: resolve property access errors

Fix TS2339 'Property does not exist' errors:
- Add missing component prop definitions
- Fix API response type interfaces
- Update store type definitions
- Add optional chaining where needed
- Fix property name typos

Errors fixed: ~207 TS2339 errors
Error count: $(cat logs/after-phase4.txt) → $(cat logs/ts2339-after.txt)"
```

**Expected Error Reduction**: 200 → ~100 errors

---

### Step 5.2: Fix Argument Type Mismatches ✓

#### 5.2.1: Identify Argument Errors
```bash
[ ] npm run type-check 2>&1 | grep -E "TS2554|TS2345" | tee logs/argument-errors.txt
[ ] cat logs/argument-errors.txt | wc -l
```

#### 5.2.2: Fix Expected Arguments (TS2554)
```bash
[ ] grep "TS2554" logs/argument-errors.txt | tee logs/ts2554.txt

# For each error:
#   1. Review function signature
#   2. Check call site
#   3. Add missing arguments or make parameters optional
```

**Common Patterns**:
```typescript
// Missing required argument
function foo(a: string, b: number) {}
foo('test');  // Error: expected 2 arguments

// Fix: Provide argument or make optional
function foo(a: string, b?: number) {}

// Fix: Provide default value
function foo(a: string, b: number = 0) {}
```

#### 5.2.3: Fix Argument Types (TS2345)
```bash
[ ] grep "TS2345" logs/argument-errors.txt | tee logs/ts2345.txt

# For each error:
#   1. Check expected type
#   2. Check actual type
#   3. Add type conversion or fix type
```

**Common Patterns**:
```typescript
// Type conversion needed
const id: string = '123';
someFunction(parseInt(id));  // If expects number

// Union type issue
function foo(x: string | number) {}
const val: string = '123';
foo(val);  // Should work, check for type narrowing issues

// Object shape mismatch
interface Expected { id: string; name: string; }
const obj = { id: '1', name: 'Test', extra: 'field' };
foo(obj);  // May need: foo({ id: obj.id, name: obj.name })
```

#### 5.2.4: Validate Argument Fixes
```bash
[ ] npm run type-check 2>&1 | grep -c -E "TS2554|TS2345" > logs/argument-errors-after.txt
[ ] echo "Argument errors remaining: $(cat logs/argument-errors-after.txt)"
```

#### 5.2.5: Commit Argument Fixes
```bash
[ ] git add -A
[ ] git commit -m "fix: resolve function argument errors

Fix TS2554/TS2345 argument type mismatches:
- Add missing function arguments
- Make parameters optional where appropriate
- Add type conversions for number/string
- Fix object shape mismatches
- Update function signatures

Errors fixed: ~77 argument errors
Error count: [update after type-check]"
```

**Expected Error Reduction**: 100 → ~50 errors

---

### Step 5.3: Create Phase 5 Checkpoint ✓
```bash
[ ] npm run type-check 2>&1 | grep -c "error TS" > logs/after-phase5.txt
[ ] git tag backup/phase-5-complete-$(date +%Y-%m-%d)
[ ] git push origin consolidate/typescript-fixes-$(date +%Y%m%d)
```

---

## Phase 6: Final Integration and Validation (Days 20-22)

### Step 6.1: Merge fix/typescript-critical-errors Branch ✓

#### 6.1.1: Review Branch Status
```bash
[ ] git fetch origin
[ ] git log --oneline origin/fix/typescript-critical-errors ^HEAD | head -20
[ ] git diff --stat origin/fix/typescript-critical-errors | head -50
```

#### 6.1.2: Merge Branch
```bash
[ ] git merge origin/fix/typescript-critical-errors -m "Merge fix/typescript-critical-errors branch"

# Expect conflicts due to our manual fixes
[ ] git status | grep "both modified" | tee logs/merge-conflicts.txt
```

#### 6.1.3: Resolve Merge Conflicts
Priority order when resolving conflicts:
1. Our manual fixes (current branch) - HIGHEST
2. fix/typescript-critical-errors - REFERENCE
3. Use best parts from both

```bash
# For each conflict:
[ ] git diff <conflicted-file>
#   1. Review both versions
#   2. Choose our version if we already fixed it
#   3. Take their version if it's a new fix
#   4. Combine if both have good changes
#   5. git add <file>

[ ] git status | grep "both modified"
# Repeat until no conflicts remain
```

#### 6.1.4: Validate Merge
```bash
[ ] npm run type-check 2>&1 | grep -c "error TS" > logs/after-merge.txt
[ ] echo "Errors after merge: $(cat logs/after-merge.txt)"
[ ] git diff --stat HEAD~1 | tee logs/merge-stats.txt
```

#### 6.1.5: Complete Merge
```bash
[ ] git add -A
[ ] git commit
# Use default merge message or customize
```

**Expected Error Reduction**: 50 → 0-10 errors

---

### Step 6.2: Final Error Cleanup ✓

#### 6.2.1: Identify Remaining Errors
```bash
[ ] npm run type-check 2>&1 | grep "error TS" | tee logs/final-errors.txt
[ ] cat logs/final-errors.txt | wc -l
```

#### 6.2.2: Fix Each Remaining Error
```bash
# Group errors by file
[ ] cat logs/final-errors.txt | cut -d"(" -f1 | sort -u | tee logs/final-error-files.txt

# For each file:
#   1. Review all errors in that file
#   2. Fix systematically
#   3. Test: npm run type-check 2>&1 | grep "<filename>"
#   4. Commit when file is clean
```

#### 6.2.3: Achieve Zero Errors
```bash
[ ] npm run type-check
# Expected: "Found 0 errors"

[ ] echo "SUCCESS: TypeScript compilation clean!" | tee logs/success.txt
```

---

### Step 6.3: Final Validation ✓

#### 6.3.1: Full Type Check
```bash
[ ] npm run type-check 2>&1 | tee logs/final-type-check.txt
[ ] grep "Found 0 errors" logs/final-type-check.txt || echo "ERRORS REMAIN!"
```

#### 6.3.2: Build Verification
```bash
[ ] rm -rf .next
[ ] npm run build 2>&1 | tee logs/final-build.txt
[ ] grep "Compiled successfully" logs/final-build.txt || echo "BUILD FAILED!"
```

#### 6.3.3: Test Suite
```bash
[ ] npm run test 2>&1 | tee logs/final-tests.txt
[ ] grep "Tests:.*passed" logs/final-tests.txt
```

#### 6.3.4: Lint Check
```bash
[ ] npm run lint 2>&1 | tee logs/final-lint.txt
```

#### 6.3.5: Bundle Size Check
```bash
[ ] npm run build
[ ] du -sh .next/static/chunks/*.js | sort -h | tail -20 | tee logs/bundle-sizes.txt
```

---

### Step 6.4: Final Commit and Tag ✓

```bash
[ ] git add -A
[ ] git commit -m "feat: achieve zero TypeScript errors

Complete TypeScript consolidation:
- Merged all fixes from stashes and branches
- Fixed all 775 TypeScript errors
- Verified build succeeds
- All tests passing

Final status:
- TypeScript errors: 0
- Build: ✓ Success
- Tests: ✓ Passing
- Lint: ✓ Clean

Closes #648"

[ ] git tag typescript-consolidation-complete-$(date +%Y-%m-%d)
[ ] git push origin consolidate/typescript-fixes-$(date +%Y%m%d)
[ ] git push origin typescript-consolidation-complete-$(date +%Y-%m-%d)
```

---

## Post-Consolidation Tasks

### Documentation ✓
- [ ] Update ARCHITECTURE.md with type changes
- [ ] Document breaking changes in CHANGELOG.md
- [ ] Update README.md with new type requirements
- [ ] Create migration guide for contributors

### Code Review ✓
- [ ] Self-review all changes
- [ ] Request team review of consolidation branch
- [ ] Address review feedback
- [ ] Get approval from at least 2 reviewers

### Create Pull Request ✓
```bash
[ ] gh pr create \
    --title "feat: Complete TypeScript consolidation - Zero errors" \
    --body "$(cat CONSOLIDATION_PR_TEMPLATE.md)" \
    --base main \
    --head consolidate/typescript-fixes-$(date +%Y%m%d) \
    --label "typescript,consolidation,enhancement"
```

### Testing ✓
- [ ] Run full E2E test suite
- [ ] Manual testing of critical paths
- [ ] Performance testing (build times, runtime)
- [ ] Browser compatibility testing

### Deployment Preparation ✓
- [ ] Test in staging environment
- [ ] Verify database migrations (if any)
- [ ] Check deployment scripts
- [ ] Update deployment documentation
- [ ] Notify team of upcoming merge

### Merge to Main ✓
```bash
[ ] git checkout main
[ ] git pull origin main
[ ] git merge consolidate/typescript-fixes-$(date +%Y%m%d)
[ ] git push origin main

[ ] gh pr close 648 --comment "Consolidated in consolidate/typescript-fixes-$(date +%Y%m%d)"
```

### Cleanup ✓
```bash
# Clean up stashes
[ ] git stash list
[ ] git stash drop stash@{0}
[ ] git stash drop stash@{1}  # Now stash@{0} after first drop

# Clean up branches (optional, keep for reference)
[ ] git branch -d consolidate/typescript-fixes-$(date +%Y%m%d)
# or keep: git branch -m consolidate/typescript-fixes-$(date +%Y%m%d) archive/typescript-consolidation

# Push final state
[ ] git push origin main
[ ] git push --tags
```

---

## Success Metrics

### Error Reduction
- **Start**: 775 errors
- **After Phase 1**: ~650 errors (-125)
- **After Phase 2**: ~400 errors (-250)
- **After Phase 3**: ~384 errors (-16)
- **After Phase 4**: ~200 errors (-184)
- **After Phase 5**: ~50 errors (-150)
- **After Phase 6**: **0 errors** (-50) ✅

### Build Status
- [ ] TypeScript: 0 errors ✅
- [ ] Build: Success ✅
- [ ] Tests: Passing ✅
- [ ] Lint: Clean ✅

### Code Quality
- [ ] Type coverage: >95% ✅
- [ ] No `any` types in new code ✅
- [ ] All imports resolved ✅
- [ ] No runtime type errors ✅

---

## Troubleshooting

### If Error Count Increases
```bash
# Identify new errors
git diff HEAD~1 --name-only | while read file; do
  npm run type-check 2>&1 | grep "$file"
done

# Rollback if needed
git reset --hard HEAD~1

# Or rollback to phase checkpoint
git reset --hard backup/phase-N-complete
```

### If Build Fails
```bash
# Clear build cache
rm -rf .next node_modules/.cache

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Rebuild
npm run build
```

### If Tests Fail
```bash
# Run specific test
npm run test -- --testPathPattern=<pattern>

# Update snapshots if needed
npm run test -- -u

# Check for type errors in tests
npm run type-check | grep "__tests__"
```

### If Merge Conflicts Are Overwhelming
```bash
# Abort merge
git merge --abort

# Try different strategy
git merge -X ours origin/fix/typescript-critical-errors
# or
git merge -X theirs origin/fix/typescript-critical-errors

# Or merge specific files only
git checkout origin/fix/typescript-critical-errors -- <specific-file>
```

---

## Notes

### Best Practices
- ✅ Commit often (after each file or logical group)
- ✅ Test after each commit
- ✅ Create backup tags before risky operations
- ✅ Document unusual fixes in commit messages
- ✅ Keep logs for reference

### Tips
- Use `npm run type-check -- --noEmit` for faster checks
- Use `git stash push -m "Description"` for descriptive stashes
- Use `git log --oneline --graph` to visualize branch history
- Use `git diff --stat` to see overview of changes

---

**Document Version**: 1.0
**Created**: 2025-10-23
**Status**: Ready for Execution
**Estimated Duration**: 16-22 days (3-4 weeks)
