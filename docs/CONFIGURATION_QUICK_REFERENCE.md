# Configuration Quick Reference

**Issue #447 Migration:** 31 files → 3 core files + templates

## TL;DR - Quick Commands

### Migration Execution
```bash
# Validate configuration
./scripts/validate-env-config.sh

# Preview migration (safe, no changes)
./scripts/migrate-env-config.sh --dry-run

# Execute migration (creates automatic backup)
./scripts/migrate-env-config.sh

# Test application
npm run dev && curl http://localhost:3000/api/health
```

### Rollback (If Needed)
```bash
# Method 1: Automated restore (fastest)
cp .env-backup-*/.env* .

# Method 2: Git rollback (safest)
git reset --hard pre-config-migration-$(date +%Y%m%d)
```

## File Structure

### Before Migration (31 Files)
```
.env                      # Which one to use? 🤔
.env.local                # Or this one?
.env.azure                # Azure specific?
.env.docker               # Docker only?
.env.demo.example         # Demo?
... (26 more files)
```

### After Migration (6 Files)
```
# Core files (gitignored, contain real secrets)
.env.local              # ✅ Development: Use this
.env.production.local   # ✅ Production: Use this
.env.test.local         # ✅ Testing: Use this

# Template files (committed, no real secrets)
.env.example            # 📖 Comprehensive reference and primary template
```

## Environment Precedence (Next.js)

### Development
```
NODE_ENV=development
1. .env.development.local  (highest priority)
2. .env.local
3. .env.development
4. .env                   (lowest priority)
```

### Production
```
NODE_ENV=production
1. .env.production.local  (highest priority)
2. .env.local
3. .env.production
4. .env                   (lowest priority)
```

### Testing
```
NODE_ENV=test
1. .env.test.local       (highest priority)
2. .env.test
3. .env                  (lowest priority)
# Note: .env.local is NOT loaded in test
```

## Getting Started

### New Developer Onboarding
```bash
# 1. Clone repository
git clone <repo-url>

# 2. Copy template
cp .env.example .env.local

# 3. Update with your values
nano .env.local
# Set: DATABASE_URL, REDIS_URL, API keys, etc.

# 4. Install and run
npm install
npm run dev

# 5. Verify health
curl http://localhost:3000/api/health
```

### Required Variables (Minimum)
```env
# .env.local - Core requirements
NODE_ENV=development
DATABASE_URL=postgresql://user:pass@localhost:5432/vibecode
REDIS_URL=redis://localhost:6379
NEXTAUTH_SECRET=generate-with-openssl-rand-base64-32
NEXTAUTH_URL=http://localhost:3000
```

### Optional Variables
```env
# AI Providers (choose one or more)
OPENAI_API_KEY=sk-...
CLAUDE_API_KEY=sk-ant-...
OPENROUTER_API_KEY=sk-or-...

# Monitoring (optional)
DD_API_KEY=your-datadog-key
DD_APP_KEY=your-datadog-app-key

# OAuth (optional)
GITHUB_ID=your-github-oauth-id
GITHUB_SECRET=your-github-oauth-secret
```

## Common Tasks

### Adding New Variable
```bash
# 1. Add to .env.example with documentation
echo "NEW_FEATURE_ENABLED=false  # Enable new feature X" >> .env.example

# 2. Add to your local config
echo "NEW_FEATURE_ENABLED=true" >> .env.local

# 3. Use in code
const enabled = process.env.NEW_FEATURE_ENABLED === 'true';
```

### Checking Current Config
```bash
# Show all environment variables (careful with secrets!)
env | grep -E "DATABASE|REDIS|NEXTAUTH" | sort

# Or use node
node -e "console.log(process.env.DATABASE_URL)"
```

### Debugging Config Issues
```bash
# 1. Which files are loaded?
ls -la .env*

# 2. Check for syntax errors
grep -n "=" .env.local | head -20

# 3. Verify required variables
./scripts/validate-env-config.sh

# 4. Check logs for missing vars
npm run dev 2>&1 | grep -i "undefined\|missing\|required"
```

## Environment-Specific Configs

### Local Development
```env
# .env.local
NODE_ENV=development
DATABASE_URL=postgresql://localhost:5432/vibecode_dev
REDIS_URL=redis://localhost:6379
DD_API_KEY=dummy-key-for-local  # Optional: use dummy keys
ENABLE_MONITORING=false          # Optional: disable in dev
```

### Docker Development
```env
# .env.local (with Docker services)
DATABASE_URL=postgresql://postgres:5432/vibecode
REDIS_URL=redis://redis:6379
COLLABORATION_SERVER_URL=http://localhost:3000
```

### Production
```env
# .env.production.local (use secrets manager)
NODE_ENV=production
DATABASE_URL=${SECRET_DATABASE_URL}  # From vault/secrets manager
REDIS_URL=${SECRET_REDIS_URL}
DD_API_KEY=${SECRET_DD_API_KEY}
ENABLE_MONITORING=true
DD_TRACE_ENABLED=true
```

