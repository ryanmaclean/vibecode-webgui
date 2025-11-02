# Code Signing & Notarization Plan

**Status:** Planning phase
**Priority:** Critical
**Timeline:** 2 weeks setup + ongoing
**Complexity:** Medium

## Overview

Implement comprehensive code signing and notarization across all platforms to ensure user trust, bypass security warnings, and meet distribution requirements for app stores.

## Why Code Signing Matters

### Security Benefits
- **Authenticity verification:** Users can verify the software comes from VibeCode
- **Integrity protection:** Detect tampering or modification
- **Trust establishment:** Operating systems trust signed software
- **Malware prevention:** Reduces malware distribution via impersonation

### User Experience Benefits
- **No security warnings:** Signed apps bypass SmartScreen, Gatekeeper warnings
- **Professional appearance:** Shows legitimacy and commitment to quality
- **Automatic updates:** Required for auto-update mechanisms
- **App store distribution:** Required for Mac App Store, Microsoft Store

### Legal/Compliance Benefits
- **Identity verification:** Proves organizational identity
- **Audit trail:** Timestamped signatures provide proof of signing date
- **Enterprise deployment:** Required for corporate software distribution

## Platform Requirements

### macOS

#### Requirements
- **Apple Developer Account:** $99/year
- **Developer ID Application Certificate:** For distribution outside App Store
- **Developer ID Installer Certificate:** For .pkg installers (optional)
- **Notarization:** Required for macOS 10.15+
- **Hardened Runtime:** Required for notarization
- **Entitlements:** Define app capabilities and permissions

#### Cost
- **One-time:** None (after account setup)
- **Annual:** $99/year (Apple Developer Program)
- **Time per release:** 5-10 minutes (automated)

### Windows

#### Requirements
- **Code Signing Certificate:** Standard or EV
- **Timestamp server:** For long-term validity
- **signtool.exe:** Windows SDK tool for signing

#### Cost
- **Standard Certificate:** $100-200/year
- **EV Certificate:** $300-500/year (recommended)
- **Hardware token:** ~$50 (for EV certificates)
- **Time per release:** 2-5 minutes (automated)

#### EV vs Standard Certificate

| Feature | Standard Certificate | EV Certificate |
|---------|---------------------|----------------|
| SmartScreen warnings | Yes (3-6 months) | No (immediate trust) |
| Cost | $100-200/year | $300-500/year |
| Verification | Basic | Extended validation |
| Hardware token | No | Yes (required) |
| Immediate reputation | No | Yes |
| **Recommendation** | Testing only | **Production** |

**Conclusion:** EV certificate worth extra $200/year for immediate trust and professional appearance.

### Linux

#### Requirements
- **GPG key pair:** Free to generate
- **Public key distribution:** GitHub, website, keyserver
- **Package signing:** dpkg-sig (Debian), rpm-sign (RPM)

#### Cost
- **One-time:** $0
- **Annual:** $0
- **Time per release:** 1-2 minutes (automated)

## macOS Code Signing & Notarization

### Prerequisites

#### 1. Apple Developer Account
```bash
# Sign up at: https://developer.apple.com/programs/
# Cost: $99/year
# Verification: 1-2 business days
```

#### 2. Developer ID Certificate

**Obtain Certificate:**
1. Log in to Apple Developer portal
2. Navigate to Certificates, Identifiers & Profiles
3. Click "+" to create new certificate
4. Select "Developer ID Application"
5. Upload Certificate Signing Request (CSR)
6. Download certificate and install in Keychain

**Create CSR:**
```bash
# Use Keychain Access on macOS
# Keychain Access → Certificate Assistant → Request a Certificate from a Certificate Authority
# Save to disk, upload to Apple Developer portal
```

**Verify Certificate Installation:**
```bash
# List signing identities
security find-identity -v -p codesigning

# Should show:
# 1) <hash> "Developer ID Application: VibeCode Team (TEAM_ID)"
```

#### 3. App-Specific Password

```bash
# Generate at: https://appleid.apple.com/account/manage
# Security → App-Specific Passwords → Generate
# Save securely (cannot be viewed again)
```

