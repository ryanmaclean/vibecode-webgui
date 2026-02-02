#!/bin/bash

# Security Secrets Scanner
# Scans for hardcoded secrets, API keys, tokens, and passwords

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPORT_DIR="${PROJECT_ROOT}/security-reports"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="${REPORT_DIR}/secrets-scan-${TIMESTAMP}.txt"

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

mkdir -p "${REPORT_DIR}"

echo -e "${BLUE}=== Secrets Security Scan ===${NC}"
echo "Report: ${REPORT_FILE}"
echo ""

# Initialize report
cat > "${REPORT_FILE}" << EOF
Secrets Security Scan Report
Generated: $(date)
Project: $(basename "${PROJECT_ROOT}")

========================================
SECRETS AND CREDENTIALS SCAN
========================================

EOF

# Secret patterns to scan for (using arrays for compatibility)
SECRET_TYPES=(
    "API_KEY"
    "AWS_KEY"
    "AWS_SECRET"
    "PASSWORD"
    "TOKEN"
    "PRIVATE_KEY"
    "GITHUB_TOKEN"
    "SLACK_TOKEN"
    "GOOGLE_API"
    "DATADOG_API"
    "DATABASE_URL"
    "JWT"
    "CERTIFICATE"
    "SSH_KEY"
)

get_pattern() {
    case "$1" in
        "API_KEY") echo '(api[_-]?key|apikey)\s*[=:]\s*["\047][a-zA-Z0-9_\-]{20,}["\047]' ;;
        "AWS_KEY") echo '(AKIA|ASIA)[A-Z0-9]{16}' ;;
        "AWS_SECRET") echo 'aws[_-]?secret[_-]?access[_-]?key.*[=:]\s*["\047][A-Za-z0-9/\+]{40}["\047]' ;;
        "PASSWORD") echo '(password|passwd|pwd)\s*[=:]\s*["\047][^"\047]{4,}["\047]' ;;
        "TOKEN") echo '(token|bearer|auth[_-]?token)\s*[=:]\s*["\047][a-zA-Z0-9_\-\.]{20,}["\047]' ;;
        "PRIVATE_KEY") echo '-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----' ;;
        "GITHUB_TOKEN") echo 'gh[pousr]_[A-Za-z0-9_]{36,}' ;;
        "SLACK_TOKEN") echo 'xox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24,}' ;;
        "GOOGLE_API") echo 'AIza[0-9A-Za-z_\-]{35}' ;;
        "DATADOG_API") echo '(datadog[_-]?api[_-]?key|dd[_-]?api[_-]?key)\s*[=:]\s*["\047][a-zA-Z0-9]{32,}["\047]' ;;
        "DATABASE_URL") echo '(mysql|postgres|mongodb|redis)://[^:]+:[^@]+@' ;;
        "JWT") echo 'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}' ;;
        "CERTIFICATE") echo '-----BEGIN CERTIFICATE-----' ;;
        "SSH_KEY") echo 'ssh-(rsa|dss|ed25519) AAAA[0-9A-Za-z+/]+' ;;
    esac
}

# Files and directories to exclude from scanning
EXCLUDE_PATTERNS=(
    ".git"
    ".build"
    "node_modules"
    "Pods"
    "*.dmg"
    "*.zip"
    "*.png"
    "*.jpg"
    "*.jpeg"
    "*.pdf"
    "*.o"
    "docs/security"
    "security-reports"
)

# Build exclude arguments for grep
EXCLUDE_ARGS=""
for pattern in "${EXCLUDE_PATTERNS[@]}"; do
    EXCLUDE_ARGS="$EXCLUDE_ARGS --exclude-dir=$pattern --exclude=$pattern"
done

# Function to scan for secret patterns
scan_secrets() {
    echo -e "${BLUE}Scanning for hardcoded secrets...${NC}"
    echo "" >> "${REPORT_FILE}"
    echo "--- Hardcoded Secrets Scan ---" >> "${REPORT_FILE}"

    local total_findings=0

    for secret_type in "${SECRET_TYPES[@]}"; do
        pattern=$(get_pattern "$secret_type")

        echo "Scanning for: ${secret_type}" | tee -a "${REPORT_FILE}"

        # Use grep with Perl regex for better pattern matching
        findings=$(grep -rniPo $EXCLUDE_ARGS "${pattern}" "${PROJECT_ROOT}" 2>/dev/null || true)

        if [ -n "$findings" ]; then
            echo -e "${RED}⚠️  Found potential ${secret_type}:${NC}"
            echo "[CRITICAL] ${secret_type} detected:" >> "${REPORT_FILE}"
            echo "$findings" | while IFS= read -r line; do
                echo "  ${line}" | tee -a "${REPORT_FILE}"
                ((total_findings++))
            done
            echo "" >> "${REPORT_FILE}"
        fi
    done

    if [ $total_findings -eq 0 ]; then
        echo -e "${GREEN}✓ No hardcoded secrets found${NC}"
        echo "[OK] No hardcoded secrets detected" >> "${REPORT_FILE}"
    fi

    echo "" >> "${REPORT_FILE}"
}

