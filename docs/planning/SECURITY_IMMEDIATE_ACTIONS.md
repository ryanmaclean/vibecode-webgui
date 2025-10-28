# Security Immediate Actions - Agent 24

**Date**: 2025-10-02
**Criticality**: **HIGH**
**Estimated Effort**: 40 hours (Week 1-2)

---

## Executive Summary

Agent 24 (Staff Security Engineer from Google's macOS Security Team) has completed a comprehensive security assessment of the VibeCode WebGUI project. **Critical security gaps identified** for macOS container runtime deployment.

**Current Risk Level**: **8.5/10 (Critical)**

**Key Findings**:
- ✅ **Good**: Hardcoded credentials now bcrypt-hashed (Issue #445 complete)
- ❌ **Critical**: No macOS App Sandbox profiles
- ❌ **Critical**: No TCC (privacy) policies
- ❌ **Critical**: No Keychain integration for secrets
- ❌ **Critical**: No code signing or notarization
- ⚠️  **High**: Credentials still in source code (database migration pending - Issue #438)
- ⚠️  **High**: Weak password generation in container provisioning

---

## Deliverables Created

### 1. Security Assessment Report
**File**: `/claudedocs/AGENT24_MACOS_SECURITY_ASSESSMENT.md`
**Size**: 25,000+ words
**Contents**:
- Authentication & secrets management audit
- macOS container runtime security analysis
- App Sandbox entitlements architecture
- TCC policy design
- MDM integration strategy
- Keychain Services implementation
- Container isolation & VM security
- Audit & monitoring architecture
- Incident response automation
- Priority remediation roadmap (4 phases)

### 2. Keychain Integration Implementation
**File**: `/src/lib/security/macos-keychain.ts`
**Features**:
- Secure secret storage via macOS Keychain Services API
- Secure Enclave backing (T2/Apple Silicon)
- FileVault encryption at rest
- Access Control Lists (ACLs)
- Fallback to environment variables
- Secret migration utility
- Secret rotation support
- Audit logging via unified logging

### 3. App Sandbox Entitlements
**File**: `/config/macos/container-runtime.entitlements`
**Permissions**:
- ✅ Virtualization.framework access (required)
- ✅ File system isolation
- ✅ Network client/server
- ✅ IPC for container orchestration
- ❌ Camera (explicitly denied)
- ❌ Microphone (explicitly denied)
- ❌ Location (explicitly denied)

### 4. TCC Privacy Policy
**File**: `/config/macos/tcc-policy.mobileconfig`
**Policies**:
- Full Disk Access for container runtime
- Camera access denied
- Microphone access denied
- Location services denied
- Automation/AppleScript denied
- Contacts/Calendar/Photos denied

### 5. Secret Migration Script
**File**: `/scripts/security/migrate-secrets-to-keychain.sh`
**Features**:
- Automatic migration from .env to Keychain
- Verification of stored secrets
- Backup of original .env file
- Interactive mode with safety prompts

### 6. Configuration Documentation
**File**: `/config/macos/README.md`
**Contents**:
- Deployment procedures
- Testing & validation guide
- Troubleshooting common issues
- MDM integration instructions
- Security monitoring setup

---

## Immediate Actions Required (This Week)

### Priority 1: Database Migration (Blocks Everything Else)
**Issue**: #438
**Status**: In Progress
**Owner**: Backend Team
**Effort**: 16 hours

**Tasks**:
1. Create PostgreSQL users table schema
2. Migrate legacy credentials from source code to database
3. Remove hardcoded credentials array from `src/lib/auth.ts`
4. Implement database-backed authentication
5. Add rate limiting middleware
6. Add account lockout after 5 failed attempts

**Blockers**: None
**Dependencies**: None

---

### Priority 2: Keychain Integration
**Issue**: NEW (create #XXX)
**Status**: Code ready, needs testing
**Owner**: Security Team
**Effort**: 12 hours

**Tasks**:
1. Install/update security pre-commit hooks: `npm run security:install-hook`
2. Test Keychain implementation on macOS development machine
3. Run migration script: `./scripts/security/migrate-secrets-to-keychain.sh`
4. Update `src/lib/auth.ts` to use `loadSecret()` instead of `process.env`
5. Verify secret retrieval works correctly
6. Test Secure Enclave integration on Apple Silicon Mac
7. Update deployment documentation

**Blockers**: None
**Dependencies**: macOS development machine

**Testing Steps**:
```bash
# 0. Ensure pre-commit security hook is configured
npm run security:install-hook

# 1. Test Keychain availability
node -e "const { isKeychainAvailable } = require('./src/lib/security/macos-keychain'); console.log(isKeychainAvailable())"

# 2. Run migration
./scripts/security/migrate-secrets-to-keychain.sh

# 3. Verify secrets stored
security find-generic-password -s com.vibecode.secrets -a NEXTAUTH_SECRET -w

# 4. Test application startup
npm run dev
```

---

### Priority 3: Fix Weak Password Generation
**Issue**: NEW (create #XXX)
**Status**: Not started
**Owner**: Backend Team
**Effort**: 2 hours

**File**: `src/lib/services/workspace-provisioning-apple-container.ts:298`

**Current Code** (INSECURE):
```typescript
private generatePassword(): string {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15)
}
```

**Secure Replacement**:
```typescript
import { randomBytes } from 'crypto'

private generatePassword(): string {
  // Generate cryptographically secure 32-character password
  return randomBytes(32).toString('base64url').substring(0, 32)
}
```

**Why This Matters**:
- `Math.random()` is **not cryptographically secure** (predictable seed)
- Attacker can predict generated passwords with enough samples
- `crypto.randomBytes()` uses OS-level entropy source (CSPRNGs)

---

### Priority 4: Add Rate Limiting to Authentication
**Issue**: NEW (create #XXX)
**Status**: Not started
**Owner**: Backend Team
**Effort**: 8 hours

**Tasks**:
1. Implement Redis-backed rate limiter (see existing code in `src/lib/rate-limit.ts`)
2. Add rate limiting middleware to `/api/auth/*` routes
3. Configure limits:
   - 5 attempts per 5 minutes for login
   - 10 attempts per hour for password reset
   - Lockout after 5 failed attempts (15 minutes)
4. Add audit logging for failed attempts
5. Send security alerts to Datadog for repeated failures
6. Test rate limiting with automated tests

**Implementation**:
```typescript
// middleware/auth-rate-limit.ts
import { rateLimit } from '@/lib/rate-limit'
import { NextRequest } from 'next/server'

export async function authRateLimit(req: NextRequest) {
  const result = await rateLimit(req, 5, 300) // 5 attempts per 5 minutes

  if (!result.success) {
    return new Response('Too many login attempts. Try again in 5 minutes.', {
      status: 429,
      headers: {
        'Retry-After': '300',
        'X-RateLimit-Limit': '5',
        'X-RateLimit-Remaining': '0',
      },
    })
  }

  return null // Allow request
}
```

---

## Short-Term Actions (Next 2-4 Weeks)

### Phase 2: macOS Security Foundation

#### Task 1: Code Signing & Notarization
**Effort**: 20 hours
**Prerequisites**: Apple Developer Account ($99/year)

**Steps**:
1. Enroll in Apple Developer Program
2. Generate Developer ID Application certificate
3. Configure Xcode project with entitlements
4. Create code signing script: `scripts/security/codesign-container-runtime.sh`
5. Test signing: `codesign --verify --verbose=4`
6. Submit for notarization: `xcrun notarytool submit`
7. Staple notarization ticket: `xcrun stapler staple`
8. Test Gatekeeper: `spctl --assess --verbose=4`

**Cost**: $99/year (Apple Developer Program)

---

#### Task 2: TCC Policy Deployment
**Effort**: 16 hours
**Prerequisites**: MDM provider (Jamf/Kandji/SimpleMDM)

**Steps**:
1. Update TCC policy with actual Apple Team ID
2. Test profile installation on development machine
3. Verify Full Disk Access granted
4. Verify camera/microphone denied
5. Package for MDM distribution
6. Deploy to test group via MDM
7. Monitor unified logging for TCC events

**Testing**:
```bash
# Install TCC profile
sudo profiles install -path=config/macos/tcc-policy.mobileconfig

# Verify installation
sudo profiles show -type configuration

# Check TCC database
sqlite3 ~/Library/Application\ Support/com.apple.TCC/TCC.db \
  "SELECT * FROM access WHERE service='kTCCServiceSystemPolicyAllFiles';"
```

---

#### Task 3: MDM Configuration Profile
**Effort**: 12 hours
**Prerequisites**: MDM provider subscription

**Steps**:
1. Create `config/macos/mdm-security-policy.mobileconfig`
2. Define resource limits (CPU, memory, storage)
3. Configure network restrictions (blocked ports)
4. Add FileVault enforcement
5. Add firewall configuration
6. Test with Jamf Pro / Kandji
7. Document deployment procedures

---

#### Task 4: Container Hardening
**Effort**: 16 hours

**Steps**:
1. Add AppArmor/SELinux profiles to Dockerfile
2. Add seccomp profiles for syscall filtering
3. Reduce binary permissions (755 → 750)
4. Implement read-only root filesystem (where possible)
5. Remove unnecessary capabilities
6. Test container isolation
7. Verify security profiles applied

---

## Testing Checklist

Before deployment, verify:

### Authentication Security
- [ ] Rate limiting works (5 attempts per 5 minutes)
- [ ] Account lockout works (after 5 failed attempts)
- [ ] Session expires correctly (24 hours)
- [ ] JWT rotates periodically (1 hour)
- [ ] Passwords use crypto.randomBytes() (not Math.random())

### Secrets Management
- [ ] Keychain stores secrets correctly
- [ ] Keychain retrieval works with fallback to env
- [ ] Migration script runs without errors
- [ ] Secrets backed up before migration
- [ ] Application starts with Keychain secrets

### macOS Security
- [ ] App Sandbox entitlements applied
- [ ] TCC policy grants Full Disk Access
- [ ] TCC policy denies camera/microphone
- [ ] Code signature valid: `codesign --verify --verbose=4`
- [ ] Gatekeeper approves: `spctl --assess --verbose=4`
- [ ] Notarization ticket stapled

### Container Security
- [ ] Containers run as non-root user
- [ ] AppArmor/SELinux profiles active
- [ ] Seccomp profiles restrict syscalls
- [ ] File system isolation enforced
- [ ] Network isolation enforced
- [ ] Resource limits enforced

---

## Risk Mitigation

### High-Risk Period: During Migration
**Dates**: This week (database migration)
**Risks**:
- Authentication downtime during database schema changes
- Failed migrations leave system in inconsistent state
- Rate limiting could block legitimate users if misconfigured

**Mitigation**:
1. Perform database migration in staging first
2. Have rollback plan ready (restore from backup)
3. Monitor authentication endpoints closely
4. Have incident response team on standby
5. Test rate limiting with automated tests before production

---

### Medium-Risk Period: After Keychain Migration
**Dates**: Week 2 (after Keychain integration)
**Risks**:
- Application fails to start if Keychain unavailable
- Secrets not migrated correctly
- Fallback to env vars doesn't work

**Mitigation**:
1. Keep backup of .env file with secrets
2. Test Keychain integration thoroughly on development machines
3. Implement graceful fallback to env vars
4. Monitor application startup metrics
5. Have emergency rollback plan

---

## Success Criteria

### Week 1 Success
- ✅ Database-backed authentication working (Issue #438 closed)
- ✅ Keychain integration tested and verified
- ✅ Weak password generation fixed
- ✅ Rate limiting active on auth endpoints
- ✅ Zero authentication-related incidents

### Week 2 Success
- ✅ App Sandbox entitlements applied
- ✅ TCC policy deployed via MDM
- ✅ Code signing & notarization complete
- ✅ MDM configuration profile tested
- ✅ Security monitoring active

### Week 4 Success
- ✅ CIS macOS Benchmark compliance achieved
- ✅ Container isolation verified
- ✅ Incident response automation tested
- ✅ Security documentation complete
- ✅ Zero security vulnerabilities in production

---

## Resources Required

### Hardware
- macOS development machine (macOS 13+ for Virtualization.framework)
- Apple Silicon Mac (for Secure Enclave testing)

### Software
- Apple Developer Account ($99/year)
- MDM provider subscription (Jamf/Kandji/SimpleMDM)
- PostgreSQL database (for user storage)
- Redis instance (for rate limiting)

### Personnel
- Backend engineer (16 hours) - database migration
- Security engineer (24 hours) - Keychain, TCC, code signing
- DevOps engineer (8 hours) - MDM deployment, monitoring

**Total Effort**: 48 hours (1.2 weeks for 3 engineers in parallel)

---

## Communication Plan

### Daily Standup
- Report progress on database migration (Issue #438)
- Report blockers immediately
- Share test results from Keychain integration
- Escalate any authentication issues

### Weekly Review
- Review security assessment findings with team
- Prioritize next week's tasks
- Update risk register
- Review incident response procedures

### Incident Response
- Security incidents: Escalate to Maya (Security Lead) immediately
- Authentication outages: Escalate to on-call engineer
- Contact: security@vibecode.com

---

## Next Steps

1. **TODAY**: Review security assessment report (`claudedocs/AGENT24_MACOS_SECURITY_ASSESSMENT.md`)
2. **TODAY**: Create GitHub issues for Priority 1-4 tasks
3. **TODAY**: Assign owners and set deadlines
4. **THIS WEEK**: Complete Priority 1-4 tasks (database migration, Keychain, password fix, rate limiting)
5. **NEXT WEEK**: Start Phase 2 (code signing, TCC, MDM)
6. **WEEK 3-4**: Complete container hardening and monitoring

---

## Questions for Team

1. **Database Migration**: Do we have PostgreSQL staging environment ready for testing?
2. **Apple Developer Account**: Do we have active enrollment ($99/year)?
3. **MDM Provider**: Which MDM are we targeting (Jamf/Kandji/SimpleMDM)?
4. **Timeline**: Is 2-week timeline for Priority 1-4 tasks acceptable?
5. **Resources**: Can we allocate 3 engineers for parallel work?

---

## Conclusion

Agent 24 has identified **critical security gaps** in the VibeCode WebGUI project for macOS container runtime deployment. While basic authentication exists, **macOS-specific security controls are completely missing**.

**Immediate action required** on:
1. Database migration (Issue #438) - **blocks everything else**
2. Keychain integration - **code ready, needs testing**
3. Password generation fix - **2 hours, critical**
4. Rate limiting - **8 hours, high priority**

## Sequential Thinking API Hardening (NEW)

**Issue**: create #559

**Owner**: Security + AI Platform (Codex-Security-2 persona)

**Why**: The `/api/ai/sequential-thinking` endpoint powers MCP workflows and must be resilient against unauthenticated access, abuse, and silent fallback loops.

**Tasks**:
1. Verify `withAIAuth` guard in edge runtime; add regression test ensuring anonymous requests receive 401/403.
2. Align middleware rate limiting thresholds (100 requests/hour baseline) and document override procedure.
3. Feed structured Datadog logs (`logSequentialThinking`) into security dashboards and define alert thresholds for fallback/error spikes.
4. Implement automated check that flags fallback ratio >25% over 5 minutes and notify on-call.
5. Update incident response runbook with remediation steps (flush queue, restart MCP server, notify platform).

**Effort**: 6 hours

**Dependencies**: #558 (middleware regression fix), #550 (Datadog dashboards)

**Estimated total effort**: 172 hours (~4.3 weeks for 1 engineer, or 1.2 weeks for 3 engineers in parallel)

**Agent 24 handoff complete**. Standing by for questions and ready to assist with implementation.

---

**Report Generated**: 2025-10-02
**Agent**: Agent 24 (Staff Security Engineer)
**Status**: Assessment complete, implementation ready
