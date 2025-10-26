# TypeScript Error Fixing Guide - Issue #658

## Overview
This guide documents the systematic approach to reducing TypeScript errors in the vibecode-webgui codebase from 780+ errors to zero.

## Progress Tracker

### Starting Point (2025-10-25)
- **Total Errors**: 726 (after initial cleanup)
- **Target**: Systematic reduction by category

### Completed
- ✅ **Phase 1**: TS2304 errors (missing imports) - **56 errors fixed**
  - Initial count: 79 errors
  - Final count: 23 errors
  - Reduction: 71%
  - PR: #689

### Remaining Categories (Priority Order)

1. **TS2339 (237 errors)** - Property does not exist on type
   - Prisma client type issues
   - Missing interface properties
   - Incorrect type assertions

2. **TS2554 (58 errors)** - Argument count mismatch
   - API signature changes
   - Function parameter mismatches

3. **TS2614 (53 errors)** - Class incorrectly extends base class
   - Inheritance issues
   - Method signature mismatches

4. **TS2322 (33 errors)** - Type not assignable
   - Type compatibility issues

5. **TS2345 (30 errors)** - Argument type not assignable
   - Parameter type mismatches

## Error Fixing Patterns

### Pattern 1: TS2304 - Cannot find name

**Symptoms:**
```
error TS2304: Cannot find name 'logger'.
error TS2304: Cannot find name 'createProblemDetailsFromError'.
```

**Solution Process:**
1. Identify the missing name
2. Search for its export in codebase:
   ```bash
   grep -r "export.*<name>" src/lib
   ```
3. Add appropriate import at top of file
4. If not found, check if it needs to be created or is incorrectly named

**Common Fixes:**
```typescript
// Logger import
import { logger } from '@/lib/logger'

// Error response utilities
import { createErrorResponseFromError, createProblemResponse } from '@/lib/utils/api-response'

// Vector DB types
import { VectorDbErrorHandler, VectorDbErrorType, VectorDbError } from '@/lib/vector-db/vector-db-error-handler'
```

### Pattern 2: Error Response Standardization

**Old Pattern (Incorrect):**
```typescript
return createProblemDetailsFromError(error, 500, {
  instance: '/api/endpoint',
  traceId: requestId,
  fallbackTitle: 'Operation failed'
})

return ErrorResponses.notFound('Resource not found', requestId)
```

**New Pattern (Correct):**
```typescript
// For unknown errors
return createErrorResponseFromError(
  error,
  500,
  'Operation failed',
  requestId
)

// For specific errors
return createProblemResponse({
  title: 'Resource not found',
  status: 404,
  traceId: requestId
})
```

### Pattern 3: Logger Usage

**Consistent Logger Pattern:**
```typescript
import { logger } from '@/lib/logger'

// Instead of console.log
logger.info('Operation successful', { context: 'details' })
logger.error('Operation failed', { error, context })

// For child loggers with context
import { createChildLogger } from '@/lib/logger'
const logger = createChildLogger({ module: 'security', scope: 'keychain' })
```

### Pattern 4: TypeScript Configuration

**Managing Type Exclusions:**
```json
// tsconfig.json
{
  "exclude": [
    "node_modules",
    "tests/**/*.ts",
    "src/components/terminal/**/*",
    "types/@xterm/**/*"  // Exclude conflicting type definitions
  ]
}
```

**Removing Conflicting Types:**
```bash
# Remove old @types packages that conflict with built-in types
npm uninstall @types/xterm

# Remove custom type definition files if the package provides its own
rm -rf types/@xterm
```

## Systematic Fixing Workflow

### 1. Assessment Phase
```bash
# Get total error count
npm run type-check 2>&1 | grep "^src/" | wc -l

# Get error distribution
npm run type-check 2>&1 | grep "error TS" | sed 's/.*error TS\([0-9]*\).*/TS\1/' | sort | uniq -c | sort -rn

# Get errors by file
npm run type-check 2>&1 | grep "^src/" | sed 's/(.*//' | sort | uniq -c | sort -rn | head -30
```

### 2. Category Selection
- Pick 1-2 error categories (50-100 errors)
- Focus on errors with consistent patterns
- Prioritize high-impact files

### 3. Fixing Phase
- Fix errors systematically by pattern
- Test incrementally
- Commit related fixes together

### 4. Verification Phase
```bash
# Check error reduction
npm run type-check 2>&1 | grep "TS<error-code>" | wc -l

# Verify no new errors introduced
git diff main --name-only | grep "\.ts$" | xargs npm run type-check 2>&1
```

