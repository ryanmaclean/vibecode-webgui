# Immediate Fixes Checklist
**CRITICAL BLOCKERS - Fix These First**

⚠️ **STOP:** Do not proceed with any new development until these are fixed!

---

## Fix #1: Duplicate Prisma Client Declaration

**File:** `src/lib/prisma.ts`

**Problem:** Variable `prismaClient` declared twice (lines 21 and 115-126)

**Fix:** DELETE lines 115-126 (duplicate declaration)
```typescript
// DELETE THESE LINES (115-126):
const prismaClient = isBuilding
  ? ({} as PrismaClient)
  : (globalForPrisma.prisma ?? new PrismaClient({
      log: process.env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['error'],
      datasources: {
        db: {
          url: getDatabaseUrl(),  // Also references undefined function
        },
      },
    }))
```

**Why:** The correct initialization is already done at lines 21-103

**Test After Fix:**
```bash
npm run type-check
# Should pass without "Identifier 'prismaClient' has already been declared" error
```

**Priority:** 🔴 CRITICAL - Blocks all database operations

---

## Fix #2: Duplicate Logger Export

**File:** `src/lib/logger.ts`

**Problem:** Export `logger` declared twice (lines 111 and 117)

**Fix:** DELETE line 117 (duplicate export)
```typescript
// LINE 111 - KEEP THIS:
export const logger: StructuredLogger = baseLogger;

// LINE 117 - DELETE THIS:
export const logger: StructuredLogger = baseLogger;  // ❌ DELETE
```

**Test After Fix:**
```bash
npm run build
# Should not show "Identifier 'logger' has already been declared" error
```

**Priority:** 🔴 CRITICAL - Blocks build

---

## Fix #3: Duplicate Event Destructuring

**File:** `src/app/api/auth/login-tracking/route.ts`

**Problem:** Variable `event` destructured twice on line 106

**Fix:** DELETE the second destructuring statement
```typescript
// CURRENT (line 106):
const { event, userId, email, provider, sessionId, ...otherMetadata } = validatedData;
const { event, userId, email, provider, sessionId, loginMethod } = validatedData;  // ❌ DELETE THIS LINE

// AFTER FIX:
const { event, userId, email, provider, sessionId, loginMethod, ...otherMetadata } = validatedData;
```

**Note:** Merge both destructuring into one statement, including `loginMethod`

**Test After Fix:**
```bash
npm run build
# Should not show "Identifier 'event' has already been declared" error
```

**Priority:** 🔴 CRITICAL - Blocks build

---

## Fix #4: Duplicate Conversation ID Destructuring

**File:** `src/app/api/chat/stream/route.ts`

**Problem:** Variable `conversationId` destructured twice on line 43

**Fix:** DELETE one of the duplicate lines
```typescript
// CURRENT (line 43):
const { conversationId, message, model, workspaceId, files, enableWebSearch, enableRAG } = validatedData;
const { conversationId, message, model, workspaceId, files, enableWebSearch, enableRAG } = validatedData;  // ❌ DELETE THIS LINE

// AFTER FIX (keep only one):
const { conversationId, message, model, workspaceId, files, enableWebSearch, enableRAG } = validatedData;
```

**Test After Fix:**
```bash
npm run build
# Should not show "Identifier 'conversationId' has already been declared" error
```

**Priority:** 🔴 CRITICAL - Blocks build

---

## Fix #5: Duplicate Try-Catch Block

**File:** `src/app/api/health/route.ts`

**Problem:** Two catch blocks for same try (lines 94-108)

**Fix:** DELETE lines 99-108 (second catch block)
```typescript
// KEEP LINES 94-97:
  } catch (error) {
    console.error('Health check error:', error)
    return NextResponse.json(healthCheckResponse, { status: 200 })

// DELETE LINES 99-108:
  } catch (error) {  // ❌ DELETE FROM HERE
    console.error('Health check failed with error:', error)
    return NextResponse.json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      requestId
    }, { status: 503 })
  }  // ❌ DELETE TO HERE
```

**Note:** Keep first catch block (returns 200), or decide which error handling is correct

**Test After Fix:**
```bash
npm run build
# Should not show "Expected a semicolon" error at line 99
```

**Priority:** 🔴 CRITICAL - Blocks build

---

## Fix #6: WebSocket Syntax Error

**File:** `src/app/api/files/sync/route.ts`

**Problem:** Invalid syntax at line 230 ("Expected ',', got 'if'")

**Fix:** Need to see more context, but likely missing closing brace or statement terminator before line 230

**Steps:**
1. View lines 220-240 in the file
2. Look for:
   - Missing closing braces `}`
   - Missing semicolons `;`
   - Incomplete statements before line 230
3. Ensure proper statement termination before the if statement

**Common issue:** Object literal or function call not properly closed

**Test After Fix:**
```bash
npm run type-check
# Should not show "Expected ','" error at line 230
```

**Priority:** 🔴 CRITICAL - Blocks build

---

## Fix #7: ESLint Configuration

**File:** `eslint.config.js` (or `.eslintrc.*`)

**Problem:** "Identifier '.default' has already been declared"

**Likely Cause:** Duplicate import or export in ESLint config

