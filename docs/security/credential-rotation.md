# Credential Rotation Runbook

Consolidated guide for rotating API keys, database credentials, and secrets in VibeCode.

## Quick Reference

| Credential | Storage | Rotation Frequency | Documentation |
|------------|---------|-------------------|---------------|
| OpenAI API Key | macOS Keychain | 90 days | [OpenAI](#openai-api-key) |
| Datadog API Key | macOS Keychain | 90 days | [Datadog](#datadog-api-key) |
| PostgreSQL Password | macOS Keychain | 90 days | [PostgreSQL](#postgresql-password) |
| CSRF Secret | macOS Keychain | On demand | [CSRF](#csrf-secret) |
| NextAuth Secret | macOS Keychain | On incident | [NextAuth](#nextauth-secret) |
| JWT Secret | macOS Keychain | On incident | [JWT](#jwt-secret) |

## Pre-Rotation Checklist

- [ ] Identify all services using the credential
- [ ] Plan maintenance window if needed
- [ ] Backup current configuration
- [ ] Verify access to rotation portals/tools
- [ ] Notify team of rotation schedule

---

## Rotation Procedures

### OpenAI API Key

**Portal**: https://platform.openai.com/api-keys

```bash
# 1. Revoke old key in OpenAI Platform
open https://platform.openai.com/api-keys

# 2. Create new project-scoped API key
# 3. Copy the new key (shown only once)

# 4. Store in macOS Keychain
security delete-generic-password -s "OPENAI_API_KEY" 2>/dev/null
security add-generic-password \
  -a "$USER" \
  -s "OPENAI_API_KEY" \
  -w "NEW_KEY_HERE" \
  -T ""

# 5. Verify storage
security find-generic-password -s "OPENAI_API_KEY" -w

# 6. Test connectivity
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $(security find-generic-password -s 'OPENAI_API_KEY' -w)"
```

### Datadog API Key

**Portal**: https://app.datadoghq.com/organization-settings/api-keys

```bash
# 1. Revoke old key in Datadog console
open https://app.datadoghq.com/organization-settings/api-keys

# 2. Create new API key with appropriate permissions
# 3. Copy the new key

# 4. Store in macOS Keychain
security delete-generic-password -s "DD_API_KEY" 2>/dev/null
security add-generic-password \
  -a "$USER" \
  -s "DD_API_KEY" \
  -w "NEW_KEY_HERE" \
  -T ""

# 5. Verify storage
security find-generic-password -s "DD_API_KEY" -w

# 6. Test connectivity
curl -X GET "https://api.datadoghq.com/api/v1/validate" \
  -H "DD-API-KEY: $(security find-generic-password -s 'DD_API_KEY' -w)"
```

### PostgreSQL Password

```bash
# 1. Generate new secure password
NEW_PASSWORD=$(openssl rand -base64 32)
echo "New password generated (save securely)"

# 2. Connect to PostgreSQL as superuser
psql -h <DB_HOST> -U postgres -d postgres

# 3. Change the password (in psql)
ALTER USER postgres WITH PASSWORD 'NEW_PASSWORD_HERE';

# 4. Store password in macOS Keychain
security delete-generic-password -s "POSTGRES_PASSWORD" 2>/dev/null
security add-generic-password \
  -a "$USER" \
  -s "POSTGRES_PASSWORD" \
  -w "$NEW_PASSWORD" \
  -T ""

# 5. Update DATABASE_URL in Keychain
NEW_DB_URL="postgresql://postgres:$NEW_PASSWORD@<DB_HOST>:5432/vibecode"
security delete-generic-password -s "DATABASE_URL" 2>/dev/null
security add-generic-password \
  -a "$USER" \
  -s "DATABASE_URL" \
  -w "$NEW_DB_URL" \
  -T ""

# 6. Test connection
psql "$(security find-generic-password -s 'DATABASE_URL' -w)" -c "SELECT version();"
```

### CSRF Secret

```bash
# 1. Generate new CSRF secret
NEW_CSRF_SECRET=$(openssl rand -hex 32)

# 2. Store in macOS Keychain
security delete-generic-password -s "CSRF_SECRET" 2>/dev/null
security add-generic-password \
  -a "$USER" \
  -s "CSRF_SECRET" \
  -w "$NEW_CSRF_SECRET" \
  -T ""

# 3. Restart application to pick up new secret
```

### NextAuth Secret

```bash
# 1. Generate 32-byte secret
NEXTAUTH_SECRET=$(openssl rand -base64 32)

# 2. Store in Keychain
security delete-generic-password -s "NEXTAUTH_SECRET" 2>/dev/null
security add-generic-password \
  -a "$USER" \
  -s "NEXTAUTH_SECRET" \
  -w "$NEXTAUTH_SECRET" \
  -T ""

# Note: Rotating this will invalidate all existing sessions
```

### JWT Secret

```bash
# 1. Generate 48-byte secret
JWT_SECRET=$(openssl rand -base64 48)

# 2. Store in Keychain
security delete-generic-password -s "JWT_SECRET" 2>/dev/null
security add-generic-password \
  -a "$USER" \
  -s "JWT_SECRET" \
  -w "$JWT_SECRET" \
  -T ""

# Note: Rotating this will invalidate all existing JWTs (WebSocket auth, etc.)
```

---

## Verification Commands

Check all secrets are properly stored in Keychain:

```bash
echo "Checking Keychain secrets..."
for secret in OPENAI_API_KEY DD_API_KEY POSTGRES_PASSWORD DATABASE_URL NEXTAUTH_SECRET JWT_SECRET CSRF_SECRET; do
  if security find-generic-password -s "$secret" -w >/dev/null 2>&1; then
    echo "✓ $secret found"
  else
    echo "✗ $secret MISSING"
  fi
done
```

## Post-Rotation Checklist

- [ ] Old credential revoked at source
- [ ] New credential stored in Keychain
- [ ] Application restarted/redeployed
- [ ] Connectivity verified
- [ ] Monitoring shows no errors
- [ ] Document rotation date in security log

## Emergency Rotation

For suspected credential compromise:

1. **Immediately revoke** the credential at its source
2. Generate and deploy new credential
3. Audit logs for unauthorized access
4. Report incident per [Security Policy](../../SECURITY.md)

## Secret Management Best Practices

**DO:**
- Use macOS Keychain or dedicated secrets manager
- Rotate secrets every 90 days (quarterly)
- Use unique secrets per environment (dev/staging/prod)
- Enable audit logging for secret access

**DON'T:**
- Store secrets in `.env` files
- Commit secrets to version control
- Share secrets via email or chat
- Reuse secrets across projects

## Related Documentation

- [Security Policy](../../SECURITY.md)
- [Security Index](./README.md)
- [GitHub Actions Security](./GITHUB_ACTIONS_SECURITY_CHECKLIST.md)

---

**Last Updated**: 2026-01-20
**Document Owner**: Security Team
**Review Cycle**: Quarterly
