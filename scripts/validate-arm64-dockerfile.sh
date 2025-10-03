#!/usr/bin/env bash
#
# ARM64 Dockerfile Validation Script
# Checks for architecture-specific issues that prevent cross-compilation
#
# Usage: ./scripts/validate-arm64-dockerfile.sh [dockerfile-path]
#

set -euo pipefail

DOCKERFILE="${1:-docker/code-server/Dockerfile}"
EXIT_CODE=0
ISSUES_FOUND=0

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== ARM64 Dockerfile Validation ===${NC}"
echo -e "Checking: ${DOCKERFILE}\n"

# Check if file exists
if [ ! -f "$DOCKERFILE" ]; then
    echo -e "${RED}❌ ERROR: Dockerfile not found: ${DOCKERFILE}${NC}"
    exit 1
fi

# Function to report issue
report_issue() {
    local severity="$1"
    local line_num="$2"
    local description="$3"
    local suggestion="$4"

    ISSUES_FOUND=$((ISSUES_FOUND + 1))

    if [ "$severity" = "CRITICAL" ]; then
        echo -e "${RED}❌ CRITICAL (Line ${line_num}): ${description}${NC}"
        EXIT_CODE=1
    elif [ "$severity" = "WARNING" ]; then
        echo -e "${YELLOW}⚠️  WARNING (Line ${line_num}): ${description}${NC}"
    else
        echo -e "${BLUE}ℹ️  INFO (Line ${line_num}): ${description}${NC}"
    fi

    if [ -n "$suggestion" ]; then
        echo -e "   ${GREEN}Suggestion: ${suggestion}${NC}"
    fi
    echo ""
}

# Function to report success
report_success() {
    local check="$1"
    echo -e "${GREEN}✅ ${check}${NC}"
}

echo -e "${BLUE}=== Architecture-Specific Downloads ===${NC}\n"

# Check 1: Hardcoded AMD64 in download URLs
echo "Checking for hardcoded AMD64 architecture..."
if grep -n "amd64\.tar\.gz\|amd64\.deb\|x86_64\|x86-64" "$DOCKERFILE" | grep -v "TARGETARCH\|BUILDPLATFORM" | grep -v "^#"; then
    while IFS=: read -r line_num content; do
        if [ -n "$line_num" ]; then
            report_issue "CRITICAL" "$line_num" \
                "Hardcoded AMD64 architecture in download URL" \
                "Use TARGETARCH variable: RUN case \${TARGETARCH} in amd64) ARCH=amd64 ;; arm64) ARCH=arm64 ;; esac"
        fi
    done < <(grep -n "amd64\.tar\.gz\|amd64\.deb\|x86_64\|x86-64" "$DOCKERFILE" | grep -v "TARGETARCH\|BUILDPLATFORM" | grep -v "^#")
else
    report_success "No hardcoded AMD64 architecture in downloads"
fi

# Check 2: TARGETARCH usage
echo "Checking TARGETARCH usage..."
if grep -q "ARG TARGETARCH" "$DOCKERFILE"; then
    report_success "TARGETARCH argument declared"
else
    report_issue "CRITICAL" "0" \
        "TARGETARCH argument not declared" \
        "Add 'ARG TARGETARCH' at the beginning of multi-arch sections"
fi

# Check 3: Go installation
echo "Checking Go installation..."
if grep -n "go.*linux-amd64\.tar\.gz" "$DOCKERFILE"; then
    line_num=$(grep -n "go.*linux-amd64\.tar\.gz" "$DOCKERFILE" | cut -d: -f1 | head -1)
    report_issue "CRITICAL" "$line_num" \
        "Go installation hardcoded to AMD64" \
        "Use: wget https://go.dev/dl/go1.22.4.linux-\${TARGETARCH}.tar.gz"
else
    report_success "Go installation uses dynamic architecture"
fi

# Check 4: Rust analyzer
echo "Checking Rust analyzer installation..."
if grep -n "rust-analyzer-x86_64" "$DOCKERFILE"; then
    line_num=$(grep -n "rust-analyzer-x86_64" "$DOCKERFILE" | cut -d: -f1 | head -1)
    report_issue "CRITICAL" "$line_num" \
        "Rust analyzer hardcoded to x86_64" \
        "Use: case \${TARGETARCH} in amd64) RUST_ARCH=x86_64 ;; arm64) RUST_ARCH=aarch64 ;; esac"
else
    report_success "Rust analyzer uses dynamic architecture"
fi

# Check 5: Vector installation
echo "Checking Vector installation..."
if grep -n "vector-amd64\.deb" "$DOCKERFILE"; then
    line_num=$(grep -n "vector-amd64\.deb" "$DOCKERFILE" | cut -d: -f1 | head -1)
    report_issue "CRITICAL" "$line_num" \
        "Vector package hardcoded to AMD64" \
        "Use: case \${TARGETARCH} in amd64) VECTOR_ARCH=amd64 ;; arm64) VECTOR_ARCH=arm64 ;; esac"
else
    report_success "Vector installation uses dynamic architecture"
fi

echo -e "\n${BLUE}=== Base Image Compatibility ===${NC}\n"

# Check 6: Base image architecture support
echo "Checking base image..."
base_image=$(grep "^FROM" "$DOCKERFILE" | head -1 | awk '{print $2}')
if [ -n "$base_image" ]; then
    echo -e "Base image: ${base_image}"
    if [[ "$base_image" =~ "codercom/code-server" ]]; then
        report_success "Base image supports multi-architecture"
    else
        report_issue "WARNING" "0" \
            "Unknown base image architecture support" \
            "Verify that ${base_image} supports linux/arm64"
    fi
