# Security Alert: API Key Rotation Required

**Status**: URGENT - Immediate Action Required
**Date Identified**: 2025-11-05
**Severity**: HIGH

## Executive Summary

Multiple API keys and sensitive credentials are currently stored in plaintext in `.env.local`. While this file is gitignored and has **NOT been committed to the repository**, these keys should be rotated as a security best practice and migrated to secure storage (macOS Keychain as indicated by comments in the file).

## Exposed Credentials Analysis

### Critical API Keys Requiring Rotation

#### 1. OpenAI API Key
- **Location**: `.env.local` line 40
- **Format**: `sk-proj-*` (Project-scoped key)
- **Status**: EXPOSED in plaintext
- **Impact**: HIGH - Unauthorized access to OpenAI API, potential billing fraud
- **Action Required**: Rotate immediately

#### 2. Datadog API Key
- **Location**: `.env.local` line 39
- **Format**: 32-character hex string
- **Status**: EXPOSED in plaintext
- **Impact**: MEDIUM - Unauthorized metric submission, potential data exfiltration
- **Action Required**: Rotate immediately

#### 3. Database Credentials
- **Location**: `.env.local` lines 34-38
- **Credentials Exposed**:
  - PostgreSQL password: `vibecode2025`
  - Database URL with embedded password
  - Host: `i9-zfs-pop.local`
  - Database: `vibecode`
  - User: `postgres`
- **Status**: EXPOSED in plaintext
- **Impact**: CRITICAL - Full database access, data breach risk
- **Action Required**: Change password immediately

#### 4. CSRF Secret
- **Location**: `.env.local` line 30
- **Format**: 64-character hex string
- **Status**: EXPOSED in plaintext
- **Impact**: MEDIUM - Potential CSRF attack vector
- **Action Required**: Regenerate

### Public Client Tokens (Lower Priority)

#### 5. Datadog RUM Client Token
- **Location**: `.env.local` lines 24-26
- **Status**: NEXT_PUBLIC_* - Designed to be exposed to browser
- **Impact**: LOW - Client-side tokens have limited scope
- **Action Required**: Review if rotation needed per Datadog best practices

### Missing Critical Secrets

#### 6. NextAuth Secret
- **Status**: MISSING from .env.local
- **Required For**: Session encryption, JWT signing
- **Impact**: CRITICAL - Application authentication may be broken
- **Action Required**: Generate and add to Keychain

#### 7. JWT Secret
- **Status**: MISSING from .env.local
- **Required For**: WebSocket authentication, token signing
- **Impact**: HIGH - WebSocket security compromised
- **Action Required**: Generate and add to Keychain

---

## Rotation Instructions

### 1. OpenAI API Key Rotation

**Steps:**
```bash
# 1. Login to OpenAI Platform
open https://platform.openai.com/api-keys

# 2. Navigate to API Keys section
# 3. Revoke the existing key starting with: sk-proj-AwO41pGkUbQj...
# 4. Create a new project-scoped API key
# 5. Set appropriate permissions and rate limits
# 6. Copy the new key (you'll only see it once)

# 7. Store in macOS Keychain
security add-generic-password \
  -a "$USER" \
  -s "OPENAI_API_KEY" \
  -w "NEW_KEY_HERE" \
  -T ""

# 8. Verify storage
security find-generic-password -s "OPENAI_API_KEY" -w
```

**Documentation:**
- https://platform.openai.com/docs/api-reference/authentication
- https://platform.openai.com/account/api-keys

---

### 2. Datadog API Key Rotation

**Steps:**
```bash
# 1. Login to Datadog
open https://app.datadoghq.com/organization-settings/api-keys

# 2. Identify the key with value: 7f3df61644...
# 3. Revoke the old key
# 4. Create a new API key with appropriate permissions
# 5. Copy the new key

# 6. Store in macOS Keychain
security add-generic-password \
  -a "$USER" \
  -s "DD_API_KEY" \
  -w "NEW_KEY_HERE" \
  -T ""

# 7. Update any external systems using this key
```

**Note**: If you also have a DD_APP_KEY, rotate that as well.

**Documentation:**
- https://docs.datadoghq.com/account_management/api-app-keys/

---

### 3. PostgreSQL Password Rotation

**Steps:**
```bash
# 1. Connect to PostgreSQL as superuser
psql -h i9-zfs-pop.local -U postgres -d postgres

# 2. Generate a new secure password
NEW_PASSWORD=$(openssl rand -base64 32)
echo "New password: $NEW_PASSWORD"

# 3. Change the password
ALTER USER postgres WITH PASSWORD 'NEW_PASSWORD_HERE';

# 4. Store in macOS Keychain
security add-generic-password \
  -a "$USER" \
  -s "POSTGRES_PASSWORD" \
  -w "$NEW_PASSWORD" \
  -T ""

# 5. Update DATABASE_URL in Keychain
NEW_DB_URL="postgresql://postgres:$NEW_PASSWORD@i9-zfs-pop.local:5432/vibecode"
security add-generic-password \
  -a "$USER" \
  -s "DATABASE_URL" \
  -w "$NEW_DB_URL" \
  -T ""

# 6. Test connection
psql "$NEW_DB_URL" -c "SELECT version();"
```

