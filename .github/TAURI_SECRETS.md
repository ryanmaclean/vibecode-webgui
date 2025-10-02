# GitHub Secrets for Tauri Build Pipeline

Required secrets for automated building, signing, and notarizing VibeCode.dmg.

## Required Secrets

### Code Signing

**`APPLE_CERTIFICATE_BASE64`**
- Base64-encoded Developer ID Application certificate (.p12)
- Generate: `base64 -i certificate.p12 | pbcopy`

**`APPLE_CERTIFICATE_PASSWORD`**
- Password for the .p12 certificate file

**`KEYCHAIN_PASSWORD`**
- Temporary password for CI keychain (any secure string)
- Generate: `openssl rand -base64 32`

**`APPLE_SIGNING_IDENTITY`**
- Full signing identity name from certificate
- Find: `security find-identity -v -p codesigning`
- Example: `Developer ID Application: John Doe (ABC123XYZ)`

### Notarization

**`APPLE_ID`**
- Your Apple Developer account email

**`APPLE_APP_SPECIFIC_PASSWORD`**
- App-specific password from appleid.apple.com
- NOT your regular Apple ID password

**`APPLE_TEAM_ID`**
- 10-character Team ID from developer.apple.com/account
- Example: `ABC123XYZ`

### Optional: Tauri Updater

**`TAURI_PRIVATE_KEY`**
- Private key for Tauri updater signatures
- Generate: `tauri signer generate`

**`TAURI_KEY_PASSWORD`**
- Password for Tauri private key (if encrypted)

## Setup Steps

### 1. Export Certificate from Keychain

```bash
# 1. Open Keychain Access
# 2. Find "Developer ID Application: Your Name"
# 3. Right-click → Export
# 4. Save as certificate.p12 with password
# 5. Convert to base64:
base64 -i certificate.p12 | pbcopy
```

### 2. Generate App-Specific Password

```bash
# 1. Go to https://appleid.apple.com
# 2. Sign-In and Security → App-Specific Passwords
# 3. Click "+" to generate
# 4. Label: "GitHub Actions Notarization"
# 5. Copy password (format: xxxx-xxxx-xxxx-xxxx)
```

### 3. Add Secrets to GitHub

```bash
gh secret set APPLE_CERTIFICATE_BASE64 < certificate.p12.base64
gh secret set APPLE_CERTIFICATE_PASSWORD
gh secret set KEYCHAIN_PASSWORD
gh secret set APPLE_SIGNING_IDENTITY
gh secret set APPLE_ID
gh secret set APPLE_APP_SPECIFIC_PASSWORD
gh secret set APPLE_TEAM_ID
```

## Testing

### Without Signing (Build Only)
```bash
gh workflow run tauri-release.yml --field skip_signing=true
```

### With Signing (Full Release)
```bash
git tag app-v1.0.0
git push origin app-v1.0.0
```

## Troubleshooting

### "MAC verification failed"
- Verify `APPLE_CERTIFICATE_PASSWORD` is correct

### "Invalid credentials"
- Regenerate `APPLE_APP_SPECIFIC_PASSWORD`

### "Package Invalid"
- Ensure app is signed before notarization
- Check entitlements.plist exists

## Resources

- [Apple Developer ID](https://developer.apple.com/developer-id/)
- [Notarization Guide](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- [Tauri Code Signing](https://tauri.app/v1/guides/distribution/sign-macos)
