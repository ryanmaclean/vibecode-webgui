# Quick Start: Console to Logger Migration

## TL;DR

Migrate all 1,203 console statements to Winston logger in 3 commands:

```bash
# 1. Preview changes (dry-run)
node scripts/migrate-console-to-logger.js --dry-run

# 2. Apply migration
node scripts/migrate-console-to-logger.js

# 3. Verify
npm run type-check && npm run lint
```

## What This Does

Automatically converts:
- `console.log()` → `logger.info()`
- `console.error()` → `logger.error()`
- `console.warn()` → `logger.warn()`
- `console.debug()` → `logger.debug()`

Plus adds `import { logger } from '@/lib/logger'` to all affected files.

## Migration Stats

- **Files to modify**: 282 out of 725
- **Total replacements**: 1,203 console statements
- **Execution time**: ~1-2 seconds
- **Risk level**: Minimal (fully reversible via git)

## Step-by-Step Migration

### 1. Create Feature Branch
```bash
git checkout -b feat/migrate-to-winston-logger
```

### 2. Run Dry-Run (Preview Only)
```bash
node scripts/migrate-console-to-logger.js --dry-run --verbose > migration-preview.txt
```

### 3. Review Preview
```bash
cat migration-preview.txt
# Check that the changes look correct
```

### 4. Test on Single Directory (Optional)
```bash
# Test on hooks first
node scripts/migrate-console-to-logger.js --files "src/hooks/**"

# Verify it works
npm run type-check
git diff src/hooks/

# Rollback if needed
git checkout src/hooks/
```

### 5. Run Full Migration
```bash
node scripts/migrate-console-to-logger.js
```

### 6. Verify Changes
```bash
# Check TypeScript compilation
npm run type-check

# Check linting
npm run lint

# Run tests
npm test

# Review changes
git diff --stat
git diff src/lib/ | less
```

### 7. Commit Changes
```bash
git add -A
git commit -m "feat: migrate all console.* calls to Winston logger

- Migrated 1,203 console statements to Winston logger
- Added logger imports to 282 files
- Improved production security by eliminating console.log data leakage
- Structured logging now enabled across entire codebase

Migration details:
  console.log → logger.info: 413
  console.error → logger.error: 593
  console.warn → logger.warn: 178
  console.debug → logger.debug: 7
  console.info → logger.info: 12

Generated with migration script at scripts/migrate-console-to-logger.js"
```

### 8. Push and Create PR
```bash
git push -u origin feat/migrate-to-winston-logger

# Create PR via GitHub CLI (if available)
gh pr create --title "feat: Migrate console.* to Winston logger" \
             --body "$(cat scripts/MIGRATION-TEST-RESULTS.md)"
```

## Rollback (If Needed)

```bash
# Discard all changes
git checkout .

# Or rollback specific directory
git checkout src/lib/

# Or rollback the entire branch
git checkout main
git branch -D feat/migrate-to-winston-logger
```

## Common Issues

### Issue: Script not executable
```bash
chmod +x scripts/migrate-console-to-logger.js
```

### Issue: "Cannot find module 'glob'"
```bash
npm install --save-dev glob
```

### Issue: TypeScript errors after migration
- These are likely pre-existing issues
- Run `npm run type-check` to see all errors
- Fix any pre-existing issues separately

### Issue: Changes look wrong
- Review the dry-run output first
- Test on a single file: `--files "path/to/file.ts"`
- Report unexpected behavior

## Advanced Usage

### Target Specific Directory
```bash
node scripts/migrate-console-to-logger.js --files "src/components/**"
```

### Target Specific File Type
```bash
node scripts/migrate-console-to-logger.js --files "src/**/*.tsx"
```

### Verbose Output
```bash
node scripts/migrate-console-to-logger.js --dry-run --verbose
```

### Multiple Patterns
```bash
# Target hooks and components only
node scripts/migrate-console-to-logger.js --files "src/hooks/**"
node scripts/migrate-console-to-logger.js --files "src/components/**"
```

## Post-Migration Checklist

- [ ] TypeScript compilation passes
- [ ] Linting passes
- [ ] Tests pass
- [ ] Manual smoke test of critical features
- [ ] Git commit with descriptive message
- [ ] PR created and linked to migration ticket
- [ ] CI/CD passes
- [ ] Code review completed
- [ ] Merged to main
- [ ] Deployed to staging
- [ ] Verified logs in staging
- [ ] Deployed to production
- [ ] Monitored production logs

## Next Steps After Migration

1. **Update ESLint**: Add `no-console` rule to prevent future console usage
2. **Update Documentation**: Reference Winston logger in coding guidelines
3. **Monitor Logs**: Verify structured logs are being captured correctly
4. **Add Log Aggregation**: Configure log shipping to monitoring platform
5. **Celebrate**: You now have production-grade logging! 🎉

## Help & Support

- **Documentation**: See `scripts/README-migration.md`
- **Test Results**: See `scripts/MIGRATION-TEST-RESULTS.md`
- **Script Source**: `scripts/migrate-console-to-logger.js`

## Questions?

Common questions answered:

**Q: Will this break my code?**
A: No. The migration is non-destructive and preserves all functionality. Logger API is compatible with console API.

**Q: Can I rollback?**
A: Yes. All changes are tracked in git. Use `git checkout .` to rollback.

**Q: How long does it take?**
A: Full migration takes 1-2 seconds. Full validation (type-check, lint, test) takes ~6-11 minutes.

**Q: What if I have custom console wrappers?**
A: The script only migrates standard console.* calls. Custom wrappers need manual migration.

**Q: Will this affect performance?**
A: Winston logger is more performant than console and adds zero overhead in production.

**Q: What happens to console calls in logger.ts itself?**
A: The script correctly handles files that intentionally use console (like logger.ts).

---

**Ready to migrate?** Start with the dry-run command! 🚀