fi

echo -e "\n${BLUE}=== System Dependencies ===${NC}\n"

# Check 7: APT package architecture handling
echo "Checking APT package installations..."
if grep -n "apt-get install.*:" "$DOCKERFILE"; then
    report_issue "WARNING" "0" \
        "Found architecture-specific APT packages" \
        "Ensure packages have ARM64 variants available"
fi

# Check 8: Node.js installation
echo "Checking Node.js installation..."
if grep -n "nodesource" "$DOCKERFILE"; then
    if grep -n "setup_.*\.x.*bash" "$DOCKERFILE" | grep -v "#"; then
        report_success "Node.js installation script should auto-detect architecture"
    fi
else
    report_success "Node.js installation not found or uses standard repos"
fi

echo -e "\n${BLUE}=== Build Arguments ===${NC}\n"

# Check 9: Build arguments documentation
echo "Checking build arguments..."
build_args=$(grep "^ARG" "$DOCKERFILE" | wc -l)
if [ "$build_args" -gt 0 ]; then
    echo -e "Found ${build_args} ARG declarations:"
    grep "^ARG" "$DOCKERFILE" | sed 's/^/  /'
else
    report_issue "INFO" "0" \
        "No ARG declarations found" \
        "Consider using ARG for VERSION, BUILD_DATE, etc."
fi

echo -e "\n${BLUE}=== Platform-Specific Logic ===${NC}\n"

# Check 10: Case statements for architecture
echo "Checking platform-specific logic..."
if grep -q "case.*TARGETARCH\|case.*BUILDARCH" "$DOCKERFILE"; then
    case_count=$(grep -c "case.*TARGETARCH\|case.*BUILDARCH" "$DOCKERFILE")
    report_success "Found ${case_count} architecture-specific case statements"

    # Show the case statements
    echo -e "\nCase statements found:"
    grep -n "case.*TARGETARCH\|case.*BUILDARCH" "$DOCKERFILE" | sed 's/^/  /'
else
    report_issue "WARNING" "0" \
        "No architecture-specific case statements found" \
        "Use case statements to handle architecture differences"
fi

echo -e "\n${BLUE}=== LSP Server Installations ===${NC}\n"

# Check 11: Language server installations
echo "Checking language server installations..."
lsp_found=false

if grep -q "language-server\|lsp\|pylsp\|gopls\|clangd" "$DOCKERFILE"; then
    lsp_found=true
    echo -e "Language servers detected:"
    grep -n "language-server\|lsp\|pylsp\|gopls\|clangd" "$DOCKERFILE" | head -5 | sed 's/^/  /'
    report_success "Language servers should be architecture-agnostic (npm/pip)"
fi

if ! $lsp_found; then
    echo -e "${BLUE}No language servers detected${NC}"
fi

echo -e "\n${BLUE}=== Validation Summary ===${NC}\n"

if [ $ISSUES_FOUND -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed! Dockerfile is ARM64-ready.${NC}"
    exit 0
else
    echo -e "${YELLOW}Found ${ISSUES_FOUND} issue(s)${NC}"

    if [ $EXIT_CODE -eq 1 ]; then
        echo -e "${RED}❌ CRITICAL issues found. ARM64 builds will likely fail.${NC}"
        echo -e "${RED}Please fix critical issues before building.${NC}"
    else
        echo -e "${YELLOW}⚠️  Warnings found. Review before building.${NC}"
    fi

    echo -e "\n${BLUE}=== Recommended Fixes ===${NC}\n"

    cat <<'EOF'
Example: Fix Go installation for multi-architecture:

  # Declare TARGETARCH
  ARG TARGETARCH

  # Download architecture-specific Go
  RUN case ${TARGETARCH} in \
        amd64) GOARCH=amd64 ;; \
        arm64) GOARCH=arm64 ;; \
      esac && \
      wget https://go.dev/dl/go1.22.4.linux-${GOARCH}.tar.gz && \
      tar -C /usr/local -xzf go1.22.4.linux-${GOARCH}.tar.gz && \
      rm go1.22.4.linux-${GOARCH}.tar.gz

Example: Fix Rust analyzer for multi-architecture:

  ARG TARGETARCH

  RUN case ${TARGETARCH} in \
        amd64) RUST_ARCH=x86_64 ;; \
        arm64) RUST_ARCH=aarch64 ;; \
      esac && \
      curl -L https://github.com/rust-analyzer/rust-analyzer/releases/latest/download/rust-analyzer-${RUST_ARCH}-unknown-linux-gnu.gz | \
      gunzip -c - > /usr/local/bin/rust-analyzer && \
      chmod +x /usr/local/bin/rust-analyzer

Example: Fix Vector for multi-architecture:

  ARG TARGETARCH

  RUN case ${TARGETARCH} in \
        amd64) VECTOR_ARCH=amd64 ;; \
        arm64) VECTOR_ARCH=arm64 ;; \
      esac && \
      curl -L https://releases.timber.io/vector/latest/vector-${VECTOR_ARCH}.deb -o vector.deb && \
      dpkg -i vector.deb && \
      rm vector.deb
EOF

    exit $EXIT_CODE
fi
