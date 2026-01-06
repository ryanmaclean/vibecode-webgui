#!/bin/bash

# Code Signing Verification Script
# Verifies digital signatures, entitlements, and code signing integrity

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPORT_DIR="${PROJECT_ROOT}/security-reports"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="${REPORT_DIR}/code-signing-${TIMESTAMP}.txt"

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

mkdir -p "${REPORT_DIR}"

echo -e "${BLUE}=== Code Signing Verification ===${NC}"
echo "Report: ${REPORT_FILE}"
echo ""

# Initialize report
cat > "${REPORT_FILE}" << EOF
Code Signing Verification Report
Generated: $(date)
Project: $(basename "${PROJECT_ROOT}")

========================================
CODE SIGNING AND INTEGRITY VERIFICATION
========================================

EOF

# Function to verify executable signatures
verify_executables() {
    echo -e "${BLUE}Verifying executable signatures...${NC}"
    echo "" >> "${REPORT_FILE}"
    echo "--- Executable Signature Verification ---" >> "${REPORT_FILE}"

    # Find all executables in the project
    local executables=$(find "${PROJECT_ROOT}" -type f -perm +111 \
        -not -path "*/.*" \
        -not -path "*/node_modules/*" \
        -not -path "*/Pods/*" \
        -not -name "*.sh" \
        -not -name "*.py" 2>/dev/null || true)

    if [ -z "$executables" ]; then
        echo "[INFO] No executables found to verify" >> "${REPORT_FILE}"
        return
    fi

    local signed_count=0
    local unsigned_count=0

    echo "$executables" | while IFS= read -r exec; do
        local basename=$(basename "$exec")
        echo "Checking: ${basename}" | tee -a "${REPORT_FILE}"

        # Check if file is a Mach-O executable
        if file "$exec" | grep -q "Mach-O"; then
            # Verify code signature
            if codesign -v "$exec" 2>/dev/null; then
                echo -e "${GREEN}  ✓ Signed and verified${NC}"
                echo "  [OK] Valid signature" >> "${REPORT_FILE}"

                # Get signature details
                sig_info=$(codesign -dvv "$exec" 2>&1 || true)
                echo "$sig_info" | grep -E "Authority|TeamIdentifier|Identifier" >> "${REPORT_FILE}" || true

                # Check for hardened runtime
                if echo "$sig_info" | grep -q "runtime"; then
                    echo "  [OK] Hardened Runtime enabled" >> "${REPORT_FILE}"
                else
                    echo -e "${YELLOW}  [WARNING] Hardened Runtime not detected${NC}"
                    echo "  [WARNING] Hardened Runtime not enabled" >> "${REPORT_FILE}"
                fi

                ((signed_count++))
            else
                echo -e "${RED}  ✗ Not signed or invalid signature${NC}"
                echo "  [CRITICAL] Missing or invalid signature" >> "${REPORT_FILE}"
                ((unsigned_count++))
            fi

            # Check entitlements
            entitlements=$(codesign -d --entitlements - "$exec" 2>/dev/null || true)
            if [ -n "$entitlements" ]; then
                echo "  [INFO] Entitlements present" >> "${REPORT_FILE}"
                # Save entitlements to report
                echo "$entitlements" | head -20 >> "${REPORT_FILE}"
            fi

        else
            echo "  [INFO] Not a Mach-O executable (script)" >> "${REPORT_FILE}"
        fi

        echo "" >> "${REPORT_FILE}"
    done

    echo "Summary: ${signed_count} signed, ${unsigned_count} unsigned" >> "${REPORT_FILE}"
    echo "" >> "${REPORT_FILE}"
}

