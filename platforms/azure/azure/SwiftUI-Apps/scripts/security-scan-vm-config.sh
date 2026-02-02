#!/bin/bash

# VM/Container Security Configuration Scanner
# Scans VM and container configurations for security vulnerabilities

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPORT_DIR="${PROJECT_ROOT}/security-reports"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="${REPORT_DIR}/vm-security-${TIMESTAMP}.txt"

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

mkdir -p "${REPORT_DIR}"

echo -e "${BLUE}=== VM/Container Security Configuration Scan ===${NC}"
echo "Report: ${REPORT_FILE}"
echo ""

# Initialize report
cat > "${REPORT_FILE}" << EOF
VM/Container Security Configuration Scan Report
Generated: $(date)
Project: $(basename "${PROJECT_ROOT}")

========================================
VM SECURITY CONFIGURATION ANALYSIS
========================================

EOF

# Function to scan VM configuration in code
scan_vm_configs() {
    echo -e "${BLUE}Scanning VM configuration code...${NC}"
    echo "" >> "${REPORT_FILE}"
    echo "--- VM Configuration Security Scan ---" >> "${REPORT_FILE}"

    # Find Swift files with VM configuration
    local vm_files=$(find "${PROJECT_ROOT}" -name "*.swift" -type f -exec grep -l "VZVirtualMachine\|VZConfiguration" {} \; 2>/dev/null || true)

    if [ -z "$vm_files" ]; then
        echo "[INFO] No VM configuration files found" >> "${REPORT_FILE}"
        return
    fi

    echo "VM Configuration files found:" >> "${REPORT_FILE}"
    echo "$vm_files" | while IFS= read -r file; do
        echo "  Analyzing: $(basename "$file")" | tee -a "${REPORT_FILE}"

        # Check for insecure network configurations
        if grep -q "VZNATNetworkDeviceAttachment\|VZBridgedNetworkDeviceAttachment" "$file"; then
            echo "    [INFO] Network device configuration found" >> "${REPORT_FILE}"

            # Check if network isolation is properly configured
            if ! grep -q "networkInterface.*isolation\|isIsolated.*true" "$file"; then
                echo -e "${YELLOW}    [WARNING] No explicit network isolation configured${NC}"
                echo "    [WARNING] Consider enabling network isolation" >> "${REPORT_FILE}"
            fi
        fi

        # Check for console configurations
        if grep -q "VZVirtioConsoleDeviceSerialPortConfiguration" "$file"; then
            echo "    [INFO] Serial console configured" >> "${REPORT_FILE}"
        fi

        # Check for insecure file sharing
        if grep -q "VZVirtioFileSystemDeviceConfiguration\|VZSharedDirectory" "$file"; then
            echo "    [INFO] File sharing configured" >> "${REPORT_FILE}"

            if grep -q "readWrite.*true\|writable.*true" "$file"; then
                echo -e "${YELLOW}    [WARNING] Read-write file sharing enabled${NC}"
                echo "    [WARNING] Read-write file sharing - ensure proper permissions" >> "${REPORT_FILE}"
            fi
        fi

        # Check for memory configuration
        if grep -q "memorySize" "$file"; then
            echo "    [INFO] Memory configuration found" >> "${REPORT_FILE}"
        fi

        # Check for CPU configuration
        if grep -q "cpuCount\|CPUCount" "$file"; then
            echo "    [INFO] CPU configuration found" >> "${REPORT_FILE}"
        fi

        # Check for boot configuration
        if grep -q "VZLinuxBootLoader\|VZEFIBootLoader" "$file"; then
            echo "    [INFO] Boot loader configuration found" >> "${REPORT_FILE}"
        fi
    done

    echo "" >> "${REPORT_FILE}"
}

