#!/bin/bash
# Migrate Secrets from .env to macOS Keychain
# Agent 24: macOS Security Engineer

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  VibeCode Secret Migration to Keychain${NC}"
echo -e "${BLUE}  Agent 24: macOS Security Engineer    ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo -e "${RED}❌ Error: This script only runs on macOS${NC}"
    exit 1
fi

# Check if security command is available
if ! command -v security &> /dev/null; then
    echo -e "${RED}❌ Error: 'security' command not found${NC}"
    echo "   This tool is required for Keychain access"
    exit 1
fi

# Check if .env.local exists
if [[ ! -f ".env.local" ]]; then
    echo -e "${YELLOW}⚠️  Warning: .env.local not found${NC}"
    echo "   Looking for .env instead..."

    if [[ ! -f ".env" ]]; then
        echo -e "${RED}❌ Error: No .env file found${NC}"
        echo "   Please create .env.local or .env with your secrets"
        exit 1
    fi

    ENV_FILE=".env"
else
    ENV_FILE=".env.local"
fi

echo -e "${GREEN}✅ Found environment file: ${ENV_FILE}${NC}"
echo ""

# Keychain configuration
KEYCHAIN_SERVICE="com.vibecode.secrets"
KEYCHAIN_ACCESS_GROUP="${TEAM_ID:-}.com.vibecode.shared"

# Secrets to migrate
SECRETS=(
    "NEXTAUTH_SECRET"
    "DATABASE_URL"
    "POSTGRES_URL"
    "OPENAI_API_KEY"
    "ANTHROPIC_API_KEY"
    "CLAUDE_API_KEY"
    "DATADOG_API_KEY"
    "DD_API_KEY"
    "DD_APP_KEY"
    "GITHUB_SECRET"
    "GOOGLE_CLIENT_SECRET"
    "JWT_SECRET"
    "SESSION_SECRET"
    "REDIS_PASSWORD"
    "AZURE_OPENAI_API_KEY"
)

# Function to store secret in Keychain
store_secret() {
    local key="$1"
    local value="$2"

    # Remove existing secret if it exists
    security delete-generic-password \
        -s "$KEYCHAIN_SERVICE" \
        -a "$key" \
        2>/dev/null || true

    # Add new secret
    security add-generic-password \
        -s "$KEYCHAIN_SERVICE" \
        -a "$key" \
        -w "$value" \
        -T "" \
        2>/dev/null

    if [[ $? -eq 0 ]]; then
        echo -e "${GREEN}  ✅ ${key}${NC}"
        return 0
    else
        echo -e "${RED}  ❌ ${key} (failed)${NC}"
        return 1
    fi
}

# Migrate secrets
echo -e "${BLUE}📦 Migrating secrets to Keychain...${NC}"
echo ""

migrated_count=0
failed_count=0

# Source environment file
set -a
source "$ENV_FILE"
set +a

for secret in "${SECRETS[@]}"; do
    # Get value from environment
    value="${!secret:-}"

    if [[ -n "$value" ]]; then
        if store_secret "$secret" "$value"; then
            ((migrated_count++))
        else
            ((failed_count++))
        fi
    else
        echo -e "${YELLOW}  ⏭️  ${secret} (not set, skipping)${NC}"
    fi
done

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ Migration complete!${NC}"
echo -e "   Migrated: ${migrated_count}"
if [[ $failed_count -gt 0 ]]; then
    echo -e "${RED}   Failed: ${failed_count}${NC}"
fi
echo -e "${BLUE}========================================${NC}"
echo ""

# Verification
echo -e "${BLUE}🔍 Verifying Keychain storage...${NC}"
echo ""

verification_passed=0
for secret in "${SECRETS[@]}"; do
    value="${!secret:-}"
    if [[ -n "$value" ]]; then
        stored_value=$(security find-generic-password \
            -s "$KEYCHAIN_SERVICE" \
            -a "$secret" \
            -w 2>/dev/null || echo "")

        if [[ "$stored_value" == "$value" ]]; then
            echo -e "${GREEN}  ✅ ${secret} verified${NC}"
            ((verification_passed++))
        else
            echo -e "${RED}  ❌ ${secret} verification failed${NC}"
        fi
    fi
done

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ Verification complete!${NC}"
echo -e "   Verified: ${verification_passed}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Security reminder
echo -e "${YELLOW}⚠️  Security Reminders:${NC}"
echo "   1. Secrets are now stored in macOS Keychain"
echo "   2. FileVault encryption protects Keychain at rest"
echo "   3. On Apple Silicon Macs, Secure Enclave provides additional protection"
echo "   4. Consider removing secrets from ${ENV_FILE} after migration"
echo "   5. Update application code to use Keychain loader:"
echo "      import { loadSecret } from '@/lib/security/macos-keychain'"
echo ""

# Offer to backup and clear env file
echo -e "${YELLOW}Would you like to backup and clear secrets from ${ENV_FILE}? (y/N)${NC}"
read -r response

if [[ "$response" =~ ^[Yy]$ ]]; then
    backup_file="${ENV_FILE}.backup-$(date +%Y%m%d-%H%M%S)"
    cp "$ENV_FILE" "$backup_file"
    echo -e "${GREEN}✅ Backed up to: ${backup_file}${NC}"

    # Create new env file with non-secret values
    cat > "${ENV_FILE}.new" << 'EOF'
# VibeCode Environment Configuration
# Secrets migrated to macOS Keychain - see scripts/security/migrate-secrets-to-keychain.sh

# Runtime Configuration
NODE_ENV=development
BASE_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000
PORT=3000

# Database (non-sensitive)
DB_POOL_MIN=2
DB_POOL_MAX=10

# Redis (non-sensitive)
REDIS_HOST=localhost
REDIS_PORT=6379

# Monitoring
ENABLE_MONITORING=true
DD_ENV=development
DD_SERVICE=vibecode-webgui

# Note: Sensitive values loaded from Keychain
# To retrieve: loadSecret('NEXTAUTH_SECRET')
EOF

    mv "${ENV_FILE}.new" "$ENV_FILE"
    echo -e "${GREEN}✅ Created new ${ENV_FILE} without secrets${NC}"
    echo -e "${YELLOW}   Original file backed up to: ${backup_file}${NC}"
fi

echo ""
echo -e "${GREEN}✅ Secret migration complete!${NC}"
