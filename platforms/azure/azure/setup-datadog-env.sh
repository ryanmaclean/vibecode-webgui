#!/bin/bash

# Setup Datadog environment for VibeCode VMs
# This script configures environment variables for passing Datadog API keys to VMs
#
# Usage:
#   ./setup-datadog-env.sh
#   (then enter your Datadog API key when prompted)
#
# Or with environment variable:
#   DD_API_KEY="your_key_here" ./setup-datadog-env.sh

set -e

echo "=================================================="
echo "VibeCode Datadog Environment Configuration"
echo "=================================================="
echo ""

# Check if DD_API_KEY is already set
if [ -z "$DD_API_KEY" ]; then
    echo "DD_API_KEY not found in environment."
    echo ""
    echo "To set up Datadog integration, please provide your API key:"
    echo "(Get it from: https://app.datadoghq.com/organization/settings/api-keys)"
    echo ""
    read -sp "Enter your Datadog API key: " DD_API_KEY
    echo ""
else
    echo "Using DD_API_KEY from environment (${DD_API_KEY:0:8}...)"
fi

# Validate key format (32 hex characters or similar length)
if ! [[ "$DD_API_KEY" =~ ^[0-9a-f]{32,}$ ]]; then
    echo "⚠️  WARNING: DD_API_KEY format seems incorrect"
    echo "Expected: 32+ hexadecimal characters"
    echo "Provided: ${DD_API_KEY}"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Cancelled."
        exit 1
    fi
fi

# Set DD_SITE if not already set
if [ -z "$DD_SITE" ]; then
    DD_SITE="datadoghq.com"
fi

echo ""
echo "Configuration:"
echo "  DD_API_KEY: ${DD_API_KEY:0:8}... (hidden)"
echo "  DD_SITE: $DD_SITE"
echo ""

# Option 1: Save to shell config file
echo "Where would you like to save this configuration?"
echo "1) ~/.zshrc (recommended for zsh users)"
echo "2) ~/.bashrc (recommended for bash users)"
echo "3) ~/.datadog/api_key (file-based storage)"
echo "4) Skip saving to file (env var only)"
echo ""
read -p "Enter choice (1-4): " choice

case $choice in
    1)
        echo "Saving to ~/.zshrc..."
        cat >> ~/.zshrc << EOF

# VibeCode Datadog Configuration (set $(date +%Y-%m-%d))
export DD_API_KEY="$DD_API_KEY"
export DD_SITE="$DD_SITE"
EOF
        echo "✅ Added to ~/.zshrc"
        echo ""
        echo "To load immediately, run:"
        echo "  source ~/.zshrc"
        ;;
    2)
        echo "Saving to ~/.bashrc..."
        cat >> ~/.bashrc << EOF

# VibeCode Datadog Configuration (set $(date +%Y-%m-%d))
export DD_API_KEY="$DD_API_KEY"
export DD_SITE="$DD_SITE"
EOF
        echo "✅ Added to ~/.bashrc"
        echo ""
        echo "To load immediately, run:"
        echo "  source ~/.bashrc"
        ;;
    3)
        echo "Saving to ~/.datadog/api_key..."
        mkdir -p ~/.datadog
        echo "$DD_API_KEY" > ~/.datadog/api_key
        chmod 600 ~/.datadog/api_key
        echo "✅ Saved to ~/.datadog/api_key (permissions: 600)"
        echo ""
        echo "Note: BaseVMManager will automatically read from this file"
        ;;
    4)
        echo "Skipping file save."
        echo "⚠️  Configuration will be lost when terminal closes"
        ;;
    *)
        echo "Invalid choice"
        exit 1
        ;;
esac

# Set variables in current shell
export DD_API_KEY="$DD_API_KEY"
export DD_SITE="$DD_SITE"

echo ""
echo "=================================================="
echo "Current Session Configuration"
echo "=================================================="
echo "Export in current session:"
echo "  export DD_API_KEY=\"$DD_API_KEY\""
echo "  export DD_SITE=\"$DD_SITE\""
echo ""
echo "These VMs will now receive Datadog configuration:"
echo "  • BasicVibeCodeApp"
echo "  • LiquidGlassVibeCodeApp"
echo "  • NetworkTestVibeCodeApp"
echo "  • VsockVibeCodeApp"
echo ""
echo "Configuration method: Kernel command line"
echo "Security level: DEVELOPMENT (visible in /proc/cmdline)"
echo ""
echo "✅ Setup complete!"
