# VibeCode MDM Deployment Playbook

**Version**: 1.0.0
**Date**: 2025-10-02
**Audience**: IT Administrators, MDM Administrators, DevOps Engineers
**Status**: Production Ready

---

## Executive Summary

This playbook provides step-by-step deployment procedures for VibeCode across major MDM platforms:
- **Jamf Pro** (10.45.0+)
- **Microsoft Intune** (macOS management enabled)
- **Kandji** (1.5+)
- **Mosyle** (4.0+)

**Time to Deploy**: 2-4 hours (including testing)
**Minimum Pilot Size**: 10 users
**Recommended Pilot Duration**: 2 weeks

---

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Jamf Pro Deployment](#jamf-pro-deployment)
3. [Microsoft Intune Deployment](#microsoft-intune-deployment)
4. [Kandji Deployment](#kandji-deployment)
5. [Mosyle Deployment](#mosyle-deployment)
6. [Validation & Testing](#validation--testing)
7. [Troubleshooting](#troubleshooting)
8. [Rollback Procedures](#rollback-procedures)

---

## Pre-Deployment Checklist

### Infrastructure Requirements

- [ ] MDM platform operational and syncing with Apple Business Manager
- [ ] At least 10 test devices enrolled (pilot group)
- [ ] Active Directory / Azure AD integration configured (if using SSO)
- [ ] Network firewall rules allow:
  - `*.vibecode.com` (application endpoints)
  - `*.docker.com` (Docker Desktop downloads)
  - `*.datadog.com` (telemetry, optional)
- [ ] Internal PostgreSQL database provisioned (if not using cloud)
- [ ] DNS records configured:
  - `vibecode.company.com` → Application load balancer
  - `vibecode-db.company.com` → Database endpoint
- [ ] TLS certificates obtained and deployed

### Software Artifacts

- [ ] `VibeCode-1.0.0.pkg` downloaded from vendor
- [ ] Package signature verified:
  ```bash
  pkgutil --check-signature VibeCode-1.0.0.pkg
  # Should show: signed by Developer ID Installer: VibeCode Inc (TEAM_ID)
  ```
- [ ] Configuration profiles prepared (see examples below)
- [ ] License key obtained from VibeCode sales

### Team Readiness

- [ ] IT admin trained on VibeCode administration
- [ ] Help desk briefed on common issues
- [ ] Pilot users identified and notified
- [ ] Communication plan prepared (email templates, Slack announcements)
- [ ] Escalation contacts established:
  - L1 Support: Internal help desk
  - L2 Support: IT admin
  - L3 Support: VibeCode enterprise support (enterprise@vibecode.com)

---

## Jamf Pro Deployment

### Step 1: Upload Package

1. **Navigate to Settings → Computer Management → Packages**

2. **Click "New"**

3. **Upload Package**:
   - Display Name: `VibeCode Enterprise`
   - Filename: `VibeCode-1.0.0.pkg`
   - Category: `Developer Tools`
   - Priority: `10` (default)
   - Fill user template: ☐ (unchecked)
   - Fill existing user home directories: ☐ (unchecked)
   - Boot volume required: ☑ (checked)

4. **Click "Save"**

5. **Verify Upload**:
   - Go to "Packages" list
   - Find "VibeCode Enterprise"
   - Click "Edit" → "View Details"
   - Confirm size: ~295MB

---

### Step 2: Create Configuration Profiles

#### Profile 1: Base Configuration

1. **Navigate to Computers → Configuration Profiles**

2. **Click "New"**

3. **General**:
   - Name: `VibeCode - Base Configuration`
   - Category: `Developer Tools`
   - Level: `Computer Level`
   - Distribution Method: `Install Automatically`

4. **Add Payload: Custom Settings**:
   - Preference Domain: `com.vibecode.app`
   - Upload or paste XML:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>APIEndpoint</key>
    <string>https://vibecode.company.com</string>

    <key>DatabaseURL</key>
    <string>postgresql://vibecode-prod.company.com:5432/vibecode</string>

    <key>AuthProvider</key>
    <string>saml</string>

    <key>SAMLSSOURL</key>
    <string>https://sso.company.com/saml</string>

    <key>SAMLEntityID</key>
    <string>urn:company:vibecode</string>

    <key>EnableAICompletion</key>
    <true/>

    <key>EnableCodebaseChat</key>
    <true/>

    <key>EnableCollaboration</key>
    <true/>

    <key>DatadogEnabled</key>
    <true/>

    <key>DatadogSite</key>
    <string>datadoghq.com</string>

    <key>DatadogService</key>
    <string>vibecode-enterprise</string>

    <key>AutoUpdateEnabled</key>
    <true/>

    <key>UpdateChannel</key>
    <string>stable</string>

    <key>LicenseKey</key>
    <string>VIBECODE-ENTERPRISE-XXXX-YYYY-ZZZZ</string>

    <key>OrganizationID</key>
    <string>YOUR_ORG_ID</string>
</dict>
</plist>
```

5. **Scope**:
   - Targets: `All Computers` (or specific smart group)
   - Exclusions: None

6. **Click "Save"**

---

#### Profile 2: Privacy Permissions (TCC)

1. **Create New Profile**: `VibeCode - Privacy Permissions`

2. **Add Payload: Privacy Preferences Policy Control**

3. **Configure Services**:

   **Full Disk Access**:
   - Identifier: `com.vibecode.app`
   - Identifier Type: `Bundle ID`
   - Code Requirement: (Auto-detect or use:)
     ```
     identifier "com.vibecode.app" and anchor apple generic
     ```
   - Access: `Allow`

   **Accessibility**:
   - Identifier: `com.vibecode.app`
   - Identifier Type: `Bundle ID`
   - Access: `Allow`

4. **Save and Deploy**

---

### Step 3: Create Smart Group

1. **Navigate to Computers → Smart Computer Groups**

2. **Click "New"**

3. **General**:
   - Name: `VibeCode - Pilot Users`
   - Display Name: `VibeCode Pilot`

4. **Criteria**:
   - Add criterion: `Department` | `is` | `Engineering`
   - Add criterion: `Operating System Version` | `greater than or equal` | `13.0`
   - Add criterion: `Computer Name` | `does not contain` | `test`
   - Add criterion: `Last Check-in` | `less than x days ago` | `1`

5. **Click "Save"**

---

### Step 4: Create Installation Policy

1. **Navigate to Computers → Policies**

2. **Click "New"**

3. **General**:
   - Display Name: `Install VibeCode Enterprise`
   - Enabled: ☑
   - Trigger: `Enrollment Complete`, `Recurring Check-In`
   - Execution Frequency: `Once per computer`
   - Category: `Developer Tools`

4. **Packages**:
   - Click "Configure"
   - Add: `VibeCode Enterprise`
   - Action: `Install`

5. **Scripts** (optional - for logging):
   - Click "Configure"
   - Add script:

```bash
#!/bin/bash
# Post-installation verification
if [[ -d "/Applications/VibeCode.app" ]]; then
    echo "VibeCode installed successfully"
    jamf recon
    exit 0
else
    echo "ERROR: VibeCode installation failed"
    exit 1
fi
```

6. **Scope**:
   - Targets: `VibeCode - Pilot Users` (smart group)
   - Exclusions: None

7. **Self Service** (optional):
   - Make available in Self Service: ☑
   - Button Name: `Install VibeCode`
   - Description:
     ```
     VibeCode is an AI-powered development platform with Monaco editor,
     code-server workspaces, and enterprise integrations.

     Requirements:
     - macOS 13.0+
     - 1GB available disk space
     - Docker Desktop (optional)
     ```
   - Icon: Upload VibeCode logo (512x512 PNG)

8. **Click "Save"**

---

### Step 5: Deploy to Pilot

1. **Verify Smart Group Membership**:
   - Go to Smart Group `VibeCode - Pilot Users`
   - Confirm 10+ computers listed
   - If empty, adjust criteria

2. **Trigger Policy Manually** (for testing):
   - Select 1 pilot computer
   - Go to Management → Commands
   - Run: `Update Inventory`
   - Then: `Run Policies`

3. **Monitor Installation**:
   - Go to Policy → Logs
   - Filter: `Install VibeCode Enterprise`
   - Check status: `Completed` vs. `Failed`

4. **Verify on Device**:
   ```bash
   # SSH or screen sharing to pilot Mac
   ls -la /Applications/VibeCode.app
   /Applications/VibeCode.app/Contents/MacOS/VibeCode-launcher --version
   ```

---

### Step 6: Create Update Policy

1. **Create New Policy**: `Update VibeCode`

2. **General**:
   - Trigger: `Recurring Check-In` (every 24 hours)
   - Execution Frequency: `Ongoing`

3. **Packages**:
   - Add: `VibeCode-1.0.1.pkg` (when available)
   - Action: `Install` (will upgrade existing)

4. **Scope**:
   - Targets: `All Computers with VibeCode Installed` (create smart group)

5. **Maintenance**:
   - Update Inventory: ☑

---

## Microsoft Intune Deployment

### Step 1: Create macOS App Package

**On macOS workstation**:

```bash
# Download IntuneAppUtil
curl -L -o IntuneAppUtil \
  https://github.com/msintuneappsdk/intune-app-wrapping-tool-mac/releases/download/v1.2/IntuneAppUtil

chmod +x IntuneAppUtil

# Convert .pkg to .intunemac
./IntuneAppUtil \
  -c VibeCode-1.0.0.pkg \
  -o VibeCode.intunemac \
  -n "VibeCode Enterprise" \
  -v "1.0.0" \
  -i "com.vibecode.app"
```

---

### Step 2: Upload to Intune

1. **Sign in to Microsoft Endpoint Manager Admin Center**:
   - https://endpoint.microsoft.com

2. **Navigate to Apps → macOS → Add**

3. **Select App Type**:
   - Choose: `macOS app (PKG)`
   - Click "Select"

4. **App Information**:
   - Name: `VibeCode Enterprise`
   - Description:
     ```
     AI-powered development platform with Monaco editor and code-server workspaces.
     Requires macOS 13.0+ and Docker Desktop (optional).
     ```
   - Publisher: `VibeCode Inc.`
   - Category: `Developer tools`
   - Show as featured: ☑
   - Information URL: `https://vibecode.com`
   - Privacy URL: `https://vibecode.com/privacy`
   - Developer: `VibeCode Inc.`
   - Owner: `IT Department`
   - Notes: `Enterprise deployment - pilot phase`

5. **App Package**:
   - Upload: `VibeCode.intunemac`
   - Wait for upload (may take 5-10 minutes)

6. **Detection Rules**:
   - Rule type: `File or folder`
   - Path: `/Applications/VibeCode.app`
   - Detection method: `File or folder exists`

   **Or use version check**:
   - Path: `/Applications/VibeCode.app/Contents/Info.plist`
   - Key: `CFBundleShortVersionString`
   - Operator: `Greater than or equal to`
   - Value: `1.0.0`

7. **Requirements**:
   - Operating system: `macOS 13.0 and later`
   - Architecture: `All` (supports Intel + Apple Silicon)

8. **Assignments**:
   - Click "Add group"
   - Assignment type: `Required`
   - Included groups: `Engineering - Pilot` (Azure AD group)
   - End user notifications: `Show all toast notifications`

9. **Click "Create"**

---

### Step 3: Create Configuration Profile

1. **Navigate to Devices → macOS → Configuration Profiles → Create Profile**

2. **Profile Type**: `Templates` → `Custom`

3. **Basics**:
   - Name: `VibeCode - Base Configuration`
   - Description: `Core settings for VibeCode Enterprise`

4. **Configuration Settings**:
   - Preference domain: `com.vibecode.app`
   - Custom configuration (XML):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>PayloadContent</key>
    <array>
        <dict>
            <key>PayloadType</key>
            <string>com.apple.ManagedClient.preferences</string>
            <key>PayloadUUID</key>
            <string>UNIQUE-UUID-HERE</string>
            <key>PayloadIdentifier</key>
            <string>com.vibecode.config</string>
            <key>PayloadVersion</key>
            <integer>1</integer>
            <key>PayloadEnabled</key>
            <true/>

            <key>com.vibecode.app</key>
            <dict>
                <key>Forced</key>
                <array>
                    <dict>
                        <key>mcx_preference_settings</key>
                        <dict>
                            <key>APIEndpoint</key>
                            <string>https://vibecode.company.com</string>

                            <key>AuthProvider</key>
                            <string>azuread</string>

                            <key>AzureADTenantID</key>
                            <string>YOUR_TENANT_ID</string>

                            <key>EnableAICompletion</key>
                            <true/>

                            <key>LicenseKey</key>
                            <string>VIBECODE-ENTERPRISE-XXXX</string>
                        </dict>
                    </dict>
                </array>
            </dict>
        </dict>
    </array>
</dict>
</plist>
```

5. **Assignments**:
   - Assign to: `Engineering - Pilot` (same group)

6. **Click "Create"**

---

### Step 4: Monitor Deployment

1. **Navigate to Apps → VibeCode Enterprise → Device install status**

2. **Check Metrics**:
   - Installation progress: `X of Y devices`
   - Success rate: `XX%`
   - Failure count: `X`

3. **Review Failures**:
   - Click "Failed" devices
   - View error details:
     - `0x87D1FDE8`: Package not found (re-upload)
     - `0x87D13B8A`: Installation failed (check device logs)
     - `0x87D13BA2`: User cancelled (resend notification)

4. **Device-Level Verification**:
   - Navigate to Devices → macOS → Select device
   - Go to "Managed Apps"
   - Confirm `VibeCode Enterprise` shows `Installed`

---

## Kandji Deployment

### Step 1: Upload Package

1. **Navigate to Library → Custom Apps → Add Custom App**

2. **App Details**:
   - Name: `VibeCode Enterprise`
   - Description: `AI-powered development platform`
   - Category: `Productivity`

3. **Upload Installer**:
   - Click "Upload"
   - Select: `VibeCode-1.0.0.pkg`
   - Wait for processing

4. **Installation Settings**:
   - Install type: `Self Service and Enforce Install`
   - Install during Setup Assistant: ☐
   - Allow deferral: ☑ (3 times, 24 hours)

5. **Self Service**:
   - Display name: `VibeCode`
   - Description:
     ```
     Install VibeCode to access AI-powered coding features,
     Monaco editor, and code-server workspaces.
     ```
   - Icon: Upload logo

6. **Assignment**:
   - Blueprint: `Engineering - Pilot`
   - Auto-assign: ☑

7. **Click "Save"**

---

### Step 2: Create Configuration Profile

1. **Navigate to Library → Custom Profiles → Add Custom Profile**

2. **Profile Details**:
   - Name: `VibeCode - Base Configuration`
   - Profile type: `Computer`

3. **Upload Profile**:
   - Create `.mobileconfig` file locally:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>PayloadContent</key>
    <array>
        <dict>
            <key>PayloadType</key>
            <string>com.apple.ManagedClient.preferences</string>
            <key>PayloadVersion</key>
            <integer>1</integer>
            <key>PayloadIdentifier</key>
            <string>com.vibecode.config</string>
            <key>PayloadUUID</key>
            <string>UNIQUE-UUID</string>

            <key>com.vibecode.app</key>
            <dict>
                <key>Forced</key>
                <array>
                    <dict>
                        <key>mcx_preference_settings</key>
                        <dict>
                            <key>APIEndpoint</key>
                            <string>https://vibecode.company.com</string>
                            <!-- Add other settings -->
                        </dict>
                    </dict>
                </array>
            </dict>
        </dict>
    </array>
    <key>PayloadDisplayName</key>
    <string>VibeCode Base Configuration</string>
    <key>PayloadIdentifier</key>
    <string>com.vibecode.base.config</string>
    <key>PayloadType</key>
    <string>Configuration</string>
    <key>PayloadUUID</key>
    <string>PROFILE-UUID</string>
    <key>PayloadVersion</key>
    <integer>1</integer>
</dict>
</plist>
```

4. **Upload and assign to Blueprint**: `Engineering - Pilot`

---

## Mosyle Deployment

### Step 1: Upload Application

1. **Navigate to Apps → Mac Apps → Add Mac App**

2. **Upload**:
   - Select: `VibeCode-1.0.0.pkg`
   - Type: `PKG Installer`

3. **App Information**:
   - Name: `VibeCode Enterprise`
   - Version: `1.0.0`
   - Category: `Development`

4. **Deployment Settings**:
   - Install method: `Background (silent)`
   - Self Service availability: ☑
   - Update automatically: ☑

5. **Assign to Group**: `Engineering - Pilot`

---

### Step 2: Create Configuration Profile

1. **Navigate to Profiles → Mac Profiles → Add Profile**

2. **Profile Settings**:
   - Name: `VibeCode Configuration`
   - Type: `Custom Settings`

3. **Add Custom Payload**:
   - Preference Domain: `com.vibecode.app`
   - Upload XML (same as Jamf example)

4. **Assign to Group**: `Engineering - Pilot`

---

## Validation & Testing

### Phase 1: Pilot Device Testing (Week 1)

**Day 1: Initial Deployment**

1. **Deploy to 3 test devices**:
   - 1 x Intel Mac (Monterey 13.0)
   - 1 x Apple Silicon M1 (Ventura 13.x)
   - 1 x Apple Silicon M3 (Sonoma 14.x)

2. **Verify Installation**:
   ```bash
   # On each device
   ls -la /Applications/VibeCode.app
   codesign --verify --deep /Applications/VibeCode.app
   spctl --assess --type execute /Applications/VibeCode.app

   # Check configuration
   defaults read com.vibecode.app

   # Test launch
   open /Applications/VibeCode.app

   # Check logs
   tail -f ~/Library/Logs/VibeCode/app.log
   ```

3. **Test Core Features**:
   - [ ] Application launches without errors
   - [ ] SSO authentication works
   - [ ] Monaco editor loads
   - [ ] AI completion responds (if enabled)
   - [ ] Code-server workspace creates
   - [ ] Files save and persist

**Day 2-7: Expand to 10 Pilot Users**

4. **Deploy to remaining 7 users**

5. **Collect Feedback**:
   - Daily check-ins (first 3 days)
   - In-app survey link
   - Slack channel: `#vibecode-pilot`

6. **Monitor Metrics** (Datadog):
   - Installation success rate: Target >95%
   - Application crashes: Target <5 per week
   - API errors: Target <1% error rate
   - User engagement: Target >50% DAU

---

### Phase 2: Beta Rollout (Week 2-3)

7. **Expand to 50 users**:
   - Update smart group criteria
   - Notify users via email
   - Schedule training sessions

8. **Test Update Mechanism**:
   - Release v1.0.1 (minor update)
   - Verify automatic update via Sparkle
   - Monitor update adoption: Target >90% in 48h

9. **Stress Testing**:
   - 10+ concurrent users
   - Code-server workspaces under load
   - AI completion API rate limits

---

### Phase 3: Production Rollout (Week 4+)

10. **Deploy to all eligible users** (500-5,000)

11. **Establish SLA Metrics**:
    - Uptime: 99.9% (8.76 hours downtime/year)
    - API response time: p95 <500ms
    - Support ticket volume: <2% of user base/month

---

## Troubleshooting

### Issue: Installation Fails with "Package Signature Invalid"

**Symptoms**:
- Installer log shows: `PackageKit: Install Failed: PKG signature verification failed`

**Resolution**:
```bash
# Re-download package from vendor
# Verify signature
pkgutil --check-signature VibeCode-1.0.0.pkg

# Expected output:
#   Package "VibeCode-1.0.0.pkg":
#      Status: signed by a developer certificate issued by Apple
#      Certificate Chain:
#       1. Developer ID Installer: VibeCode Inc (TEAM_ID)
#       2. Developer ID Certification Authority
#       3. Apple Root CA

# If invalid, contact VibeCode support for re-signed package
```

---

### Issue: App Crashes on Launch

**Symptoms**:
- Application icon bounces in dock, then quits
- Crash report generated in `~/Library/Logs/DiagnosticReports/`

**Resolution**:
```bash
# Check crash log
ls -lt ~/Library/Logs/DiagnosticReports/VibeCode* | head -1

# Common causes:
# 1. Missing Node.js runtime
#    Fix: Reinstall package

# 2. Database connection failure
#    Fix: Check DATABASE_URL in config profile
defaults read com.vibecode.app DatabaseURL

# 3. Permissions issue
#    Fix: Grant Full Disk Access in System Preferences
tccutil reset SystemPolicyAllFiles com.vibecode.app
```

---

### Issue: Configuration Profile Not Applying

**Symptoms**:
- App uses default settings instead of MDM-configured values

**Resolution**:
```bash
# Check if profile installed
profiles list | grep vibecode

# Force profile installation (Jamf)
sudo jamf policy -event install_vibecode_config

# Verify settings
defaults read com.vibecode.app

# Check profile payload
sudo profiles show -type configuration -output stdout-xml | grep -A 50 vibecode
```

---

### Issue: SSO Authentication Fails

**Symptoms**:
- User redirected to SSO, but returns to login screen
- Error: "Authentication failed: invalid_state"

**Resolution**:
1. **Verify SAML Configuration**:
   ```bash
   # Check SSO URL
   defaults read com.vibecode.app SAMLSSOURL

   # Should match IdP configuration
   ```

2. **Check IdP Settings**:
   - Assertion Consumer Service (ACS) URL: `https://vibecode.company.com/api/auth/callback/saml`
   - Entity ID: `urn:company:vibecode`
   - Name ID format: `urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress`

3. **Test SAML Flow**:
   - Use SAML Tracer browser extension
   - Capture SAML Response
   - Verify attributes: `email`, `name`, `groups`

---

## Rollback Procedures

### Emergency Rollback (P0 Incident)

**Scenario**: Critical bug affecting >50% of users

**Immediate Actions** (within 1 hour):

1. **Disable Automatic Installation**:
   - Jamf: Edit policy → Disable trigger
   - Intune: Change assignment to "Available"
   - Kandji: Remove from Blueprint
   - Mosyle: Pause deployment

2. **Notify Users**:
   ```
   Subject: VibeCode Temporary Service Interruption

   We've identified an issue with VibeCode and are working on a fix.
   Please do not launch VibeCode until further notice.

   For urgent development needs, use [backup tool].

   ETA for resolution: [X hours]
   ```

3. **Uninstall from Affected Devices**:
   ```bash
   # Create Jamf uninstall policy
   sudo rm -rf /Applications/VibeCode.app
   sudo rm -rf "/Library/Application Support/VibeCode"
   sudo launchctl unload /Library/LaunchDaemons/com.vibecode.updater.plist
   sudo rm /Library/LaunchDaemons/com.vibecode.updater.plist
   ```

---

### Controlled Rollback (P1 Issue)

**Scenario**: Non-critical bug, planned downgrade

**Procedure** (24-48 hour window):

1. **Prepare Previous Version**:
   - Upload `VibeCode-0.9.0.pkg` to MDM
   - Test on 3 devices

2. **Create Downgrade Policy**:
   - Scope: Affected users only
   - Script:
     ```bash
     #!/bin/bash
     # Uninstall current version
     sudo rm -rf /Applications/VibeCode.app

     # Install previous version
     sudo installer -pkg /path/to/VibeCode-0.9.0.pkg -target /
     ```

3. **Deploy in Phases**:
   - Day 1: 10% of users
   - Day 2: 50% of users
   - Day 3: 100% of users

4. **Monitor & Communicate**:
   - Track downgrade success rate
   - Send follow-up email once complete

---

## Appendix: Quick Reference

### MDM Platform Comparison

| Feature | Jamf Pro | Intune | Kandji | Mosyle |
|---------|----------|--------|--------|--------|
| **Deployment Speed** | Fast (2 hours) | Medium (4 hours) | Fast (2 hours) | Fast (2 hours) |
| **Configuration Flexibility** | High | Medium | High | Medium |
| **Self Service Portal** | Excellent | Good | Excellent | Good |
| **Reporting Depth** | Excellent | Good | Good | Fair |
| **API Integration** | Excellent | Excellent | Good | Fair |
| **Best For** | Large enterprises | Microsoft shops | Mid-market | SMB |

### Support Contacts

**VibeCode Enterprise Support**:
- Email: enterprise@vibecode.com
- Phone: +1-800-VIBECODE (24/7)
- Slack Connect: Request invite from account manager
- Status Page: https://status.vibecode.com

**Internal Escalation**:
- L1: Help Desk (Tier 1 troubleshooting)
- L2: IT Admin (MDM configuration, policies)
- L3: VibeCode Support (application bugs, platform issues)

---

**Document Version**: 1.0.0
**Last Updated**: 2025-10-02
**Next Review**: 2025-11-01
**Maintained By**: Agent 30 (Staff Solutions Architect, Jamf)
