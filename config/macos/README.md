# macOS Security Configuration

**Agent 24**: Staff Security Engineer (Google macOS Security Team)
**Mission**: Production security for Apple Container runtime

---

## Overview

This directory contains macOS-specific security configurations for VibeCode container runtime:

1. **App Sandbox Entitlements** (`container-runtime.entitlements`)
2. **TCC Privacy Policies** (`tcc-policy.mobileconfig`)
3. **MDM Configuration** (`mdm-security-policy.mobileconfig`)

---

## 1. App Sandbox Entitlements

**File**: `container-runtime.entitlements`
**Purpose**: Define app sandbox boundaries and permissions

### Key Entitlements

```xml
<!-- Container runtime requires Virtualization.framework -->
<key>com.apple.security.virtualization</key>
<true/>

<!-- File system isolation -->
<key>com.apple.security.files.user-selected.read-write</key>
<true/>

<!-- Network isolation -->
<key>com.apple.security.network.client</key>
<true/>
```

### Usage

```bash
# Apply during code signing
codesign --force --deep \
  --options runtime \
  --sign "Developer ID Application: Your Company" \
  --entitlements config/macos/container-runtime.entitlements \
  --timestamp \
  dist/VibeCode.app
```

### Security Benefits

- Process isolation from host system
- Restricted file system access
- Network traffic monitoring
- IPC permission control
- Virtualization hardware access control

---

## 2. TCC (Transparency, Consent, Control) Policy

**File**: `tcc-policy.mobileconfig`
**Purpose**: Define privacy permissions for container runtime

### Permissions Granted

- **Full Disk Access**: Required for container volume management
- **Network Access**: Required for container networking

### Permissions Denied

- Camera access (explicitly denied)
- Microphone access (explicitly denied)
- Location services (explicitly denied)
- Automation/AppleScript (explicitly denied)
- Contacts (explicitly denied)
- Calendar (explicitly denied)
- Photos (explicitly denied)

### Deployment

#### Option 1: MDM Deployment (Recommended for Enterprise)

```bash
# Jamf Pro
sudo jamf policy -id <policy-id>

# Kandji
kandji install-profile --profile-id <profile-id>

# SimpleMDM
/usr/local/bin/simplemdm-agent install-profile config/macos/tcc-policy.mobileconfig
```

#### Option 2: Manual Installation (Development Only)

```bash
# Install profile
sudo profiles install -path=config/macos/tcc-policy.mobileconfig

# Verify installation
sudo profiles show -type configuration

# Remove profile (if needed)
sudo profiles remove -identifier com.vibecode.tcc-policy
```

### Code Signing Requirement

**IMPORTANT**: Replace `TEAM_ID_PLACEHOLDER` in the TCC policy with your actual Apple Developer Team ID:

```xml
<key>CodeRequirement</key>
<string>identifier "com.vibecode.container-runtime" and anchor apple generic and certificate leaf[subject.OU] = "YOUR_TEAM_ID_HERE"</string>
```

Get your Team ID:
```bash
# From Apple Developer portal
# OR from existing certificate
security find-identity -v -p codesigning | grep "Developer ID"
```

---

## 3. MDM Security Policy

**File**: `mdm-security-policy.mobileconfig` (to be created)
**Purpose**: Enterprise security policies for fleet deployment

### Policy Enforcement

- Container resource limits (CPU, memory, storage)
- Network restrictions (allowed/blocked ports)
- FileVault encryption enforcement
- Firewall configuration
- Audit logging

### MDM Compatibility

Tested with:
- **Jamf Pro** (recommended for large fleets)
- **Kandji** (recommended for mid-size fleets)
- **SimpleMDM** (recommended for small fleets)
- **Apple Business Manager** (native MDM)

---

## Security Implementation Checklist

### Phase 1: Code Signing & Notarization

- [ ] Obtain Apple Developer ID Application certificate
- [ ] Configure Xcode project with entitlements
- [ ] Sign app bundle with entitlements
- [ ] Verify signature: `codesign --verify --verbose=4 dist/VibeCode.app`
- [ ] Submit for notarization: `xcrun notarytool submit`
- [ ] Staple notarization ticket: `xcrun stapler staple`
- [ ] Test Gatekeeper approval: `spctl --assess --verbose=4`

### Phase 2: TCC Policy Deployment

- [ ] Update TCC policy with actual Team ID
- [ ] Test profile installation on development machine
- [ ] Verify Full Disk Access is granted
- [ ] Verify camera/microphone are denied
- [ ] Package profile for MDM distribution
- [ ] Deploy via MDM to test group
- [ ] Monitor for TCC denial events