# Function to check kernel command line parameters
check_kernel_cmdline() {
    echo -e "${BLUE}Checking kernel command line parameters...${NC}"
    echo "" >> "${REPORT_FILE}"
    echo "--- Kernel Command Line Security ---" >> "${REPORT_FILE}"

    # Find references to kernel command lines
    local cmdline_refs=$(grep -rn "commandLine\|kernelCommandLine" "${PROJECT_ROOT}" --include="*.swift" 2>/dev/null || true)

    if [ -z "$cmdline_refs" ]; then
        echo "[INFO] No kernel command line configurations found" >> "${REPORT_FILE}"
    else
        echo "Kernel command line references found:" >> "${REPORT_FILE}"
        echo "$cmdline_refs" >> "${REPORT_FILE}"

        # Check for insecure parameters
        insecure_params=("init=/bin/sh" "single" "rw" "selinux=0")

        for param in "${insecure_params[@]}"; do
            if echo "$cmdline_refs" | grep -q "$param"; then
                echo -e "${RED}    [CRITICAL] Insecure kernel parameter found: ${param}${NC}"
                echo "    [CRITICAL] Insecure kernel parameter: ${param}" >> "${REPORT_FILE}"
            fi
        done

        # Check for security enhancements
        secure_params=("ro" "selinux=1" "apparmor=1")
        for param in "${secure_params[@]}"; do
            if echo "$cmdline_refs" | grep -q "$param"; then
                echo "    [OK] Security parameter found: ${param}" >> "${REPORT_FILE}"
            fi
        done
    fi

    echo "" >> "${REPORT_FILE}"
}

# Function to check network security configurations
check_network_security() {
    echo -e "${BLUE}Checking network security configurations...${NC}"
    echo "" >> "${REPORT_FILE}"
    echo "--- Network Security Configuration ---" >> "${REPORT_FILE}"

    # Check for NAT vs Bridge configurations
    local nat_configs=$(grep -rn "VZNATNetworkDeviceAttachment" "${PROJECT_ROOT}" --include="*.swift" 2>/dev/null || true)
    local bridge_configs=$(grep -rn "VZBridgedNetworkDeviceAttachment" "${PROJECT_ROOT}" --include="*.swift" 2>/dev/null || true)

    if [ -n "$nat_configs" ]; then
        echo "[INFO] NAT network configuration found (more isolated)" >> "${REPORT_FILE}"
        echo -e "${GREEN}✓ NAT provides better isolation${NC}"
    fi

    if [ -n "$bridge_configs" ]; then
        echo -e "${YELLOW}[WARNING] Bridge network configuration found${NC}"
        echo "[WARNING] Bridge network - VM has direct network access" >> "${REPORT_FILE}"
        echo "  Recommendation: Use NAT for better isolation unless bridge is required" >> "${REPORT_FILE}"
    fi

    # Check for port forwarding configurations
    local port_forwards=$(grep -rn "portForward\|forwardPort" "${PROJECT_ROOT}" --include="*.swift" 2>/dev/null || true)

    if [ -n "$port_forwards" ]; then
        echo "[INFO] Port forwarding configured" >> "${REPORT_FILE}"
        echo "$port_forwards" >> "${REPORT_FILE}"
        echo "  [WARNING] Review forwarded ports for security" >> "${REPORT_FILE}"
    fi

    echo "" >> "${REPORT_FILE}"
}

