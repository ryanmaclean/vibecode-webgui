# Security Guide - Consolidated Documentation

**Last Updated**: November 18, 2025  
**Status**: Authoritative Security Reference  
**Audience**: Developers, DevOps, Security Teams

---

## Table of Contents

1. [Overview](#overview)
2. [API Key Management](#api-key-management)
3. [Credential Rotation](#credential-rotation)
4. [Security Audit Checklist](#security-audit-checklist)
5. [Incident Response](#incident-response)
6. [Compliance](#compliance)
7. [Supply Chain Security](#supply-chain-security)
8. [Best Practices](#best-practices)

---

## Overview

This document consolidates all security procedures, policies, and best practices for the VibeCode platform. It serves as the single source of truth for security-related operations.

### Security Principles

1. **Defense in Depth**: Multiple layers of security controls
2. **Least Privilege**: Minimal access rights for users and services
3. **Zero Trust**: Verify explicitly, never assume trust
4. **Secure by Default**: Security enabled out of the box
5. **Transparency**: Clear audit trails and logging

### Threat Model

**Primary Threats**:
- API key exposure (HackerNews/Reddit Nov 2025: Major concern)
- Supply chain attacks (Compromised dependencies/extensions)
- Unauthorized access to workspaces
- Data exfiltration
- Cost attacks (Token exhaustion)

---

## API Key Management

### Storage

**✅ APPROVED Methods**:
- VS Code Secret Storage API (encrypted, OS keychain)
- Environment variables (for services, not committed)
- Azure Key Vault / AWS Secrets Manager (production)
- HashiCorp Vault (enterprise)

**❌ NEVER**:
- Hardcode in source code
- Commit to version control
- Store in plain text files
- Include in Docker images
- Log in application logs

### Configuration

```typescript
// ✅ CORRECT: Use VS Code Secret Storage
import * as vscode from 'vscode';

async function storeApiKey(key: string): Promise<void> {
  await vscode.workspace.getConfiguration('workspaceRag').update(
    'apiKey',
    key,
    vscode.ConfigurationTarget.Global
  );
}

// ✅ CORRECT: Retrieve from secure storage
async function getApiKey(): Promise<string | undefined> {
  return vscode.workspace.getConfiguration('workspaceRag').get('apiKey');
}
```

### Validation

All API keys must be validated before storage:

```typescript
function validateApiKey(key: string, provider: string): boolean {
  const patterns = {
    openai: /^sk-[A-Za-z0-9]{48}$/,
    anthropic: /^sk-ant-[A-Za-z0-9-]{95}$/,
    google: /^AIza[A-Za-z0-9_-]{35}$/
  };
  
  return patterns[provider]?.test(key) || false;
}
```

### Rotation Schedule

| Key Type | Rotation Frequency | Automated | Owner |
|----------|-------------------|-----------|-------|
| Development API Keys | 90 days | No | Developers |
| Production API Keys | 30 days | Yes | DevOps |
| Service Accounts | 30 days | Yes | DevOps |
| Database Credentials | 30 days | Yes | DevOps |
| OAuth Secrets | 90 days | No | Security Team |

---

## Credential Rotation

### Automated Rotation Process

**Script**: `scripts/security/rotate-credentials.sh`

```bash
#!/bin/bash
# Automated credential rotation with zero downtime
# Usage: ./rotate-credentials.sh [environment] [credential-type]

set -euo pipefail

ENVIRONMENT=${1:-production}
CREDENTIAL_TYPE=${2:-all}

echo "🔄 Starting credential rotation for $ENVIRONMENT..."

# 1. Generate new credentials
echo "📝 Generating new credentials..."
NEW_CREDS=$(generate_new_credentials "$CREDENTIAL_TYPE")

# 2. Store in secret manager
echo "🔐 Storing in secret manager..."
store_credentials "$ENVIRONMENT" "$NEW_CREDS"

# 3. Update services (rolling update)
echo "🔄 Updating services..."
update_services "$ENVIRONMENT" "$NEW_CREDS"

# 4. Verify new credentials work
echo "✅ Verifying new credentials..."
verify_credentials "$ENVIRONMENT"

# 5. Revoke old credentials (after grace period)
echo "⏰ Scheduling old credential revocation (24h grace period)..."
schedule_revocation "$ENVIRONMENT" "24h"

# 6. Audit log
echo "📊 Logging rotation event..."
log_rotation_event "$ENVIRONMENT" "$CREDENTIAL_TYPE"

echo "✅ Credential rotation complete!"
```

### Manual Rotation Procedure

**When**: Automated rotation fails, suspected compromise, or on-demand

**Steps**:

1. **Preparation** (5 minutes)
   ```bash
   # Notify team
   ./scripts/notify-team.sh "Starting credential rotation"
   
   # Backup current configuration
   ./scripts/backup-config.sh
   ```

2. **Generate New Credentials** (2 minutes)
   ```bash
   # For API keys
   openai api keys create --name "production-$(date +%Y%m%d)"
   
   # For database passwords
   openssl rand -base64 32
   ```

3. **Update Secret Manager** (3 minutes)
   ```bash
   # Azure Key Vault
   az keyvault secret set \
     --vault-name vibecode-prod \
     --name openai-api-key \
     --value "sk-new-key-here"
   
   # AWS Secrets Manager
   aws secretsmanager update-secret \
     --secret-id vibecode/openai-key \
     --secret-string "sk-new-key-here"
   ```

4. **Rolling Update** (10 minutes)
   ```bash
   # Kubernetes rolling update
   kubectl rollout restart deployment/vibecode-app -n production
   kubectl rollout status deployment/vibecode-app -n production
   ```

5. **Verification** (5 minutes)
   ```bash
   # Test new credentials
   ./scripts/test-credentials.sh production
   
   # Check application logs
   kubectl logs -l app=vibecode -n production --tail=100
   ```

6. **Revoke Old Credentials** (2 minutes)
   ```bash
   # Revoke old API key
   openai api keys delete sk-old-key-here
   
   # Update audit log
   ./scripts/audit-log.sh "Revoked old credentials"
   ```

### Rollback Procedure

If new credentials fail:

```bash
# 1. Restore from backup
./scripts/restore-config.sh

# 2. Restart services
kubectl rollout undo deployment/vibecode-app -n production

# 3. Investigate failure
./scripts/investigate-failure.sh
```

---

## Security Audit Checklist

### Pre-Deployment Checklist

- [ ] **Code Review**
  - [ ] No hardcoded secrets
  - [ ] Input validation on all user inputs
  - [ ] SQL injection prevention
  - [ ] XSS prevention
  - [ ] CSRF protection

- [ ] **Dependency Audit**
  - [ ] `npm audit` shows no critical/high vulnerabilities
  - [ ] All dependencies have compatible licenses (BSD/MIT/Apache)
  - [ ] No deprecated packages
  - [ ] Supply chain verification (npm provenance)

- [ ] **Secret Scanning**
  - [ ] Gitleaks scan passed
  - [ ] TruffleHog scan passed
  - [ ] No API keys in commit history

- [ ] **Access Control**
  - [ ] Principle of least privilege applied
  - [ ] Role-based access control (RBAC) configured
  - [ ] Service accounts have minimal permissions

- [ ] **Encryption**
  - [ ] Data at rest encrypted
  - [ ] Data in transit uses TLS 1.3
  - [ ] Secrets encrypted in storage

- [ ] **Logging & Monitoring**
  - [ ] Security events logged
  - [ ] Audit trail enabled
  - [ ] Alerts configured for suspicious activity

### Monthly Security Audit

Run on the 1st of each month:

```bash
#!/bin/bash
# Monthly security audit script

echo "🔍 Running monthly security audit..."

# 1. Dependency vulnerabilities
npm audit --audit-level=moderate

# 2. Secret scanning
gitleaks detect --source . --verbose

# 3. License compliance
npx license-checker --summary

# 4. Docker image scanning
trivy image vibecode/app:latest

# 5. Kubernetes security
kube-bench run --targets master,node

# 6. Access review
./scripts/review-access.sh

# 7. Generate report
./scripts/generate-security-report.sh
```

### Quarterly Security Review

- [ ] Penetration testing
- [ ] Threat model update
- [ ] Incident response drill
- [ ] Security training for team
- [ ] Compliance audit (SOC2, GDPR)

---

## Incident Response

### Incident Classification

| Severity | Description | Response Time | Escalation |
|----------|-------------|---------------|------------|
| **P0 - Critical** | Active breach, data exfiltration | < 15 minutes | CEO, CISO |
| **P1 - High** | API key exposed, unauthorized access | < 1 hour | Security Team |
| **P2 - Medium** | Suspicious activity, failed auth attempts | < 4 hours | DevOps |
| **P3 - Low** | Security policy violation | < 24 hours | Team Lead |

### Incident Response Playbook

#### API Key Exposure (P1)

**Detection**:
- GitHub secret scanning alert
- Gitleaks detection
- Unusual API usage patterns
- User report

**Response** (Complete within 1 hour):

1. **Immediate** (0-5 minutes)
   ```bash
   # Revoke exposed key immediately
   openai api keys delete sk-exposed-key
   
   # Notify team
   ./scripts/notify-team.sh "API key exposure - P1 incident"
   ```

2. **Containment** (5-15 minutes)
   ```bash
   # Rotate all related credentials
   ./scripts/rotate-credentials.sh production api-keys
   
   # Check for unauthorized usage
   ./scripts/check-api-usage.sh sk-exposed-key
   ```

3. **Investigation** (15-30 minutes)
   ```bash
   # Review git history
   git log --all --full-history -- "*api*key*"
   
   # Check access logs
   ./scripts/analyze-access-logs.sh
   
   # Identify exposure window
   ./scripts/identify-exposure-window.sh
   ```

4. **Recovery** (30-45 minutes)
   ```bash
   # Deploy new credentials
   kubectl apply -f k8s/secrets-updated.yaml
   
   # Verify services operational
   ./scripts/health-check.sh
   ```

5. **Post-Incident** (45-60 minutes)
   ```bash
   # Document incident
   ./scripts/create-incident-report.sh
   
   # Update security measures
   ./scripts/update-security-controls.sh
   
   # Schedule post-mortem
   ./scripts/schedule-postmortem.sh
   ```

#### Unauthorized Access (P1)

1. **Immediate Actions**:
   - Disable compromised account
   - Force logout all sessions
   - Enable enhanced monitoring

2. **Investigation**:
   - Review access logs
   - Identify attack vector
   - Assess data exposure

3. **Remediation**:
   - Patch vulnerability
   - Reset all credentials
   - Notify affected users

#### Data Breach (P0)

1. **Immediate Actions**:
   - Isolate affected systems
   - Preserve evidence
   - Notify legal/compliance

2. **Notification**:
   - Internal: Immediate
   - Customers: Within 72 hours (GDPR)
   - Regulators: As required

---

## Compliance

### SOC 2 Type II

**Requirements**:
- [ ] Access controls documented
- [ ] Change management process
- [ ] Incident response plan
- [ ] Regular security training
- [ ] Vendor risk management

**Evidence Collection**:
```bash
# Automated evidence collection
./scripts/collect-soc2-evidence.sh
```

### GDPR

**Data Protection**:
- [ ] Data encryption at rest and in transit
- [ ] Right to erasure implemented
- [ ] Data portability supported
- [ ] Privacy by design
- [ ] Data processing agreements

**User Rights**:
```typescript
// Right to erasure
async function deleteUserData(userId: string): Promise<void> {
  await database.deleteUser(userId);
  await vectorStore.deleteUserVectors(userId);
  await auditLog.log('user_data_deleted', { userId });
}

// Data export
async function exportUserData(userId: string): Promise<UserData> {
  const data = await database.getUserData(userId);
  return {
    personal: data.personal,
    usage: data.usage,
    preferences: data.preferences
  };
}
```

---

## Supply Chain Security

### Dependency Management

**Approved Sources**:
- ✅ npm registry (with provenance)
- ✅ GitHub (verified publishers)
- ❌ Unknown registries
- ❌ Unverified sources

**Verification**:
```bash
# Check package provenance
npm audit signatures

# Verify package integrity
npm install --ignore-scripts

# Review package contents
npm pack --dry-run
```

### VS Code Extension Security

**Before Installing**:
- [ ] Check publisher verification
- [ ] Review permissions requested
- [ ] Check download count and ratings
- [ ] Review source code (if available)
- [ ] Scan for known vulnerabilities

**Monitoring**:
```bash
# Monitor extension updates
./scripts/monitor-extensions.sh

# Audit installed extensions
code --list-extensions --show-versions
```

---

## Best Practices

### Development

1. **Never commit secrets**
   ```bash
   # Use pre-commit hooks
   pre-commit install
   
   # Configure gitleaks
   gitleaks protect --staged
   ```

2. **Use environment variables**
   ```bash
   # .env.example (committed)
   OPENAI_API_KEY=sk-your-key-here
   DATABASE_URL=postgresql://user:pass@localhost:5432/db
   
   # .env (gitignored)
   OPENAI_API_KEY=sk-actual-key
   DATABASE_URL=postgresql://actual-connection
   ```

3. **Validate all inputs**
   ```typescript
   import { z } from 'zod';
   
   const UserInputSchema = z.object({
     query: z.string().min(1).max(1000),
     model: z.enum(['gpt-4', 'gpt-3.5-turbo', 'claude-3-sonnet'])
   });
   
   function handleUserInput(input: unknown) {
     const validated = UserInputSchema.parse(input);
     // Safe to use validated data
   }
   ```

### Production

1. **Enable audit logging**
2. **Use read-only file systems**
3. **Implement rate limiting**
4. **Regular security updates**
5. **Automated backups**

### Monitoring

1. **Security metrics**:
   - Failed authentication attempts
   - API key usage anomalies
   - Unusual data access patterns
   - Dependency vulnerabilities

2. **Alerts**:
   - Critical: Immediate notification
   - High: Within 1 hour
   - Medium: Daily digest
   - Low: Weekly report

---

## Emergency Contacts

| Role | Contact | Availability |
|------|---------|--------------|
| Security Lead | security@vibecode.io | 24/7 |
| DevOps On-Call | oncall@vibecode.io | 24/7 |
| Legal | legal@vibecode.io | Business hours |
| CEO | ceo@vibecode.io | Emergency only |

---

## Appendix

### Useful Scripts

- `scripts/security/rotate-credentials.sh` - Automated credential rotation
- `scripts/security/audit-dependencies.sh` - Dependency security audit
- `scripts/security/scan-secrets.sh` - Secret scanning
- `scripts/security/generate-report.sh` - Security report generation

### References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CIS Benchmarks](https://www.cisecurity.org/cis-benchmarks)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [SOC 2 Requirements](https://www.aicpa.org/soc)
- [GDPR Compliance](https://gdpr.eu/)

---

**Document Version**: 1.0.0  
**Last Reviewed**: November 18, 2025  
**Next Review**: December 18, 2025  
**Owner**: Security Team
