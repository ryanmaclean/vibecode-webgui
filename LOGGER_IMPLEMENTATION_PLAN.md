# 🔧 Logger Implementation Plan - Issue #657

**Status**: In Progress  
**Agent**: Claude (Cascade) via MCP Roundtable  
**Priority**: 🔴 CRITICAL

---

## 📋 Implementation Steps

### ✅ Step 1: Create New Pino Logger
**File**: `src/lib/logger-new.ts`

**Features**:
- Pino-based implementation (no circular deps)
- Environment-based configuration
- Datadog transport integration
- Pretty printing for development
- Compatible API with old logger
- Server/client compatible
- TypeScript types

**Dependencies Added**:
```bash
npm install --save pino pino-pretty pino-datadog
```

---

### 🔄 Step 2: Test New Logger (Current)

**Actions**:
1. Create test file to verify logger works
2. Test Datadog integration
3. Verify no circular dependencies
4. Check build compiles

**Test Commands**:
```bash
cd /Users/studio/.code/working/vibecode-webgui/fixes/logger

# Test logger
node -e "const {logger} = require('./src/lib/logger-new.ts'); logger.info('Test')"

# Build test
npm run build

# Check for circular deps
npx madge --circular src/lib/logger-new.ts
```

---

### 📝 Step 3: Migration Strategy

**Option A: Gradual Migration (Safer)**
```bash
# Keep old logger as logger.ts
# New logger as logger-new.ts
# Gradually migrate files one by one
```

**Option B: Atomic Switch (Faster)**
```bash
# Backup old logger
mv src/lib/logger.ts src/lib/logger.old.ts

# Deploy new logger
mv src/lib/logger-new.ts src/lib/logger.ts

# Test build
npm run build

# If fails, rollback
```

**Recommendation**: Option B (Atomic Switch)
- Cleaner
- Easier to test
- All 316 files get fix at once
- Can rollback if issues

---

### 🔄 Step 4: Deploy New Logger

```bash
# Backup current logger
cp src/lib/logger.ts src/lib/logger.backup.ts

# Deploy new Pino logger
cp src/lib/logger-new.ts src/lib/logger.ts

# Update exports if needed
# (Should be compatible, so no changes needed)

# Test build
npm run build

# If successful
git add src/lib/logger.ts package.json package-lock.json
git commit -m "feat: Replace console logger with production Pino logger

- Add Pino, pino-pretty, pino-datadog dependencies
- Environment-based log levels
- Datadog integration for production
- Pretty printing for development
- Zero circular dependencies
- Compatible API with existing logger

Fixes #657"
```

---

### ✅ Step 5: Verify All 316 Files Work

**Verification Script**:
```bash
# Count files using logger
grep -r "import.*logger" src/ --include="*.ts" --include="*.tsx" | wc -l

# Check for commented imports (should be 0)
grep -r "// import.*logger" src/ --include="*.ts" --include="*.tsx" | wc -l

# Verify build
npm run build

# Run tests
npm run test

# Check type errors
npm run type-check
```

---

### 🔄 Step 6: Test Datadog Integration

**Local Testing**:
```bash
# Set Datadog env vars
export DD_API_KEY="your-key-here"
export DD_SITE="datadoghq.com"
export DD_SERVICE="vibecode-webgui"
export NODE_ENV="production"

# Start app
npm run start

# Generate logs
curl http://localhost:3000/api/health

# Check Datadog console for logs
```

**Production Testing**:
- Deploy to staging
- Generate test traffic
- Verify logs appear in Datadog
- Check log levels and formatting

---

### 📝 Step 7: Documentation

**Files to Update**:
1. `README.md` - Add logger configuration section
2. `docs/LOGGER.md` - Create logger documentation
3. `.env.example` - Add logger env vars
4. `CHANGELOG.md` - Document logger upgrade

**Logger Env Vars**:
```bash
# Logger Configuration
LOG_LEVEL=debug              # Log level: error, warn, info, debug
DD_API_KEY=xxx               # Datadog API key
DD_SITE=datadoghq.com        # Datadog site
DD_SERVICE=vibecode-webgui   # Service name
NODE_ENV=development         # Environment
```

---

### ✅ Step 8: Create PR

**PR Checklist**:
- [ ] New Pino logger implemented
- [ ] Dependencies added
- [ ] Build compiles
- [ ] Tests pass
- [ ] Type checking passes
- [ ] Datadog integration tested
- [ ] Documentation updated
- [ ] No circular dependencies

**PR Command**:
```bash
git push origin fix/restore-proper-logger

gh pr create \
  --title "feat: Replace console logger with production Pino logger" \
  --body "## Changes
- Implement Pino-based logger with Datadog integration
- Replace console wrapper with proper structured logging
- Add environment-based configuration
- Zero circular dependencies

## Testing
- ✅ Build compiles
- ✅ All tests pass
- ✅ Type checking passes
- ✅ Datadog integration verified
- ✅ 316 files using logger work correctly

## Performance
- Pino is 5x faster than Winston
- Minimal memory overhead
- Async logging for production

Fixes #657" \
  --base main
```

---

## 🚦 Current Status

| Step | Status | Notes |
|------|--------|-------|
| 1. Create Pino logger | ✅ Complete | File: src/lib/logger-new.ts |
| 2. Test logger | 🔄 In Progress | Running tests now |
| 3. Migration strategy | 📝 Planned | Atomic switch recommended |
| 4. Deploy | ⏸️ Pending | After tests pass |
| 5. Verify 316 files | ⏸️ Pending | After deployment |
| 6. Test Datadog | ⏸️ Pending | Need API key |
| 7. Documentation | ⏸️ Pending | After deployment |
| 8. Create PR | ⏸️ Pending | Final step |

---

## 🎯 Acceptance Criteria

- [x] Pino logger created
- [ ] Zero circular dependencies verified
- [ ] Build compiles successfully
- [ ] All tests pass
- [ ] Type checking passes
- [ ] Datadog integration works
- [ ] All 316 files functional
- [ ] Documentation complete
- [ ] PR created and reviewed

---

## 📊 Impact Analysis

**Before (Console Wrapper)**:
- Basic console output
- No structured logging
- No external integration
- Limited debugging

**After (Pino)**:
- Structured JSON logs
- Datadog integration
- Performance optimized
- Production-ready
- Full observability

---

## 🔗 Related Issues

- #657 - This issue (Logger restoration)
- #658 - TypeScript validation (may need logger)
- #661 - Test infrastructure (uses logger)

---

**Next Action**: Test the new logger implementation
