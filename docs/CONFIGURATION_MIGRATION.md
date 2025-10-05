# Configuration Migration Guide

**Issue:** [#447 - Consolidate Configuration Management](https://github.com/vibecode/webgui/issues/447)
**Status:** Ready for Migration
**Date:** 2025-10-01

## Executive Summary

This migration consolidates 31 environment files into a streamlined configuration structure, reducing complexity and eliminating configuration chaos.

### Migration Goals
- Reduce from 31 .env files to 3 core files + templates
- Eliminate configuration precedence confusion
- Maintain backward compatibility during transition
- Zero downtime deployment
- Complete backup and rollback capability

## Pre-Migration Status

### Current State
```
Total .env files: 31
├── Core development: .env, .env.local, .env.development.local
├── Platform-specific: .env.azure, .env.docker, .env.valkey
├── Testing: .env.test-db, .env.test-external-db, .env.production.test
└── Templates: .env.example, .env.template, .env.local.example
```

### Problems Addressed
1. **Configuration Chaos:** 31 files with unclear precedence
2. **Deployment Failures:** Environment-specific bugs difficult to reproduce
3. **Security Risk:** Scattered credential references (707 `process.env` calls)
4. **Developer Friction:** Unclear which file to use for what purpose

## Post-Migration Structure

### Core Files (3)
```
.env.local              # Development environment (gitignored)
.env.production.local   # Production environment (gitignored)
.env.test.local         # Testing environment (gitignored)
```

### Template Files (Reference Only)
```
.env.example            # Comprehensive template with all variables (single source of truth)
```

### File Precedence (Next.js Standard)
```
NODE_ENV=production:
  .env.production.local → .env.local → .env.production → .env

NODE_ENV=development:
  .env.development.local → .env.local → .env.development → .env

NODE_ENV=test:
  .env.test.local → .env.local → .env.test → .env
```

## Migration Process

### Phase 1: Preparation (Pre-Migration)

#### 1.1 Review Current Configuration
```bash
# List all environment files
find . -maxdepth 1 -name ".env*" -type f | sort

# Check for sensitive data
grep -r "API_KEY\|SECRET\|PASSWORD" .env* | head -20
```

#### 1.2 Validate .env.example
```bash
# Verify all required sections exist
./scripts/migrate-env-config.sh --dry-run
```

#### 1.3 Document Custom Variables
```bash
# Extract any custom variables not in .env.example
for file in .env*; do
    echo "=== $file ==="
    grep -v "^#" "$file" | grep -v "^$" | cut -d= -f1 | sort
done | sort -u > custom_vars.txt
```

### Phase 2: Backup (Critical)

#### 2.1 Automated Backup
```bash
# Run migration script in dry-run mode first
./scripts/migrate-env-config.sh --dry-run

# Create backup (automatic when running actual migration)
./scripts/migrate-env-config.sh
```

#### 2.2 Manual Backup (Optional Safety)
```bash
# Create timestamped backup
BACKUP_DIR=".env-backup-manual-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp .env* "$BACKUP_DIR/" 2>/dev/null || true
echo "Manual backup created: $BACKUP_DIR"
```

#### 2.3 Git Checkpoint
```bash
# Create pre-migration commit
git add -A
git commit -m "checkpoint: Pre-migration configuration state"
git tag "pre-config-migration-$(date +%Y%m%d)"
```

### Phase 3: Migration Execution

#### 3.1 Run Migration Script
```bash
# Perform actual migration
./scripts/migrate-env-config.sh --verbose

# Output:
# - Backup directory location
# - List of archived files
# - Migration report
```

#### 3.2 Consolidate Active Configuration
```bash
# Copy your current .env to .env.local
cp .env .env.local

# Review and update with values from .env.example
diff .env.example .env.local

# Add any missing required variables
nano .env.local
```

#### 3.3 Update .gitignore
Script automatically adds:
```gitignore
# Deprecated environment files (archived)
.env.azure
.env.demo.example
.env.docker
.env.docker.fixed
.env.local.template
.env.production.test
.env.test-db
.env.test-external-db
.env.valkey
```

### Phase 4: Validation

#### 4.1 Application Startup Test
```bash
# Test application startup
npm run dev

# Verify no configuration errors in logs
# Check: http://localhost:3000
```

#### 4.2 Health Check Validation
```bash
# Run health checks
curl http://localhost:3000/api/health
curl http://localhost:3000/api/health/simple
curl http://localhost:3000/api/healthz
curl http://localhost:3000/api/readyz

# Expected: All return 200 OK
```

#### 4.3 Integration Testing
```bash
# Test database connectivity
npm run test:db

# Test Redis/Valkey connectivity
npm run test:cache

# Test AI provider integration
npm run test:ai

# Run full integration suite
npm run test:integration
```

#### 4.4 Configuration Verification
```bash
# Verify all required variables are set
node -e "
const required = [
  'DATABASE_URL',
  'REDIS_URL',
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL'
];
const missing = required.filter(key => !process.env[key]);
if (missing.length) {
  console.error('Missing required variables:', missing);
  process.exit(1);
}
console.log('All required variables present');
"
```

### Phase 5: Rollback (If Needed)

#### 5.1 Automatic Rollback
```bash
# Find your backup directory
ls -la | grep ".env-backup-"

# Restore from backup
BACKUP_DIR=".env-backup-20251001-123456"  # Use your actual backup dir
cp "$BACKUP_DIR"/.env* .

# Verify restoration
git status
git diff
```

#### 5.2 Git Rollback
```bash
# Rollback to pre-migration state
git reset --hard pre-config-migration-$(date +%Y%m%d)

# Or reset to specific commit
git log --oneline -10
git reset --hard <commit-hash>
```

#### 5.3 Manual Rollback
```bash
# Check backup manifest
cat .env-backup-*/MANIFEST.txt

# Restore specific files
cp .env-backup-*/.env.azure .
cp .env-backup-*/.env.docker .
# etc.
```

## Testing Checklist

### Pre-Migration Testing
- [ ] Document all current environment variables in use
- [ ] Identify any custom/undocumented variables
- [ ] Verify .env.example contains all necessary variables
- [ ] Create git checkpoint and tag
- [ ] Backup all .env files

### Post-Migration Testing
- [ ] Application starts without errors
- [ ] Database connection successful
- [ ] Redis/Valkey connection successful
- [ ] AI provider authentication works
- [ ] Health checks pass (all endpoints return 200)
- [ ] Integration tests pass
- [ ] No configuration-related errors in logs
- [ ] Datadog monitoring active (if enabled)
- [ ] Authentication flows work (GitHub, Google OAuth)
- [ ] API endpoints respond correctly

### Production Deployment Testing
- [ ] Test in staging environment first
- [ ] Verify production .env.production.local prepared
- [ ] Confirm all secrets present in production config
- [ ] Test rollback procedure in staging
- [ ] Monitor application metrics post-deployment
- [ ] Verify no degradation in performance/reliability

## Migration Timeline

### Development Environment
- **Duration:** 1-2 hours
- **Recommended Time:** Off-peak hours
- **Risk Level:** Low (easy rollback)

### Staging Environment
- **Duration:** 2-3 hours (includes testing)
- **Recommended Time:** Weekday afternoon
- **Risk Level:** Low-Medium

### Production Environment
- **Duration:** 3-4 hours (includes validation)
- **Recommended Time:** Maintenance window
- **Risk Level:** Medium (requires careful planning)

### Suggested Schedule
```
Week 1: Development migration and testing
Week 2: Staging migration and extended testing
Week 3: Production migration (with rollback plan)
```

## Common Issues and Solutions

### Issue: Missing Variables After Migration
**Symptom:** Application fails to start with "undefined environment variable"
**Solution:**
```bash
# Compare your old .env with .env.example
diff .env-backup-*/.env .env.example

# Add missing variables to .env.local
nano .env.local
```

### Issue: Database Connection Fails
**Symptom:** Health checks fail, database errors in logs
**Solution:**
```bash
# Verify DATABASE_URL format
echo $DATABASE_URL

# Test connection manually
psql "$DATABASE_URL" -c "SELECT 1;"

# Check if old .env.azure had different credentials
grep DATABASE_URL .env-backup-*/.env.azure
```

### Issue: AI Provider Authentication Fails
**Symptom:** AI features return 401/403 errors
**Solution:**
```bash
# Check if API keys were in different files
grep -r "API_KEY" .env-backup-*/

# Consolidate all API keys in .env.local
nano .env.local
```

### Issue: Datadog Monitoring Not Working
**Symptom:** No metrics/traces in Datadog
**Solution:**
```bash
# Verify all Datadog variables present
grep "^DD_\|^DATADOG_" .env.local

# Compare with .env.example
diff <(grep "^DD_\|^DATADOG_" .env.example) <(grep "^DD_\|^DATADOG_" .env.local)
```

### Issue: Need to Restore Specific Deprecated File
**Symptom:** Legacy script requires old .env.docker format
**Solution:**
```bash
# Temporarily restore specific file
cp .env-backup-*/.env.docker .

# Update script to use .env.local instead
# Or keep .env.docker temporarily and add to .gitignore
```

## Security Considerations

### Before Migration
- [ ] Audit all .env files for hardcoded secrets
- [ ] Identify any secrets committed to git history
- [ ] Document secret rotation plan

### During Migration
- [ ] Never commit actual .env files to git
- [ ] Use .env.example as template only
- [ ] Verify .gitignore covers all environment files

### After Migration
- [ ] Rotate any exposed secrets
- [ ] Implement secret management solution (Vault, AWS Secrets Manager)
- [ ] Set up automated secret scanning
- [ ] Monitor for configuration leaks

### Secret Management Best Practices
```bash
# Use environment-specific secrets
# Development
.env.local -> dummy/test secrets

# Production
.env.production.local -> real secrets from vault

# Never share production secrets via .env files
# Use secret management service instead
```

## Next Phase: Type-Safe Configuration

After migration is stable, implement typed configuration:

```typescript
// src/lib/config.ts
import { z } from 'zod';

const configSchema = z.object({
  database: z.object({
    url: z.string().url(),
    poolSize: z.number().default(10),
  }),
  auth: z.object({
    secret: z.string().min(32),
    nextAuthUrl: z.string().url(),
  }),
  // ... all config with validation
});

export const config = configSchema.parse({
  database: {
    url: process.env.DATABASE_URL,
    poolSize: parseInt(process.env.DB_POOL_MAX || '10'),
  },
  auth: {
    secret: process.env.NEXTAUTH_SECRET,
    nextAuthUrl: process.env.NEXTAUTH_URL,
  },
});
```

See [Phase 2 Issue](https://github.com/vibecode/webgui/issues/447) for type-safe migration.

## Support and Resources

### Documentation
- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [.env File Precedence](https://github.com/motdotla/dotenv#what-happens-to-environment-variables-that-were-already-set)
- [GitHub Issue #447](https://github.com/vibecode/webgui/issues/447)

### Scripts
- `scripts/migrate-env-config.sh` - Migration automation
- `scripts/validate-config.sh` - Configuration validation (to be created)

### Getting Help
- GitHub Issues: Tag `@maintainers` in issue #447
- Slack: `#vibecode-dev` channel
- Emergency Rollback: See Phase 5 above

## Success Criteria

Migration is considered successful when:
- [ ] 31 files reduced to 3 core + templates
- [ ] All tests passing
- [ ] Zero configuration-related incidents
- [ ] Application performance unchanged
- [ ] All integrations working (DB, Redis, AI, Datadog)
- [ ] Team understands new structure
- [ ] Documentation complete and reviewed

## Appendix A: File Mapping

### Deprecated Files → Consolidated Location

| Deprecated File | New Location | Notes |
|----------------|--------------|-------|
| `.env.azure` | `.env.local` or `.env.production.local` | Azure-specific vars consolidated |
| `.env.docker` | `.env.local` | Docker vars now in main config |
| `.env.docker.fixed` | Archive | Obsolete |
| `.env.demo.example` | `.env.example` | Merged into comprehensive template |
| `.env.local.template` | `.env.example` | Redundant template |
| `.env.production.test` | `.env.test.local` | Production testing config |
| `.env.test-db` | `.env.test.local` | Test database config |
| `.env.test-external-db` | `.env.test.local` | External test DB config |
| `.env.valkey` | `.env.local` | Valkey vars in main config |

### Template Files (Keep)

| File | Purpose | Status |
|------|---------|--------|
| `.env.example` | Comprehensive template, all variables documented | **Primary template - single source of truth** |

## Appendix B: Environment Variable Audit

### Critical Variables (Must Be Present)
```
NODE_ENV
DATABASE_URL
REDIS_URL
NEXTAUTH_SECRET
NEXTAUTH_URL
```

### Optional But Recommended
```
DD_API_KEY (Datadog monitoring)
OPENAI_API_KEY (AI features)
GITHUB_ID/GITHUB_SECRET (OAuth)
```

### Platform-Specific (As Needed)
```
AZURE_* (Azure deployments)
AWS_* (AWS deployments)
KUBERNETES_* (K8s deployments)
```

## Appendix C: Migration Script Output

Sample output from successful migration:

```
=============================================================================
VibeCode Configuration Migration Tool
=============================================================================

[INFO] Checking Prerequisites
[SUCCESS] All prerequisites met

[INFO] Validating .env.example
[SUCCESS] .env.example validated successfully

[INFO] Creating Backup
[INFO] Backup directory created: .env-backup-20251001-153045
[SUCCESS] Backed up 15 files to .env-backup-20251001-153045

[INFO] Analyzing Current Configuration
[INFO] Total .env files: 15
[INFO] Core files (to consolidate): 3
[INFO] Deprecated files (to archive): 9
[INFO] Template files (to keep): 3

[INFO] Consolidating Configuration Files
[INFO] Archiving: .env.azure
[INFO] Archiving: .env.docker
[INFO] Archiving: .env.docker.fixed
[SUCCESS] Archived 9 deprecated configuration files

[INFO] Updating .gitignore
[SUCCESS] .gitignore updated

[INFO] Generating Migration Report
[SUCCESS] Migration report generated: .env-backup-20251001-153045/MIGRATION_REPORT.md

=============================================================================
Migration Complete
=============================================================================

[SUCCESS] Configuration migration completed successfully!
[INFO] Backup location: .env-backup-20251001-153045
[INFO] Next steps:
  1. Review migration report: .env-backup-20251001-153045/MIGRATION_REPORT.md
  2. Test application: npm run dev
  3. Run health checks: npm run test:health
  4. Commit changes if everything works
```