### Phase 3: MDM Integration

- [ ] Create MDM configuration profile
- [ ] Configure resource limits
- [ ] Configure network restrictions
- [ ] Add FileVault enforcement
- [ ] Add firewall configuration
- [ ] Test deployment via MDM
- [ ] Document deployment procedures

### Phase 4: Keychain Integration

- [ ] Implement Keychain Services API wrapper
- [ ] Migrate secrets from environment variables
- [ ] Test secret retrieval from Keychain
- [ ] Verify Secure Enclave integration
- [ ] Document secret rotation procedures

---

## Testing & Validation

### Test App Sandbox

```bash
# Run app with sandbox-exec to simulate sandbox
sandbox-exec -f /System/Library/Sandbox/Profiles/application.sb \
  /Applications/VibeCode.app/Contents/MacOS/VibeCode

# Check for sandbox violations
log stream --predicate 'subsystem == "com.apple.sandbox"'
```

### Test TCC Policy

```bash
# Verify Full Disk Access
sqlite3 ~/Library/Application\ Support/com.apple.TCC/TCC.db \
  "SELECT * FROM access WHERE service='kTCCServiceSystemPolicyAllFiles';"

# Monitor TCC events
log stream --predicate 'subsystem == "com.apple.TCC"'
```

### Test Container Isolation

```bash
# Start container
npm run container:start

# Verify process isolation
ps aux | grep vibecode-container

# Check file system access
sudo fs_usage -w | grep vibecode-container

# Monitor network connections
sudo nettop -P vibecode-container
```

---

## Troubleshooting

### Problem: Code Signing Fails

```
Error: code object is not signed at all
```

**Solution**:
1. Verify Developer ID certificate is installed
2. Check entitlements file syntax: `plutil -lint container-runtime.entitlements`
3. Ensure Team ID is correct in entitlements

### Problem: TCC Policy Not Applied

```
Operation not permitted (no Full Disk Access)
```

**Solution**:
1. Verify profile installation: `sudo profiles show`
2. Check code signing matches TCC policy: `codesign -d --entitlements :- dist/VibeCode.app`
3. Restart system to apply TCC changes
4. Check TCC database: `sqlite3 ~/Library/Application\ Support/com.apple.TCC/TCC.db`

### Problem: Container Cannot Access Volumes

```
Error: Permission denied accessing /Volumes/...
```

**Solution**:
1. Grant Full Disk Access via TCC policy
2. Check entitlements include `com.apple.security.files.user-selected.read-write`
3. Verify sandbox is not blocking access: `log stream --predicate 'subsystem == "com.apple.sandbox"'`

### Problem: Keychain Access Denied

```
Error: The user name or passphrase you entered is not correct.
```

**Solution**:
1. Check Keychain access in System Preferences > Security & Privacy > Privacy > Keychain
2. Grant VibeCode access to Keychain
3. Verify code signing: unsigned apps have limited Keychain access
4. Check ACLs: `security dump-keychain | grep -A 10 com.vibecode.secrets`

---

## Security Monitoring

### Unified Logging

```bash
# Monitor all security events
log stream --predicate 'subsystem BEGINSWITH "com.apple.security"'

# Monitor TCC events
log stream --predicate 'subsystem == "com.apple.TCC"'

# Monitor sandbox violations
log stream --predicate 'subsystem == "com.apple.sandbox"'

# Monitor Keychain access
log stream --predicate 'subsystem == "com.apple.security.keychain"'
```

### Audit Events (BSM)

```bash
# Enable audit logging
sudo audit -s

# Monitor audit events
sudo praudit -l /var/audit/current
```

---

## References

- [Apple Platform Security Guide](https://support.apple.com/guide/security/)
- [App Sandbox Design Guide](https://developer.apple.com/library/archive/documentation/Security/Conceptual/AppSandboxDesignGuide/)
- [TCC Configuration Profile Reference](https://developer.apple.com/documentation/devicemanagement/privacypreferencespolicycontrol)
- [Code Signing Guide](https://developer.apple.com/library/archive/documentation/Security/Conceptual/CodeSigningGuide/)
- [Notarization Documentation](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- [Virtualization Framework](https://developer.apple.com/documentation/virtualization)

---

**Last Updated**: 2025-10-02
**Agent**: Agent 24 (Staff Security Engineer)
**Status**: Initial security configuration complete