**Important**: Update any other applications or services connecting to this database.

---

### 4. CSRF Secret Regeneration

**Steps:**
```bash
# 1. Generate new CSRF secret
NEW_CSRF_SECRET=$(openssl rand -hex 32)

# 2. Store in macOS Keychain
security add-generic-password \
  -a "$USER" \
  -s "CSRF_SECRET" \
  -w "$NEW_CSRF_SECRET" \
  -T ""

# 3. Update application configuration
```

---

### 5. Generate Missing Secrets

#### NextAuth Secret
```bash
# Generate 32-byte secret
NEXTAUTH_SECRET=$(openssl rand -base64 32)

# Store in Keychain
security add-generic-password \
  -a "$USER" \
  -s "NEXTAUTH_SECRET" \
  -w "$NEXTAUTH_SECRET" \
  -T ""
```

#### JWT Secret
```bash
# Generate 48-byte secret (per .env.example)
JWT_SECRET=$(openssl rand -base64 48)

# Store in Keychain
security add-generic-password \
  -a "$USER" \
  -s "JWT_SECRET" \
  -w "$JWT_SECRET" \
  -T ""
```

---

## Migration to Secure Storage

The `.env.local` file references a migration script. Complete the migration:

### 1. Review Migration Script
```bash
cat scripts/security/migrate-secrets-to-keychain.sh
```

### 2. Run Migration (if available)
```bash
# Backup current .env.local
cp .env.local .env.local.backup-$(date +%Y%m%d-%H%M%S)

# Run migration script
./scripts/security/migrate-secrets-to-keychain.sh
```

### 3. Update .env.local
After migration, `.env.local` should only contain:
- Non-sensitive configuration values
- Public environment variables (NEXT_PUBLIC_*)
- References to Keychain for sensitive values

### 4. Verify Application Loads Secrets from Keychain
```bash
# Check if loadSecret() function exists
grep -r "loadSecret" src/ lib/

# Test secret loading
npm run dev
```

---

## Security Checklist

### Immediate Actions (Complete within 24 hours)

- [ ] **Rotate OpenAI API Key**
  - [ ] Revoke old key in OpenAI Platform
  - [ ] Generate new project-scoped key
  - [ ] Store in macOS Keychain
  - [ ] Test application functionality
  - [ ] Remove old key from `.env.local`

- [ ] **Rotate Datadog API Key**
  - [ ] Revoke old key in Datadog console
  - [ ] Generate new API key
  - [ ] Store in macOS Keychain
  - [ ] Update monitoring configuration
  - [ ] Remove old key from `.env.local`

- [ ] **Change PostgreSQL Password**
  - [ ] Generate secure password (32+ characters)
  - [ ] Update password in PostgreSQL
  - [ ] Store in macOS Keychain
  - [ ] Update DATABASE_URL
  - [ ] Test database connectivity
  - [ ] Remove plaintext password from `.env.local`

- [ ] **Regenerate CSRF Secret**
  - [ ] Generate new 64-character hex secret
  - [ ] Store in macOS Keychain
  - [ ] Update application configuration
  - [ ] Remove old secret from `.env.local`

- [ ] **Generate Missing Secrets**
  - [ ] Generate NEXTAUTH_SECRET (32 bytes)
  - [ ] Generate JWT_SECRET (48 bytes)
  - [ ] Store both in macOS Keychain
  - [ ] Verify application authentication works

### Short-term Actions (Complete within 1 week)

- [ ] **Review Datadog RUM Tokens**
  - [ ] Verify Application ID: 52590244-d98c-4d53-a756-cfe50a8e868b
  - [ ] Verify Client Token scope is appropriate
  - [ ] Rotate if necessary per Datadog recommendations

- [ ] **Audit Keychain Migration**
  - [ ] Review migration script: `scripts/security/migrate-secrets-to-keychain.sh`
  - [ ] Ensure all secrets load from Keychain
  - [ ] Remove all plaintext secrets from `.env.local`

- [ ] **Update Documentation**
  - [ ] Document secret retrieval process
  - [ ] Update onboarding docs with Keychain setup
  - [ ] Create runbook for secret rotation

### Long-term Actions (Complete within 1 month)

- [ ] **Implement Secrets Management**
  - [ ] Evaluate HashiCorp Vault, AWS Secrets Manager, or 1Password
  - [ ] Consider team secret sharing requirements
  - [ ] Implement automated secret rotation