### Entitlements Configuration

**File:** `src-tauri/entitlements.plist`
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <!-- Hardened Runtime -->
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>

    <!-- Network access -->
    <key>com.apple.security.network.client</key>
    <true/>
    <key>com.apple.security.network.server</key>
    <true/>

    <!-- File access -->
    <key>com.apple.security.files.user-selected.read-write</key>
    <true/>

    <!-- Docker/VM access -->
    <key>com.apple.security.app-sandbox</key>
    <false/>

    <!-- JIT compilation (for WebView) -->
    <key>com.apple.security.cs.allow-jit</key>
    <true/>

    <!-- Disable library validation (for Tauri) -->
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>
</dict>
</plist>
```

**Note:** These entitlements are for distribution outside the App Store. App Store requires more restrictive entitlements.

### Signing Process

#### Manual Signing

```bash
#!/bin/bash
set -e

APP_PATH="src-tauri/target/universal-apple-darwin/release/bundle/macos/VibeCode.app"
IDENTITY="Developer ID Application: VibeCode Team (TEAM_ID)"
ENTITLEMENTS="src-tauri/entitlements.plist"

# Sign the application
codesign --force --deep \
  --sign "$IDENTITY" \
  --options runtime \
  --entitlements "$ENTITLEMENTS" \
  --timestamp \
  "$APP_PATH"

# Verify signature
codesign --verify --verbose=2 "$APP_PATH"

# Check entitlements
codesign --display --entitlements :- "$APP_PATH"

echo "Signing complete!"
```

#### Create DMG

```bash
#!/bin/bash
set -e

APP_PATH="src-tauri/target/universal-apple-darwin/release/bundle/macos/VibeCode.app"
DMG_PATH="VibeCode-1.6.0.dmg"
IDENTITY="Developer ID Application: VibeCode Team (TEAM_ID)"

# Install create-dmg if not present
brew install create-dmg

# Create DMG
create-dmg \
  --volname "VibeCode" \
  --volicon "icons/icon.icns" \
  --window-pos 200 120 \
  --window-size 800 400 \
  --icon-size 100 \
  --icon "VibeCode.app" 200 190 \
  --hide-extension "VibeCode.app" \
  --app-drop-link 600 185 \
  "$DMG_PATH" \
  "$APP_PATH"

# Sign DMG
codesign --force \
  --sign "$IDENTITY" \
  --timestamp \
  "$DMG_PATH"

# Verify DMG signature
codesign --verify --verbose=2 "$DMG_PATH"

echo "DMG created and signed: $DMG_PATH"
```

### Notarization Process

#### Notarize with notarytool (recommended)

```bash
#!/bin/bash
set -e

DMG_PATH="VibeCode-1.6.0.dmg"
APPLE_ID="team@vibecode.com"
TEAM_ID="TEAM_ID"
APP_PASSWORD="app-specific-password"

# Submit for notarization
echo "Submitting for notarization..."
xcrun notarytool submit "$DMG_PATH" \
  --apple-id "$APPLE_ID" \
  --team-id "$TEAM_ID" \
  --password "$APP_PASSWORD" \
  --wait

# Check notarization status
echo "Checking notarization status..."
xcrun notarytool info <submission-id> \
  --apple-id "$APPLE_ID" \
  --team-id "$TEAM_ID" \
  --password "$APP_PASSWORD"

# If successful, staple the ticket
echo "Stapling notarization ticket..."
xcrun stapler staple "$DMG_PATH"

# Verify stapling
xcrun stapler validate "$DMG_PATH"

echo "Notarization complete!"
```

**Timeline:**
- Submission: <1 minute
- Processing: 2-10 minutes (typically 3-5 minutes)
- Stapling: <10 seconds
- **Total:** ~5-15 minutes per release

#### Using Keychain for credentials

```bash
# Store credentials in Keychain (recommended)
xcrun notarytool store-credentials "vibecode-notarization" \
  --apple-id "team@vibecode.com" \
  --team-id "TEAM_ID" \
  --password "app-specific-password"