# Function to verify app bundles
verify_app_bundles() {
    echo -e "${BLUE}Verifying .app bundles...${NC}"
    echo "" >> "${REPORT_FILE}"
    echo "--- Application Bundle Verification ---" >> "${REPORT_FILE}"

    # Find all .app bundles
    local app_bundles=$(find "${PROJECT_ROOT}" -name "*.app" -type d -not -path "*/.*" 2>/dev/null || true)

    if [ -z "$app_bundles" ]; then
        echo "[INFO] No .app bundles found" >> "${REPORT_FILE}"
        return
    fi

    echo "$app_bundles" | while IFS= read -r app; do
        local app_name=$(basename "$app")
        echo "Verifying: ${app_name}" | tee -a "${REPORT_FILE}"

        # Verify the bundle
        if codesign -v "$app" 2>/dev/null; then
            echo -e "${GREEN}  ✓ Bundle signature valid${NC}"
            echo "  [OK] Valid bundle signature" >> "${REPORT_FILE}"

            # Check for deep verification
            if codesign --verify --deep --strict "$app" 2>/dev/null; then
                echo -e "${GREEN}  ✓ Deep verification passed${NC}"
                echo "  [OK] Deep verification passed" >> "${REPORT_FILE}"
            else
                echo -e "${YELLOW}  [WARNING] Deep verification failed${NC}"
                echo "  [WARNING] Deep verification failed - possible tampering" >> "${REPORT_FILE}"
            fi

            # Get detailed signature info
            sig_details=$(codesign -dvvv "$app" 2>&1 || true)
            echo "$sig_details" | head -15 >> "${REPORT_FILE}"

        else
            echo -e "${RED}  ✗ Invalid or missing signature${NC}"
            echo "  [CRITICAL] Bundle not properly signed" >> "${REPORT_FILE}"
        fi

        # Check Info.plist
        if [ -f "$app/Contents/Info.plist" ]; then
            echo "  [INFO] Info.plist present" >> "${REPORT_FILE}"

            # Check for minimum required keys
            required_keys=("CFBundleIdentifier" "CFBundleVersion" "CFBundleExecutable")
            for key in "${required_keys[@]}"; do
                if /usr/libexec/PlistBuddy -c "Print :${key}" "$app/Contents/Info.plist" >/dev/null 2>&1; then
                    echo "    [OK] ${key} present" >> "${REPORT_FILE}"
                else
                    echo "    [WARNING] Missing ${key}" >> "${REPORT_FILE}"
                fi
            done
        fi

        echo "" >> "${REPORT_FILE}"
    done

    echo "" >> "${REPORT_FILE}"
}

# Function to verify frameworks
verify_frameworks() {
    echo -e "${BLUE}Verifying embedded frameworks...${NC}"
    echo "" >> "${REPORT_FILE}"
    echo "--- Framework Signature Verification ---" >> "${REPORT_FILE}"

    # Find all .framework bundles
    local frameworks=$(find "${PROJECT_ROOT}" -name "*.framework" -type d -not -path "*/.*" 2>/dev/null || true)

    if [ -z "$frameworks" ]; then
        echo "[INFO] No frameworks found" >> "${REPORT_FILE}"
        return
    fi

    echo "$frameworks" | while IFS= read -r framework; do
        local framework_name=$(basename "$framework")
        echo "Checking: ${framework_name}" | tee -a "${REPORT_FILE}"

        # Verify framework signature
        if codesign -v "$framework" 2>/dev/null; then
            echo -e "${GREEN}  ✓ Framework signed${NC}"
            echo "  [OK] Valid framework signature" >> "${REPORT_FILE}"

            # Get framework signature details
            codesign -dvv "$framework" 2>&1 | head -10 >> "${REPORT_FILE}" || true
        else
            echo -e "${RED}  ✗ Framework not signed${NC}"
            echo "  [WARNING] Framework not signed or invalid signature" >> "${REPORT_FILE}"
        fi

        echo "" >> "${REPORT_FILE}"
    done

    echo "" >> "${REPORT_FILE}"
}

# Function to check for tampering
check_tampering() {
    echo -e "${BLUE}Checking for code tampering...${NC}"
    echo "" >> "${REPORT_FILE}"
    echo "--- Tampering Detection ---" >> "${REPORT_FILE}"

    # Find signed executables and verify their seal
    local signed_execs=$(find "${PROJECT_ROOT}" -type f -perm +111 -not -path "*/.*" -not -name "*.sh" 2>/dev/null || true)

    if [ -z "$signed_execs" ]; then
        echo "[INFO] No executables to check" >> "${REPORT_FILE}"
        return
    fi

    echo "$signed_execs" | while IFS= read -r exec; do
        if file "$exec" | grep -q "Mach-O"; then
            if codesign -v "$exec" 2>/dev/null; then
                # Check seal integrity
                if codesign --verify --strict "$exec" 2>/dev/null; then
                    echo "  [OK] $(basename "$exec"): No tampering detected" >> "${REPORT_FILE}"
                else
                    echo -e "${RED}  [CRITICAL] $(basename "$exec"): Possible tampering!${NC}"
                    echo "  [CRITICAL] $(basename "$exec"): Possible tampering detected" >> "${REPORT_FILE}"
                fi
            fi
        fi
    done

    echo "" >> "${REPORT_FILE}"
}