- [ ] **Add Pre-commit Hooks**
  - [ ] Install git-secrets or similar tool
  - [ ] Scan for API key patterns
  - [ ] Block commits containing secrets

- [ ] **Security Audit**
  - [ ] Review all environment variables
  - [ ] Audit access logs for compromised keys
  - [ ] Check for unusual API usage patterns
  - [ ] Review database access logs

- [ ] **Implement Monitoring**
  - [ ] Set up alerts for unusual API usage
  - [ ] Monitor database access patterns
  - [ ] Alert on failed authentication attempts

---

## Additional Security Recommendations

### 1. Environment Variable Best Practices

**DO:**
- Use macOS Keychain or dedicated secrets manager
- Rotate secrets regularly (quarterly minimum)
- Use unique secrets per environment (dev/staging/prod)
- Implement principle of least privilege
- Enable audit logging for secret access

**DON'T:**
- Commit `.env` files to version control
- Share secrets via email, Slack, or plaintext
- Use the same secrets across multiple projects
- Hard-code secrets in application code
- Store secrets in browser localStorage

### 2. Access Control

- Limit who has access to production secrets
- Use service accounts with minimal permissions
- Implement multi-factor authentication
- Regularly audit access logs
- Revoke access for departed team members

### 3. Detection and Response

- Set up billing alerts for OpenAI (detect unauthorized usage)
- Monitor Datadog API usage metrics
- Enable PostgreSQL query logging
- Create runbook for security incident response
- Test backup restoration procedures

### 4. Network Security

- Restrict PostgreSQL access to known IP addresses
- Use VPN for database connections
- Enable SSL/TLS for all connections
- Consider network segmentation

---

## Verification Commands

### Check if secrets are in Keychain
```bash
# OpenAI
security find-generic-password -s "OPENAI_API_KEY" -w 2>/dev/null && echo "✓ Found" || echo "✗ Missing"

# Datadog
security find-generic-password -s "DD_API_KEY" -w 2>/dev/null && echo "✓ Found" || echo "✗ Missing"

# Database
security find-generic-password -s "POSTGRES_PASSWORD" -w 2>/dev/null && echo "✓ Found" || echo "✗ Missing"
security find-generic-password -s "DATABASE_URL" -w 2>/dev/null && echo "✓ Found" || echo "✗ Missing"

# NextAuth
security find-generic-password -s "NEXTAUTH_SECRET" -w 2>/dev/null && echo "✓ Found" || echo "✗ Missing"

# JWT
security find-generic-password -s "JWT_SECRET" -w 2>/dev/null && echo "✓ Found" || echo "✗ Missing"
```

### Test API connectivity
```bash
# OpenAI (after rotation)
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $(security find-generic-password -s 'OPENAI_API_KEY' -w)"

# Datadog (after rotation)
curl -X GET "https://api.datadoghq.com/api/v1/validate" \
  -H "DD-API-KEY: $(security find-generic-password -s 'DD_API_KEY' -w)"

# PostgreSQL (after rotation)
psql "$(security find-generic-password -s 'DATABASE_URL' -w)" -c "SELECT 1"
```

---

## Timeline Tracking

| Action | Owner | Deadline | Status |
|--------|-------|----------|--------|
| Rotate OpenAI API Key | [ASSIGN] | 2025-11-06 | ⏳ Pending |
| Rotate Datadog API Key | [ASSIGN] | 2025-11-06 | ⏳ Pending |
| Change PostgreSQL Password | [ASSIGN] | 2025-11-06 | ⏳ Pending |
| Generate NEXTAUTH_SECRET | [ASSIGN] | 2025-11-06 | ⏳ Pending |
| Generate JWT_SECRET | [ASSIGN] | 2025-11-06 | ⏳ Pending |
| Migrate to Keychain | [ASSIGN] | 2025-11-07 | ⏳ Pending |
| Verify Application | [ASSIGN] | 2025-11-07 | ⏳ Pending |
| Update Documentation | [ASSIGN] | 2025-11-12 | ⏳ Pending |

---

## Support Resources

- **OpenAI Support**: https://help.openai.com/
- **Datadog Support**: https://help.datadoghq.com/
- **PostgreSQL Documentation**: https://www.postgresql.org/docs/
- **macOS Keychain**: `man security`
- **Security Incident Response**: [Define your process]

---

## Compliance Notes

If your organization is subject to:
- **GDPR**: Document this security event, assess data breach risk
- **SOC 2**: Update incident log, review access controls
- **HIPAA**: Assess if PHI was at risk, document remediation
- **PCI DSS**: Review if payment data was exposed

Consult with your security/compliance team as appropriate.

---

**Document Version**: 1.0
**Last Updated**: 2025-11-05
**Next Review**: After all actions completed
**Classification**: CONFIDENTIAL - Internal Use Only
