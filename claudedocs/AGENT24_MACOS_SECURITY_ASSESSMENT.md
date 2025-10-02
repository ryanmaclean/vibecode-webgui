# Agent 24: macOS Container Runtime Security Assessment

**Date**: 2025-10-02
**Agent**: Staff Security Engineer (Google macOS Security Team)
**Mission**: Production security architecture for Apple Container runtime
**Status**: **CRITICAL GAPS IDENTIFIED**

---

## Executive Summary

### Security Posture: **HIGH RISK**

The VibeCode WebGUI project lacks macOS-specific security controls required for enterprise container runtime deployment. While standard Docker security is partially addressed, **zero macOS security hardening exists**.

**Critical Findings**:
- ❌ No App Sandbox profiles
- ❌ No TCC (Transparency, Consent, Control) policies
- ❌ No Keychain integration for secrets
- ❌ No MDM configuration profiles
- ❌ No code signing or notarization
- ❌ No Virtualization.framework entitlements
- ⚠️  Hardcoded credentials in source code (bcrypt hashed but not database-backed)
- ⚠️  Weak secret management (env files, no macOS Keychain)
- ⚠️  Docker containers running as root in places
- ✅ Basic authentication with NextAuth (JWT-based)
- ✅ Supply chain verification for kubectl/helm/cosign

**Risk Rating**: **8.5/10** (Critical for enterprise deployment)

---

## 1. Authentication & Secrets Management Audit

### Current State: **VULNERABLE**

#### Finding: Hardcoded Legacy Credentials in Source Code
**File**: `/src/lib/auth.ts:113-184`
**Severity**: **CRITICAL** (Was HIGH, now mitigated with bcrypt)

```typescript
// SECURITY ISSUE: Credentials hardcoded in source code
const RAW_LEGACY_CREDENTIALS: LegacyCredential[] = [
  {
    email: 'admin@vibecode.dev',
    passwordHash: '$2b$12$JXIxHKb5sd8aZDt2pQNHhujlkBoXGXvJBfdJgOZ1uo.WAXN3mKFwK',
    id: 'legacy-admin',
    name: 'Admin User',
    role: 'admin'
  },
  // ... 9 more accounts
]
```

**Risks**:
- ✅ **MITIGATED**: Passwords now bcrypt-hashed (12 rounds) per Issue #445
- ⚠️  **REMAINING**: Credentials still in source code (not database-backed)
- ⚠️  **REMAINING**: No rate limiting on failed login attempts
- ⚠️  **REMAINING**: No account lockout mechanism
- ⚠️  **REMAINING**: No password reset flow
- ⚠️  **REMAINING**: No MFA support