# Function to verify entitlements consistency
verify_entitlements() {
    echo -e "${BLUE}Verifying entitlements consistency...${NC}"
    echo "" >> "${REPORT_FILE}"
    echo "--- Entitlements Consistency Check ---" >> "${REPORT_FILE}"

    # Find entitlements files
    local entitlement_files=$(find "${PROJECT_ROOT}" -name "*.entitlements" -o -name "entitlements.plist" 2>/dev/null || true)

    if [ -z "$entitlement_files" ]; then
        echo "[INFO] No entitlements files found" >> "${REPORT_FILE}"
        return
    fi

    echo "Entitlements files found:" >> "${REPORT_FILE}"
    echo "$entitlement_files" | while IFS= read -r ent_file; do
        echo "  $(basename "$ent_file")" >> "${REPORT_FILE}"

        # Validate XML
        if plutil -lint "$ent_file" >/dev/null 2>&1; then
            echo "    [OK] Valid plist format" >> "${REPORT_FILE}"
        else
            echo -e "${RED}    [CRITICAL] Invalid plist format${NC}"
            echo "    [CRITICAL] Invalid plist format" >> "${REPORT_FILE}"
        fi

        # Check for required entitlements
        if grep -q "com.apple.security.virtualization" "$ent_file"; then
            echo "    [OK] Virtualization entitlement present" >> "${REPORT_FILE}"
        else
            echo "    [WARNING] Missing virtualization entitlement" >> "${REPORT_FILE}"
        fi
    done

    echo "" >> "${REPORT_FILE}"
}

# Function to check developer certificates
check_certificates() {
    echo -e "${BLUE}Checking developer certificates...${NC}"
    echo "" >> "${REPORT_FILE}"
    echo "--- Developer Certificate Check ---" >> "${REPORT_FILE}"

    # List available code signing identities
    echo "Available signing identities:" >> "${REPORT_FILE}"
    security find-identity -v -p codesigning >> "${REPORT_FILE}" 2>&1 || echo "No signing identities found" >> "${REPORT_FILE}"

    echo "" >> "${REPORT_FILE}"

    # Check certificate expiration
    echo "Certificate expiration check:" >> "${REPORT_FILE}"
    security find-certificate -a -c "Developer" -p | openssl x509 -noout -dates 2>/dev/null >> "${REPORT_FILE}" || echo "No certificates found" >> "${REPORT_FILE}"

    echo "" >> "${REPORT_FILE}"
}

# Function to verify DMG/PKG integrity if present
verify_installers() {
    echo -e "${BLUE}Verifying installer packages...${NC}"
    echo "" >> "${REPORT_FILE}"
    echo "--- Installer Package Verification ---" >> "${REPORT_FILE}"

    # Find DMG files
    local dmg_files=$(find "${PROJECT_ROOT}" -name "*.dmg" -type f 2>/dev/null || true)

    if [ -n "$dmg_files" ]; then
        echo "DMG files found:" >> "${REPORT_FILE}"
        echo "$dmg_files" | while IFS= read -r dmg; do
            echo "  $(basename "$dmg")" >> "${REPORT_FILE}"
            # Verify DMG
            hdiutil verify "$dmg" >> "${REPORT_FILE}" 2>&1 && echo "    [OK] DMG verified" >> "${REPORT_FILE}" || echo "    [WARNING] DMG verification failed" >> "${REPORT_FILE}"
        done
    fi

    # Find PKG files
    local pkg_files=$(find "${PROJECT_ROOT}" -name "*.pkg" -type f 2>/dev/null || true)

    if [ -n "$pkg_files" ]; then
        echo "PKG files found:" >> "${REPORT_FILE}"
        echo "$pkg_files" | while IFS= read -r pkg; do
            echo "  $(basename "$pkg")" >> "${REPORT_FILE}"
            pkgutil --check-signature "$pkg" >> "${REPORT_FILE}" 2>&1 || echo "    [INFO] Not signed" >> "${REPORT_FILE}"
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

    echo "Code Signing Best Practices:" >> "${REPORT_FILE}"
    echo "1. Sign all executables and frameworks" >> "${REPORT_FILE}"
    echo "2. Enable Hardened Runtime for distribution" >> "${REPORT_FILE}"
    echo "3. Use notarization for macOS apps" >> "${REPORT_FILE}"
    echo "4. Regularly verify code signatures" >> "${REPORT_FILE}"
    echo "5. Use minimal required entitlements" >> "${REPORT_FILE}"
    echo "6. Keep certificates up to date" >> "${REPORT_FILE}"
    echo "" >> "${REPORT_FILE}"

    if [ $critical_issues -eq 0 ] && [ $warnings -le 2 ]; then
        echo "Overall Status: ✓ PASS" >> "${REPORT_FILE}"
        echo -e "${GREEN}✓ Code signing verification passed${NC}"
        exit 0
    elif [ $critical_issues -gt 0 ]; then
        echo "Overall Status: ✗ FAIL (Critical issues found)" >> "${REPORT_FILE}"
        echo -e "${RED}✗ Critical code signing issues found${NC}"
        exit 1
    else
        echo "Overall Status: ⚠ PASS WITH WARNINGS" >> "${REPORT_FILE}"
        echo -e "${YELLOW}⚠ Code signing verification completed with warnings${NC}"
        exit 0
    fi
}

# Main execution
main() {
    verify_executables
    verify_app_bundles
    verify_frameworks
    check_tampering
    verify_entitlements
    check_certificates
    verify_installers
    generate_summary

    echo ""
    echo -e "${BLUE}Report saved to: ${REPORT_FILE}${NC}"
}

main
