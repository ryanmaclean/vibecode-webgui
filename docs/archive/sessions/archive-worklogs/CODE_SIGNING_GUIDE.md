# Code Signing Configuration for VibeCode Desktop

## Overview
This document outlines the code signing setup for the VibeCode desktop application using Apple Developer certificates and notarization.

## Required GitHub Secrets

The following secrets must be configured in the GitHub repository settings:

### Apple Developer Certificate
- `APPLE_CERTIFICATE_BASE64`: Base64-encoded .p12 certificate file
- `APPLE_CERTIFICATE_PASSWORD`: Password for the .p12 certificate
- `APPLE_SIGNING_IDENTITY`: Full certificate name (e.g., "Developer ID Application: Your Name (TEAM_ID)")

### Apple ID for Notarization
- `APPLE_ID`: Apple ID email address
- `APPLE_APP_SPECIFIC_PASSWORD`: App-specific password for notarization
- `APPLE_TEAM_ID`: Apple Developer Team ID

### Keychain Management
- `KEYCHAIN_PASSWORD`: Temporary keychain password for build process

### Tauri Signing (Optional)
- `TAURI_PRIVATE_KEY`: Tauri private key for app signing
- `TAURI_KEY_PASSWORD`: Password for Tauri private key

## Setup Instructions

### 1. Apple Developer Account Setup
1. Enroll in Apple Developer Program ($99/year)
2. Create a "Developer ID Application" certificate
3. Export the certificate as a .p12 file with a password

### 2. App-Specific Password
1. Go to [appleid.apple.com](https://appleid.apple.com)
2. Sign in with your Apple ID
3. Generate an app-specific password for notarization

### 3. GitHub Secrets Configuration
1. Go to repository Settings → Secrets and variables → Actions
2. Add each secret listed above with the appropriate values

### 4. Certificate Encoding
```bash
# Convert .p12 certificate to base64
base64 -i YourCertificate.p12 -o certificate_base64.txt
# Copy the content to APPLE_CERTIFICATE_BASE64 secret
```

## Workflow Triggers

The code signing workflow is triggered by:
- **Release tags**: `app-v*` (e.g., `app-v1.0.0`)
- **Manual dispatch**: Via GitHub Actions UI with optional skip_signing parameter
- **Pull requests**: For testing (without signing)

## Signing Process

1. **Certificate Import**: Creates temporary keychain and imports certificate
2. **Application Signing**: Signs the .app bundle with entitlements
3. **DMG Creation**: Creates DMG installer package
4. **DMG Signing**: Signs the DMG package
5. **Notarization**: Submits DMG to Apple for notarization
6. **Stapling**: Attaches notarization ticket to DMG

## Verification

After signing, the workflow verifies:
- Application signature validity
- DMG signature validity
- Notarization status
- Gatekeeper assessment

## Troubleshooting

### Common Issues
1. **Certificate expired**: Renew certificate in Apple Developer portal
2. **Wrong Team ID**: Verify APPLE_TEAM_ID matches your certificate
3. **Notarization failed**: Check APPLE_ID and app-specific password
4. **Entitlements mismatch**: Ensure entitlements.plist matches app requirements

### Manual Verification
```bash
# Verify app signature
codesign --verify --deep --strict --verbose=2 VibeCode.app

# Check notarization
xcrun stapler validate VibeCode.dmg

# Gatekeeper assessment
spctl --assess --type open --context context:primary-signature --verbose=4 VibeCode.dmg
```

## Security Considerations

- Never commit certificates or private keys to the repository
- Use GitHub Secrets for all sensitive information
- Rotate certificates before expiration
- Monitor Apple Developer account for any issues

## Cost Considerations

- Apple Developer Program: $99/year
- Notarization: Free (included with Developer Program)
- GitHub Actions: Free for public repositories, usage-based for private

## Next Steps

1. Configure all required GitHub secrets
2. Test the workflow with a manual dispatch
3. Create a release tag to trigger full signing and notarization
4. Verify the signed DMG works on clean macOS systems