# Use stored credentials
xcrun notarytool submit VibeCode.dmg \
  --keychain-profile "vibecode-notarization" \
  --wait
```

### Automated Signing Script

**File:** `scripts/sign-macos.sh`
```bash
#!/bin/bash
set -e

# Configuration
APP_NAME="VibeCode"
VERSION="${1:-1.6.0}"
APP_PATH="src-tauri/target/universal-apple-darwin/release/bundle/macos/${APP_NAME}.app"
DMG_PATH="${APP_NAME}-${VERSION}.dmg"

# Environment variables (set in CI/CD)
IDENTITY="${APPLE_IDENTITY:-Developer ID Application: VibeCode Team}"
APPLE_ID="${APPLE_ID}"
TEAM_ID="${APPLE_TEAM_ID}"
KEYCHAIN_PROFILE="vibecode-notarization"

echo "🔐 Signing ${APP_NAME}.app..."

# 1. Sign application
codesign --force --deep \
  --sign "$IDENTITY" \
  --options runtime \
  --entitlements src-tauri/entitlements.plist \
  --timestamp \
  "$APP_PATH"

# 2. Verify signature
echo "✅ Verifying signature..."
codesign --verify --verbose=2 "$APP_PATH"

# 3. Create DMG
echo "📦 Creating DMG..."
create-dmg \
  --volname "${APP_NAME}" \
  --volicon "icons/icon.icns" \
  --window-pos 200 120 \
  --window-size 800 400 \
  --icon-size 100 \
  --icon "${APP_NAME}.app" 200 190 \
  --hide-extension "${APP_NAME}.app" \
  --app-drop-link 600 185 \
  "$DMG_PATH" \
  "$APP_PATH"

# 4. Sign DMG
echo "🔐 Signing DMG..."
codesign --force \
  --sign "$IDENTITY" \
  --timestamp \
  "$DMG_PATH"

# 5. Notarize
echo "📝 Submitting for notarization..."
xcrun notarytool submit "$DMG_PATH" \
  --keychain-profile "$KEYCHAIN_PROFILE" \
  --wait

# 6. Staple
echo "📌 Stapling notarization ticket..."
xcrun stapler staple "$DMG_PATH"

# 7. Verify
echo "✅ Verifying notarization..."
xcrun stapler validate "$DMG_PATH"
spctl --assess --type open --context context:primary-signature -v "$DMG_PATH"

echo "✅ ${DMG_PATH} is signed and notarized!"
```

### CI/CD Integration (GitHub Actions)

```yaml
- name: Sign and notarize macOS app
  env:
    APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE_BASE64 }}
    APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
    APPLE_ID: ${{ secrets.APPLE_ID }}
    APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
    APPLE_APP_PASSWORD: ${{ secrets.APPLE_APP_PASSWORD }}
  run: |
    # Decode certificate
    echo "$APPLE_CERTIFICATE" | base64 --decode > certificate.p12

    # Create temporary keychain
    security create-keychain -p "$RUNNER_TEMP" build.keychain
    security default-keychain -s build.keychain
    security unlock-keychain -p "$RUNNER_TEMP" build.keychain

    # Import certificate
    security import certificate.p12 \
      -k build.keychain \
      -P "$APPLE_CERTIFICATE_PASSWORD" \
      -T /usr/bin/codesign

    # Allow codesign to use keychain
    security set-key-partition-list \
      -S apple-tool:,apple: \
      -s \
      -k "$RUNNER_TEMP" \
      build.keychain

    # Store notarization credentials
    xcrun notarytool store-credentials "vibecode-notarization" \
      --apple-id "$APPLE_ID" \
      --team-id "$APPLE_TEAM_ID" \
      --password "$APPLE_APP_PASSWORD"

    # Run signing script
    chmod +x scripts/sign-macos.sh
    ./scripts/sign-macos.sh

    # Clean up
    security delete-keychain build.keychain
    rm certificate.p12
