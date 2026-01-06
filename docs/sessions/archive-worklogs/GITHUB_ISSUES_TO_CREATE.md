# GitHub Issues to Create

This document contains templates for GitHub issues that should be created to track remaining TypeScript errors and improvements.

---

## Issue 1: Fix lucide-react Icon Import Type Definitions

**Title:** Fix lucide-react icon import type definition errors (47 files)

**Labels:** `bug`, `typescript`, `ui`, `medium-priority`

**Description:**

### Problem
TypeScript reports that 31 icons don't exist as named exports in `lucide-react` v0.395.0, even though they are present in the package. This affects 47 files across the codebase.

### Affected Icons
AlertTriangle, BookOpen, Brain, CheckCheck, Code, Command, Cursor, DollarSign, FileCode, FileSearch, GitBranch, Github, Globe, GripVertical, Keyboard, Maximize, Minimize, Paperclip, QrCode, Rocket, Share, Share2, TestTube, Tools, Train, TriangleAlert, UserCircle, Volume, Volume2

### Impact
- 47 files with TypeScript warnings
- Code compiles and runs successfully (non-blocking)
- May cause confusion for developers

### Proposed Solutions
1. Replace problematic icons with working alternatives (recommended)
2. Upgrade lucide-react to v0.400.0+
3. Add type declaration file

### Files to Fix
See `LUCIDE_REACT_ERRORS.md` for complete list of affected files.

### Acceptance Criteria
- [ ] All 47 files pass TypeScript type-check without warnings
- [ ] Icons render correctly in all themes
- [ ] Visual regression tests pass
- [ ] Documentation updated

### Estimated Effort
2-3 hours

### References
- `LUCIDE_REACT_ERRORS.md`
- `TYPESCRIPT_FIXES_SUMMARY.md`

---

## Issue 2: Fix API Route Type Mismatches

**Title:** Fix TypeScript type mismatches in API routes

**Labels:** `bug`, `typescript`, `backend`, `medium-priority`

**Description:**

### Problem
Several API routes have TypeScript type mismatches that don't prevent compilation but reduce type safety.

### Affected Files
1. `src/app/api/claude/session/route.ts` - Not all code paths return a value
2. `src/app/api/experiments/route.ts` - Type mismatch in boolean parameter
3. `src/app/api/monitoring/embeddings/route.ts` - Missing function arguments
4. `src/app/api/monitoring/pool/route.ts` - Missing module and property errors
5. `src/app/api/terminal/session/route.ts` - Type conversion errors
6. `src/app/api/uploads/pdf/route.ts` - Prisma.JsonObject namespace error

### Example Errors
```typescript
// src/app/api/claude/session/route.ts
error TS7030: Not all code paths return a value.

// src/app/api/experiments/route.ts
error TS2345: Argument of type '{} | null | undefined' is not assignable to parameter of type 'boolean | undefined'.
```

### Proposed Solution
Fix each API route individually:
1. Ensure all code paths return NextResponse
2. Add proper type guards for nullable values
3. Fix function call signatures
4. Use correct Prisma types

### Acceptance Criteria
- [ ] All API routes pass TypeScript type-check
- [ ] All endpoints tested with Postman/curl
- [ ] Error handling improved
- [ ] Type safety maintained

### Estimated Effort
3-4 hours (30-40 minutes per file)

---

## Issue 3: Export Missing Types from Component Files

**Title:** Export component types for re-export in index.ts files

**Labels:** `enhancement`, `typescript`, `frontend`, `low-priority`

**Description:**

### Problem
Index.ts files are trying to re-export types that aren't exported from source component files.

### Affected Files
- `/src/components/agents/index.ts`
- `/src/components/ai/index.ts`

### Example Errors
```typescript
Module '"./AgentConfigPanel"' declares 'AgentConfig' locally, but it is not exported.
Module '"./AgentConversationThread"' declares 'ThreadMessage' locally, but it is not exported.
```

### Proposed Solution
1. Export all types from source component files
2. Update index.ts re-exports
3. Add JSDoc comments for exported types

### Acceptance Criteria
- [ ] All types properly exported
- [ ] Index.ts files have no errors
- [ ] Types documented with JSDoc
- [ ] Type inference works correctly

### Estimated Effort
1-2 hours

---

## Issue 4: Fix Prisma JsonObject Type Error

**Title:** Fix Prisma.JsonObject namespace error in PDF upload route

**Labels:** `bug`, `typescript`, `backend`, `low-priority`

**Description:**