**Remediation Status** (Issue #438 - In Progress):
- [x] Replace plaintext with bcrypt hashes
- [ ] Migrate to database-backed user storage (PostgreSQL)
- [ ] Implement rate limiting middleware
- [ ] Add account lockout after N failed attempts
- [ ] Implement password reset flow
- [ ] Add MFA provider integration

---

#### Finding: NEXTAUTH_SECRET Validation - **GOOD**
**File**: `/src/lib/auth.ts:50-78`
**Severity**: **LOW** (Proper validation exists)

The project **correctly validates** `NEXTAUTH_SECRET`:
```typescript
if (!NEXTAUTH_SECRET) {
  throw new Error('🚨 CRITICAL SECURITY ERROR: NEXTAUTH_SECRET is not defined!')
}

if (NEXTAUTH_SECRET.length < 32) {
  throw new Error('🚨 CRITICAL SECURITY ERROR: NEXTAUTH_SECRET is too weak!')
}
```

✅ **Good Practice**: Fails fast with clear error messages
✅ **Good Practice**: Enforces 32+ character minimum
✅ **Good Practice**: Documents generation method (`openssl rand -base64 32`)

---

#### Finding: Weak Secret Management - **HIGH RISK**
**File**: `.env.example`
**Severity**: **HIGH**

**Secrets stored in environment files**:
- Database passwords
- API keys (OpenAI, Anthropic, Datadog)
- OAuth credentials (GitHub, Google)
- JWT secrets
- Session secrets

**macOS Security Gaps**:
- ❌ No macOS Keychain integration
- ❌ No Secure Enclave support
- ❌ No Apple CryptoKit usage
- ❌ Secrets passed as plain environment variables
- ❌ No automatic secret rotation

**Recommended Architecture**:
```
┌─────────────────────────────────────┐
│ macOS Keychain Integration          │
├─────────────────────────────────────┤
│                                      │
│  Application Layer                   │
│  ├─ Process.env fallback            │
│  └─ Keychain as primary source      │
│                                      │
│  Keychain Services API               │
│  ├─ kSecClass: kSecClassGenericPassword
│  ├─ kSecAttrService: com.vibecode.secrets
│  ├─ kSecAttrAccessGroup: <team-id>.shared
│  └─ kSecAttrAccessible: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
│                                      │
│  Security Features                   │
│  ├─ Encrypted at rest (FileVault)   │
│  ├─ Access Control Lists (ACLs)     │
│  ├─ Secure Enclave (T2/Apple Silicon)│
│  └─ User presence required           │
│                                      │
└─────────────────────────────────────┘
```

---

## 2. macOS Container Runtime Security - **MISSING**

### Critical Gap: No App Sandbox Profiles

**Current State**: ❌ **NOT IMPLEMENTED**
**Required For**: macOS App Store distribution, MDM deployment, enterprise security

#### Missing: Container Runtime Entitlements
**Required File**: `entitlements/container-runtime.entitlements` (**MISSING**)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <!-- REQUIRED: Virtualization.framework for Apple Container -->
    <key>com.apple.security.virtualization</key>
    <true/>

    <!-- REQUIRED: File system access for container volumes -->
    <key>com.apple.security.files.user-selected.read-write</key>
    <true/>

    <!-- REQUIRED: Network access for container networking -->
    <key>com.apple.security.network.client</key>
    <true/>
    <key>com.apple.security.network.server</key>
    <true/>

    <!-- REQUIRED: IPC for container orchestration -->
    <key>com.apple.security.app-sandbox</key>
    <true/>
    <key>com.apple.security.application-groups</key>
    <array>
        <string>$(TeamIdentifierPrefix)com.vibecode.containers</string>
    </array>

    <!-- DENY: Camera/Microphone access -->
    <!-- Explicitly NOT included - containers should not access these -->

    <!-- DENY: Location services -->
    <!-- Explicitly NOT included -->

    <!-- OPTIONAL: Code signing verification -->
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <false/>
    <key>com.apple.security.cs.disable-library-validation</key>
    <false/>
</dict>
</plist>
```

**Security Benefits**:
- Process isolation from host system
- Restricted file system access (sandbox)
- Network traffic monitoring
- IPC permission control
- Virtualization hardware access control

---

### Critical Gap: No TCC Policies

**Current State**: ❌ **NOT IMPLEMENTED**
**Required For**: Enterprise MDM deployment, user privacy compliance

#### Missing: TCC (Transparency, Consent, Control) Configuration
**Required File**: `config/tcc/vibecode-container-tcc.mobileconfig` (**MISSING**)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>PayloadContent</key>
    <array>
        <dict>
            <key>PayloadType</key>
            <string>com.apple.TCC.configuration-profile-policy</string>
            <key>PayloadVersion</key>
            <integer>1</integer>
            <key>PayloadIdentifier</key>
            <string>com.vibecode.tcc-policy</string>
            <key>PayloadUUID</key>
            <string>GENERATE-UUID-HERE</string>
            <key>PayloadDisplayName</key>
            <string>VibeCode Container TCC Policy</string>

            <key>Services</key>
            <dict>
                <!-- GRANT: Full Disk Access for container runtime -->
                <key>SystemPolicyAllFiles</key>
                <array>
                    <dict>
                        <key>Identifier</key>
                        <string>com.vibecode.container-runtime</string>
                        <key>IdentifierType</key>
                        <string>bundleID</string>
                        <key>CodeRequirement</key>
                        <string>identifier "com.vibecode.container-runtime" and anchor apple generic and certificate 1[field.1.2.840.113635.100.6.2.6] /* exists */ and certificate leaf[field.1.2.840.113635.100.6.1.13] /* exists */ and certificate leaf[subject.OU] = "TEAM_ID_HERE"</string>
                        <key>Allowed</key>
                        <integer>1</integer>
                    </dict>
                </array>

                <!-- DENY: Camera access -->
                <key>Camera</key>
                <array>
                    <dict>
                        <key>Identifier</key>
                        <string>com.vibecode.container-runtime</string>
                        <key>IdentifierType</key>
                        <string>bundleID</string>
                        <key>Allowed</key>
                        <integer>0</integer>
                    </dict>
                </array>

                <!-- DENY: Microphone access -->
                <key>Microphone</key>
                <array>
                    <dict>
                        <key>Identifier</key>
                        <string>com.vibecode.container-runtime</string>
                        <key>IdentifierType</key>
                        <string>bundleID</string>
                        <key>Allowed</key>
                        <integer>0</integer>
                    </dict>
                </array>

                <!-- DENY: Location services -->
                <key>Location</key>
                <array>
                    <dict>
                        <key>Identifier</key>
                        <string>com.vibecode.container-runtime</string>
                        <key>IdentifierType</key>
                        <string>bundleID</string>
                        <key>Allowed</key>
                        <integer>0</integer>
                    </dict>
                </array>

                <!-- DENY: Automation/AppleScript access -->
                <key>AppleEvents</key>
                <array>
                    <dict>
                        <key>Identifier</key>
                        <string>com.vibecode.container-runtime</string>
                        <key>IdentifierType</key>
                        <string>bundleID</string>
                        <key>Allowed</key>
                        <integer>0</integer>
                    </dict>
                </array>
            </dict>
        </dict>
    </array>

    <key>PayloadDisplayName</key>
    <string>VibeCode TCC Policy</string>
    <key>PayloadIdentifier</key>
    <string>com.vibecode.tcc-policy</string>
    <key>PayloadType</key>
    <string>Configuration</string>
    <key>PayloadUUID</key>
    <string>GENERATE-UUID-HERE</string>
    <key>PayloadVersion</key>
    <integer>1</integer>
</dict>
</plist>
```

**Security Benefits**:
- Explicit user privacy controls
- MDM-managed permissions
- Audit trail for access requests
- Prevents privilege escalation
- Compliance with Apple privacy guidelines

---

### Critical Gap: No MDM Integration

**Current State**: ❌ **NOT IMPLEMENTED**
**Required For**: Enterprise fleet deployment (Jamf, Kandji, SimpleMDM)

#### Missing: MDM Configuration Profile
**Required File**: `config/mdm/vibecode-container-mdm.mobileconfig` (**MISSING**)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>PayloadContent</key>
    <array>
        <!-- Security & Privacy Payload -->
        <dict>
            <key>PayloadType</key>
            <string>com.apple.ManagedClient.preferences</string>
            <key>PayloadVersion</key>
            <integer>1</integer>
            <key>PayloadIdentifier</key>
            <string>com.vibecode.security-policy</string>
            <key>PayloadUUID</key>
            <string>GENERATE-UUID-HERE</string>
            <key>PayloadDisplayName</key>
            <string>VibeCode Security Policy</string>

            <key>PayloadContent</key>
            <dict>
                <key>com.vibecode.container-runtime</key>
                <dict>
                    <key>Forced</key>
                    <array>
                        <dict>
                            <key>mcx_preference_settings</key>
                            <dict>
                                <!-- Container Security Settings -->
                                <key>AllowUnsignedContainers</key>
                                <false/>
                                <key>RequireCodeSigning</key>
                                <true/>
                                <key>AllowRootContainers</key>
                                <false/>
                                <key>EnableSecurityMonitoring</key>
                                <true/>

                                <!-- Resource Limits -->
                                <key>MaxContainerMemoryGB</key>
                                <integer>16</integer>
                                <key>MaxContainerCPUCores</key>
                                <integer>8</integer>
                                <key>MaxContainerStorageGB</key>
                                <integer>100</integer>

                                <!-- Network Restrictions -->
                                <key>AllowedNetworks</key>
                                <array>
                                    <string>10.0.0.0/8</string>
                                    <string>172.16.0.0/12</string>
                                    <string>192.168.0.0/16</string>
                                </array>
                                <key>BlockedPorts</key>
                                <array>
                                    <integer>22</integer>  <!-- SSH -->
                                    <integer>3389</integer> <!-- RDP -->
                                </array>

                                <!-- Audit & Logging -->
                                <key>EnableAuditLogging</key>
                                <true/>
                                <key>LogRetentionDays</key>
                                <integer>90</integer>
                                <key>SendLogsToSIEM</key>
                                <true/>
                                <key>SIEMEndpoint</key>
                                <string>https://siem.company.com/api/logs</string>
                            </dict>
                        </dict>
                    </array>
                </dict>
            </dict>
        </dict>

        <!-- FileVault Enforcement -->
        <dict>
            <key>PayloadType</key>
            <string>com.apple.MCX.FileVault2</string>
            <key>PayloadVersion</key>
            <integer>1</integer>
            <key>PayloadIdentifier</key>
            <string>com.vibecode.filevault</string>
            <key>PayloadUUID</key>
            <string>GENERATE-UUID-HERE</string>
            <key>Enable</key>
            <string>On</string>
            <key>Defer</key>
            <false/>
            <key>UseRecoveryKey</key>
            <true/>
        </dict>

        <!-- Firewall Configuration -->
        <dict>
            <key>PayloadType</key>
            <string>com.apple.security.firewall</string>
            <key>PayloadVersion</key>
            <integer>1</integer>
            <key>PayloadIdentifier</key>
            <string>com.vibecode.firewall</string>
            <key>PayloadUUID</key>
            <string>GENERATE-UUID-HERE</string>
            <key>EnableFirewall</key>
            <true/>
            <key>BlockAllIncoming</key>
            <false/>
            <key>EnableStealthMode</key>
            <true/>
        </dict>
    </array>

    <key>PayloadDisplayName</key>
    <string>VibeCode Container Security Policy</string>
    <key>PayloadIdentifier</key>
    <string>com.vibecode.mdm-profile</string>
    <key>PayloadOrganization</key>
    <string>VibeCode</string>
    <key>PayloadType</key>
    <string>Configuration</string>
    <key>PayloadUUID</key>
    <string>GENERATE-UUID-HERE</string>
    <key>PayloadVersion</key>
    <integer>1</integer>
    <key>PayloadRemovalDisallowed</key>
    <true/>
</dict>
</plist>
```

**MDM Deployment Commands**:
```bash
# Jamf Pro
sudo jamf policy -id 12345

# Kandji
kandji install-profile --profile-id abc123

# SimpleMDM
/usr/local/bin/simplemdm-agent install-profile vibecode-container-mdm.mobileconfig
```

---

### Critical Gap: No Code Signing or Notarization

**Current State**: ❌ **NOT IMPLEMENTED**
**Required For**: macOS Gatekeeper approval, App Store distribution

#### Missing: Code Signing Configuration
**Required File**: `scripts/security/codesign-container-runtime.sh` (**MISSING**)

```bash
#!/bin/bash
# Code Sign VibeCode Container Runtime for macOS Distribution

set -euo pipefail

# Configuration
DEVELOPER_ID="Developer ID Application: Your Company (TEAM_ID)"
ENTITLEMENTS_FILE="entitlements/container-runtime.entitlements"
APP_BUNDLE="dist/VibeCode.app"
DMG_FILE="dist/VibeCode-installer.dmg"

# Step 1: Sign app bundle
echo "📝 Signing app bundle..."
codesign --force --deep \
  --options runtime \
  --sign "$DEVELOPER_ID" \
  --entitlements "$ENTITLEMENTS_FILE" \
  --timestamp \
  "$APP_BUNDLE"

# Step 2: Verify signature
echo "🔍 Verifying signature..."
codesign --verify --verbose=4 "$APP_BUNDLE"

# Step 3: Check entitlements
echo "🔐 Checking entitlements..."
codesign --display --entitlements :- "$APP_BUNDLE"

# Step 4: Create DMG installer
echo "📦 Creating DMG installer..."
hdiutil create -volname "VibeCode Installer" \
  -srcfolder "$APP_BUNDLE" \
  -ov -format UDZO \
  "$DMG_FILE"

# Step 5: Sign DMG
echo "📝 Signing DMG..."
codesign --force \
  --sign "$DEVELOPER_ID" \
  --timestamp \
  "$DMG_FILE"

# Step 6: Notarize with Apple
echo "🍎 Submitting for notarization..."
xcrun notarytool submit "$DMG_FILE" \
  --apple-id "developer@vibecode.com" \
  --team-id "$TEAM_ID" \
  --password "@keychain:AC_PASSWORD" \
  --wait

# Step 7: Staple notarization ticket
echo "📎 Stapling notarization..."
xcrun stapler staple "$DMG_FILE"

# Step 8: Verify notarization
echo "✅ Verifying notarization..."
spctl --assess --verbose=4 --type install "$DMG_FILE"

echo "✅ Code signing and notarization complete!"
```

**Security Benefits**:
- Gatekeeper approval (no warnings)
- Malware detection by macOS XProtect
- Verified developer identity
- Tamper-evident distribution
- Enterprise trust via MDM

---

## 3. Keychain Integration for Secrets - **MISSING**

**Current State**: ❌ **NOT IMPLEMENTED**
**Required For**: Secure secret storage on macOS

#### Missing: Keychain Services Integration
**Required File**: `src/lib/security/macos-keychain.ts` (**MISSING**)

```typescript
/**
 * macOS Keychain Integration for Secure Secret Storage
 *
 * Provides secure storage for API keys, database passwords, and OAuth tokens
 * using macOS Keychain Services API with Secure Enclave backing (T2/Apple Silicon).
 */

import { execSync } from 'child_process'
import { createChildLogger } from '@/lib/logger'

const logger = createChildLogger({ module: 'security', scope: 'keychain' })

// Keychain configuration
const KEYCHAIN_SERVICE = 'com.vibecode.secrets'
const KEYCHAIN_ACCESS_GROUP = process.env.TEAM_ID ? `${process.env.TEAM_ID}.com.vibecode.shared` : undefined

interface KeychainOptions {
  service?: string
  account: string
  accessGroup?: string
  accessibility?: 'whenUnlocked' | 'afterFirstUnlock' | 'whenUnlockedThisDeviceOnly'
  requireUserPresence?: boolean
}

/**
 * Store secret in macOS Keychain
 *
 * @param key - Secret identifier (e.g., 'openai-api-key')
 * @param value - Secret value to store
 * @param options - Keychain configuration options
 */
export async function setSecret(
  key: string,
  value: string,
  options: Partial<KeychainOptions> = {}
): Promise<void> {
  const opts: KeychainOptions = {
    service: KEYCHAIN_SERVICE,
    account: key,
    accessGroup: KEYCHAIN_ACCESS_GROUP,
    accessibility: 'whenUnlockedThisDeviceOnly',
    ...options,
  }

  try {
    // Use security command-line tool to interact with Keychain
    // In production, use native Swift/Objective-C bridge for better performance
    const command = [
      'security',
      'add-generic-password',
      '-s', opts.service!,
      '-a', opts.account,
      '-w', value,
      '-U', // Update if exists
      '-T', '', // Allow access by all applications (remove for stricter access)
    ]

    if (opts.accessGroup) {
      command.push('-G', opts.accessGroup)
    }

    execSync(command.join(' '), { encoding: 'utf8' })

    logger.info('Secret stored in Keychain', {
      service: opts.service,
      account: opts.account
    })
  } catch (error) {
    logger.error('Failed to store secret in Keychain', {
      error: error instanceof Error ? error.message : error,
      account: key
    })
    throw new Error(`Keychain storage failed for ${key}`)
  }
}

/**
 * Retrieve secret from macOS Keychain
 *
 * @param key - Secret identifier
 * @param options - Keychain configuration options
 * @returns Secret value or null if not found
 */
export async function getSecret(
  key: string,
  options: Partial<KeychainOptions> = {}
): Promise<string | null> {
  const opts: KeychainOptions = {
    service: KEYCHAIN_SERVICE,
    account: key,
    ...options,
  }

  try {
    const command = [
      'security',
      'find-generic-password',
      '-s', opts.service!,
      '-a', opts.account,
      '-w', // Output password only
    ]

    const result = execSync(command.join(' '), {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'] // Suppress stderr
    })

    logger.debug('Secret retrieved from Keychain', {
      service: opts.service,
      account: opts.account
    })

    return result.trim()
  } catch (error) {
    // Secret not found is not an error, just return null
    if (error instanceof Error && error.message.includes('could not be found')) {
      logger.debug('Secret not found in Keychain', { account: key })
      return null
    }

    logger.error('Failed to retrieve secret from Keychain', {
      error: error instanceof Error ? error.message : error,
      account: key
    })
    throw new Error(`Keychain retrieval failed for ${key}`)
  }
}

/**
 * Delete secret from macOS Keychain
 *
 * @param key - Secret identifier
 * @param options - Keychain configuration options
 */
export async function deleteSecret(
  key: string,
  options: Partial<KeychainOptions> = {}
): Promise<void> {
  const opts: KeychainOptions = {
    service: KEYCHAIN_SERVICE,
    account: key,
    ...options,
  }

  try {
    const command = [
      'security',
      'delete-generic-password',
      '-s', opts.service!,
      '-a', opts.account,
    ]

    execSync(command.join(' '), { encoding: 'utf8' })

    logger.info('Secret deleted from Keychain', {
      service: opts.service,
      account: opts.account
    })
  } catch (error) {
    logger.error('Failed to delete secret from Keychain', {
      error: error instanceof Error ? error.message : error,
      account: key
    })
    throw new Error(`Keychain deletion failed for ${key}`)
  }
}

/**
 * Check if running on macOS with Keychain support
 */
export function isKeychainAvailable(): boolean {
  try {
    execSync('which security', { encoding: 'utf8', stdio: 'ignore' })
    return process.platform === 'darwin'
  } catch {
    return false
  }
}

/**
 * Migrate secrets from environment variables to Keychain
 *
 * Run this during first-time setup on macOS
 */
export async function migrateSecretsToKeychain(): Promise<void> {
  if (!isKeychainAvailable()) {
    logger.warn('Keychain not available, skipping secret migration')
    return
  }

  const secretsToMigrate = [
    'NEXTAUTH_SECRET',
    'DATABASE_URL',
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
    'CLAUDE_API_KEY',
    'DATADOG_API_KEY',
    'GITHUB_SECRET',
    'GOOGLE_CLIENT_SECRET',
  ]

  let migratedCount = 0

  for (const secretKey of secretsToMigrate) {
    const envValue = process.env[secretKey]
    if (envValue) {
      try {
        await setSecret(secretKey, envValue, {
          accessibility: 'whenUnlockedThisDeviceOnly',
        })
        migratedCount++
        logger.info(`Migrated ${secretKey} to Keychain`)
      } catch (error) {
        logger.error(`Failed to migrate ${secretKey}`, { error })
      }
    }
  }

  logger.info(`Migrated ${migratedCount} secrets to Keychain`)
}

/**
 * Load secret from Keychain with fallback to environment variable
 *
 * @param key - Secret identifier
 * @returns Secret value or undefined
 */
export async function loadSecret(key: string): Promise<string | undefined> {
  // Try Keychain first (if on macOS)
  if (isKeychainAvailable()) {
    try {
      const keychainValue = await getSecret(key)
      if (keychainValue) {
        logger.debug(`Loaded ${key} from Keychain`)
        return keychainValue
      }
    } catch (error) {
      logger.warn(`Failed to load ${key} from Keychain, falling back to env`, { error })
    }
  }

  // Fallback to environment variable
  const envValue = process.env[key]
  if (envValue) {
    logger.debug(`Loaded ${key} from environment variable`)
  }

  return envValue
}
```

**Usage Example**:
```typescript
// src/lib/auth.ts (modified)
import { loadSecret } from '@/lib/security/macos-keychain'

// Replace direct process.env access:
// const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET

// With Keychain-aware loading:
const NEXTAUTH_SECRET = await loadSecret('NEXTAUTH_SECRET')
```

**Security Benefits**:
- Encrypted storage with FileVault
- Secure Enclave backing (T2/Apple Silicon)
- Access Control Lists (ACLs)
- User presence requirement options
- Audit trail via unified logging
- Integration with MDM policies

---

## 4. Container Isolation & VM Security

### Current State: **PARTIAL**

#### Docker Security: **MODERATE**
**File**: `docker/code-server/Dockerfile`

**Good Practices**:
- ✅ Non-root user (`USER coder`)
- ✅ Supply chain verification (cosign for kubectl/helm)
- ✅ Checksum validation for downloads
- ✅ Specific base image versions (not `latest`)

**Security Gaps**:
- ⚠️  Some operations run as `root` before switching to `coder`
- ⚠️  `chmod 755` on binaries (should be `750` for executables)
- ⚠️  No AppArmor/SELinux profiles
- ⚠️  No seccomp profiles
- ⚠️  Health check uses `curl` (dependency)

**Recommended Hardening**:
```dockerfile
# Dockerfile.secure (snippet)

# Use minimal base image
FROM codercom/code-server:4.104.2-alpine

# Run as non-root throughout
USER root
RUN addgroup -g 1001 -S coder && \
    adduser -S coder -u 1001 -G coder

# Install with minimal permissions
RUN install -m 750 -o coder -g coder /tmp/lazygit /usr/local/bin/lazygit

# Add security profiles
COPY --chown=root:root seccomp-profile.json /etc/seccomp-profile.json
COPY --chown=root:root apparmor-profile /etc/apparmor.d/vibecode-container

# Switch to non-root user
USER coder

# Read-only root filesystem where possible
# (Next.js needs write to /tmp and /app/.next/cache)

# Health check without external dependencies
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD ps aux | grep -q code-server || exit 1
```

---

#### Apple Container (Virtualization.framework): **MISSING**
**File**: `src/lib/services/workspace-provisioning-apple-container.ts`

**Security Gaps**:
- ❌ No VM isolation policies
- ❌ No memory encryption
- ❌ No network segmentation
- ❌ No resource quotas
- ❌ Passwords generated with weak `Math.random()` (not cryptographically secure)

**Recommended Implementation**:
```typescript
// src/lib/services/workspace-provisioning-apple-container.ts (snippet)

import { randomBytes } from 'crypto'

// Replace weak password generation
private generatePassword(): string {
  // INSECURE:
  // return Math.random().toString(36).substring(2, 15)

  // SECURE:
  return randomBytes(32).toString('base64url').substring(0, 32)
}

// Add VM isolation configuration
interface VMSecurityConfig {
  enableMemoryEncryption: boolean
  maxMemoryGB: number
  maxCPUCores: number
  networkIsolation: 'none' | 'private' | 'isolated'
  allowedNetworks: string[]
  resourceQuota: {
    diskGB: number
    networkMbps: number
  }
}

const VM_SECURITY_CONFIG: VMSecurityConfig = {
  enableMemoryEncryption: true,
  maxMemoryGB: 8,
  maxCPUCores: 4,
  networkIsolation: 'private',
  allowedNetworks: ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'],
  resourceQuota: {
    diskGB: 50,
    networkMbps: 100,
  },
}
```

---

## 5. Audit & Monitoring

### Current State: **BASIC**

#### Good: Datadog Integration Exists
**Files**: `src/lib/monitoring/*.ts`, `k8s/skywalking/*.yaml`

**Implemented**:
- ✅ Datadog APM tracing
- ✅ RUM (Real User Monitoring)
- ✅ Database monitoring
- ✅ Kubernetes metrics

**Missing for macOS Security**:
- ❌ No macOS unified logging (os_log) integration
- ❌ No BSM (Basic Security Module) audit events
- ❌ No TCC access audit logging
- ❌ No container escape detection
- ❌ No anomaly detection for privilege escalation

**Recommended: macOS Security Monitoring**
```typescript
// src/lib/monitoring/macos-security-events.ts (NEW FILE)

import { execSync } from 'child_process'
import { createChildLogger } from '@/lib/logger'

const logger = createChildLogger({ module: 'security', scope: 'audit' })

/**
 * Monitor macOS unified logging for security events
 */
export async function startSecurityMonitoring() {
  if (process.platform !== 'darwin') {
    logger.warn('macOS security monitoring not available on this platform')
    return
  }

  // Monitor unified logging for security-relevant events
  const securityPredicates = [
    'eventType == activityCreateEvent',
    'subsystem == "com.apple.TCC"',
    'subsystem == "com.apple.securityd"',
    'category == "authorization"',
    'category == "container"',
  ].join(' OR ')

  const logCommand = `log stream --predicate '${securityPredicates}' --style json`

  logger.info('Starting macOS security event monitoring')

  // In production, use persistent background process
  // For now, log to console
  try {
    execSync(logCommand, {
      encoding: 'utf8',
      stdio: 'pipe',
    })
  } catch (error) {
    logger.error('Security monitoring failed', { error })
  }
}

/**
 * Send security event to Datadog
 */
export function reportSecurityEvent(event: {
  type: 'tcc_access' | 'container_start' | 'privilege_escalation' | 'keychain_access'
  severity: 'info' | 'warning' | 'critical'
  message: string
  metadata?: Record<string, any>
}) {
  logger.info('Security event detected', event)

  // Send to Datadog via API
  // (Implementation depends on Datadog integration)
}
```

---

## 6. Incident Response & Compliance

### Current State: **DOCUMENTED BUT NOT AUTOMATED**

**File**: `docs/deployment/SECURITY_HARDENING.md`

**Good**: Incident response playbook exists
**Gap**: No automated incident response scripts

**Recommended Automation**:
```bash
#!/bin/bash
# scripts/security/incident-response.sh

# Automated Security Incident Response for macOS Container Runtime

set -euo pipefail

INCIDENT_TYPE="${1:-unknown}"
SEVERITY="${2:-medium}"

case "$INCIDENT_TYPE" in
  "container-escape")
    echo "🚨 Container escape detected!"
    # Kill all containers
    docker kill $(docker ps -q) || true
    # Revoke container runtime TCC permissions
    sudo tccutil reset All com.vibecode.container-runtime
    # Alert security team
    curl -X POST "$SECURITY_WEBHOOK" -d '{"type":"container-escape","severity":"critical"}'
    ;;

  "compromised-credentials")
    echo "🚨 Compromised credentials detected!"
    # Rotate all secrets in Keychain
    /usr/local/bin/rotate-all-secrets.sh
    # Force logout all users
    sudo pkill -9 -u "$CURRENT_USER"
    ;;

  "privilege-escalation")
    echo "🚨 Privilege escalation detected!"
    # Kill offending process
    sudo kill -9 "$OFFENDING_PID"
    # Revoke admin privileges
    sudo dseditgroup -o delete -u "$OFFENDING_USER" admin
    ;;

  *)
    echo "⚠️  Unknown incident type: $INCIDENT_TYPE"
    ;;