```

## Windows Code Signing

### Prerequisites

#### 1. Acquire Code Signing Certificate

**Recommended: EV Certificate**
- **DigiCert EV Code Signing:** $469/year
- **Sectigo EV Code Signing:** $299/year
- **GlobalSign EV Code Signing:** $349/year

**Process:**
1. Purchase certificate from provider
2. Submit organization verification documents
3. Complete phone verification
4. Receive hardware token (USB) by mail (3-5 days)
5. Install certificate on token

**Standard Certificate (not recommended for production):**
- Shows SmartScreen warnings for 3-6 months
- Only use for testing/internal distribution

#### 2. Install Windows SDK

```powershell
# signtool.exe is included in Windows SDK
# Download from: https://developer.microsoft.com/en-us/windows/downloads/windows-sdk/

# Or install via Visual Studio Installer:
# Visual Studio Installer → Modify → Individual Components → Windows 10/11 SDK
```

**signtool.exe location:**
```
C:\Program Files (x86)\Windows Kits\10\bin\<SDK_VERSION>\x64\signtool.exe
```

### Signing Process

#### Manual Signing

```powershell
# Configuration
$APP_PATH = "src-tauri\target\x86_64-pc-windows-msvc\release\vibecode.exe"
$MSI_PATH = "src-tauri\target\x86_64-pc-windows-msvc\release\bundle\msi\VibeCode_1.6.0_x64_en-US.msi"
$CERTIFICATE = "certificate.pfx"
$PASSWORD = "certificate-password"
$TIMESTAMP_SERVER = "http://timestamp.digicert.com"

# Sign executable
& "C:\Program Files (x86)\Windows Kits\10\bin\10.0.22000.0\x64\signtool.exe" sign `
  /f "$CERTIFICATE" `
  /p "$PASSWORD" `
  /fd SHA256 `
  /tr "$TIMESTAMP_SERVER" `
  /td SHA256 `
  /d "VibeCode" `
  /du "https://vibecode.app" `
  "$APP_PATH"

# Sign MSI installer
& "C:\Program Files (x86)\Windows Kits\10\bin\10.0.22000.0\x64\signtool.exe" sign `
  /f "$CERTIFICATE" `
  /p "$PASSWORD" `
  /fd SHA256 `
  /tr "$TIMESTAMP_SERVER" `
  /td SHA256 `
  /d "VibeCode Installer" `
  /du "https://vibecode.app" `
  "$MSI_PATH"

# Verify signatures
& "C:\Program Files (x86)\Windows Kits\10\bin\10.0.22000.0\x64\signtool.exe" verify `
  /pa `
  /v `
  "$APP_PATH"

Write-Host "✅ Signing complete!"
```

#### Timestamp Servers

**Purpose:** Allow signed binaries to remain valid even after certificate expires.

**Recommended servers:**
```powershell
# DigiCert (recommended)
http://timestamp.digicert.com

# Sectigo
http://timestamp.sectigo.com

# GlobalSign
http://timestamp.globalsign.com

# Comodo (legacy)
http://timestamp.comodoca.com
```

**Always use SHA256 timestamping** (`/td SHA256`)

### Automated Signing Script