# Function to check .gitignore configuration
check_gitignore() {
    echo -e "${BLUE}Checking .gitignore configuration...${NC}"
    echo "" >> "${REPORT_FILE}"
    echo "--- .gitignore Security Check ---" >> "${REPORT_FILE}"

    if [ ! -f "${PROJECT_ROOT}/.gitignore" ]; then
        echo -e "${RED}✗ .gitignore file not found${NC}"
        echo "[CRITICAL] Missing .gitignore file" >> "${REPORT_FILE}"
        return
    fi

    # Critical patterns that should be in .gitignore
    local critical_patterns=(
        "\.env"
        "\.env\.local"
        "\.env\.production"
        "credentials"
        "secrets"
        "*.pem"
        "*.key"
        "*.p12"
        "*.mobileprovision"
    )

    local missing_patterns=()

    for pattern in "${critical_patterns[@]}"; do
        if ! grep -q "$pattern" "${PROJECT_ROOT}/.gitignore"; then
            missing_patterns+=("$pattern")
            echo -e "${YELLOW}[WARNING] .gitignore missing: ${pattern}${NC}"
            echo "[WARNING] .gitignore should include: ${pattern}" >> "${REPORT_FILE}"
        fi
    done

    if [ ${#missing_patterns[@]} -eq 0 ]; then
        echo -e "${GREEN}✓ .gitignore properly configured${NC}"
        echo "[OK] .gitignore includes critical patterns" >> "${REPORT_FILE}"
    fi

    echo "" >> "${REPORT_FILE}"
}

# Function to scan environment files
scan_env_files() {
    echo -e "${BLUE}Scanning environment files...${NC}"
    echo "" >> "${REPORT_FILE}"
    echo "--- Environment Files Scan ---" >> "${REPORT_FILE}"

    local env_files=$(find "${PROJECT_ROOT}" -name ".env*" -not -path "*/\.*" -not -name "*.example" 2>/dev/null || true)

    if [ -n "$env_files" ]; then
        echo -e "${RED}⚠️  Found .env files (should be in .gitignore):${NC}"
        echo "[WARNING] .env files found:" >> "${REPORT_FILE}"
        echo "$env_files" | while IFS= read -r file; do
            echo "  ${file}" | tee -a "${REPORT_FILE}"

            # Check if file is tracked by git
            if git -C "${PROJECT_ROOT}" ls-files --error-unmatch "$file" >/dev/null 2>&1; then
                echo -e "${RED}  ✗ File is tracked by Git!${NC}"
                echo "  [CRITICAL] File is tracked by Git!" >> "${REPORT_FILE}"
            fi
        done
    else
        echo -e "${GREEN}✓ No .env files found${NC}"
        echo "[OK] No .env files detected" >> "${REPORT_FILE}"
    fi

    echo "" >> "${REPORT_FILE}"
}

# Function to scan git history for secrets
scan_git_history() {
    echo -e "${BLUE}Scanning git history for leaked secrets...${NC}"
    echo "" >> "${REPORT_FILE}"
    echo "--- Git History Secrets Scan ---" >> "${REPORT_FILE}"

    if [ ! -d "${PROJECT_ROOT}/.git" ]; then
        echo "Not a git repository - skipping history scan" >> "${REPORT_FILE}"
        return
    fi

    # Check for common secret patterns in git history
    echo "Scanning git log for secret patterns..." >> "${REPORT_FILE}"

    local history_findings=0

    # Scan commit messages for keywords
    local secret_keywords=("password" "token" "api_key" "secret" "credential")

    for keyword in "${secret_keywords[@]}"; do
        findings=$(git -C "${PROJECT_ROOT}" log --all --grep="$keyword" --oneline 2>/dev/null || true)
        if [ -n "$findings" ]; then
            echo -e "${YELLOW}[WARNING] Found '${keyword}' in commit messages:${NC}"
            echo "[WARNING] Keyword '${keyword}' in commit messages:" >> "${REPORT_FILE}"
            echo "$findings" | head -5 >> "${REPORT_FILE}"
            ((history_findings++))
        fi
    done

    if [ $history_findings -eq 0 ]; then
        echo -e "${GREEN}✓ No obvious secrets in git history${NC}"
        echo "[OK] No obvious secrets in commit history" >> "${REPORT_FILE}"
    else
        echo "[INFO] Consider using tools like git-filter-repo to clean history" >> "${REPORT_FILE}"
    fi

    echo "" >> "${REPORT_FILE}"
}

# Function to check for exposed keys in code
check_code_for_keys() {
    echo -e "${BLUE}Checking source code for key material...${NC}"
    echo "" >> "${REPORT_FILE}"
    echo "--- Source Code Key Material Check ---" >> "${REPORT_FILE}"

    # Look for files that might contain keys
    local key_files=$(find "${PROJECT_ROOT}" \( -name "*.pem" -o -name "*.key" -o -name "*.p12" -o -name "*.mobileprovision" \) 2>/dev/null || true)

    if [ -n "$key_files" ]; then
        echo -e "${RED}⚠️  Found key files:${NC}"
        echo "[WARNING] Key files found:" >> "${REPORT_FILE}"
        echo "$key_files" | while IFS= read -r file; do
            echo "  ${file}" | tee -a "${REPORT_FILE}"

            # Check if tracked by git
            if git -C "${PROJECT_ROOT}" ls-files --error-unmatch "$file" >/dev/null 2>&1; then
                echo -e "${RED}  ✗ CRITICAL: Key file is tracked by Git!${NC}"
                echo "  [CRITICAL] Key file tracked by Git!" >> "${REPORT_FILE}"
            fi
        done
    else
        echo -e "${GREEN}✓ No key files found in repository${NC}"
        echo "[OK] No key files in repository" >> "${REPORT_FILE}"
    fi

    echo "" >> "${REPORT_FILE}"
}

# Function to check for Base64 encoded secrets
check_base64_secrets() {
    echo -e "${BLUE}Checking for Base64 encoded secrets...${NC}"
    echo "" >> "${REPORT_FILE}"
    echo "--- Base64 Encoded Secrets Check ---" >> "${REPORT_FILE}"

    # Look for suspicious Base64 strings (long, high entropy)
    local b64_pattern='[A-Za-z0-9+/]{40,}={0,2}'

    findings=$(grep -rnoP $EXCLUDE_ARGS "$b64_pattern" "${PROJECT_ROOT}" 2>/dev/null | head -20 || true)

    if [ -n "$findings" ]; then
        echo -e "${YELLOW}[WARNING] Found potential Base64 encoded data:${NC}"
        echo "[WARNING] Potential Base64 encoded secrets (sample):" >> "${REPORT_FILE}"
        echo "$findings" | head -10 >> "${REPORT_FILE}"
        echo "[INFO] Review these for encoded credentials" >> "${REPORT_FILE}"
    else
        echo "[OK] No suspicious Base64 strings found" >> "${REPORT_FILE}"
    fi

    echo "" >> "${REPORT_FILE}"
}

# Function to generate summary
generate_summary() {
    echo "" >> "${REPORT_FILE}"
    echo "========================================" >> "${REPORT_FILE}"
    echo "SCAN SUMMARY" >> "${REPORT_FILE}"
    echo "========================================" >> "${REPORT_FILE}"

    local critical_issues=$(grep -c "\[CRITICAL\]" "${REPORT_FILE}" || echo "0")
    local warnings=$(grep -c "\[WARNING\]" "${REPORT_FILE}" || echo "0")
    local ok_checks=$(grep -c "\[OK\]" "${REPORT_FILE}" || echo "0")

    echo "Critical Issues: ${critical_issues}" >> "${REPORT_FILE}"
    echo "Warnings: ${warnings}" >> "${REPORT_FILE}"
    echo "Passed Checks: ${ok_checks}" >> "${REPORT_FILE}"
    echo "" >> "${REPORT_FILE}"

    echo "Recommendations:" >> "${REPORT_FILE}"
    echo "1. Use environment variables for sensitive configuration" >> "${REPORT_FILE}"
    echo "2. Use Keychain for storing credentials on macOS" >> "${REPORT_FILE}"
    echo "3. Use .env.example files to document required variables" >> "${REPORT_FILE}"
    echo "4. Rotate any exposed secrets immediately" >> "${REPORT_FILE}"
    echo "5. Use git-secrets or gitleaks as pre-commit hooks" >> "${REPORT_FILE}"
    echo "" >> "${REPORT_FILE}"

    if [ $critical_issues -eq 0 ]; then
        echo "Overall Status: ✓ PASS" >> "${REPORT_FILE}"
        echo -e "${GREEN}✓ No critical secrets found${NC}"
        exit 0
    else
        echo "Overall Status: ✗ FAIL (Critical issues found)" >> "${REPORT_FILE}"
        echo -e "${RED}✗ Critical secrets detected - immediate action required${NC}"
        exit 1
    fi
}

# Main execution
main() {
    scan_secrets
    check_gitignore
    scan_env_files
    scan_git_history
    check_code_for_keys
    check_base64_secrets
    generate_summary

    echo ""
    echo -e "${BLUE}Report saved to: ${REPORT_FILE}${NC}"
}

main
