#!/bin/bash

# VibeCode Remote Mac Test Deployment Script
# Tests unsigned PKG on remote Macs and handles password revocation

set -e

echo "🚀 VibeCode Remote Mac Test Deployment"
echo "======================================"
echo ""

# Configuration
PKG_FILE="dist-pkg/VibeCode-1.2.0.pkg"
LOG_FILE="/tmp/vibecode-remote-test.log"
TEST_HOSTS=("mac1.local" "mac2.local" "mac3.local")  # Add your remote Mac hostnames/IPs

# Check if PKG exists
if [ ! -f "$PKG_FILE" ]; then
    echo "❌ Error: $PKG_FILE not found!"
    echo "Run PKG build first"
    exit 1
fi

echo "📦 PKG Information:"
echo "   File: $PKG_FILE"
echo "   Size: $(du -h "$PKG_FILE" | cut -f1)"
echo "   Status: $(pkgutil --check-signature "$PKG_FILE" 2>/dev/null || echo "Not signed")"
echo ""

# Function to test PKG on remote Mac
test_remote_mac() {
    local host=$1
    echo "🖥️  Testing on $host..."
    
    # Copy PKG to remote Mac
    echo "   📤 Copying PKG to $host..."
    if scp "$PKG_FILE" "admin@$host:/tmp/" 2>/dev/null; then
        echo "   ✅ PKG copied successfully"
    else
        echo "   ❌ Failed to copy PKG to $host"
        return 1
    fi
    
    # Test installation on remote Mac
    echo "   📦 Testing installation on $host..."
    ssh "admin@$host" << 'EOF'
        set -e
        PKG_FILE="/tmp/VibeCode-1.2.0.pkg"
        LOG_FILE="/tmp/vibecode-install-test.log"
        
        echo "🚀 Testing VibeCode installation on $(hostname)..." | tee "$LOG_FILE"
        echo "Date: $(date)" | tee -a "$LOG_FILE"
        echo "User: $(whoami)" | tee -a "$LOG_FILE"
        echo "OS: $(sw_vers -productName) $(sw_vers -productVersion)" | tee -a "$LOG_FILE"
        
        # Check if PKG exists
        if [ ! -f "$PKG_FILE" ]; then
            echo "❌ Error: $PKG_FILE not found!" | tee -a "$LOG_FILE"
            exit 1
        fi
        
        # Try to install with -allowUntrusted (for unsigned PKG)
        echo "📦 Installing VibeCode package (unsigned)..." | tee -a "$LOG_FILE"
        if sudo installer -pkg "$PKG_FILE" -target / -allowUntrusted 2>&1 | tee -a "$LOG_FILE"; then
            echo "✅ Installation successful!" | tee -a "$LOG_FILE"
        else
            echo "❌ Installation failed!" | tee -a "$LOG_FILE"
            exit 1
        fi
        
        # Verify installation
        if [ -d "/Applications/VibeCode.app" ]; then
            echo "✅ VibeCode installed successfully!" | tee -a "$LOG_FILE"
            echo "📍 Location: /Applications/VibeCode.app" | tee -a "$LOG_FILE"
            
            # Get app info
            APP_VERSION=$(defaults read /Applications/VibeCode.app/Contents/Info.plist CFBundleShortVersionString 2>/dev/null || echo "Unknown")
            echo "📋 Version: $APP_VERSION" | tee -a "$LOG_FILE"
            
            # Check architectures
            ARCHS=$(lipo -info /Applications/VibeCode.app/Contents/MacOS/vibecode 2>/dev/null || echo "Unknown")
            echo "🏗️  Architectures: $ARCHS" | tee -a "$LOG_FILE"
            
            # Test launching
            echo "🚀 Testing app launch..." | tee -a "$LOG_FILE"
            if open /Applications/VibeCode.app 2>&1 | tee -a "$LOG_FILE"; then
                echo "✅ App launched successfully!" | tee -a "$LOG_FILE"
            else
                echo "⚠️  App launch failed" | tee -a "$LOG_FILE"
            fi
            
        else
            echo "❌ Installation verification failed!" | tee -a "$LOG_FILE"
            exit 1
        fi
        
        echo "🎉 Test complete on $(hostname)!" | tee -a "$LOG_FILE"
EOF
    
    if [ $? -eq 0 ]; then
        echo "   ✅ Test successful on $host"
    else
        echo "   ❌ Test failed on $host"
        return 1
    fi
}

# Function to revoke password if wrong
revoke_password() {
    local host=$1
    echo "🔐 Revoking password on $host..."
    
    ssh "admin@$host" << 'EOF'
        # Revoke password (set to empty)
        sudo dscl . -passwd /Users/admin ""
        echo "✅ Password revoked on $(hostname)"
EOF
}

# Function to set new password
set_password() {
    local host=$1
    local new_password=$2
    echo "🔐 Setting new password on $host..."
    
    ssh "admin@$host" << EOF
        # Set new password
        echo "admin:$new_password" | sudo chpasswd
        echo "✅ Password set on $(hostname)"
EOF
}

# Main test loop
echo "🧪 Starting remote Mac tests..."
echo ""

SUCCESS_COUNT=0
TOTAL_COUNT=${#TEST_HOSTS[@]}

for host in "${TEST_HOSTS[@]}"; do
    echo "Testing $host..."
    
    # Test connection first
    if ssh -o ConnectTimeout=5 "admin@$host" "echo 'Connection OK'" 2>/dev/null; then
        echo "   ✅ Connection successful"
        
        # Test PKG installation
        if test_remote_mac "$host"; then
            ((SUCCESS_COUNT++))
            echo "   ✅ Test passed"
        else
            echo "   ❌ Test failed"
            
            # Ask if we should revoke password
            echo "   🔐 Would you like to revoke the password on $host? (y/n)"
            read -r response
            if [[ "$response" =~ ^[Yy]$ ]]; then
                revoke_password "$host"
                
                # Ask for new password
                echo "   🔐 Enter new password for $host:"
                read -s new_password
                set_password "$host" "$new_password"
            fi
        fi
    else
        echo "   ❌ Connection failed to $host"
    fi
    
    echo ""
done

# Summary
echo "📊 Test Summary"
echo "==============="
echo "Total hosts: $TOTAL_COUNT"
echo "Successful: $SUCCESS_COUNT"
echo "Failed: $((TOTAL_COUNT - SUCCESS_COUNT))"

if [ $SUCCESS_COUNT -eq $TOTAL_COUNT ]; then
    echo "🎉 All tests passed! PKG is ready for ARD deployment."
else
    echo "⚠️  Some tests failed. Check logs and fix issues before ARD deployment."
fi

echo ""
echo "📁 Log files available on each remote Mac:"
echo "   /tmp/vibecode-install-test.log"
echo ""
echo "📦 PKG ready for ARD deployment:"
echo "   $PKG_FILE"
echo "   Size: $(du -h "$PKG_FILE" | cut -f1)"
echo "   Status: Unsigned (use -allowUntrusted flag)"