**File:** `scripts/sign-windows.ps1`
```powershell
param(
    [string]$Version = "1.6.0"
)

$ErrorActionPreference = "Stop"

# Configuration
$APP_NAME = "VibeCode"
$BUILD_DIR = "src-tauri\target\x86_64-pc-windows-msvc\release"
$EXE_PATH = "$BUILD_DIR\vibecode.exe"
$MSI_PATH = "$BUILD_DIR\bundle\msi\${APP_NAME}_${Version}_x64_en-US.msi"
$NSIS_PATH = "$BUILD_DIR\bundle\nsis\${APP_NAME}_${Version}_x64-setup.exe"

# Find signtool.exe
$SIGNTOOL = Get-ChildItem -Path "C:\Program Files (x86)\Windows Kits" `
    -Recurse -Filter "signtool.exe" `
    -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -match "x64" } |
    Select-Object -First 1 -ExpandProperty FullName

if (-not $SIGNTOOL) {
    throw "signtool.exe not found. Install Windows SDK."
}

Write-Host "🔐 Using signtool: $SIGNTOOL"

# Environment variables (from CI/CD or local)
$CERTIFICATE = $env:WINDOWS_CERTIFICATE
$PASSWORD = $env:WINDOWS_CERTIFICATE_PASSWORD
$TIMESTAMP_SERVER = "http://timestamp.digicert.com"

# Sign function
function Sign-File {
    param($FilePath)

    Write-Host "🔐 Signing: $FilePath"

    & $SIGNTOOL sign `
        /f "$CERTIFICATE" `
        /p "$PASSWORD" `
        /fd SHA256 `
        /tr "$TIMESTAMP_SERVER" `
        /td SHA256 `
        /d "$APP_NAME" `
        /du "https://vibecode.app" `
        "$FilePath"

    if ($LASTEXITCODE -ne 0) {
        throw "Failed to sign $FilePath"
    }

    # Verify
    & $SIGNTOOL verify /pa /v "$FilePath"

    if ($LASTEXITCODE -ne 0) {
        throw "Failed to verify signature of $FilePath"
    }

    Write-Host "✅ Signed: $FilePath"
}

# Sign all files
Sign-File -FilePath $EXE_PATH

if (Test-Path $MSI_PATH) {
    Sign-File -FilePath $MSI_PATH
}

if (Test-Path $NSIS_PATH) {
    Sign-File -FilePath $NSIS_PATH
}

Write-Host "✅ All files signed successfully!"
```

### CI/CD Integration (GitHub Actions)

```yaml
- name: Sign Windows executables
  env:
    CERTIFICATE_BASE64: ${{ secrets.WINDOWS_CERTIFICATE_BASE64 }}
    CERTIFICATE_PASSWORD: ${{ secrets.WINDOWS_CERTIFICATE_PASSWORD }}
  shell: pwsh
  run: |
    # Decode certificate from base64
    $cert = [Convert]::FromBase64String($env:CERTIFICATE_BASE64)
    [IO.File]::WriteAllBytes("certificate.pfx", $cert)

    # Set environment variable for signing script
    $env:WINDOWS_CERTIFICATE = "certificate.pfx"
    $env:WINDOWS_CERTIFICATE_PASSWORD = $env:CERTIFICATE_PASSWORD

    # Run signing script
    .\scripts\sign-windows.ps1 -Version "1.6.0"

    # Clean up certificate
    Remove-Item certificate.pfx -Force
```

### Submit to Microsoft SmartScreen

**Purpose:** Build reputation and reduce SmartScreen warnings.

**Process:**
1. Go to: https://www.microsoft.com/en-us/wdsi/filesubmission
2. Select "Submit a file for malware analysis"
3. Upload signed executable
4. Provide detailed information:
   - Application name: VibeCode
   - Publisher: VibeCode Team
   - Description: AI-Powered Development Environment
   - Website: https://vibecode.app
5. Submit and wait 1-2 weeks for review

**Results:**
- Approved: Reputation boost, fewer warnings
- Flagged: Review and remediate issues

## Linux Package Signing (GPG)

### Prerequisites

#### 1. Generate GPG Key

```bash
# Generate new GPG key
gpg --full-generate-key

# Select:
# - Key type: (1) RSA and RSA
# - Key size: 4096
# - Expiration: 2 years (recommended)
# - Real name: VibeCode Team
# - Email: team@vibecode.com
# - Comment: Code Signing Key

# List keys
gpg --list-secret-keys --keyid-format LONG

# Export public key
gpg --armor --export team@vibecode.com > vibecode-signing-key.asc

# Export private key (keep secure!)
gpg --armor --export-secret-keys team@vibecode.com > vibecode-signing-key-private.asc
```

#### 2. Publish Public Key

```bash
# Upload to keyserver
gpg --keyserver keyserver.ubuntu.com --send-keys <KEY_ID>

# Also publish on:
# - GitHub repository (vibecode-signing-key.asc)
# - Website (https://vibecode.app/vibecode-signing-key.asc)
# - Package repository
```

### Signing Process

#### Sign .deb Package

