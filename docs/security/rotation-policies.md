# Secret Rotation Policies
**Policy Definitions and Implementation Guide**

**Version:** 1.0
**Date:** February 16, 2026
**Status:** Production Ready
**Security Classification:** Internal Use

---

## Overview

This document defines the rotation policies used in VibeCode's secret lifecycle management system. Policies determine rotation intervals, enforcement strategies, and handling procedures for different secret types.

**Key Concepts:**
- **Rotation Policy:** A set of rules defining when and how secrets should be rotated
- **Rotation Interval:** Time period before expiration (e.g., 90 days)
- **Rotation Strategy:** Manual, automated, provider-managed, or warning-only
- **Grace Period:** Buffer time before marking as critical
- **Warning Thresholds:** Days before expiration when alerts are triggered

---

## Table of Contents

1. [Policy Framework](#policy-framework)
2. [Predefined Policies](#predefined-policies)
3. [Policy Assignment](#policy-assignment)
4. [Rotation Strategies](#rotation-strategies)
5. [Policy Enforcement](#policy-enforcement)
6. [Custom Policies](#custom-policies)
7. [Policy Configuration](#policy-configuration)
8. [Compliance & Auditing](#compliance--auditing)

---

## Policy Framework

### Policy Structure

Every rotation policy includes:

```typescript
interface RotationPolicy {
  // Identification
  name: string                    // Unique policy identifier
  description: string             // Human-readable description
  secretType: SecretType          // Category of secrets

  // Timing
  rotationIntervalDays: number    // Days until expiration
  gracePeriodDays: number         // Buffer before critical status
  warningThresholds: number[]     // Alert at these days before expiration

  // Enforcement
  strategy: RotationStrategy      // How rotation is performed
  mandatory: boolean              // Whether policy is enforced

  // Metadata
  metadata?: {
    requiresApproval?: boolean            // Pre-approval needed
    allowProductionRotation?: boolean     // Can rotate in prod
    customValidation?: string             // Extra validation logic
    providerInstructions?: string         // Provider-specific steps
  }
}
```

### Secret Types

| Type | Description | Examples |
|------|-------------|----------|
| `api_key` | Third-party API keys | OpenAI, Anthropic, Google Cloud |
| `auth_token` | Authentication tokens | GitHub PATs, JWT secrets |
| `database_credential` | Database connections | PostgreSQL, Redis passwords |
| `monitoring_key` | Observability services | Datadog, New Relic API keys |
| `custom` | User-defined secrets | Application-specific secrets |

---

## Predefined Policies

### 1. API Keys Policy

**Policy Name:** `api_keys`

**Use Cases:** Third-party API keys for LLM providers, cloud services, and external integrations

**Configuration:**
```typescript
{
  name: 'api_keys',
  description: 'Third-party API keys (OpenAI, Anthropic, Azure, Google, etc.)',
  secretType: 'api_key',
  rotationIntervalDays: 90,        // 3 months
  gracePeriodDays: 7,
  warningThresholds: [30, 14, 7, 3, 1],
  strategy: 'manual',
  mandatory: true,
  metadata: {
    requiresApproval: false,
    allowProductionRotation: true,
    providerInstructions: 'Rotate via provider dashboard and update keychain'
  }
}
```

**Rotation Procedure:**
1. Generate new key in provider dashboard (OpenAI, Azure, etc.)
2. Test new key in staging environment
3. Rotate in VibeCode: `python rotate_secrets.py --secret-name OPENAI_API_KEY --new-value "sk-proj-..."`
4. Update all deployments
5. Verify functionality
6. Revoke old key in provider dashboard after 7-day grace period

**Applicable Secrets:**
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `AZURE_OPENAI_KEY`
- `GOOGLE_AI_API_KEY`
- `VOYAGE_API_KEY`

---

### 2. Auth Tokens Policy

**Policy Name:** `auth_tokens`

**Use Cases:** Short-lived authentication tokens and session secrets

**Configuration:**
```typescript
{
  name: 'auth_tokens',
  description: 'Authentication tokens and session secrets',
  secretType: 'auth_token',
  rotationIntervalDays: 30,        // 1 month (shorter interval)
  gracePeriodDays: 3,
  warningThresholds: [14, 7, 3, 1],
  strategy: 'manual',
  mandatory: true,
  metadata: {
    requiresApproval: false,
    allowProductionRotation: true,
    providerInstructions: 'Generate new token in provider settings'
  }
}
```

**Rotation Procedure:**
1. Create new personal access token (GitHub, GitLab, etc.)
2. Set appropriate scopes/permissions
3. Rotate in VibeCode: `python rotate_secrets.py --secret-name GITHUB_TOKEN --new-value "ghp_..."`
4. Update CI/CD configurations
5. Test repository access
6. Delete old token in provider settings

**Applicable Secrets:**
- `GITHUB_TOKEN`
- `GITLAB_TOKEN`
- `LINEAR_API_KEY`
- `NEXTAUTH_SECRET`

**Rationale:** Authentication tokens have higher compromise risk and shorter validity periods in industry standards.

---

### 3. Database Credentials Policy

**Policy Name:** `db_credentials`

**Use Cases:** Database connection strings, passwords, and credentials

**Configuration:**
```typescript
{
  name: 'db_credentials',
  description: 'Database connection strings and credentials',
  secretType: 'database_credential',
  rotationIntervalDays: 180,       // 6 months (longer interval)
  gracePeriodDays: 14,
  warningThresholds: [60, 30, 14, 7],
  strategy: 'manual',
  mandatory: true,
  metadata: {
    requiresApproval: true,         // Requires SRE approval
    allowProductionRotation: false, // Only during maintenance windows
    customValidation: 'Test connection before rotation',
    providerInstructions: 'Coordinate with database team for password reset'
  }
}
```

**Rotation Procedure:**
1. Schedule maintenance window (requires downtime)
2. Create new database user/password (or reset existing)
3. Test new credentials in staging
4. Update connection strings in all services
5. Coordinate deployment with SRE team
6. Rotate in VibeCode: `python rotate_secrets.py --secret-name DATABASE_URL --new-value "postgres://..."`
7. Restart all dependent services
8. Verify connectivity across services
9. Drop old database user after grace period

**Applicable Secrets:**
- `DATABASE_URL`
- `REDIS_URL`
- `POSTGRES_PASSWORD`

**Rationale:** Database rotations require coordination and potential downtime, justifying longer intervals.

---

### 4. Monitoring Keys Policy

**Policy Name:** `monitoring`

**Use Cases:** Observability and monitoring service API keys

**Configuration:**
```typescript
{
  name: 'monitoring',
  description: 'Monitoring and observability service keys',
  secretType: 'monitoring_key',
  rotationIntervalDays: 90,        // 3 months
  gracePeriodDays: 7,
  warningThresholds: [30, 14, 7],
  strategy: 'manual',
  mandatory: true,
  metadata: {
    requiresApproval: false,
    allowProductionRotation: true,
    providerInstructions: 'Generate new API key in service dashboard'
  }
}
```

**Rotation Procedure:**
1. Generate new API key in monitoring dashboard (Datadog, New Relic, etc.)
2. Rotate in VibeCode: `python rotate_secrets.py --secret-name DD_API_KEY --new-value "..."`
3. Update agent configurations
4. Restart agents/services
5. Verify telemetry flow
6. Revoke old key in dashboard

**Applicable Secrets:**
- `DD_API_KEY`
- `DD_APP_KEY`
- `DATADOG_API_KEY`
- `NEW_RELIC_LICENSE_KEY`

**Rationale:** Monitoring keys are critical for observability but have lower direct security risk.

---

### 5. Custom Policy

**Policy Name:** `custom`

**Use Cases:** Application-specific secrets not covered by other policies

**Configuration:**
```typescript
{
  name: 'custom',
  description: 'Custom-defined secrets',
  secretType: 'custom',
  rotationIntervalDays: 90,        // Default 3 months
  gracePeriodDays: 7,
  warningThresholds: [30, 14, 7],
  strategy: 'manual',
  mandatory: false,                // Advisory only
  metadata: {
    requiresApproval: false,
    allowProductionRotation: true,
    providerInstructions: 'Follow application-specific rotation procedure'
  }
}
```

**Use Cases:**
- Internal service API keys
- Webhook signing secrets
- Encryption keys
- Custom application secrets

**Rotation Procedure:** Application-specific (define in secret metadata)

---

## Policy Assignment

### Automatic Assignment

The system automatically infers policies based on secret key names:

```typescript
function inferPolicyFromKeyName(keyName: string): string {
  const normalized = keyName.toUpperCase()

  // API keys pattern
  if (/(OPENAI|ANTHROPIC|AZURE|GOOGLE|VOYAGE|DEEPSEEK).*API.*KEY/i.test(normalized)) {
    return 'api_keys'
  }

  // Auth tokens pattern
  if (/(GITHUB|GITLAB|LINEAR).*TOKEN/i.test(normalized) || /NEXTAUTH.*SECRET/i.test(normalized)) {
    return 'auth_tokens'
  }

  // Database credentials pattern
  if (/(DATABASE|POSTGRES|REDIS|MYSQL).*URL/i.test(normalized) || /.*(DB|DATABASE).*PASSWORD/i.test(normalized)) {
    return 'db_credentials'
  }

  // Monitoring keys pattern
  if (/(DD|DATADOG|NEW_RELIC|SENTRY).*API.*KEY/i.test(normalized)) {
    return 'monitoring'
  }

  // Default to custom
  return 'custom'
}
```

**Examples:**

| Secret Name | Inferred Policy | Rotation Interval |
|-------------|-----------------|-------------------|
| `OPENAI_API_KEY` | api_keys | 90 days |
| `GITHUB_TOKEN` | auth_tokens | 30 days |
| `DATABASE_URL` | db_credentials | 180 days |
| `DD_API_KEY` | monitoring | 90 days |
| `WEBHOOK_SECRET` | custom | 90 days |

### Manual Assignment

Override automatic assignment via registration:

```typescript
await secretManager.registerSecret(
  'CUSTOM_SECRET',
  'value',
  {
    rotationPolicy: 'auth_tokens',  // Override to shorter interval
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  }
)
```

Or via database:

```sql
UPDATE secret_metadata
SET rotation_policy = 'auth_tokens'
WHERE key_name = 'CUSTOM_SECRET';
```

---

## Rotation Strategies

### 1. Manual Strategy

**Description:** Requires human intervention to generate and apply new secrets

**Process:**
1. Operator generates new secret in provider dashboard
2. Operator updates VibeCode via CLI/API
3. System records rotation in audit trail
4. Operator verifies functionality

**Use Cases:** Most secrets (API keys, tokens, credentials)

**Advantages:**
- Full control over rotation process
- Can coordinate with external teams
- Allows pre-rotation testing

**Disadvantages:**
- Requires manual effort
- Risk of delayed rotations
- Human error potential

---

### 2. Automated Strategy

**Description:** System automatically generates and applies new secrets

**Process:**
1. System detects rotation needed (expiration threshold)
2. System generates cryptographically secure random value
3. System updates keychain + database
4. System records rotation in audit trail
5. Alerts sent for verification

**Use Cases:** Internal secrets with no external dependencies

**Advantages:**
- No manual intervention
- Consistent rotation schedule
- Reduces human error

**Disadvantages:**
- Limited to self-contained secrets
- Cannot handle provider-managed secrets
- Requires post-rotation verification

**Implementation:**
```bash
# Auto-generate secret value
python rotate_secrets.py --secret-name INTERNAL_API_KEY
# Generates 64-character random string automatically
```

---

### 3. Provider-Managed Strategy

**Description:** Secret rotation handled entirely by external provider (e.g., AWS Secrets Manager)

**Process:**
1. Provider rotates secret automatically
2. VibeCode pulls new value from provider API
3. System updates local cache + database
4. System records rotation in audit trail

**Use Cases:** Cloud-managed secrets (AWS, Azure Key Vault, GCP Secret Manager)

**Advantages:**
- Centralized secret management
- Automatic rotation by provider
- Built-in access controls

**Disadvantages:**
- Requires integration with provider API
- Additional costs
- Network dependency

**Status:** Future implementation (not currently supported)

---

### 4. Warning-Only Strategy

**Description:** System alerts on expiration but does not enforce rotation

**Process:**
1. System monitors expiration date
2. Warnings sent at threshold milestones
3. No automatic rotation performed
4. Operator decides when/if to rotate

**Use Cases:**
- Low-risk secrets
- Development/testing environments
- Secrets with complex rotation procedures

**Advantages:**
- Flexible rotation schedule
- No forced disruptions
- Alerts keep rotation visible

**Disadvantages:**
- Easy to ignore warnings
- Secrets may expire
- Compliance risk

---

## Policy Enforcement

### Eligibility Checks

Before rotation, the system validates:

1. **Policy Exists:** Secret has assigned rotation policy
2. **Status Valid:** Secret is `active` (not `expired`, `rotating`, `revoked`)
3. **Cooldown Elapsed:** 24 hours since last rotation
4. **Production Rules:** `allowProductionRotation` respected in prod environment
5. **Approval Required:** Pre-approval obtained if `requiresApproval: true`

**Example Validation:**

```typescript
import { validateRotationEligibility } from '@/lib/security/rotation-policies'

const result = await validateRotationEligibility(prisma, 'GITHUB_TOKEN', {
  isProduction: true
})

if (!result.eligible) {
  console.error('Cannot rotate:', result.reason)
  // Output: "Rotation cooldown active (23 hours remaining)"
}
```

### Cooldown Period

**Duration:** 24 hours between rotations

**Rationale:**
- Prevents accidental double-rotation
- Allows time for deployment propagation
- Reduces churn and instability

**Override:** Not recommended (can cause service disruption)

---

## Custom Policies

### Creating Custom Policies

Add new policies in `rotation-policies.ts`:

```typescript
export const ROTATION_POLICIES: Record<string, RotationPolicy> = {
  // ... existing policies ...

  payment_credentials: {
    name: 'payment_credentials',
    description: 'Payment gateway API keys and secrets',
    secretType: 'api_key',
    rotationIntervalDays: 60,       // 2 months (high security)
    gracePeriodDays: 5,
    warningThresholds: [30, 14, 7, 3, 1],
    strategy: 'manual',
    mandatory: true,
    metadata: {
      requiresApproval: true,       // Requires finance approval
      allowProductionRotation: false, // Only during maintenance
      customValidation: 'Verify payment processing after rotation',
      providerInstructions: 'Rotate via payment gateway dashboard with PCI compliance'
    }
  }
}
```

### Policy Considerations

When defining custom policies:

1. **Rotation Interval:** Balance security vs. operational overhead
   - High-risk secrets: 30-60 days
   - Standard secrets: 90 days
   - Low-risk secrets: 180 days

2. **Grace Period:** Allow time for planned rotations
   - Critical secrets: 3-5 days
   - Standard secrets: 7 days
   - Infrastructure: 14 days

3. **Warning Thresholds:** Start early to avoid last-minute rushes
   - Include 30-day warning for planning
   - Daily warnings in final week

4. **Strategy:** Choose based on secret lifecycle
   - External providers: manual
   - Internal secrets: automated
   - Cloud-managed: provider-managed

5. **Approval Requirements:** Based on business impact
   - Production database: require approval
   - Payment systems: require approval
   - Internal APIs: no approval needed

---

## Policy Configuration

### Environment-Specific Policies

Use different intervals for different environments:

```typescript
const rotationInterval = process.env.NODE_ENV === 'production'
  ? 90  // 3 months in production
  : 180 // 6 months in development

await secretManager.registerSecret(
  'API_KEY',
  'value',
  {
    rotationPolicy: 'api_keys',
    expiresAt: new Date(Date.now() + rotationInterval * 24 * 60 * 60 * 1000)
  }
)
```

### Global Policy Settings

Configure system-wide defaults in environment:

```bash
# .env
SECRET_ROTATION_DEFAULT_POLICY=api_keys
SECRET_ROTATION_DEFAULT_INTERVAL=90
SECRET_ROTATION_COOLDOWN_HOURS=24
SECRET_ROTATION_GRACE_PERIOD_DAYS=7
```

### Per-Secret Overrides

Override policy settings for specific secrets:

```sql
-- Shorter interval for high-risk secret
UPDATE secret_metadata
SET rotation_policy = 'auth_tokens'  -- 30 days instead of 90
WHERE key_name = 'HIGH_RISK_API_KEY';

-- Longer interval for stable credential
UPDATE secret_metadata
SET rotation_policy = 'db_credentials'  -- 180 days instead of 90
WHERE key_name = 'READONLY_DB_URL';
```

---

## Compliance & Auditing

### Policy Compliance Rate

Track adherence to rotation policies:

```sql
-- Overall compliance rate
SELECT
  COUNT(*) FILTER (WHERE rotation_policy IS NOT NULL) * 100.0 / COUNT(*) AS compliance_rate,
  COUNT(*) FILTER (WHERE rotation_policy IS NOT NULL) AS with_policy,
  COUNT(*) FILTER (WHERE rotation_policy IS NULL) AS without_policy
FROM secret_metadata
WHERE status = 'active';

-- Per-policy compliance
SELECT
  rotation_policy,
  COUNT(*) AS total_secrets,
  COUNT(*) FILTER (WHERE expires_at > NOW()) AS compliant,
  COUNT(*) FILTER (WHERE expires_at <= NOW()) AS expired
FROM secret_metadata
WHERE status = 'active'
GROUP BY rotation_policy
ORDER BY expired DESC;
```

### Audit Reports

Generate rotation compliance reports:

```bash
# Summary report
python check_expiration.py --format json > report.json

# Parse compliance data
jq '{
  total: .summary.total,
  compliant: (.summary.active + .summary.no_expiration),
  violations: (.summary.expired + .summary.expiring_soon),
  compliance_rate: ((.summary.active + .summary.no_expiration) * 100 / .summary.total)
}' report.json
```

### Rotation History Audit

Review rotation activity:

```sql
-- Rotation frequency by secret
SELECT
  sm.key_name,
  sm.rotation_policy,
  COUNT(*) AS rotation_count,
  MAX(srh.rotated_at) AS last_rotation,
  MIN(srh.rotated_at) AS first_rotation
FROM secret_rotation_history srh
JOIN secret_metadata sm ON srh.secret_id = sm.id
WHERE srh.rotated_at > NOW() - INTERVAL '90 days'
GROUP BY sm.key_name, sm.rotation_policy
ORDER BY rotation_count DESC;

-- Rotation by operator
SELECT
  rotated_by,
  COUNT(*) AS rotation_count,
  COUNT(DISTINCT secret_id) AS unique_secrets
FROM secret_rotation_history
WHERE rotated_at > NOW() - INTERVAL '30 days'
GROUP BY rotated_by
ORDER BY rotation_count DESC;
```

### Policy Violations

Identify secrets violating policies:

```sql
-- Expired secrets (policy violation)
SELECT
  key_name,
  rotation_policy,
  expires_at,
  NOW() - expires_at AS overdue_duration,
  status
FROM secret_metadata
WHERE expires_at < NOW()
  AND status = 'active'
ORDER BY expires_at ASC;

-- Secrets without policies
SELECT
  key_name,
  created_at,
  status
FROM secret_metadata
WHERE rotation_policy IS NULL
  AND status = 'active'
ORDER BY created_at ASC;
```

---

## Policy Best Practices

### 1. Risk-Based Assignment

Assign policies based on secret sensitivity:

**High Risk (30-day rotation):**
- Production database credentials
- Payment API keys
- Administrative tokens

**Medium Risk (90-day rotation):**
- Standard API keys (OpenAI, GitHub)
- Service-to-service secrets
- Monitoring API keys

**Low Risk (180-day rotation):**
- Read-only database credentials
- Development environment secrets
- Internal tooling tokens

### 2. Staggered Rotation Schedule

Avoid rotating all secrets simultaneously:

```
Week 1: Group A (OpenAI, Anthropic)
Week 2: Group B (Azure, Google Cloud)
Week 3: Group C (GitHub, GitLab)
Week 4: Group D (Monitoring, databases)
```

### 3. Testing Before Production

Always test rotations in staging:

1. Rotate in staging environment
2. Verify full application functionality
3. Monitor for errors (24-48 hours)
4. Apply to production
5. Monitor production (24-48 hours)
6. Revoke old secret

### 4. Grace Period Usage

Use grace periods for zero-downtime rotations:

1. Rotate secret (old still valid)
2. Deploy new secret to all services
3. Verify connectivity
4. Wait grace period (7 days)
5. Revoke old secret

### 5. Documentation

Document secret ownership and dependencies:

```yaml
# secrets-inventory.yaml
OPENAI_API_KEY:
  policy: api_keys
  interval: 90 days
  owner: platform-team
  used_by:
    - webgui (Next.js)
    - agents (Python)
    - experiments (Jupyter)
  rotation_notes: Coordinate with AI team before rotation
```

---

## Policy Migration

### Adding Policies to Existing Secrets

Bulk-assign policies to unmanaged secrets:

```sql
-- Assign api_keys policy to API key secrets
UPDATE secret_metadata
SET rotation_policy = 'api_keys',
    expires_at = NOW() + INTERVAL '90 days'
WHERE key_name LIKE '%_API_KEY'
  AND rotation_policy IS NULL;

-- Assign auth_tokens policy to token secrets
UPDATE secret_metadata
SET rotation_policy = 'auth_tokens',
    expires_at = NOW() + INTERVAL '30 days'
WHERE key_name LIKE '%_TOKEN'
  AND rotation_policy IS NULL;

-- Assign db_credentials policy to database secrets
UPDATE secret_metadata
SET rotation_policy = 'db_credentials',
    expires_at = NOW() + INTERVAL '180 days'
WHERE key_name LIKE 'DATABASE_%' OR key_name LIKE '%_DB_URL'
  AND rotation_policy IS NULL;
```

Or via Python script:

```bash
python migrate_secrets_to_keychain.py
# Automatically infers and assigns policies
```

---

## Additional Resources

- [Secret Rotation Guide](./secret-rotation-guide.md) - Operational documentation
- [TypeScript Implementation](../../src/lib/security/rotation-policies.ts) - Policy definitions
- [Expiration Checker](../../src/lib/security/expiration-checker.ts) - Monitoring logic
- [CLI Tools](../../scripts/security/) - Rotation automation

**Support:** For policy questions or custom policy requests, contact the Platform Security team.

**Version History:**
- 1.0 (2026-02-16): Initial policy framework with 5 predefined policies
