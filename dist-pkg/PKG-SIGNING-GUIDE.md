# VibeCode PKG Signing Guide for ARD Deployment

## Overview
For Apple Remote Desktop (ARD) deployment, the PKG needs to be signed with a certificate trusted on both the signing machine and all target machines.

## Current Status
- ✅ **Unsigned PKG Created**: `dist-pkg/VibeCode-1.2.0.pkg` (5.1 MB)
- ⚠️  **Not Signed**: No code signing certificate available

## Option 1: Developer ID Installer Certificate (Recommended)

If you have an Apple Developer account:

```bash
# Sign with Developer ID Installer certificate
productsign --sign "Developer ID Installer: Your Name" \
    dist-pkg/VibeCode-1.2.0.pkg \
    dist-pkg/VibeCode-1.2.0-signed.pkg

# Verify signature
pkgutil --check-signature dist-pkg/VibeCode-1.2.0-signed.pkg
```

## Option 2: Self-Signed Certificate for Internal Deployment

For internal/testing use, create and trust a self-signed certificate:

### Step 1: Create Certificate Authority
```bash
# Generate CA private key
openssl genrsa -out /tmp/VibeCodeCA.key 2048

# Generate CA certificate
openssl req -x509 -new -nodes -key /tmp/VibeCodeCA.key \
    -sha256 -days 1825 -out /tmp/VibeCodeCA.pem \
    -subj "/CN=VibeCode CA/O=VibeCode/C=US"
```

### Step 2: Import CA to Keychain (Signing Machine)
```bash
# Import to system keychain
sudo security add-trusted-cert -d -r trustRoot \
    -k /Library/Keychains/System.keychain /tmp/VibeCodeCA.pem

# Or import to login keychain
security import /tmp/VibeCodeCA.pem -k ~/Library/Keychains/login.keychain-db
```

### Step 3: Create Code Signing Certificate
```bash
# Generate signing key
openssl genrsa -out /tmp/VibeCodeSigning.key 2048

# Create certificate signing request
openssl req -new -key /tmp/VibeCodeSigning.key \
    -out /tmp/VibeCodeSigning.csr \
    -subj "/CN=VibeCode Installer/O=VibeCode/C=US"

# Sign with CA
openssl x509 -req -in /tmp/VibeCodeSigning.csr \
    -CA /tmp/VibeCodeCA.pem -CAkey /tmp/VibeCodeCA.key \
    -CAcreateserial -out /tmp/VibeCodeSigning.crt \
    -days 825 -sha256

# Create PKCS12 bundle
openssl pkcs12 -export -out /tmp/VibeCodeSigning.p12 \
    -inkey /tmp/VibeCodeSigning.key \
    -in /tmp/VibeCodeSigning.crt \
    -password pass:vibecode
```

### Step 4: Import Signing Certificate to Keychain
```bash
# Import to login keychain
security import /tmp/VibeCodeSigning.p12 \
    -k ~/Library/Keychains/login.keychain-db \
    -P vibecode -T /usr/bin/productsign
```

### Step 5: Sign the PKG
```bash
# Sign with self-signed certificate
productsign --sign "VibeCode Installer" \
    dist-pkg/VibeCode-1.2.0.pkg \
    dist-pkg/VibeCode-1.2.0-signed.pkg

# Verify signature
pkgutil --check-signature dist-pkg/VibeCode-1.2.0-signed.pkg
```

### Step 6: Deploy CA Certificate to Target Machines

**Via ARD:**
```bash
# Copy CA certificate to target machines
# Then on each target machine:
sudo security add-trusted-cert -d -r trustRoot \
    -k /Library/Keychains/System.keychain /tmp/VibeCodeCA.pem
```

**Via Configuration Profile:**
Create a configuration profile with the CA certificate and deploy via MDM or ARD.

## Option 3: Unsigned PKG with Manual Trust (Quick Testing)

For quick testing without signing:

```bash
# Install unsigned PKG (requires sudo and -allowUntrusted)
sudo installer -pkg dist-pkg/VibeCode-1.2.0.pkg -target / -allowUntrusted
```

## ARD Deployment Steps

### 1. Prepare Files
```bash
# Files to distribute:
dist-pkg/
├── VibeCode-1.2.0-signed.pkg  # Signed PKG
├── VibeCodeCA.pem              # CA certificate (if self-signed)
└── install-vibecode.sh         # Installation script
```

### 2. Distribute CA Certificate (Self-Signed Only)
```bash
# Via ARD "Copy Items" command:
# 1. Select target Macs
# 2. Copy VibeCodeCA.pem to /tmp/
# 3. Run command:
sudo security add-trusted-cert -d -r trustRoot \
    -k /Library/Keychains/System.keychain /tmp/VibeCodeCA.pem
```

### 3. Install PKG
```bash
# Via ARD "Install Packages" command:
# 1. Select target Macs
# 2. Select VibeCode-1.2.0-signed.pkg
# 3. Click "Install"
```

### 4. Verify Installation
```bash
# Via ARD "Send Unix Command":
ls -la /Applications/VibeCode.app && \
lipo -info /Applications/VibeCode.app/Contents/MacOS/vibecode
```

## Current PKG Information

```
Package: dist-pkg/VibeCode-1.2.0.pkg
Size: 5.1 MB
Status: Not signed
Identifier: com.vibecode.app
Version: 1.2.0
Install Location: /Applications
Architecture: Universal2 (x86_64 + arm64)
```

## Recommendations

1. **For Production**: Use Apple Developer ID Installer certificate
2. **For Internal Testing**: Use self-signed certificate with proper CA trust
3. **For Quick Testing**: Use unsigned PKG with `-allowUntrusted` flag

## Next Steps

Choose one of the options above based on your deployment needs. The self-signed certificate option (Option 2) provides the best balance for internal ARD deployments.
