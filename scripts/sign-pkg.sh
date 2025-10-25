#!/bin/bash

# VibeCode PKG Signing Script
# Creates self-signed certificate and signs PKG for ARD deployment

set -e

echo "🔐 VibeCode PKG Signing for ARD Deployment"
echo "=========================================="
echo ""

# Configuration
PKG_FILE="dist-pkg/VibeCode-1.2.0.pkg"
SIGNED_PKG="dist-pkg/VibeCode-1.2.0-signed.pkg"
CERT_DIR="/tmp/vibecode-certs"
CA_NAME="VibeCode CA"
CERT_NAME="VibeCode Installer"

# Check if PKG exists
if [ ! -f "$PKG_FILE" ]; then
    echo "❌ Error: $PKG_FILE not found!"
    echo "Run ./scripts/build-pkg-simple.sh first"
    exit 1
fi

# Create certificate directory
mkdir -p "$CERT_DIR"

echo "📋 Step 1: Creating Certificate Authority..."
# Generate CA private key
openssl genrsa -out "$CERT_DIR/VibeCodeCA.key" 2048 2>/dev/null

# Generate CA certificate
openssl req -x509 -new -nodes -key "$CERT_DIR/VibeCodeCA.key" \
    -sha256 -days 1825 -out "$CERT_DIR/VibeCodeCA.pem" \
    -subj "/CN=$CA_NAME/O=VibeCode/C=US" 2>/dev/null

echo "✅ CA certificate created: $CERT_DIR/VibeCodeCA.pem"

echo ""
echo "📋 Step 2: Creating Code Signing Certificate..."
# Generate signing key
openssl genrsa -out "$CERT_DIR/VibeCodeSigning.key" 2048 2>/dev/null

# Create certificate signing request
openssl req -new -key "$CERT_DIR/VibeCodeSigning.key" \
    -out "$CERT_DIR/VibeCodeSigning.csr" \
    -subj "/CN=$CERT_NAME/O=VibeCode/C=US" 2>/dev/null

# Sign with CA
openssl x509 -req -in "$CERT_DIR/VibeCodeSigning.csr" \
    -CA "$CERT_DIR/VibeCodeCA.pem" -CAkey "$CERT_DIR/VibeCodeCA.key" \
    -CAcreateserial -out "$CERT_DIR/VibeCodeSigning.crt" \
    -days 825 -sha256 2>/dev/null

# Create PKCS12 bundle
openssl pkcs12 -export -out "$CERT_DIR/VibeCodeSigning.p12" \
    -inkey "$CERT_DIR/VibeCodeSigning.key" \
    -in "$CERT_DIR/VibeCodeSigning.crt" \
    -password pass:vibecode 2>/dev/null

echo "✅ Signing certificate created: $CERT_DIR/VibeCodeSigning.p12"

echo ""
echo "📋 Step 3: Importing CA to System Keychain..."
# Import CA to system keychain (requires sudo)
if sudo security add-trusted-cert -d -r trustRoot \
    -k /Library/Keychains/System.keychain "$CERT_DIR/VibeCodeCA.pem" 2>/dev/null; then
    echo "✅ CA certificate imported to system keychain"
else
    echo "⚠️  Could not import CA to system keychain (requires admin)"
    echo "   Manual import: sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain $CERT_DIR/VibeCodeCA.pem"
fi

echo ""
echo "📋 Step 4: Importing Signing Certificate to Login Keychain..."
# Import signing certificate to login keychain
security import "$CERT_DIR/VibeCodeSigning.p12" \
    -k ~/Library/Keychains/login.keychain-db \
    -P vibecode -T /usr/bin/productsign 2>/dev/null || true

echo "✅ Signing certificate imported to login keychain"

echo ""
echo "📋 Step 5: Signing PKG..."
# Sign the PKG
if productsign --sign "$CERT_NAME" "$PKG_FILE" "$SIGNED_PKG" 2>/dev/null; then
    echo "✅ PKG signed successfully: $SIGNED_PKG"
else
    echo "❌ Failed to sign PKG"
    echo "   Available identities:"
    security find-identity -v -p codesigning
    exit 1
fi

echo ""
echo "📋 Step 6: Verifying Signature..."
pkgutil --check-signature "$SIGNED_PKG"

echo ""
echo "📦 Creating ARD Deployment Package..."
# Copy CA certificate to dist-pkg
cp "$CERT_DIR/VibeCodeCA.pem" dist-pkg/

# Create ARD deployment script
cat > dist-pkg/deploy-to-remote-macs.sh << 'EOFSCRIPT'
#!/bin/bash

# VibeCode ARD Deployment Script
# Run this on each target Mac to trust the certificate and install VibeCode

set -e

echo "🚀 VibeCode ARD Deployment"
echo "=========================="

# Step 1: Install CA certificate
if [ -f "VibeCodeCA.pem" ]; then
    echo "📋 Installing CA certificate..."
    sudo security add-trusted-cert -d -r trustRoot \
        -k /Library/Keychains/System.keychain VibeCodeCA.pem
    echo "✅ CA certificate trusted"
else
    echo "⚠️  VibeCodeCA.pem not found - skipping CA trust"
fi

# Step 2: Install PKG
if [ -f "VibeCode-1.2.0-signed.pkg" ]; then
    echo "📦 Installing VibeCode..."
    sudo installer -pkg VibeCode-1.2.0-signed.pkg -target /
    echo "✅ VibeCode installed"
else
    echo "❌ VibeCode-1.2.0-signed.pkg not found"
    exit 1
fi

# Step 3: Verify installation
if [ -d "/Applications/VibeCode.app" ]; then
    echo ""
    echo "🎉 Installation Complete!"
    echo "📍 Location: /Applications/VibeCode.app"
    echo "🏗️  Architecture: $(lipo -info /Applications/VibeCode.app/Contents/MacOS/vibecode 2>/dev/null)"
else
    echo "❌ Installation verification failed"
    exit 1
fi
EOFSCRIPT

chmod +x dist-pkg/deploy-to-remote-macs.sh

echo ""
echo "✅ PKG Signing Complete!"
echo "========================"
echo ""
echo "📦 Files ready for ARD deployment:"
echo "   • $SIGNED_PKG (signed PKG)"
echo "   • dist-pkg/VibeCodeCA.pem (CA certificate)"
echo "   • dist-pkg/deploy-to-remote-macs.sh (deployment script)"
echo ""
echo "📖 Next steps:"
echo "   1. Copy these files to target Macs via ARD"
echo "   2. Run deploy-to-remote-macs.sh on each Mac"
echo "   3. Or see dist-pkg/PKG-SIGNING-GUIDE.md for manual steps"
echo ""
echo "🔐 Certificate Details:"
echo "   CA: $CERT_DIR/VibeCodeCA.pem"
echo "   Signing Cert: $CERT_DIR/VibeCodeSigning.p12 (password: vibecode)"
echo ""
