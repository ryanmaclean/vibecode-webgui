# macOS Keychain - Quick Reference Card

**Issue #530 - Critical P0 Implementation**

---

## Quick Start (3 Commands)

```bash
# 1. Migrate secrets from .env to Keychain
npm run security:migrate-keychain

# 2. Validate migration
npm run security:validate-keychain

# 3. Test application
npm test
```

---

## Code Migration (Before → After)

### Before (Insecure)
```typescript
const apiKey = process.env.OPENAI_API_KEY
```

### After (Secure)
```typescript
import { loadSecret } from '@/lib/security/macos-keychain'

const apiKey = await loadSecret('OPENAI_API_KEY')
```

---

## Platform Behavior

| Platform | Behavior |
|----------|----------|
| macOS Development | ✅ Uses Keychain (Secure Enclave + FileVault) |
| Docker/Kubernetes | ✅ Falls back to process.env (Kubernetes Secrets) |
| CI/CD | ✅ Falls back to process.env (GitHub Secrets) |
| Windows | ✅ Falls back to process.env |

---

## Common Commands

### Migration
```bash
# Migrate all secrets
npm run security:migrate-keychain

# Dry run (see what would be migrated)
bash scripts/security/migrate-secrets-to-keychain.sh --dry-run
```

### Validation
```bash
# Full validation suite
npm run security:validate-keychain

# Quick check
security find-generic-password -s "com.vibecode.secrets" -a "OPENAI_API_KEY" -w
```

### Manual Operations
```bash
# Store secret
security add-generic-password \
  -s "com.vibecode.secrets" \
  -a "MY_SECRET_KEY" \
  -w "secret-value"

# Retrieve secret
security find-generic-password \
  -s "com.vibecode.secrets" \
  -a "MY_SECRET_KEY" \
  -w

# Delete secret
security delete-generic-password \
  -s "com.vibecode.secrets" \
  -a "MY_SECRET_KEY"

# List all secrets
security dump-keychain | grep -A 5 "com.vibecode.secrets"
```

---

## API Reference

### Load Secret (with fallback)
```typescript
import { loadSecret } from '@/lib/security/macos-keychain'

// Automatically uses Keychain on macOS, process.env elsewhere
const apiKey = await loadSecret('OPENAI_API_KEY')
```

### Store Secret
```typescript
import { setSecret } from '@/lib/security/macos-keychain'

await setSecret('API_KEY', 'sk-...', {
  accessibility: 'whenUnlockedThisDeviceOnly'
})
```

### Check Platform
```typescript
import { isKeychainAvailable } from '@/lib/security/macos-keychain'

if (isKeychainAvailable()) {
  console.log('macOS - using Keychain')
} else {
  console.log('Non-macOS - using env vars')
}
```

### Rotate Secret
```typescript
import { rotateSecret } from '@/lib/security/macos-keychain'

await rotateSecret('JWT_SECRET', () => {
  return crypto.randomBytes(32).toString('base64')
})
```

---

## Supported Secrets (16 types)

✅ `NEXTAUTH_SECRET` - Session encryption
✅ `DATABASE_URL` / `POSTGRES_URL` - Database
✅ `OPENAI_API_KEY` - OpenAI
✅ `ANTHROPIC_API_KEY` / `CLAUDE_API_KEY` - Claude
✅ `DATADOG_API_KEY` / `DD_API_KEY` / `DD_APP_KEY` - Monitoring
✅ `GITHUB_SECRET` - GitHub OAuth
✅ `GOOGLE_CLIENT_SECRET` - Google OAuth
✅ `JWT_SECRET` / `SESSION_SECRET` - Sessions
✅ `REDIS_PASSWORD` - Redis
✅ `AZURE_OPENAI_API_KEY` - Azure OpenAI
✅ `OPENROUTER_API_KEY` - OpenRouter

---

## Troubleshooting

### Issue: "security command not found"
**Cause**: Not on macOS
**Fix**: Automatic fallback to process.env (expected behavior)

### Issue: "Failed to store secret"
**Cause**: Keychain locked
**Fix**:
```bash
security unlock-keychain ~/Library/Keychains/login.keychain-db
```

### Issue: "Secret not found"
**Cause**: Not migrated
**Fix**:
```bash
npm run security:migrate-keychain
```

### Issue: Docker can't access Keychain
**Expected**: Docker runs Linux, not macOS
**Fix**: Use Kubernetes Secrets (automatic fallback)

---

## File Locations

```
/src/lib/security/macos-keychain.ts        # Core library
/scripts/security/migrate-secrets-to-keychain.sh  # Migration
/scripts/security/validate-keychain.ts     # Validation
/src/examples/security/keychain-usage-example.ts  # Examples
/claudedocs/KEYCHAIN_IMPLEMENTATION.md     # Full docs
```

---

## Security Checklist

- [ ] FileVault enabled (`fdesetup status`)
- [ ] Keychain auto-locks after 5 minutes
- [ ] Secrets migrated (`npm run security:migrate-keychain`)
- [ ] Validation passed (`npm run security:validate-keychain`)
- [ ] Code updated to use `loadSecret()`
- [ ] Tests passing (`npm test`)
- [ ] .env backups secured
- [ ] Team trained on new workflow

---

## SOC 2 Compliance

✅ Encryption at Rest (FileVault + Secure Enclave)
✅ Access Control (Keychain ACLs)
✅ Audit Logging (macOS unified logging)
✅ No plaintext secrets in version control
✅ Secret rotation support

---

## Resources

- **Full Documentation**: `/claudedocs/KEYCHAIN_IMPLEMENTATION.md`
- **Code Examples**: `/src/examples/security/keychain-usage-example.ts`
- **Issue**: #530
- **Priority**: P0 (Critical)
- **Timeline**: ✅ Completed within 1 week

---

**Quick Help**: Run `npm run security:validate-keychain` for diagnostics