**Fix Steps:**
1. Check for duplicate `default` exports
2. Look for conflicting import statements
3. Ensure ESLint plugins are not imported twice
4. Check for merge conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`)

**Test After Fix:**
```bash
npm run lint
# Should run without syntax error
```

**Priority:** 🔴 CRITICAL - Blocks code quality checks

---

## Fix #8: Container API Reference Error

**File:** `src/app/api/containers/route.ts`

**Problem:** Function `createEnhancedContainerSchema` called at line 72 before definition

**Fix Options:**

**Option A:** Move function definition before line 72

**Option B:** Use function hoisting by changing to function declaration:
```typescript
// Instead of:
const createEnhancedContainerSchema = () => { ... }

// Use:
function createEnhancedContainerSchema() { ... }
```

**Option C:** Check if function is imported from another file and fix import

**Test After Fix:**
```bash
npm test -- tests/api-validation-phase4-batch2.test.ts
# Container tests should not show "is not defined" error
```

**Priority:** 🟠 HIGH - Blocks container management

---

## Quick Verification Script

After making fixes, run this verification:

```bash
#!/bin/bash
echo "🔍 Running Integration Validation..."

echo "1️⃣ Checking TypeScript..."
npm run type-check || { echo "❌ TypeScript check failed"; exit 1; }
echo "✅ TypeScript passed"

echo "2️⃣ Checking ESLint..."
npm run lint || { echo "❌ ESLint check failed"; exit 1; }
echo "✅ ESLint passed"

echo "3️⃣ Building application..."
npm run build || { echo "❌ Build failed"; exit 1; }
echo "✅ Build passed"

echo "4️⃣ Running tests..."
npm test || { echo "⚠️ Some tests failed"; }

echo "🎉 All critical checks passed!"
```

Save as `verify-fixes.sh` and run: `bash verify-fixes.sh`

---

## Fix Order

Fix in this exact order for best results:

1. ✅ Fix #2 (Logger) - Simplest, blocks everything
2. ✅ Fix #1 (Prisma) - Critical for database
3. ✅ Fix #3 (Login Tracking) - Quick syntax fix
4. ✅ Fix #4 (Chat Stream) - Quick syntax fix
5. ✅ Fix #5 (Health Check) - Remove duplicate catch
6. ✅ Fix #6 (WebSocket) - May need investigation
7. ✅ Fix #7 (ESLint) - Check config file
8. ✅ Fix #8 (Container API) - Move or hoist function

**Estimated Time:** 2-4 hours if done carefully

---

## After All Fixes

### Step 1: Verify Build
```bash
npm run build
```
**Expected:** ✅ Successful build with no errors

### Step 2: Run Type Check
```bash
npm run type-check
```
**Expected:** ✅ No TypeScript errors

### Step 3: Run Tests
```bash
npm test
```
**Expected:** ⚠️ Most tests passing (some may still fail)

### Step 4: Start Application
```bash
npm run dev
```
**Expected:** ✅ Application starts without errors

### Step 5: Test Critical Endpoints
```bash
# Health check
curl http://localhost:3000/api/health

# Database connection
curl http://localhost:3000/api/monitoring/metrics
```
**Expected:** ✅ Endpoints respond correctly

---

## Git Workflow

After fixes are complete:

```bash
# 1. Create fix branch
git checkout -b fix/integration-critical-blockers

# 2. Make fixes (one commit per fix)
git add src/lib/logger.ts
git commit -m "fix: remove duplicate logger export"

git add src/lib/prisma.ts
git commit -m "fix: remove duplicate prismaClient declaration"

# ... etc for each fix

# 3. Verify all checks pass
npm run build && npm run type-check && npm run lint && npm test

# 4. Push and create PR
git push origin fix/integration-critical-blockers

# 5. Request review from team leads
```

---

## Red Flags to Watch For

While fixing, watch for these issues:

- ⚠️ **Merge conflict markers:** `<<<<<<<`, `=======`, `>>>>>>>`
- ⚠️ **Commented out code:** Old implementations left commented
- ⚠️ **Multiple return statements:** Dead code after first return
- ⚠️ **Unused imports:** May indicate incomplete refactoring
- ⚠️ **Console.logs in production:** Debug statements left in
- ⚠️ **TODO/FIXME comments:** Temporary solutions marked for fix

---

## Success Checklist

Before declaring fixes complete:

- [ ] All 8 fixes applied
- [ ] `npm run build` succeeds
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] No duplicate declarations remain
- [ ] No syntax errors remain
- [ ] Application starts successfully
- [ ] Health check endpoint works
- [ ] Database connection works
- [ ] At least 80% of tests passing

---

## Need Help?

**If stuck on a fix:**
1. Read full error message carefully
2. Check surrounding code context (20 lines before/after)
3. Look for merge conflict markers
4. Compare with git history: `git log --oneline --graph`
5. Review PR that introduced the issue
6. Ask team lead who worked on that file

**Emergency Contacts:**
- Database issues: Database team lead
- Build issues: Infrastructure team lead
- Test failures: Testing team lead
- Security concerns: Security team lead

---

**Remember:** Take your time, fix one issue at a time, test after each fix, commit frequently.

**Goal:** Get to a buildable, runnable application as quickly as possible.