### 5. Documentation Phase
- Document patterns used
- Update this guide with new learnings
- Create PR with clear description

## Common Issues and Solutions

### Issue: Conflicting Type Definitions
**Problem:** Multiple sources defining the same types
**Solution:**
1. Remove old `@types/*` packages
2. Exclude custom type directories
3. Use package-provided types

### Issue: Circular Dependencies
**Problem:** Modules importing each other
**Solution:**
1. Use centralized logger from `@/lib/logger`
2. Extract shared types to interface files
3. Use dependency injection

### Issue: Missing Interface Properties
**Problem:** Accessing properties not in type definition
**Solution:**
1. Add properties to interface if they should exist
2. Create extended interface for additional properties
3. Use type assertion only if necessary

### Issue: Metrics/Telemetry Not Defined
**Problem:** Using `metrics` without import
**Solution:**
1. Import from monitoring library
2. Wrap in `enableMetrics` check
3. Consider using console.log for now if library is complex

## File-Specific Patterns

### API Routes (`/app/api/**/route.ts`)
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createErrorResponseFromError, createProblemResponse } from '@/lib/utils/api-response'

export async function POST(request: NextRequest) {
  try {
    // ... operation
    return NextResponse.json({ success: true })
  } catch (error) {
    return createErrorResponseFromError(error, 500, 'Operation failed')
  }
}
```

### Monitoring Files (`/lib/monitoring/**/*.ts`)
```typescript
import { logger } from '@/lib/logger'
import { datadogMetrics } from './datadog-metrics'

export function monitorOperation(name: string) {
  logger.info(`Monitoring ${name}`)
  datadogMetrics.increment(`operation.${name}`)
}
```

### Vector Database Adapters (`/lib/vector/**/*.ts`)
```typescript
import { VectorDbErrorHandler, VectorDbErrorType, VectorDbError } from '@/lib/vector-db/vector-db-error-handler'

interface PostgreSQLVectorConfig extends VectorDatabaseConfig {
  enableLogging?: boolean
  enableMetrics?: boolean
  // ... other properties
}
```

## Testing Strategy

### Before Committing
1. Run type-check on modified files
2. Verify no new errors introduced
3. Check that fixes don't break functionality

### Commands
```bash
# Type-check specific file
npx tsc --noEmit path/to/file.ts

# Type-check all files
npm run type-check

# Check specific error type
npm run type-check 2>&1 | grep "TS2304"
```

## Progress Tracking

### Metrics to Track
- Total error count
- Errors fixed per PR
- Error reduction percentage
- Categories completed

### Reporting Format
```markdown
## TypeScript Error Reduction - PR #XXX

**Errors Fixed**: XX
**Category**: TSXXXX - Description
**Impact**: XX% reduction

### Changes
- Fixed imports in N files
- Standardized error handling in N routes
- Added missing type definitions

### Before/After
- TSXXXX: XX → XX (XX fixed)
- Total: XXX → XXX (XX fixed)
```

## Next Steps

### Recommended Order
1. ✅ **TS2304** - Missing imports (COMPLETED)
2. **TS2339** - Property does not exist (NEXT - 237 errors)
   - Focus on Prisma client issues first
   - Fix interface property mismatches
3. **TS2554** - Argument count (58 errors)
   - Update function signatures
   - Fix API parameter mismatches
4. **TS2614** - Class inheritance (53 errors)
   - Fix method signatures
   - Update base class implementations

### For Each Category
1. Analyze error patterns
2. Create systematic fix approach
3. Fix 50-100 errors
4. Test and verify
5. Create PR with documentation
6. Update this guide

## Resources

### Useful Commands
```bash
# Find exports
grep -r "export.*FunctionName" src/lib

# Count specific error
npm run type-check 2>&1 | grep "TS2304" | wc -l

# List files with errors
npm run type-check 2>&1 | grep "^src/" | cut -d'(' -f1 | sort -u

# Get error details
npm run type-check 2>&1 | grep "error TS" | head -20
```

### Documentation
- [TypeScript Error Reference](https://typescript-error-translator.vercel.app/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)

## Contributing

When fixing TypeScript errors:
1. Follow patterns in this guide
2. Update this document with new patterns
3. Document your changes in PR
4. Test thoroughly before committing
5. Keep fixes focused and systematic

---

**Last Updated**: 2025-10-25
**Current Status**: 56 errors fixed, 670+ remaining
**Next Target**: TS2339 errors (Prisma client issues)