### Testing/CI
```env
# .env.test.local
NODE_ENV=test
DATABASE_URL=postgresql://localhost:5432/vibecode_test
REDIS_URL=redis://localhost:6379/1
ENABLE_REAL_AI_TESTS=false
ENABLE_REAL_INTEGRATION_TESTS=false
```

## Migration Checklist

### Before You Start
- [ ] Read [docs/CONFIGURATION_MIGRATION.md](./CONFIGURATION_MIGRATION.md)
- [ ] Review [docs/MIGRATION_CHECKLIST.md](./MIGRATION_CHECKLIST.md)
- [ ] Backup your current .env files manually (just in case)
- [ ] Commit or stash any pending changes

### Migration Steps
```bash
# 1. Validate
./scripts/validate-env-config.sh

# 2. Create git checkpoint
git add -A && git commit -m "checkpoint: pre-config-migration"
git tag "pre-config-migration-$(date +%Y%m%d)"

# 3. Dry run (preview only)
./scripts/migrate-env-config.sh --dry-run

# 4. Execute migration
./scripts/migrate-env-config.sh

# 5. Review backup and report
ls -la .env-backup-*
cat .env-backup-*/MIGRATION_REPORT.md

# 6. Test application
npm run dev
curl http://localhost:3000/api/health

# 7. Run tests
npm run test:integration
```

### Post-Migration
- [ ] Application starts successfully
- [ ] Health checks pass
- [ ] All integrations working
- [ ] No config errors in logs
- [ ] Review migration report
- [ ] Update team documentation

## Troubleshooting

### Issue: Application won't start
```bash
# Check for missing variables
npm run dev 2>&1 | grep -i "undefined"

# Compare with .env.example
diff <(grep "^[A-Z]" .env.example | cut -d= -f1 | sort) \
     <(grep "^[A-Z]" .env.local | cut -d= -f1 | sort)

# Restore specific variables from backup
grep "MISSING_VAR" .env-backup-*/.env*
```

### Issue: Database connection fails
```bash
# Verify DATABASE_URL format
echo $DATABASE_URL

# Test connection
psql "$DATABASE_URL" -c "SELECT 1;"

# Check if credentials changed
grep DATABASE_URL .env-backup-*/.env*
```

### Issue: Need to rollback
```bash
# Quick restore all files
cp .env-backup-20251001-*/.env* .
npm run dev

# Or git rollback
git reset --hard pre-config-migration-20251001
npm run dev
```

### Issue: Lost custom variables
```bash
# Find in backup
grep -r "YOUR_CUSTOM_VAR" .env-backup-*/

# List all unique variables in backup
cat .env-backup-*/.env* | grep "^[A-Z]" | cut -d= -f1 | sort -u
```

## Best Practices

### ✅ DO
- Use `.env.local` for local development
- Copy from `.env.example` to start
- Keep secrets out of git (use `.gitignore`)
- Document new variables in `.env.example`
- Use placeholder values in templates
- Rotate secrets regularly
- Use secrets manager for production

### ❌ DON'T
- Commit `.env.local` or `.env.production.local`
- Put real secrets in `.env.example`
- Share `.env` files via Slack/email
- Hardcode secrets in application code
- Use production secrets in development
- Skip the migration backup step

## Security Notes

### Generating Secrets
```bash
# NEXTAUTH_SECRET (32+ chars)
openssl rand -base64 32

# JWT_SECRET
openssl rand -base64 64

# SESSION_SECRET
openssl rand -hex 32
```

### Checking for Exposed Secrets
```bash
# Never commit these files
git ls-files | grep "\.env\."

# Check git history for leaked secrets
git log --all --full-history -- .env.local
```

### Secret Rotation
```bash
# 1. Generate new secret
NEW_SECRET=$(openssl rand -base64 32)

# 2. Update .env.local
sed -i.bak "s/NEXTAUTH_SECRET=.*/NEXTAUTH_SECRET=$NEW_SECRET/" .env.local

# 3. Restart application
npm run dev
```

## Support

### Documentation
- Full Guide: [docs/CONFIGURATION_MIGRATION.md](./CONFIGURATION_MIGRATION.md)
- Checklist: [docs/MIGRATION_CHECKLIST.md](./MIGRATION_CHECKLIST.md)
- GitHub Issue: [#447](https://github.com/vibecode/webgui/issues/447)

### Scripts
- Validate: `./scripts/validate-env-config.sh`
- Migrate: `./scripts/migrate-env-config.sh`
- Help: `./scripts/migrate-env-config.sh --help`

### Getting Help
- GitHub Issues: Tag `@maintainers` in #447
- Check backup: `.env-backup-*/MIGRATION_REPORT.md`
- Review logs: `npm run dev 2>&1 | less`

---

**Last Updated:** 2025-10-01
**Migration Status:** Ready for Execution
**Next Phase:** Type-safe configuration with Zod (after stabilization)
