# Repository Cleanup Scripts

These scripts help clean up the repository from accidentally committed large files and secrets.

## Quick Reference

| Script | Purpose | Safe? |
|--------|---------|-------|
| `backup-before-cleanup.sh` | Create full backup bundle | ✅ Yes |
| `remove-tracked-secrets.sh` | Untrack .env files | ✅ Yes (keeps files) |
| `remove-large-binaries.sh` | Untrack binary files | ✅ Yes (keeps files) |
| `full-history-cleanup.sh` | Rewrite git history | ⚠️ DESTRUCTIVE |

## Recommended Cleanup Order

### Phase 1: Safe Cleanup (No history changes)

```bash
# 1. Create backup first!
./scripts/cleanup/backup-before-cleanup.sh

# 2. Remove secrets from tracking
./scripts/cleanup/remove-tracked-secrets.sh

# 3. Remove binaries from tracking
./scripts/cleanup/remove-large-binaries.sh

# 4. Commit the changes
git add .gitignore
git commit -m "chore: remove tracked secrets and large binaries"
git push
```

### Phase 2: Full History Cleanup (Destructive)

Only do this if you need to reduce the git pack size (currently 1.1 GiB):

```bash
# ⚠️ COORDINATE WITH TEAM FIRST
./scripts/cleanup/full-history-cleanup.sh

# After completion:
git push --force --all origin
git push --force --tags origin

# All team members must:
git clone <fresh-url> new-clone
```

## What Gets Removed

### Secret Files
- `.env.docker.fixed` - Contains real API keys
- `.env.test-db` - Contains Azure OpenAI key
- All other `.env.*` files (except examples)

### Large Binary Files
- `azure/*.cpio.gz` - VM initramfs images (up to 95 MB each)
- `azure/*.img*` - Disk images
- `azure/linux-kernel*` - Linux kernel binaries (47 MB)
- `bench-images/` - Benchmark images
- `artifacts/` - Build artifacts
- `demos/venv311/` - Python virtual environment

## Prevention

After cleanup, the updated `.gitignore` will prevent these files from being tracked again. Additionally, consider adding:

1. **Pre-commit hooks** with secretlint
2. **CI checks** for large files
3. **Regular audits** with `git count-objects -vH`