### Problem
```typescript
src/app/api/uploads/pdf/route.ts(113,21): error TS2694: 
Namespace '"/Users/studio/ai-tools/vibecode-webgui/node_modules/.prisma/client/default".Prisma' 
has no exported member 'JsonObject'.
```

### Root Cause
Using incorrect Prisma type import path or version mismatch.

### Proposed Solution
```typescript
// Instead of:
metadata: {
  jobId,
  blobName,
  queue: getQueueName()
} as Prisma.JsonObject

// Use:
metadata: {
  jobId,
  blobName,
  queue: getQueueName()
} as Record<string, any>

// Or import correctly:
import { Prisma } from '@prisma/client'
```

### Acceptance Criteria
- [ ] PDF upload route passes type-check
- [ ] Upload functionality tested
- [ ] Metadata properly typed

### Estimated Effort
15-30 minutes

---

## Issue 5: Add Pre-commit Type Checking

**Title:** Add pre-commit hooks for TypeScript type checking

**Labels:** `enhancement`, `devops`, `typescript`, `low-priority`

**Description:**

### Problem
TypeScript errors can be committed without detection, leading to build failures in CI/CD.

### Proposed Solution
Add Husky pre-commit hooks:

```bash
npm install --save-dev husky lint-staged
npx husky install
```

`.husky/pre-commit`:
```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

npm run type-check
```

`package.json`:
```json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "npm run type-check"
    ]
  }
}
```

### Acceptance Criteria
- [ ] Husky installed and configured
- [ ] Pre-commit hook runs type-check
- [ ] Failed type-check blocks commit
- [ ] Documentation updated

### Estimated Effort
1 hour

---

## Issue 6: Document Icon Usage Guidelines

**Title:** Create icon usage guidelines and design system documentation

**Labels:** `documentation`, `design-system`, `low-priority`

**Description:**

### Problem
No clear guidelines on which icons to use and how to import them correctly.

### Proposed Solution
Create documentation covering:
1. List of approved/working icons
2. Import patterns and best practices
3. Icon sizing and theming guidelines
4. Accessibility requirements
5. Common icon replacements

### Deliverables
- [ ] `docs/ICON_USAGE_GUIDELINES.md`
- [ ] Update Storybook with icon examples
- [ ] Add to design system documentation

### Acceptance Criteria
- [ ] Documentation complete and reviewed
- [ ] Examples provided for common use cases
- [ ] Integrated into onboarding docs

### Estimated Effort
2-3 hours

---

## Issue 7: Upgrade lucide-react (Future)

**Title:** Evaluate and upgrade lucide-react to latest stable version

**Labels:** `enhancement`, `dependencies`, `future`

**Description:**

### Problem
Current version (0.395.0) has type definition issues.

### Proposed Solution
1. Research latest stable version
2. Check breaking changes
3. Test in development environment
4. Create migration guide
5. Update all icon imports

### Risks
- May break existing icon imports
- Icon names may have changed
- Other dependencies may conflict

### Acceptance Criteria
- [ ] Latest version tested
- [ ] All icon imports updated
- [ ] No TypeScript errors
- [ ] Visual regression tests pass
- [ ] Migration guide created

### Estimated Effort
4-6 hours

---

## Priority Order

1. **High Priority:**
   - None (all critical issues fixed)

2. **Medium Priority:**
   - Issue 1: Fix lucide-react icon imports (47 files)
   - Issue 2: Fix API route type mismatches (6 files)

3. **Low Priority:**
   - Issue 3: Export missing types
   - Issue 4: Fix Prisma JsonObject error
   - Issue 5: Add pre-commit hooks
   - Issue 6: Document icon guidelines

4. **Future:**
   - Issue 7: Upgrade lucide-react

---

## Sprint Planning Recommendation

**Sprint 1:**
- Issue 1 (lucide-react icons) - 2-3 hours
- Issue 2 (API routes) - 3-4 hours
- Total: 5-7 hours (1 developer, 1 sprint)

**Sprint 2:**
- Issue 3 (type exports) - 1-2 hours
- Issue 4 (Prisma type) - 0.5 hours
- Issue 5 (pre-commit hooks) - 1 hour
- Total: 2.5-3.5 hours (1 developer, 1 sprint)

**Sprint 3:**
- Issue 6 (documentation) - 2-3 hours
- Issue 7 (upgrade lucide-react) - 4-6 hours
- Total: 6-9 hours (1 developer, 1 sprint)

---

**Created:** 2023-10-23  
**Last Updated:** 2023-10-23