esac

# Log to unified logging
log -l "com.vibecode.security" -t "$INCIDENT_TYPE" "Security incident detected: $SEVERITY"
```

---

## 7. Priority Remediation Roadmap

### Phase 1: Critical Security Fixes (Week 1-2)

**Priority**: **CRITICAL**
**Effort**: 40 hours

1. **Migrate Hardcoded Credentials to Database** (Issue #438)
   - [ ] Create PostgreSQL users table schema
   - [ ] Migrate legacy credentials to database with bcrypt hashes
   - [ ] Remove hardcoded credentials from source code
   - [ ] Implement database-backed authentication
   - **ETA**: 16 hours

2. **Implement Keychain Integration for Secrets**
   - [ ] Create `src/lib/security/macos-keychain.ts`
   - [ ] Implement `setSecret()`, `getSecret()`, `deleteSecret()`
   - [ ] Add migration script for env vars → Keychain
   - [ ] Update auth.ts to use Keychain-aware loading
   - **ETA**: 12 hours

3. **Fix Weak Password Generation**
   - [ ] Replace `Math.random()` with `crypto.randomBytes()`
   - [ ] Update workspace provisioning service
   - **ETA**: 2 hours

4. **Add Rate Limiting to Auth Endpoints**
   - [ ] Implement Redis-backed rate limiter
   - [ ] Add to `/api/auth/*` routes
   - [ ] Configure lockout after 5 failed attempts
   - **ETA**: 8 hours

---

### Phase 2: macOS Security Foundation (Week 3-4)

**Priority**: **HIGH**
**Effort**: 60 hours

1. **Create App Sandbox Entitlements**
   - [ ] Create `entitlements/container-runtime.entitlements`
   - [ ] Configure Virtualization.framework permissions
   - [ ] Define file system access boundaries
   - [ ] Test with sandboxed build
   - **ETA**: 12 hours

2. **Create TCC Configuration Profile**
   - [ ] Create `config/tcc/vibecode-container-tcc.mobileconfig`
   - [ ] Define Full Disk Access policy
   - [ ] Deny camera/microphone/location access
   - [ ] Test TCC policy deployment
   - **ETA**: 16 hours

3. **Implement Code Signing & Notarization**
   - [ ] Create `scripts/security/codesign-container-runtime.sh`
   - [ ] Obtain Apple Developer ID certificate
   - [ ] Configure Xcode build for code signing
   - [ ] Submit for notarization
   - [ ] Test Gatekeeper approval
   - **ETA**: 20 hours

4. **Create MDM Configuration Profile**
   - [ ] Create `config/mdm/vibecode-container-mdm.mobileconfig`
   - [ ] Define security policies (resource limits, network restrictions)
   - [ ] Add FileVault enforcement
   - [ ] Add firewall configuration
   - [ ] Test with Jamf Pro / Kandji
   - **ETA**: 12 hours

---

### Phase 3: Container Isolation & Monitoring (Week 5-6)

**Priority**: **MEDIUM**
**Effort**: 40 hours

1. **Harden Docker Containers**
   - [ ] Add AppArmor/SELinux profiles
   - [ ] Add seccomp profiles
   - [ ] Implement read-only root filesystem where possible
   - [ ] Reduce binary permissions (750 instead of 755)
   - **ETA**: 16 hours

2. **Implement macOS Security Monitoring**
   - [ ] Create `src/lib/monitoring/macos-security-events.ts`
   - [ ] Integrate with macOS unified logging (os_log)
   - [ ] Monitor TCC access events
   - [ ] Send security events to Datadog
   - **ETA**: 12 hours

3. **Add VM Isolation Policies**
   - [ ] Configure Virtualization.framework resource limits
   - [ ] Implement network segmentation
   - [ ] Add memory encryption
   - [ ] Define resource quotas
   - **ETA**: 12 hours

---

### Phase 4: Compliance & Audit (Week 7-8)

**Priority**: **MEDIUM**
**Effort**: 32 hours

1. **CIS macOS Benchmark Compliance**
   - [ ] Run CIS-CAT assessment tool
   - [ ] Remediate identified gaps
   - [ ] Document compliance status
   - **ETA**: 16 hours

2. **Automated Incident Response**
   - [ ] Create `scripts/security/incident-response.sh`
   - [ ] Implement container escape detection
   - [ ] Implement privilege escalation detection
   - [ ] Test incident response procedures
   - **ETA**: 12 hours

3. **Security Documentation**
   - [ ] Create deployment security guide
   - [ ] Document MDM deployment procedures
   - [ ] Create security runbooks
   - **ETA**: 4 hours

---

## 8. Critical Dependencies & Blockers

### External Dependencies
- **Apple Developer Account** (required for code signing)
  - Developer ID Application certificate
  - Team ID for App Sandbox
  - Notarization API credentials

- **MDM Provider** (required for enterprise deployment)
  - Jamf Pro / Kandji / SimpleMDM subscription
  - MDM server configuration access
  - Device enrollment testing environment

- **Certificate Authority** (for TLS/SSL)
  - Code signing certificates
  - Server certificates for container communication

### Technical Blockers
- **Database Migration** (Issue #438)
  - Blocks credential hardening
  - Requires schema changes
  - Needs user migration plan

- **Virtualization.framework Maturity**
  - macOS 13+ required for full feature set
  - Limited documentation
  - May need fallback to Docker Desktop

---

## 9. Testing & Validation Plan

### Security Testing Checklist

**Authentication & Authorization**:
- [ ] Test brute force protection (rate limiting)
- [ ] Test account lockout after failed attempts
- [ ] Test session expiration (24 hours)
- [ ] Test JWT rotation (1 hour)
- [ ] Test MFA flows (when implemented)

**Secrets Management**:
- [ ] Test Keychain storage/retrieval
- [ ] Test Keychain migration from env vars
- [ ] Test Keychain access with Secure Enclave
- [ ] Test secret rotation

**Container Security**:
- [ ] Test container escape attempts
- [ ] Test privilege escalation attempts
- [ ] Test network isolation
- [ ] Test resource limits
- [ ] Test file system isolation

**macOS Security**:
- [ ] Test App Sandbox restrictions
- [ ] Test TCC policy enforcement
- [ ] Test code signature verification
- [ ] Test Gatekeeper approval
- [ ] Test MDM profile deployment

**Monitoring & Audit**:
- [ ] Test security event logging
- [ ] Test Datadog integration
- [ ] Test unified logging (os_log)
- [ ] Test incident response automation

---

## 10. Recommendations Summary

### Immediate Actions (This Week)
1. ✅ **Acknowledged**: Hardcoded credentials are already bcrypt-hashed (Issue #445 complete)
2. ❌ **Start database migration** (Issue #438) - blocks other improvements
3. ❌ **Implement Keychain integration** for secrets
4. ❌ **Add rate limiting** to authentication endpoints
5. ❌ **Fix weak password generation** in workspace provisioning

### Short Term (Next 2-4 Weeks)
1. ❌ Create App Sandbox entitlements
2. ❌ Create TCC configuration profile
3. ❌ Implement code signing and notarization
4. ❌ Create MDM configuration profile
5. ❌ Harden Docker containers

### Medium Term (1-2 Months)
1. ❌ Implement macOS security monitoring
2. ❌ Add VM isolation policies
3. ❌ Achieve CIS macOS Benchmark compliance
4. ❌ Implement automated incident response

### Long Term (3+ Months)
1. ❌ Implement MFA (multi-factor authentication)
2. ❌ Add hardware security module (HSM) integration
3. ❌ Achieve SOC 2 Type II compliance
4. ❌ Implement zero-trust network architecture

---

## Conclusion

The VibeCode WebGUI project has **significant security gaps** for macOS container runtime deployment. While basic authentication exists and supply chain verification is partially implemented, **critical macOS-specific security controls are completely missing**.

**Risk Assessment**: **8.5/10 (Critical)**

**Primary Risks**:
1. No App Sandbox → Unrestricted system access
2. No TCC policies → Privacy compliance violations
3. No Keychain integration → Secrets exposed in env files
4. No code signing → Gatekeeper warnings, MDM rejection
5. Hardcoded credentials → Authentication bypass potential (mitigated with bcrypt, database migration pending)

**Recommended Path Forward**:
1. **Immediate**: Complete Issue #438 (database-backed authentication)
2. **Week 1-2**: Implement Keychain integration + rate limiting
3. **Week 3-4**: Create App Sandbox, TCC, and MDM profiles
4. **Week 5-8**: Harden containers, implement monitoring, achieve compliance

**Estimated Total Effort**: **172 hours** (~4.3 weeks for 1 engineer)

---

## Appendices

### Appendix A: macOS Security Resources
- [Apple Platform Security Guide](https://support.apple.com/guide/security/)
- [App Sandbox Design Guide](https://developer.apple.com/library/archive/documentation/Security/Conceptual/AppSandboxDesignGuide/)
- [TCC Configuration Profile Reference](https://developer.apple.com/documentation/devicemanagement/privacypreferencespolicycontrol)
- [Code Signing Guide](https://developer.apple.com/library/archive/documentation/Security/Conceptual/CodeSigningGuide/)
- [Notarization Documentation](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- [CIS macOS Benchmark](https://www.cisecurity.org/benchmark/apple_os)

### Appendix B: Security Contacts
- **Primary**: Agent 24 (Staff Security Engineer)
- **Escalation**: Maya (Security Lead) - see Issue #416
- **On-call**: Security team rotation

### Appendix C: Compliance Frameworks
- **CIS macOS Benchmark** (target)
- **NIST 800-53** (federal requirements)
- **SOC 2 Type II** (customer trust)
- **ISO 27001** (international standard)

---

**Report Generated**: 2025-10-02
**Agent**: Agent 24 (Staff Security Engineer)
**Next Review**: 2025-10-09 (weekly cadence during remediation)