# Function to check file sharing security
check_file_sharing() {
    echo -e "${BLUE}Checking file sharing configurations...${NC}"
    echo "" >> "${REPORT_FILE}"
    echo "--- File Sharing Security ---" >> "${REPORT_FILE}"

    local share_configs=$(grep -rn "VZSharedDirectory\|VZVirtioFileSystemDevice" "${PROJECT_ROOT}" --include="*.swift" 2>/dev/null || true)

    if [ -z "$share_configs" ]; then
        echo "[INFO] No file sharing configured" >> "${REPORT_FILE}"
    else
        echo "File sharing configurations found:" >> "${REPORT_FILE}"
        echo "$share_configs" >> "${REPORT_FILE}"

        # Check read-only vs read-write
        if echo "$share_configs" | grep -qi "readOnly.*true"; then
            echo -e "${GREEN}✓ Read-only sharing detected${NC}"
            echo "  [OK] Read-only file sharing (recommended)" >> "${REPORT_FILE}"
        fi

        if echo "$share_configs" | grep -qi "readWrite.*true\|writable.*true"; then
            echo -e "${YELLOW}⚠️  Read-write sharing detected${NC}"
            echo "  [WARNING] Read-write file sharing enabled" >> "${REPORT_FILE}"
            echo "  Recommendation: Use read-only sharing when possible" >> "${REPORT_FILE}"
        fi
    fi

    echo "" >> "${REPORT_FILE}"
}

# Function to check entitlements
check_entitlements() {
    echo -e "${BLUE}Checking app entitlements...${NC}"
    echo "" >> "${REPORT_FILE}"
    echo "--- Application Entitlements Security ---" >> "${REPORT_FILE}"

    local entitlement_files=$(find "${PROJECT_ROOT}" -name "*.entitlements" -o -name "entitlements.plist" 2>/dev/null || true)

    if [ -z "$entitlement_files" ]; then
        echo "[WARNING] No entitlements file found" >> "${REPORT_FILE}"
        return
    fi

    echo "$entitlement_files" | while IFS= read -r file; do
        echo "Analyzing: $(basename "$file")" >> "${REPORT_FILE}"

        # Check for dangerous entitlements
        if [ -f "$file" ]; then
            # Check for disable-library-validation
            if grep -q "com.apple.security.cs.disable-library-validation" "$file"; then
                if grep -A1 "com.apple.security.cs.disable-library-validation" "$file" | grep -q "<true/>"; then
                    echo -e "${RED}  [CRITICAL] Library validation disabled!${NC}"
                    echo "  [CRITICAL] Library validation disabled - security risk" >> "${REPORT_FILE}"
                fi
            fi

            # Check for allow-unsigned-executable-memory
            if grep -q "com.apple.security.cs.allow-unsigned-executable-memory" "$file"; then
                if grep -A1 "com.apple.security.cs.allow-unsigned-executable-memory" "$file" | grep -q "<true/>"; then
                    echo -e "${YELLOW}  [WARNING] Unsigned executable memory allowed${NC}"
                    echo "  [WARNING] Unsigned executable memory allowed" >> "${REPORT_FILE}"
                fi
            fi

            # Check for allow-dyld-environment-variables
            if grep -q "com.apple.security.cs.allow-dyld-environment-variables" "$file"; then
                if grep -A1 "com.apple.security.cs.allow-dyld-environment-variables" "$file" | grep -q "<true/>"; then
                    echo -e "${YELLOW}  [WARNING] DYLD environment variables allowed${NC}"
                    echo "  [WARNING] DYLD environment variables allowed" >> "${REPORT_FILE}"
                fi
            fi

            # Check for network client entitlement
            if grep -q "com.apple.security.network.client" "$file"; then
                if grep -A1 "com.apple.security.network.client" "$file" | grep -q "<true/>"; then
                    echo "  [INFO] Network client access enabled" >> "${REPORT_FILE}"
                fi
            fi

            # Check for virtualization entitlement
            if grep -q "com.apple.security.virtualization" "$file"; then
                if grep -A1 "com.apple.security.virtualization" "$file" | grep -q "<true/>"; then
                    echo "  [OK] Virtualization entitlement present (required)" >> "${REPORT_FILE}"
                fi
            else
                echo -e "${RED}  [CRITICAL] Missing virtualization entitlement${NC}"
                echo "  [CRITICAL] Missing com.apple.security.virtualization" >> "${REPORT_FILE}"
            fi
        fi
    done

    echo "" >> "${REPORT_FILE}"
}

