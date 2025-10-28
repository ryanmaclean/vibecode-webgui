# Build Fix Action Plan

## Critical Build Blockers

### Issue 1: lightningcss Native Module Not Found

**Error:**
```
Error: Cannot find module '../lightningcss.darwin-arm64.node'
```

**Fix:**
```bash
# Reinstall lightningcss with native bindings
npm uninstall lightningcss
npm install lightningcss@1.19.0 --save
# OR rebuild native modules
npm rebuild
```

### Issue 2: AI SDK Import Path Issue

**Error:**
```
Module not found: Package path ./react is not exported from package ai
```

**Root Cause:** Incorrect import in `/src/app/generative-ui/page.tsx`

**Fix:** Import was automatically corrected to:
```javascript
import { useChat } from '@ai-sdk/react'; // ✅ Correct
```

### Issue 3: Enhanced AI Manager Module Missing

**Error:**
```
Module not found: Can't resolve './enhanced-ai-manager'
```

**Investigation Needed:**
```bash
# Find the importing file
grep -r "enhanced-ai-manager" src/
# Either create the module or remove the import
```

### Issue 4: Webpack Error Constructor Issue

**Error:**
```
TypeError: _webpack.WebpackError is not a constructor
```

**Likely Cause:** Next.js 15.5.3 vs @next/swc 15.5.4 version mismatch

**Fix:**
```bash
# Option 1: Align SWC version
npm install @next/swc-darwin-arm64@15.5.3 --save-exact

# Option 2: Update Next.js (if compatible)
npm install next@15.5.4 --save-exact
```

## Missing File Implementations

### 14 Files Without Backups

Create minimal stub implementations that export basic functions/components:

#### 1. `/src/app/api/health/vector-metrics/route.ts`
```typescript
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Vector metrics temporarily unavailable - pending implementation'
  });
}
```

#### 2. `/src/app/api/monitoring/pool-alerts/route.ts`
```typescript
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    alerts: [],
    message: 'Pool alerts temporarily unavailable - pending implementation'
  });
}
```

#### 3-14. Other Missing Files
Use template:
```typescript
// Temporary stub - TODO: Restore from git history or reimplement
export default function PlaceholderComponent() {
  return null;
}

// OR for library files
export const placeholderFunction = () => {
  throw new Error('Feature temporarily disabled - implementation pending');
};
```

## Step-by-Step Fix Process

### Step 1: Fix Package Issues (30 min)
```bash
# 1. Fix lightningcss
npm rebuild lightningcss

# 2. Align Next.js versions
npm install @next/swc-darwin-arm64@15.5.3 --save-exact

# 3. Find enhanced-ai-manager issue
grep -r "enhanced-ai-manager" src/

# 4. Verify hi-base32 installed
npm list hi-base32
```

### Step 2: Create Missing File Stubs (60 min)

```bash
# Create all missing route handlers
touch src/app/api/health/vector-metrics/route.ts
touch src/app/api/monitoring/pool-alerts/route.ts

# Create all missing components
touch src/components/ai/AICodeReview.tsx

# Create all missing library files
touch src/lib/ai/smart-code-completion.ts
touch src/lib/ai/performance-optimization.ts
touch src/lib/ai/azureEmbeddingService.ts
touch src/lib/ai/agents/multi-agent-workflow.ts
touch src/lib/ai/local/ollama-client.ts
touch src/lib/ai/code-review-automation.ts
touch src/lib/ai/integration-testing.ts
touch src/lib/db/connection-pool-alerts.ts
touch src/lib/vector-db/vector-database-factory.ts
touch src/lib/vector-db/vector-db-error-handler-new.ts
touch src/lib/vector-db/base-vector-database-adapter.ts
```

### Step 3: Test Build (10 min)
```bash
npm run build 2>&1 | tee build-test.log
```

### Step 4: Address Remaining Errors (Variable)

If build still fails:
1. Review build-test.log for specific errors
2. Use git to find original implementations
3. Restore from git history if possible
4. Create minimal implementations otherwise

## Quick Win: Stub Template Generator

```bash
#!/bin/bash
# /Users/ryan.maclean/vibecode-webgui/scripts/create-stub.sh

FILE=$1
TYPE=${2:-"component"} # component, route, library

case $TYPE in
  "route")
    cat > "$FILE" << 'EOF'
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Temporarily unavailable - pending implementation'
  });
}
EOF
    ;;
  "component")
    cat > "$FILE" << 'EOF'
export default function TemporaryStub() {
  return (
    <div className="p-4 border border-yellow-500 bg-yellow-50 rounded">
      <p className="text-sm text-yellow-800">
        This feature is temporarily unavailable while we restore it.
      </p>
    </div>
  );
}
EOF
    ;;
  "library")
    cat > "$FILE" << 'EOF'
// Temporary stub - TODO: Restore implementation
export const placeholder = () => {
  console.warn('Feature temporarily disabled - implementation pending');
  return null;
};
EOF
    ;;
esac

echo "Created stub: $FILE"
```

Usage:
```bash
chmod +x scripts/create-stub.sh
./scripts/create-stub.sh src/app/api/health/vector-metrics/route.ts route
./scripts/create-stub.sh src/components/ai/AICodeReview.tsx component
./scripts/create-stub.sh src/lib/ai/smart-code-completion.ts library
```

## Testing Checklist

After build fixes:

- [ ] `npm run build` completes without errors
- [ ] `.next/build-manifest.json` exists
- [ ] Main page loads without errors
- [ ] Console shows no critical errors
- [ ] Authentication flow works
- [ ] Basic AI chat functionality works

## Rollback Plan

If fixes introduce new issues:

```bash
# Restore from git
git checkout HEAD~1 -- src/

# OR use specific commits
git log --oneline | head -20
git checkout <commit-hash> -- src/path/to/file
```

## Post-Fix Actions

Once build succeeds:

1. **Document technical debt**
   - List all stub implementations
   - Create issues for proper restoration
   - Prioritize based on usage

2. **Run test suite**
   ```bash
   npm run test:unit
   npm run test:integration
   ```

3. **Deploy to staging**
   - Test all major user flows
   - Verify no regressions

4. **Proceed with performance optimization**
   - Run baseline Lighthouse audit
   - Implement lazy loading
   - Measure improvements

---

**Time Estimate:** 2-4 hours for full build fix
**Risk:** Medium - Some features temporarily disabled
**Next Step:** After build passes, implement performance optimizations
