#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Verify all recommended extensions exist on Open VSX
# Part of VibeCode security hardening

# Initialize log aggregation
init_log_aggregation


set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PRODUCT_JSON="docs/product.json.template"
MISSING=()
VERIFIED=()
WARNINGS=()

echo "========================================="
echo "VibeCode Extension Security Verification"
echo "========================================="
echo ""
echo "Checking extensions against Open VSX registry..."
echo ""

# Extract extension IDs from product.json
if [ ! -f "$PRODUCT_JSON" ]; then
    echo -e "${RED}Error: $PRODUCT_JSON not found${NC}"
    exit 1
fi

# Get extensionRecommendations
EXTENSIONS=$(jq -r '.extensionRecommendations | keys[]' "$PRODUCT_JSON" 2>/dev/null || echo "")

if [ -z "$EXTENSIONS" ]; then
    echo -e "${YELLOW}No extension recommendations found${NC}"
    exit 0
fi

# Check each extension
for ext in $EXTENSIONS; do
    publisher="${ext%.*}"
    name="${ext#*.}"

    echo -n "Checking ${ext}... "

    # Query Open VSX API
    response=$(curl -s "https://open-vsx.org/api/$publisher/$name" 2>/dev/null || echo '{"error": "network error"}')

    if echo "$response" | jq -e '.error' > /dev/null 2>&1; then
        error_msg=$(echo "$response" | jq -r '.error')
        echo -e "${RED}❌ NOT FOUND${NC}"
        echo "   Error: $error_msg"
        MISSING+=("$ext")
    else
        version=$(echo "$response" | jq -r '.version // "unknown"')
        verified=$(echo "$response" | jq -r '.verified // false')
        namespace=$(echo "$response" | jq -r '.namespace // "unknown"')
        downloads=$(echo "$response" | jq -r '.downloadCount // 0')

        if [ "$verified" = "true" ]; then
            echo -e "${GREEN}✅ v$version${NC} (verified, $downloads downloads)"
            VERIFIED+=("$ext")
        else
            echo -e "${YELLOW}⚠️  v$version${NC} (unverified, $downloads downloads)"
            VERIFIED+=("$ext")
            WARNINGS+=("$ext - unverified publisher")
        fi
    fi

    # Rate limiting - be nice to Open VSX
    sleep 0.5
done

# Also check language extension tips
echo ""
echo "Checking language extension tips..."
echo ""

LANG_EXTS=$(jq -r '.languageExtensionTips[]?' "$PRODUCT_JSON" 2>/dev/null || echo "")

for ext in $LANG_EXTS; do
    # Skip if already checked
    if [[ " ${EXTENSIONS[@]} " =~ " ${ext} " ]]; then
        continue
    fi

    publisher="${ext%.*}"
    name="${ext#*.}"

    echo -n "Checking ${ext}... "

    response=$(curl -s "https://open-vsx.org/api/$publisher/$name" 2>/dev/null || echo '{"error": "network error"}')

    if echo "$response" | jq -e '.error' > /dev/null 2>&1; then
        echo -e "${RED}❌ NOT FOUND${NC}"
        MISSING+=("$ext")
    else
        version=$(echo "$response" | jq -r '.version // "unknown"')
        verified=$(echo "$response" | jq -r '.verified // false')

        if [ "$verified" = "true" ]; then
            echo -e "${GREEN}✅ v$version${NC}"
            VERIFIED+=("$ext")
        else
            echo -e "${YELLOW}⚠️  v$version${NC}"
            VERIFIED+=("$ext")
            WARNINGS+=("$ext - unverified publisher")
        fi
    fi

    sleep 0.5
done

# Summary
echo ""
echo "========================================="
echo "Verification Summary"
echo "========================================="
echo ""
echo "Total checked: $((${#VERIFIED[@]} + ${#MISSING[@]}))"
echo -e "${GREEN}Verified: ${#VERIFIED[@]}${NC}"
echo -e "${RED}Missing: ${#MISSING[@]}${NC}"
echo -e "${YELLOW}Warnings: ${#WARNINGS[@]}${NC}"

# Details
if [ ${#MISSING[@]} -gt 0 ]; then
    echo ""
    echo -e "${RED}❌ MISSING EXTENSIONS (CRITICAL SECURITY RISK):${NC}"
    printf '   - %s\n' "${MISSING[@]}"
    echo ""
    echo "   These extensions do NOT exist on Open VSX and create"
    echo "   a supply chain attack vector. Attackers can register"
    echo "   these namespaces and distribute malicious code."
    echo ""
    echo "   ACTION REQUIRED: Remove from product.json.template"
fi

if [ ${#WARNINGS[@]} -gt 0 ]; then
    echo ""
    echo -e "${YELLOW}⚠️  WARNINGS (UNVERIFIED PUBLISHERS):${NC}"
    printf '   - %s\n' "${WARNINGS[@]}"
    echo ""
    echo "   These extensions exist but are not from verified"
    echo "   publishers. Verify authenticity before use."
fi

echo ""

# Exit with error if critical issues found
if [ ${#MISSING[@]} -gt 0 ]; then
    echo -e "${RED}FAIL: Critical security issues found${NC}"
    exit 1
fi

if [ ${#WARNINGS[@]} -gt 0 ]; then
    echo -e "${YELLOW}PASS: All extensions exist, but some warnings${NC}"
    exit 0
fi

echo -e "${GREEN}✅ SUCCESS: All extensions verified${NC}"
exit 0
