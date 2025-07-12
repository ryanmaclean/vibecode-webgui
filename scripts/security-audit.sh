#!/bin/bash
# VibeCode Security Audit Script
# Scans the codebase for potential security vulnerabilities

set -e

echo "🔍 VibeCode Security Audit"
echo "=========================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Initialize counters
ISSUES_FOUND=0
WARNINGS_FOUND=0

echo -e "${BLUE}🔑 Scanning for exposed secrets...${NC}"

# Check for potentially exposed API keys and secrets
echo "Checking for exposed secrets in source files..."
EXPOSED_SECRETS=$(grep -r -i --exclude-dir=node_modules --exclude-dir=.git --exclude="*.md" \
   -E "(api[_-]?key|secret|token|password)\s*[:=]\s*[\"'][a-zA-Z0-9_-]{20,}" . 2>/dev/null | \
   grep -v "REPLACE_WITH_" | grep -v "your_.*_here" | grep -v "placeholder" | grep -v ".example" | \
   grep -v "ExistingSecret" | grep -v "secretKeyRef" || true)

if [ -n "$EXPOSED_SECRETS" ]; then
    echo "$EXPOSED_SECRETS"
    echo -e "${RED}❌ Found potential exposed secrets in the above files${NC}"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
else
    echo -e "${GREEN}✅ No exposed secrets found in source files${NC}"
fi

# Check for hardcoded credentials in config files
echo ""
echo "Checking for hardcoded credentials in configuration files..."
HARDCODED_FOUND=false

# Look for specific patterns that should be replaced
while IFS= read -r -d '' file; do
    if grep -q "REPLACE_WITH_" "$file" 2>/dev/null; then
        continue # These are template files with proper placeholders
    fi
    
    if grep -i -E "(password|secret|token|key).*[:=].*[\"'][^\"'REPLACE_WITH_]{10,}" "$file" 2>/dev/null | grep -v -E "(REPLACE_WITH_|template|example)" >/dev/null; then
        echo -e "${YELLOW}⚠️  Potential hardcoded credential in: $file${NC}"
        WARNINGS_FOUND=$((WARNINGS_FOUND + 1))
        HARDCODED_FOUND=true
    fi
done < <(find . -name "*.yaml" -o -name "*.yml" -o -name "*.json" -o -name "*.env*" -print0 2>/dev/null | grep -z -v node_modules)

if [ "$HARDCODED_FOUND" = false ]; then
    echo -e "${GREEN}✅ No hardcoded credentials found${NC}"
fi

echo ""
echo -e "${BLUE}🔒 Checking file permissions...${NC}"

# Check for overly permissive files
PERMS_ISSUE=false
while IFS= read -r -d '' file; do
    if [[ -f "$file" && $(stat -f %A "$file" 2>/dev/null || stat -c %a "$file" 2>/dev/null) =~ ^.{2}[^0-4] ]]; then
        echo -e "${YELLOW}⚠️  Overly permissive file: $file${NC}"
        WARNINGS_FOUND=$((WARNINGS_FOUND + 1))
        PERMS_ISSUE=true
    fi
done < <(find . -name "*.sh" -o -name "*.key" -o -name "*.pem" -print0 2>/dev/null | grep -z -v node_modules)

if [ "$PERMS_ISSUE" = false ]; then
    echo -e "${GREEN}✅ File permissions look secure${NC}"
fi

echo ""
echo -e "${BLUE}📦 Checking dependency security...${NC}"

# Check if npm audit is available and run it
if command -v npm >/dev/null 2>&1 && [ -f package.json ]; then
    echo "Running npm audit..."
    if npm audit --audit-level=moderate >/dev/null 2>&1; then
        echo -e "${GREEN}✅ No critical npm vulnerabilities found${NC}"
    else
        echo -e "${YELLOW}⚠️  npm audit found vulnerabilities - run 'npm audit' for details${NC}"
        WARNINGS_FOUND=$((WARNINGS_FOUND + 1))
    fi
else
    echo -e "${BLUE}ℹ️  Skipping npm audit (npm not available or no package.json)${NC}"
fi

echo ""
echo -e "${BLUE}🔧 Checking .gitignore coverage...${NC}"

# Check if critical files are properly ignored
GITIGNORE_ISSUES=false
CRITICAL_PATTERNS=(".env.local" "*.key" "*.pem" "secrets/" ".datadog/")

for pattern in "${CRITICAL_PATTERNS[@]}"; do
    if ! grep -q "$pattern" .gitignore 2>/dev/null; then
        echo -e "${YELLOW}⚠️  Missing .gitignore pattern: $pattern${NC}"
        WARNINGS_FOUND=$((WARNINGS_FOUND + 1))
        GITIGNORE_ISSUES=true
    fi
done

if [ "$GITIGNORE_ISSUES" = false ]; then
    echo -e "${GREEN}✅ .gitignore properly configured${NC}"
fi

echo ""
echo -e "${BLUE}🔍 Checking for Kubernetes secrets management...${NC}"

# Check if Kubernetes secrets are properly templated
K8S_SECRETS_OK=true
while IFS= read -r -d '' file; do
    if grep -q "kind: Secret" "$file" && ! grep -q "REPLACE_WITH_" "$file" && grep -q "data:" "$file"; then
        if grep -A 10 "data:" "$file" | grep -E "^\s*[^#].*:\s*[a-zA-Z0-9+/=]{20,}\s*$" >/dev/null; then
            echo -e "${RED}❌ Kubernetes secret with hardcoded data in: $file${NC}"
            ISSUES_FOUND=$((ISSUES_FOUND + 1))
            K8S_SECRETS_OK=false
        fi
    fi
done < <(find . -name "*.yaml" -o -name "*.yml" -print0 2>/dev/null | grep -z -v node_modules)

if [ "$K8S_SECRETS_OK" = true ]; then
    echo -e "${GREEN}✅ Kubernetes secrets properly templated${NC}"
fi

echo ""
echo -e "${BLUE}📋 Security Audit Summary${NC}"
echo "========================="

if [ $ISSUES_FOUND -eq 0 ] && [ $WARNINGS_FOUND -eq 0 ]; then
    echo -e "${GREEN}🎉 No security issues found!${NC}"
    exit 0
elif [ $ISSUES_FOUND -eq 0 ]; then
    echo -e "${YELLOW}⚠️  $WARNINGS_FOUND warning(s) found - review recommended${NC}"
    exit 1
else
    echo -e "${RED}❌ $ISSUES_FOUND critical issue(s) and $WARNINGS_FOUND warning(s) found${NC}"
    echo ""
    echo -e "${BLUE}Recommended actions:${NC}"
    echo "1. Replace any hardcoded secrets with environment variables"
    echo "2. Use Kubernetes secrets or external secret management"
    echo "3. Run the security setup script: ./scripts/security-setup.sh"
    echo "4. Review and fix any dependency vulnerabilities: npm audit fix"
    exit 2
fi