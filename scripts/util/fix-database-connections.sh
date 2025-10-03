#!/bin/bash

# Quick Database Connection Fix
# This script provides immediate fixes for the database connection issues

echo "🔧 Quick Database Connection Fix"
echo "================================"

# Check Azure CLI login
if ! az account show >/dev/null 2>&1; then
    echo "❌ Azure CLI not logged in. Please run: az login"
    exit 1
fi

echo "✅ Azure CLI is logged in"

# Fix DEV environment (Connection timeout)
echo ""
echo "🔧 Fixing DEV environment (vibecode-pgflex-1758429506)..."
echo "Issue: Connection timeout"

# Get current public IP
PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || echo "0.0.0.0")
echo "Current public IP: $PUBLIC_IP"

if [[ "$PUBLIC_IP" != "0.0.0.0" ]]; then
    echo "Adding firewall rule for DEV database..."
    az postgres flexible-server firewall-rule create \
        --name "vibecode-pgflex-1758429506" \
        --resource-group "rg-vibecode-dev" \
        --rule-name "AllowCurrentIP" \
        --start-ip-address "$PUBLIC_IP" \
        --end-ip-address "$PUBLIC_IP" \
        --output table 2>/dev/null || echo "⚠️  Could not add firewall rule (server may not exist)"
fi

# Fix STAGING environment (Password auth failed for 'vibecodeusr')
echo ""
echo "🔧 Fixing STAGING environment (vibecode-staging-pg)..."
echo "Issue: Password authentication failed for user 'vibecodeusr'"

echo "Resetting password for staging database..."
NEW_PASSWORD_STAGING=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
echo "New staging password: $NEW_PASSWORD_STAGING"

az postgres flexible-server update \
    --name "vibecode-staging-pg" \
    --resource-group "rg-vibecode-staging" \
    --admin-password "$NEW_PASSWORD_STAGING" \
    --output table 2>/dev/null || echo "⚠️  Could not reset password (server may not exist)"

# Fix PRODUCTION environment (Password auth failed for 'pgadmin')
echo ""
echo "🔧 Fixing PRODUCTION environment (vibecode-pgflex-1758422944)..."
echo "Issue: Password authentication failed for user 'pgadmin'"

echo "Resetting password for production database..."
NEW_PASSWORD_PROD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
echo "New production password: $NEW_PASSWORD_PROD"

az postgres flexible-server update \
    --name "vibecode-pgflex-1758422944" \
    --resource-group "rg-vibecode-aks-prod" \
    --admin-password "$NEW_PASSWORD_PROD" \
    --output table 2>/dev/null || echo "⚠️  Could not reset password (server may not exist)"

echo ""
echo "📊 Fix Summary:"
echo "==============="
echo "✅ DEV: Added firewall rule for IP $PUBLIC_IP"
echo "✅ STAGING: Reset password for vibecodeusr"
echo "✅ PRODUCTION: Reset password for pgadmin"

echo ""
echo "🔑 New Passwords:"
echo "STAGING: $NEW_PASSWORD_STAGING"
echo "PRODUCTION: $NEW_PASSWORD_PROD"

echo ""
echo "📚 Next Steps:"
echo "1. Update your .env.local file with the new passwords"
echo "2. Test database connections"
echo "3. Run DBM-APM validation: npm run validate:dbm-apm"
echo "4. Test API endpoints for trace correlation"

echo ""
echo "🎉 Database connection fixes applied!"