# Function to check for exposed services
check_exposed_services() {
    echo -e "${BLUE}Checking for exposed network services...${NC}"
    echo "" >> "${REPORT_FILE}"
    echo "--- Exposed Services Check ---" >> "${REPORT_FILE}"

    # Look for socket/port bindings in code
    local socket_refs=$(grep -rn "bind\|listen\|accept\|Socket\|ServerSocket" "${PROJECT_ROOT}" --include="*.swift" 2>/dev/null | grep -v "VZVirtio" || true)

    if [ -z "$socket_refs" ]; then
        echo "[OK] No exposed network services detected in code" >> "${REPORT_FILE}"
    else
        echo "[INFO] Socket/network service references found:" >> "${REPORT_FILE}"
        echo "$socket_refs" | head -10 >> "${REPORT_FILE}"
        echo "  Review these for unintended exposure" >> "${REPORT_FILE}"
    fi

    echo "" >> "${REPORT_FILE}"
}

# Function to check resource limits
check_resource_limits() {
    echo -e "${BLUE}Checking VM resource limits...${NC}"
    echo "" >> "${REPORT_FILE}"
    echo "--- Resource Limits Check ---" >> "${REPORT_FILE}"

    # Check for memory limits
    local mem_configs=$(grep -rn "memorySize" "${PROJECT_ROOT}" --include="*.swift" 2>/dev/null || true)

    if [ -n "$mem_configs" ]; then
        echo "Memory configurations found:" >> "${REPORT_FILE}"
        echo "$mem_configs" >> "${REPORT_FILE}"

        # Check for reasonable limits
        if echo "$mem_configs" | grep -E "[0-9]{10,}"; then
            echo -e "${YELLOW}  [WARNING] Very large memory allocation detected${NC}"
            echo "  [WARNING] Review memory limits for DoS prevention" >> "${REPORT_FILE}"
        fi
    fi

    # Check for CPU limits
    local cpu_configs=$(grep -rn "cpuCount\|CPUCount" "${PROJECT_ROOT}" --include="*.swift" 2>/dev/null || true)

    if [ -n "$cpu_configs" ]; then
        echo "CPU configurations found:" >> "${REPORT_FILE}"
        echo "$cpu_configs" >> "${REPORT_FILE}"
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

    echo "Security Recommendations:" >> "${REPORT_FILE}"
    echo "1. Use NAT networking for better VM isolation" >> "${REPORT_FILE}"
    echo "2. Configure read-only file sharing when possible" >> "${REPORT_FILE}"
    echo "3. Enable minimal required entitlements only" >> "${REPORT_FILE}"
    echo "4. Set appropriate resource limits to prevent DoS" >> "${REPORT_FILE}"
    echo "5. Use secure kernel command line parameters" >> "${REPORT_FILE}"
    echo "6. Regularly audit VM configurations" >> "${REPORT_FILE}"
    echo "" >> "${REPORT_FILE}"

    if [ $critical_issues -eq 0 ] && [ $warnings -eq 0 ]; then
        echo "Overall Status: ✓ PASS" >> "${REPORT_FILE}"
        echo -e "${GREEN}✓ All VM security checks passed${NC}"
        exit 0
    elif [ $critical_issues -gt 0 ]; then
        echo "Overall Status: ✗ FAIL (Critical issues found)" >> "${REPORT_FILE}"
        echo -e "${RED}✗ Critical VM security issues found${NC}"
        exit 1
    else
        echo "Overall Status: ⚠ PASS WITH WARNINGS" >> "${REPORT_FILE}"
        echo -e "${YELLOW}⚠ VM security scan completed with warnings${NC}"
        exit 0
    fi
}

# Main execution
main() {
    scan_vm_configs
    check_kernel_cmdline
    check_network_security
    check_file_sharing
    check_entitlements
    check_exposed_services
    check_resource_limits
    generate_summary

    echo ""
    echo -e "${BLUE}Report saved to: ${REPORT_FILE}${NC}"
}

main