```bash
#!/bin/bash
set -e

DEB_FILE="vibecode_1.6.0_amd64.deb"
GPG_KEY="team@vibecode.com"

# Install dpkg-sig if not present
sudo apt install dpkg-sig

# Sign package
dpkg-sig --sign builder -k "$GPG_KEY" "$DEB_FILE"

# Verify signature
dpkg-sig --verify "$DEB_FILE"

echo "✅ .deb package signed"
```

#### Sign .rpm Package

```bash
#!/bin/bash
set -e

RPM_FILE="vibecode-1.6.0-1.x86_64.rpm"
GPG_KEY="team@vibecode.com"

# Configure RPM macros
echo "%_gpg_name $GPG_KEY" >> ~/.rpmmacros

# Sign package
rpm --addsign "$RPM_FILE"

# Verify signature
rpm --checksig -v "$RPM_FILE"

echo "✅ .rpm package signed"
```

### Automated Signing Script

**File:** `scripts/sign-linux.sh`
```bash
#!/bin/bash
set -e

VERSION="${1:-1.6.0}"
BUILD_DIR="src-tauri/target/x86_64-unknown-linux-gnu/release/bundle"
GPG_KEY="team@vibecode.com"

echo "🔐 Signing Linux packages..."

# Sign .deb packages
for DEB in "$BUILD_DIR"/deb/*.deb; do
    if [ -f "$DEB" ]; then
        echo "🔐 Signing: $DEB"
        dpkg-sig --sign builder -k "$GPG_KEY" "$DEB"
        dpkg-sig --verify "$DEB"
        echo "✅ Signed: $DEB"
    fi
done

# Sign .rpm packages
for RPM in "$BUILD_DIR"/rpm/*.rpm; do
    if [ -f "$RPM" ]; then
        echo "🔐 Signing: $RPM"
        rpm --addsign "$RPM"
        rpm --checksig -v "$RPM"
        echo "✅ Signed: $RPM"
    fi
done

echo "✅ All Linux packages signed!"
```

### CI/CD Integration (GitHub Actions)

```yaml
- name: Sign Linux packages
  env:
    GPG_PRIVATE_KEY: ${{ secrets.GPG_PRIVATE_KEY }}
    GPG_PASSPHRASE: ${{ secrets.GPG_PASSPHRASE }}
  run: |
    # Import GPG key
    echo "$GPG_PRIVATE_KEY" | gpg --batch --import

    # Configure GPG for non-interactive signing
    echo "allow-preset-passphrase" >> ~/.gnupg/gpg-agent.conf
    gpgconf --kill gpg-agent
    gpgconf --launch gpg-agent

    # Get key grip
    KEYGRIP=$(gpg --with-keygrip --list-secret-keys team@vibecode.com | grep -A1 "ssb" | tail -1 | tr -d ' ')

    # Preset passphrase
    /usr/lib/gnupg/gpg-preset-passphrase --preset "$KEYGRIP" <<< "$GPG_PASSPHRASE"

    # Run signing script
    chmod +x scripts/sign-linux.sh
    ./scripts/sign-linux.sh
```

## Cost Summary

### Total Annual Costs

| Platform | Item | Cost | Notes |
|----------|------|------|-------|
| **macOS** | Apple Developer | $99/year | Required |
| **Windows** | EV Code Signing | $300-500/year | Recommended |
| **Windows** | Hardware token | $50 one-time | For EV cert |
| **Linux** | GPG signing | $0 | Free |
| **Total Annual** | | **$400-600/year** | |

### Time Investment

| Platform | Setup Time | Per-Release Time |
|----------|------------|------------------|
| macOS | 2-3 hours | 5-10 minutes (automated) |
| Windows | 1-2 hours | 2-5 minutes (automated) |
| Linux | 1 hour | 1-2 minutes (automated) |
| **Total Setup** | **4-6 hours** | |
| **Total Per-Release** | | **8-17 minutes** |

## Security Best Practices

### Certificate Storage

#### macOS
```bash
# Store certificate in Keychain
# Import via Keychain Access or:
security import certificate.p12 \
  -k ~/Library/Keychains/login.keychain-db \
  -P "password" \
  -T /usr/bin/codesign

# Lock keychain when not in use
security lock-keychain ~/Library/Keychains/login.keychain-db
```

