# Secret Rotation Guide
**VibeCode Secret Lifecycle Management**

**Version:** 1.0
**Date:** February 16, 2026
**Status:** Production Ready
**Security Classification:** Internal Use

---

## Executive Summary

VibeCode implements comprehensive secret rotation and expiration tracking to minimize the blast radius of credential compromise. This guide covers the operational aspects of managing secrets throughout their lifecycle, from registration through rotation to retirement.

**Key Capabilities:**
- Automatic expiration tracking for all secrets
- Policy-based rotation schedules (90/30/180 day intervals)
- CLI tools for health auditing and rotation automation
- API endpoints for programmatic management
- macOS Keychain integration for secure storage
- Complete audit trail via rotation history

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [System Architecture](#system-architecture)
3. [Secret Registration](#secret-registration)
4. [Checking Secret Health](#checking-secret-health)
5. [Rotating Secrets](#rotating-secrets)
6. [API Usage](#api-usage)
7. [Monitoring & Alerts](#monitoring--alerts)
8. [Troubleshooting](#troubleshooting)
9. [Best Practices](#best-practices)

---

## Quick Start

### Prerequisites

- macOS 12+ (for Keychain integration)
- PostgreSQL database with migrations applied
- Node.js 18+ and Python 3.9+
- Environment variables configured (DATABASE_URL)

### Initial Setup

1. **Apply database migrations:**
   ```bash
   npx prisma migrate dev
   ```

2. **Verify schema:**
   ```bash
   npx prisma migrate status
   psql $DATABASE_URL -c "\dt secret_*"
   ```

3. **Register existing secrets:**
   ```bash
   cd scripts/security
   python migrate_secrets_to_keychain.py
   ```

4. **Check secret health:**
   ```bash
   python check_expiration.py
   ```

### Daily Operations

```bash
# Check for expiring secrets (CI-friendly)
python check_expiration.py --ci --days 30

# Rotate a specific secret (dry-run first)
python rotate_secrets.py --secret-name GITHUB_TOKEN --dry-run
python rotate_secrets.py --secret-name GITHUB_TOKEN --new-value "ghp_new_token"

# View rotation history
curl http://localhost:3000/api/secrets/status | jq '.lastRotations'
```

---

## System Architecture

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Secret Lifecycle System                  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────┐    ┌──────────────┐    ┌───────────────┐  │
│  │   macOS     │───▶│  PostgreSQL  │◀───│  TypeScript   │  │
│  │  Keychain   │    │  Metadata    │    │  Libraries    │  │
│  └─────────────┘    └──────────────┘    └───────────────┘  │
│         │                  │                      │          │
│         │                  │                      │          │
│         ▼                  ▼                      ▼          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Unified Secret Manager                   │  │
│  └──────────────────────────────────────────────────────┘  │
│         │                  │                      │          │
│         ▼                  ▼                      ▼          │
│  ┌──────────┐      ┌─────────────┐      ┌──────────────┐  │
│  │ Python   │      │ REST APIs   │      │  Expiration  │  │
│  │ CLI      │      │ /secrets/*  │      │  Checker     │  │
│  └──────────┘      └─────────────┘      └──────────────┘  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Registration:** Secrets stored in Keychain + metadata in PostgreSQL
2. **Tracking:** Expiration dates and rotation policies tracked in database
3. **Monitoring:** Automated checks identify expiring/expired secrets
4. **Rotation:** Coordinated update of Keychain + database + audit trail
5. **Alerting:** Severity-based notifications (critical/warning/info)

### Database Schema

**secret_metadata table:**
- `id`: Primary key
- `key_name`: Unique identifier (e.g., "GITHUB_TOKEN")
- `created_at`: Registration timestamp
- `expires_at`: Expiration date (nullable)
- `last_rotated_at`: Last rotation timestamp
- `rotation_policy`: Policy name (api_keys, auth_tokens, etc.)
- `status`: active | expired | rotating | revoked
- `metadata`: JSONB for additional context

**secret_rotation_history table:**
- `id`: Primary key
- `secret_id`: Foreign key to secret_metadata
- `rotated_at`: Rotation timestamp
- `rotated_by`: User/system identifier
- `reason`: Rotation reason
- `previous_expires_at`: Old expiration date
- `new_expires_at`: New expiration date

---

## Secret Registration

### Using TypeScript API

```typescript
import { SecretManager } from '@/lib/security/secret-manager'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const secretManager = new SecretManager(prisma)

// Register with expiration and rotation policy
await secretManager.registerSecret(
  'OPENAI_API_KEY',
  'sk-proj-...',
  {
    expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
    rotationPolicy: 'api_keys',
    metadata: {
      provider: 'OpenAI',
      environment: 'production'
    },
    keychainOptions: {
      service: 'VibeCode',
      accessibility: 'whenUnlocked'
    }
  }
)
```

### Using Python Migration Script

```bash
# Migrate secrets from .env to Keychain + database
cd scripts/security
python migrate_secrets_to_keychain.py

# The script will:
# 1. Read secrets from .env file
# 2. Store in macOS Keychain with metadata
# 3. Register in database with inferred rotation policies
# 4. Report migration statistics
```

### Manual Registration

```bash
# Store secret in Keychain
security add-generic-password -a "$USER" -s "GITHUB_TOKEN" \
  -w "ghp_your_token_here" \
  -j '{"createdAt": "2026-02-16T00:00:00Z", "expiresAt": "2026-05-17T00:00:00Z"}'

# Register in database via psql
psql $DATABASE_URL <<EOF
INSERT INTO secret_metadata (key_name, expires_at, rotation_policy, status)
VALUES ('GITHUB_TOKEN', '2026-05-17 00:00:00', 'api_keys', 'active')
ON CONFLICT (key_name) DO UPDATE
SET expires_at = EXCLUDED.expires_at,
    rotation_policy = EXCLUDED.rotation_policy;
EOF
```

---

## Checking Secret Health

### Python CLI Tool

The `check_expiration.py` script provides comprehensive secret health auditing:

```bash
# Basic check - shows all secrets
python check_expiration.py

# Check secrets expiring within 7 days
python check_expiration.py --days 7

# Filter by status
python check_expiration.py --status expired
python check_expiration.py --status expiring_soon

# JSON output for automation
python check_expiration.py --format json > secrets.json

# CI integration (exits with non-zero on issues)
python check_expiration.py --ci --days 30
# Exit codes: 0=ok, 1=warning, 2=critical, 3=error

# Disable colors and recommendations
python check_expiration.py --no-color --no-recommendations
```

### Output Example

```
🔍 Secret Expiration Check
─────────────────────────────────────────────────────────────

🔴 CRITICAL: OPENAI_API_KEY
   Status: Expired
   Expired: 2 days ago
   Policy: api_keys (90 days)
   Recommendation: Rotate immediately via OpenAI dashboard

🟡 WARNING: GITHUB_TOKEN
   Status: Expiring Soon
   Expires: in 5 days
   Policy: api_keys (90 days)
   Recommendation: Plan rotation via GitHub settings

📊 Summary
─────────────────────────────────────────────────────────────
Total secrets: 15
✅ Active: 10
🟡 Expiring soon: 3
🔴 Expired: 2
⚪ No expiration: 0

Exit code: 2 (CRITICAL)
```

### REST API

```bash
# Get comprehensive status
curl http://localhost:3000/api/secrets/status | jq

# Response structure:
{
  "status": "degraded",
  "timestamp": "2026-02-16T12:00:00.000Z",
  "secrets": {
    "total": 15,
    "active": 10,
    "expiringSoon": 3,
    "expired": 2,
    "noExpiration": 0
  },
  "alerts": [
    {
      "keyName": "OPENAI_API_KEY",
      "severity": "critical",
      "expiresAt": "2026-02-14T00:00:00.000Z",
      "daysUntilExpiration": -2,
      "rotationPolicy": "api_keys",
      "message": "Secret expired 2 days ago"
    }
  ],
  "policyCompliance": {
    "withPolicy": 12,
    "withoutPolicy": 3,
    "complianceRate": "80.0%"
  },
  "lastRotations": [
    {
      "keyName": "DATABASE_URL",
      "rotatedAt": "2026-02-15T10:30:00.000Z",
      "rotatedBy": "system",
      "reason": "scheduled_rotation"
    }
  ],
  "responseTime": "45ms"
}
```

---

## Rotating Secrets

### Python CLI Tool

The `rotate_secrets.py` script provides automated rotation capabilities:

```bash
# Rotate a single secret (dry-run recommended first)
python rotate_secrets.py --secret-name GITHUB_TOKEN --dry-run
python rotate_secrets.py --secret-name GITHUB_TOKEN --new-value "ghp_new_token"

# Auto-generate secure secret value
python rotate_secrets.py --secret-name API_SECRET
# Generates 64-character random string automatically

# Batch rotation (use with caution!)
python rotate_secrets.py --all --dry-run
python rotate_secrets.py --all

# The script will:
# 1. Verify secret exists in database
# 2. Check rotation policy and cooldown period (24 hours)
# 3. Generate new secret value (if not provided)
# 4. Update macOS Keychain with metadata
# 5. Record rotation in database history
# 6. Display next expiration date
```

### Rotation Policies

Secrets are automatically assigned rotation intervals based on their policy:

| Policy | Interval | Strategy | Use Cases |
|--------|----------|----------|-----------|
| `api_keys` | 90 days | Manual | OpenAI, Anthropic, Azure, Google Cloud |
| `auth_tokens` | 30 days | Manual | GitHub PATs, session tokens |
| `db_credentials` | 180 days | Manual | PostgreSQL, Redis passwords |
| `monitoring` | 90 days | Manual | Datadog, New Relic API keys |
| `custom` | 90 days | Manual | Other secrets |

**Cooldown Period:** 24 hours between rotations to prevent excessive changes.

### REST API

```bash
# Trigger rotation via API
curl -X POST http://localhost:3000/api/secrets/rotate \
  -H "Content-Type: application/json" \
  -d '{
    "secret_name": "GITHUB_TOKEN",
    "reason": "scheduled_rotation",
    "dry_run": true
  }'

# Response structure:
{
  "success": true,
  "secret_name": "GITHUB_TOKEN",
  "rotated_at": "2026-02-16T12:30:00.000Z",
  "previous_expires_at": "2026-03-01T00:00:00.000Z",
  "new_expires_at": "2026-05-17T00:00:00.000Z",
  "rotation_policy": "api_keys",
  "message": "Secret rotated successfully",
  "nextSteps": [
    "Update .env file with new value",
    "Restart services that use this secret",
    "Verify functionality in staging environment"
  ]
}

# With new secret value
curl -X POST http://localhost:3000/api/secrets/rotate \
  -H "Content-Type: application/json" \
  -d '{
    "secret_name": "OPENAI_API_KEY",
    "new_secret_value": "sk-proj-new-key",
    "reason": "security_incident",
    "dry_run": false
  }'
```

### Manual Rotation Steps

For provider-managed secrets (GitHub, OpenAI, etc.):

1. **Generate new secret** in provider dashboard
2. **Test new secret** in staging environment
3. **Rotate in VibeCode:**
   ```bash
   python rotate_secrets.py --secret-name GITHUB_TOKEN --new-value "ghp_new_token"
   ```
4. **Update deployments** with new secret
5. **Verify functionality** across all services
6. **Revoke old secret** in provider dashboard after grace period

---

## API Usage

### Authentication

API endpoints require authentication via next-auth session:

```typescript
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const session = await getServerSession(authOptions)
if (!session) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

Unauthenticated requests receive limited information (status + timestamp only).

### Endpoints

#### GET /api/secrets/status

**Purpose:** Monitor secret health and expiration status

**Response:**
- `status`: healthy | degraded | unhealthy
- `secrets`: Counts by status (total, active, expiring, expired)
- `alerts`: Array of expiring/expired secrets with severity
- `policyCompliance`: Compliance metrics
- `lastRotations`: Recent rotation history

**Use Cases:**
- Health monitoring dashboards
- Automated alerting pipelines
- Compliance reporting

#### POST /api/secrets/rotate

**Purpose:** Trigger secret rotation programmatically

**Request Body:**
```json
{
  "secret_name": "GITHUB_TOKEN",
  "reason": "scheduled_rotation",
  "new_secret_value": "ghp_optional_new_value",
  "dry_run": false
}
```

**Response:**
```json
{
  "success": true,
  "secret_name": "GITHUB_TOKEN",
  "rotated_at": "2026-02-16T12:30:00.000Z",
  "new_expires_at": "2026-05-17T00:00:00.000Z",
  "message": "Secret rotated successfully",
  "nextSteps": ["Update deployments", "Verify functionality"]
}
```

**Error Responses:**
- `400`: Missing/invalid parameters, no rotation policy
- `401`: Authentication required
- `404`: Secret not found
- `429`: Rotation cooldown active (24 hours)
- `500`: Server error

---

## Monitoring & Alerts

### Expiration Thresholds

Alerts are generated based on days until expiration:

| Threshold | Severity | Action |
|-----------|----------|--------|
| ≤ 1 day | Critical | Immediate rotation required |
| ≤ 7 days | Critical | Rotation within 7 days |
| ≤ 14 days | Warning | Plan rotation |
| ≤ 30 days | Info | Review upcoming rotations |
| > 30 days | OK | No action needed |

### Alert Configuration

Configure notification settings in `ExpirationChecker`:

```typescript
import { ExpirationChecker } from '@/lib/security/expiration-checker'

const checker = new ExpirationChecker(prisma, {
  thresholds: {
    critical: 7,  // days
    warning: 14,
    info: 30
  },
  notifications: {
    enabled: true,
    minSeverity: 'warning',  // Only warning+ alerts
    renotifyInterval: 24 * 60 * 60 * 1000,  // 24 hours in ms
    includeRecommendations: true
  }
})

// Send alerts
await checker.sendAlerts()
```

### Integration with Monitoring Systems

**Datadog Integration:**

```python
# In check_expiration.py (already instrumented)
from ddtrace import tracer

with tracer.trace("secret.expiration.check"):
    summary = analyze_secrets()

    # Metric reporting
    statsd.gauge("vibecode.secrets.total", summary.total)
    statsd.gauge("vibecode.secrets.expired", summary.expired)
    statsd.gauge("vibecode.secrets.expiring_soon", summary.expiring_soon)
```

**CI/CD Integration:**

```yaml
# GitHub Actions example
- name: Check Secret Expiration
  run: |
    cd scripts/security
    python check_expiration.py --ci --days 30
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

### Scheduled Checks

**Cron job example (daily check):**

```bash
# /etc/cron.daily/check-secrets
#!/bin/bash
cd /path/to/vibecode/scripts/security
python check_expiration.py --ci --days 30 2>&1 | tee -a /var/log/secret-checks.log
```

---

## Troubleshooting

### Common Issues

#### "psycopg2 module not found"

**Problem:** Python database driver not installed

**Solution:**
```bash
pip install psycopg2-binary
# or
pip install -r requirements.txt
```

#### "Keychain access denied"

**Problem:** macOS Keychain permissions not granted

**Solution:**
```bash
# Unlock keychain if locked
security unlock-keychain ~/Library/Keychains/login.keychain-db

# Grant Terminal/script access in System Settings > Privacy & Security
```

#### "Migration not applied"

**Problem:** Database tables don't exist

**Solution:**
```bash
npx prisma migrate dev
npx prisma migrate status  # Verify
```

#### "Rotation cooldown active"

**Problem:** Trying to rotate within 24 hours of last rotation

**Solution:**
- Wait for cooldown period to expire
- Check last rotation time: `python check_expiration.py --format json | jq '.secrets[] | select(.key_name == "SECRET_NAME")'`
- Override not recommended (introduces instability)

#### "Secret not found in database"

**Problem:** Secret exists in Keychain but not registered in database

**Solution:**
```bash
# Re-run migration to register
python migrate_secrets_to_keychain.py

# Or register manually via API
curl -X POST http://localhost:3000/api/secrets/rotate \
  -d '{"secret_name": "SECRET_NAME", "dry_run": true}'
```

### Debug Mode

Enable debug logging:

```bash
# Python scripts
export DD_CURRENT_LOG_LEVEL=DEBUG
python check_expiration.py

# TypeScript/Node.js
export LOG_LEVEL=debug
npm run dev
```

### Database Inspection

```sql
-- Check secret metadata
SELECT key_name, expires_at, rotation_policy, status, last_rotated_at
FROM secret_metadata
ORDER BY expires_at ASC NULLS LAST;

-- Check rotation history
SELECT sm.key_name, srh.rotated_at, srh.rotated_by, srh.reason
FROM secret_rotation_history srh
JOIN secret_metadata sm ON srh.secret_id = sm.id
ORDER BY srh.rotated_at DESC
LIMIT 10;

-- Find secrets without policies
SELECT key_name, status, created_at
FROM secret_metadata
WHERE rotation_policy IS NULL;

-- Find expired secrets
SELECT key_name, expires_at, rotation_policy
FROM secret_metadata
WHERE expires_at < NOW() AND status != 'revoked';
```

---

## Best Practices

### Security

1. **Never commit secrets** to version control
2. **Use environment-specific policies** (shorter intervals for production)
3. **Audit rotation history** regularly for anomalies
4. **Revoke old secrets** after rotation grace period
5. **Test in staging** before production rotation
6. **Limit access** to Keychain and database
7. **Enable Datadog APM** for rotation activity monitoring

### Operational

1. **Dry-run first** - Always test rotation with `--dry-run`
2. **Rotate during maintenance windows** - Minimize service disruption
3. **Update documentation** - Track which secrets are used where
4. **Automate where possible** - Use CI/CD for routine checks
5. **Set calendar reminders** - For manual rotation tasks
6. **Monitor compliance rate** - Aim for 100% policy coverage
7. **Review alerts weekly** - Don't let secrets expire

### Policy Assignment

Choose appropriate policies based on secret sensitivity:

- **High-value secrets** (production DB, payment APIs): 30-day auth_tokens policy
- **Standard APIs** (OpenAI, GitHub): 90-day api_keys policy
- **Low-churn credentials** (monitoring, logging): 180-day db_credentials policy
- **Development secrets**: custom policy with longer intervals

### Rotation Schedule

Stagger rotations to avoid simultaneous updates:

```
Week 1: API keys group A (OpenAI, Anthropic)
Week 2: API keys group B (Azure, Google)
Week 3: Auth tokens (GitHub PATs)
Week 4: Monitoring keys (Datadog, New Relic)
```

### Documentation

Maintain a secret inventory spreadsheet:

| Secret Name | Policy | Last Rotated | Next Rotation | Owner | Services |
|-------------|--------|--------------|---------------|-------|----------|
| OPENAI_API_KEY | api_keys | 2026-02-15 | 2026-05-16 | Platform | webgui, agents |
| DATABASE_URL | db_credentials | 2025-12-01 | 2026-05-30 | SRE | All services |

---

## Additional Resources

- [Rotation Policies Reference](./rotation-policies.md) - Detailed policy documentation
- [Secret Manager API](../../src/lib/security/secret-manager.ts) - TypeScript implementation
- [Database Schema](../../prisma/schema.prisma) - Prisma models
- [CLI Tools](../../scripts/security/) - Python scripts

**Support:** For issues or questions, contact the Platform Security team.

**Version History:**
- 1.0 (2026-02-16): Initial release with full rotation system
