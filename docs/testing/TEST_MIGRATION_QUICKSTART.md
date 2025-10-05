# Test Migration Quick Start Guide

**Purpose**: Quick reference for migrating test files from `/src` to `/tests` using `migrate-tests.sh`

**Issue**: [#446](https://github.com/yourusername/vibecode-webgui/issues/446) - Fix Test Coverage - Move Tests from /src to /tests

---

## Quick Commands

### Dry-Run First (Always!)
```bash
# Preview what will happen - NO changes made
./scripts/migrate-tests.sh src/components
./scripts/migrate-tests.sh src/lib
./scripts/migrate-tests.sh src/hooks
```

### Execute Migration
```bash
# Actually move files and convert imports
./scripts/migrate-tests.sh src/components --execute
```

---

## Common Scenarios

### By Directory
```bash
# Migrate all component tests
./scripts/migrate-tests.sh src/components --execute

# Migrate all lib tests
./scripts/migrate-tests.sh src/lib --execute

# Migrate all hook tests
./scripts/migrate-tests.sh src/hooks --execute

# Migrate all utility tests
./scripts/migrate-tests.sh src/utils --execute
```

### By Subdirectory
```bash
# Migrate specific component subdirectory
./scripts/migrate-tests.sh src/components/workspace --execute

# Migrate specific lib subdirectory
./scripts/migrate-tests.sh src/lib/auth --execute
```

---

## What the Script Does

1. **Finds test files**: `*.test.ts`, `*.test.tsx`, `*.spec.ts`, `*.spec.tsx`
2. **Converts imports**: Relative paths (`../../../lib/foo`) → Absolute paths (`@/lib/foo`)
3. **Organizes by type**:
   - Unit tests → `tests/unit/`
   - Integration tests → `tests/integration/`
   - E2E tests → `tests/e2e/`
4. **Preserves git history**: Uses `git mv` to maintain file history
5. **Creates backup**: Automatic timestamped backup before execution

---

## Before/After Import Examples

### Before Migration
```typescript
// src/components/workspace/WorkspacePanel.test.tsx
import { render } from '@testing-library/react';
import WorkspacePanel from './WorkspacePanel';
import { useWorkspace } from '../../hooks/useWorkspace';
import { getConfig } from '../../lib/config';
import { formatDate } from '../../utils/date';
```

### After Migration
```typescript
// tests/unit/components/workspace/WorkspacePanel.test.tsx
import { render } from '@testing-library/react';
import WorkspacePanel from '@/components/workspace/WorkspacePanel';
import { useWorkspace } from '@/hooks/useWorkspace';
import { getConfig } from '@/lib/config';
import { formatDate } from '@/utils/date';
```

---

## Verification Checklist

### After Migration
- [ ] Run dry-run first to preview changes
- [ ] Review git status: `git status`
- [ ] Check import conversions: `git diff`
- [ ] Run tests: `npm test`
- [ ] Verify all tests pass
- [ ] Check for remaining relative imports (warnings in script output)

### Common Checks
```bash
# Check what changed
git status

# Review import changes
git diff

# Run all tests
npm test

# Run specific test suite
npm test -- tests/unit/components

# Check for remaining relative imports
grep -r "from '\.\.\/" tests/
```

---

## Troubleshooting

### Issue: "Uncommitted changes detected"
**Solution**: Commit or stash changes first
```bash
git add .
git commit -m "WIP: before test migration"
./scripts/migrate-tests.sh src/components --execute
```

### Issue: "Import validation issues detected"
**Solution**: Review warnings for remaining relative imports
- Check script output for specific files
- Manually fix complex relative imports
- Re-run script or fix manually

### Issue: Tests fail after migration
**Solution**: Check import paths
```bash
# Find failing test
npm test -- --verbose

# Check for import issues in specific file
cat tests/unit/path/to/test.test.ts | grep "from"

# Fix manually if needed
# Then re-run tests
npm test
```

### Issue: "Backup directory already exists"
**Solution**: Script auto-removes old backups
- If concerned, manually preserve: `mv .test-migration-backup backup_YYYYMMDD`
- Then re-run migration

---

## Best Practices

### 1. Always Dry-Run First
```bash
# See what will happen
./scripts/migrate-tests.sh src/components
# Review output carefully
# Then execute if satisfied
./scripts/migrate-tests.sh src/components --execute
```

### 2. Migrate in Small Batches
```bash
# Good: One directory at a time
./scripts/migrate-tests.sh src/components/terminal --execute
./scripts/migrate-tests.sh src/components/workspace --execute

# Avoid: Too broad initially
./scripts/migrate-tests.sh src --execute  # Only after testing smaller batches
```

### 3. Test After Each Migration
```bash
./scripts/migrate-tests.sh src/components --execute
npm test  # Verify immediately
git add tests/
git commit -m "test: migrate component tests to /tests"
```

### 4. Review Import Changes
```bash
# Check what imports were converted
git diff | grep "from"

# Look for any missed conversions
grep -n "from '\.\.\/" tests/unit/components/
```

---

## Recovery

### If Something Goes Wrong
```bash
# Option 1: Git reset (before commit)
git reset --hard HEAD

# Option 2: Restore from backup
tar -xzf .test-migration-backup/tests_backup_TIMESTAMP.tar.gz

# Option 3: Revert commit (after commit)
git revert HEAD
```

---

## Next Steps After Migration

1. **Run full test suite**: `npm test`
2. **Update documentation**: Update any references to old test locations
3. **Clean up**: Remove empty directories in `/src`
4. **Commit changes**:
```bash
git add tests/ src/
git commit -m "test: migrate tests from src/components to /tests

- Converted relative imports to absolute @/ imports
- Organized tests by type (unit/integration/e2e)
- Preserved git history with git mv

Relates to #446"
```

---

## Quick Reference: File Patterns

| Pattern | Target Directory |
|---------|------------------|
| `*.test.ts` | `tests/unit/` |
| `*.test.tsx` | `tests/unit/` |
| `*.integration.test.ts` | `tests/integration/` |
| `*.e2e.test.ts` | `tests/e2e/` |
| `*.spec.ts` | `tests/e2e/` |

---

## Support

**Backup Location**: `.test-migration-backup/`
**Script Location**: `scripts/migrate-tests.sh`
**Issue Tracking**: [#446](https://github.com/yourusername/vibecode-webgui/issues/446)

For issues or questions, comment on issue #446.