#### Windows
```powershell
# Store certificate in Windows Certificate Store (for EV certificates on hardware token)
# Or encrypt .pfx file:
# Use Azure Key Vault or AWS Secrets Manager in CI/CD
```

#### Linux
```bash
# Encrypt private GPG key
gpg --armor --export-secret-keys team@vibecode.com | \
  gpg --symmetric --cipher-algo AES256 > gpg-key-encrypted.asc

# Store encrypted key in repository secrets
```

### CI/CD Secrets

**GitHub Secrets to create:**
- `APPLE_CERTIFICATE_BASE64` - Base64-encoded .p12 certificate
- `APPLE_CERTIFICATE_PASSWORD` - Certificate password
- `APPLE_ID` - Apple ID email
- `APPLE_TEAM_ID` - 10-character team ID
- `APPLE_APP_PASSWORD` - App-specific password
- `WINDOWS_CERTIFICATE_BASE64` - Base64-encoded .pfx certificate
- `WINDOWS_CERTIFICATE_PASSWORD` - Certificate password
- `GPG_PRIVATE_KEY` - ASCII-armored GPG private key
- `GPG_PASSPHRASE` - GPG key passphrase

### Rotation and Renewal

- **macOS:** Renew Developer account annually ($99/year)
- **Windows:** Renew certificate annually before expiration
- **Linux:** Rotate GPG key every 2 years (recommended)

## Verification

### macOS
```bash
# Verify code signature
codesign --verify --verbose=2 VibeCode.app

# Check notarization
spctl --assess --type open --context context:primary-signature -v VibeCode.app

# Display signing info
codesign --display --verbose=2 VibeCode.app

# Check entitlements
codesign --display --entitlements :- VibeCode.app
```

### Windows
```powershell
# Verify signature
signtool verify /pa /v VibeCode.exe

# Display certificate info
signtool verify /pa /v /d VibeCode.exe
```

### Linux
```bash
# Verify .deb signature
dpkg-sig --verify vibecode_1.6.0_amd64.deb

# Verify .rpm signature
rpm --checksig -v vibecode-1.6.0-1.x86_64.rpm

# Check GPG key
gpg --verify package.deb.asc package.deb
```

## Troubleshooting

### macOS: "No identity found"
```bash
# List identities
security find-identity -v -p codesigning

# If empty, import certificate
security import certificate.p12 -k ~/Library/Keychains/login.keychain-db
```

### macOS: Notarization fails
```bash
# Check notarization log
xcrun notarytool log <submission-id> \
  --apple-id "$APPLE_ID" \
  --team-id "$TEAM_ID" \
  --password "$APP_PASSWORD"

# Common issues:
# - Missing entitlements
# - Unsigned binaries in bundle
# - Hardened runtime not enabled
```

### Windows: "SignTool Error: No certificates were found that met all the given criteria"
```powershell
# Verify certificate is accessible
certutil -user -store My

# Re-import certificate
certutil -user -f -importpfx certificate.pfx
```

### Linux: GPG signing fails in CI
```bash
# Ensure GPG agent is running
gpgconf --launch gpg-agent

# Use --batch and --yes flags
gpg --batch --yes --sign file
```

## Success Criteria

- [ ] Apple Developer account active
- [ ] macOS signing certificate obtained
- [ ] macOS notarization working
- [ ] Windows EV certificate obtained
- [ ] Windows signing working
- [ ] GPG key generated and published
- [ ] Linux package signing working
- [ ] All signing automated in CI/CD
- [ ] Verification scripts working
- [ ] Documentation complete
- [ ] Secrets stored securely

## Conclusion

Code signing is essential for professional software distribution. While it requires upfront investment ($400-600/year + 4-6 hours setup), the benefits far outweigh the costs:

- User trust and confidence
- No security warnings
- Professional appearance
- Required for app stores
- Protection against tampering

**Recommendation:** Implement code signing before v1.6.0 release. The automated scripts make it seamless for ongoing releases.
