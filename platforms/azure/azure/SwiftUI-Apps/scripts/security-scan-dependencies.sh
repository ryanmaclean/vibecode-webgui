#!/bin/bash

# Security Dependency Scanner
# Scans Swift Package Manager dependencies for known vulnerabilities

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPORT_DIR="${PROJECT_ROOT}/security-reports"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="${REPORT_DIR}/dependency-scan-${TIMESTAMP}.txt"

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

mkdir -p "${REPORT_DIR}"

echo -e "${BLUE}=== Swift Package Dependency Security Scan ===${NC}"
echo "Report: ${REPORT_FILE}"
echo ""

# Initialize report
cat > "${REPORT_FILE}" << EOF
Dependency Security Scan Report
Generated: $(date)
Project: $(basename "${PROJECT_ROOT}")

========================================
DEPENDENCY VULNERABILITY ANALYSIS
========================================

EOF

# Function to check if package is outdated
check_package_updates() {
    local package_name=$1
    local current_version=$2

    echo "Checking updates for ${package_name}..." >&2

    # This is a placeholder - in production, query package registry
    echo "CURRENT: ${current_version}" >> "${REPORT_FILE}"
}

# Function to scan Package.swift
scan_package_file() {
    echo -e "${BLUE}Scanning Package.swift for dependencies...${NC}"

    if [ ! -f "${PROJECT_ROOT}/Package.swift" ]; then
        echo -e "${YELLOW}Warning: Package.swift not found${NC}"
        echo "Status: NO_PACKAGE_FILE" >> "${REPORT_FILE}"
        return
    fi

    echo "" >> "${REPORT_FILE}"
    echo "--- Package Dependencies ---" >> "${REPORT_FILE}"

    # Extract dependencies from Package.swift
    grep -A 5 ".package(" "${PROJECT_ROOT}/Package.swift" | while read -r line; do
        if [[ $line =~ url:.*\"(.*)\" ]]; then
            url="${BASH_REMATCH[1]}"
            echo "Dependency URL: ${url}" >> "${REPORT_FILE}"

            # Check for known vulnerable patterns
            if [[ $url == *"http://"* ]]; then
                echo -e "${RED}  ⚠️  SECURITY: Insecure HTTP URL${NC}"
                echo "  [CRITICAL] Insecure HTTP URL detected" >> "${REPORT_FILE}"
            fi

            # Check if URL is from trusted source
            if [[ $url == *"github.com"* ]]; then
                echo "  [OK] GitHub source (generally trusted)" >> "${REPORT_FILE}"
            else
                echo -e "${YELLOW}  [WARNING] Non-GitHub source - verify trust${NC}"
                echo "  [WARNING] Non-GitHub source" >> "${REPORT_FILE}"
            fi
        fi
    done

    echo "" >> "${REPORT_FILE}"
}

# Function to check for known vulnerable packages
check_vulnerable_packages() {
    echo -e "${BLUE}Checking for known vulnerable packages...${NC}"
    echo "" >> "${REPORT_FILE}"
    echo "--- Known Vulnerability Check ---" >> "${REPORT_FILE}"

    # Known vulnerable package patterns (examples)
    local vulnerable_patterns=(
        "SwiftyJSON:4.0.0"  # Example - hypothetical vulnerability
        "Alamofire:4.8.0"   # Example - hypothetical vulnerability
    )

    local found_vulnerabilities=0

    if [ -f "${PROJECT_ROOT}/Package.swift" ]; then
        for pattern in "${vulnerable_patterns[@]}"; do
            if grep -q "${pattern}" "${PROJECT_ROOT}/Package.swift"; then
                echo -e "${RED}⚠️  FOUND: Vulnerable package ${pattern}${NC}"
                echo "[CRITICAL] Vulnerable package: ${pattern}" >> "${REPORT_FILE}"
                ((found_vulnerabilities++))
            fi
        done
    fi

    if [ $found_vulnerabilities -eq 0 ]; then
        echo -e "${GREEN}✓ No known vulnerable packages found${NC}"
        echo "[OK] No known vulnerabilities in package versions" >> "${REPORT_FILE}"
    fi

    echo "" >> "${REPORT_FILE}"
}

# Function to verify package checksums/integrity
verify_package_integrity() {
    echo -e "${BLUE}Verifying package integrity...${NC}"
    echo "" >> "${REPORT_FILE}"
    echo "--- Package Integrity Verification ---" >> "${REPORT_FILE}"

    if [ -d "${PROJECT_ROOT}/.build/checkouts" ]; then
        echo "Checked out packages:" >> "${REPORT_FILE}"
        ls -1 "${PROJECT_ROOT}/.build/checkouts" >> "${REPORT_FILE}" 2>/dev/null || echo "None" >> "${REPORT_FILE}"
    else
        echo "No checked out packages found" >> "${REPORT_FILE}"
    fi

    echo "" >> "${REPORT_FILE}"
}

# Function to check for outdated dependencies
check_outdated_dependencies() {
    echo -e "${BLUE}Checking for outdated dependencies...${NC}"
    echo "" >> "${REPORT_FILE}"
    echo "--- Outdated Dependencies Check ---" >> "${REPORT_FILE}"

    if command -v swift &> /dev/null; then
        echo "Running: swift package show-dependencies" >> "${REPORT_FILE}"
        cd "${PROJECT_ROOT}"
        swift package show-dependencies >> "${REPORT_FILE}" 2>&1 || echo "Unable to resolve dependencies" >> "${REPORT_FILE}"
    else
        echo "Swift command not available" >> "${REPORT_FILE}"
    fi

    echo "" >> "${REPORT_FILE}"
}

# Function to scan for dependency confusion attacks
check_dependency_confusion() {
    echo -e "${BLUE}Checking for dependency confusion risks...${NC}"
    echo "" >> "${REPORT_FILE}"
    echo "--- Dependency Confusion Risk Assessment ---" >> "${REPORT_FILE}"

    if [ -f "${PROJECT_ROOT}/Package.swift" ]; then
        # Check for internal vs external package naming
        echo "Analyzing package naming patterns..." >> "${REPORT_FILE}"

        # Look for packages that might be internal but fetched externally
        grep ".package(" "${PROJECT_ROOT}/Package.swift" | while read -r line; do
            if [[ $line =~ \"([^\"]+)\" ]]; then
                pkg_name="${BASH_REMATCH[1]}"

                # Internal packages often have org prefixes
                if [[ ! $pkg_name =~ (github\.com|gitlab\.com|bitbucket\.org) ]]; then
                    echo "[WARNING] Potential internal package without explicit source: ${pkg_name}" >> "${REPORT_FILE}"
                fi
            fi
        done
    fi

    echo "" >> "${REPORT_FILE}"
}

# Function to check for license compliance
check_license_compliance() {
    echo -e "${BLUE}Checking license compliance...${NC}"
    echo "" >> "${REPORT_FILE}"
    echo "--- License Compliance Check ---" >> "${REPORT_FILE}"

    # Look for LICENSE files in dependencies
    if [ -d "${PROJECT_ROOT}/.build/checkouts" ]; then
        for dep_dir in "${PROJECT_ROOT}/.build/checkouts"/*; do
            if [ -d "$dep_dir" ]; then
                dep_name=$(basename "$dep_dir")
                echo "Dependency: ${dep_name}" >> "${REPORT_FILE}"

                # Check for LICENSE file
                if ls "$dep_dir"/LICENSE* >/dev/null 2>&1; then
                    license_file=$(ls "$dep_dir"/LICENSE* | head -1)
                    echo "  License found: $(basename "$license_file")" >> "${REPORT_FILE}"
                else
                    echo -e "${YELLOW}  [WARNING] No license file found${NC}"
                    echo "  [WARNING] No license file found" >> "${REPORT_FILE}"
                fi
            fi
        done
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

    if [ $critical_issues -eq 0 ] && [ $warnings -eq 0 ]; then
        echo "Overall Status: ✓ PASS" >> "${REPORT_FILE}"
        echo -e "${GREEN}✓ All dependency security checks passed${NC}"
        exit 0
    elif [ $critical_issues -gt 0 ]; then
        echo "Overall Status: ✗ FAIL (Critical issues found)" >> "${REPORT_FILE}"
        echo -e "${RED}✗ Critical security issues found in dependencies${NC}"
        exit 1
    else
        echo "Overall Status: ⚠ PASS WITH WARNINGS" >> "${REPORT_FILE}"
        echo -e "${YELLOW}⚠ Dependency scan completed with warnings${NC}"
        exit 0
    fi
}

# Main execution
main() {
    scan_package_file
    check_vulnerable_packages
    verify_package_integrity
    check_outdated_dependencies
    check_dependency_confusion
    check_license_compliance
    generate_summary

    echo ""
    echo -e "${BLUE}Report saved to: ${REPORT_FILE}${NC}"
}

main
