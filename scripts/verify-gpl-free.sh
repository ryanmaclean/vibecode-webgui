#!/usr/bin/env bash
# verify-gpl-free.sh - Verify GPL-free v1.1.1 code-server builds
# Part of issue #453: https://github.com/ryanmaclean/vibecode-webgui/issues/453

set -euo pipefail

VERSION="${VERSION:-1.1.1}"
PROFILES=("minimal" "standard" "ai" "web" "full")
GHCR_REGISTRY="ghcr.io/ryanmaclean/vibecode-codeserver"
DOCKERHUB_REGISTRY="ryanmaclean/vibecode-codeserver"
ARCHITECTURES=("linux/amd64" "linux/arm64")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

log_info() {
    echo -e "${BLUE}[INFO]${NC} $*"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $*"
    ((PASSED_TESTS++)) || true
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*"
    ((FAILED_TESTS++)) || true
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $*"
}

# Check if image exists in registry
check_image_exists() {
    local registry="$1"
    local profile="$2"
    local tag="${VERSION}-${profile}"

    ((TOTAL_TESTS++)) || true
    log_info "Checking ${registry}:${tag}"

    if docker manifest inspect "${registry}:${tag}" >/dev/null 2>&1; then
        log_success "Image exists: ${registry}:${tag}"
        return 0
    else
        log_error "Image NOT FOUND: ${registry}:${tag}"
        return 1
    fi
}

# Verify Emacs is absent (GPL compliance)
check_emacs_absent() {
    local image="$1"
    local platform="$2"

    ((TOTAL_TESTS++)) || true
    log_info "Checking Emacs absence in ${image} (${platform})"

    # Try multiple methods to detect emacs
    if docker run --rm --platform "$platform" --entrypoint bash "$image" -c \
        "! command -v emacs >/dev/null 2>&1 && \
         ! command -v emacsclient >/dev/null 2>&1 && \
         ! which emacs >/dev/null 2>&1 && \
         ! dpkg -l | grep -i emacs >/dev/null 2>&1" 2>/dev/null; then
        log_success "Emacs absent in ${image} (${platform})"
        return 0
    else
        log_error "Emacs FOUND or check failed in ${image} (${platform})"
        return 1
    fi
}

# Verify alternative editors are present
check_editors_present() {
    local image="$1"
    local platform="$2"

    log_info "Checking alternative editors in ${image} (${platform})"

    local editors=("vim" "nvim")
    local all_present=true

    for editor in "${editors[@]}"; do
        ((TOTAL_TESTS++)) || true
        if docker run --rm --platform "$platform" --entrypoint bash "$image" -c \
            "command -v $editor >/dev/null 2>&1 && $editor --version" >/dev/null 2>&1; then
            log_success "$editor present in ${image} (${platform})"
        else
            log_error "$editor MISSING in ${image} (${platform})"
            all_present=false
        fi
    done

    $all_present
}

# Verify key development tools
check_dev_tools() {
    local image="$1"
    local platform="$2"

    log_info "Checking development tools in ${image} (${platform})"

    local tools=("git" "bash" "curl" "jq")
    local all_present=true

    for tool in "${tools[@]}"; do
        ((TOTAL_TESTS++)) || true
        if docker run --rm --platform "$platform" --entrypoint bash "$image" -c \
            "command -v $tool >/dev/null 2>&1" >/dev/null 2>&1; then
            log_success "$tool present in ${image} (${platform})"
        else
            log_error "$tool MISSING in ${image} (${platform})"
            all_present=false
        fi
    done

    $all_present
}

# Verify AI tools (aider/goose) for profiles that should have them
check_ai_tools() {
    local image="$1"
    local platform="$2"
    local profile="$3"

    # Only check for profiles that should have AI tools
    case "$profile" in
        minimal)
            log_info "Skipping AI tools check for minimal profile"
            return 0
            ;;
        *)
            log_info "Checking AI tools in ${image} (${platform})"
            ;;
    esac

    local tools=("aider" "goose")
    local all_present=true

    for tool in "${tools[@]}"; do
        ((TOTAL_TESTS++)) || true
        if docker run --rm --platform "$platform" --entrypoint bash "$image" -c \
            "$tool --version 2>&1 | head -1" >/dev/null 2>&1; then
            log_success "$tool present and working in ${image} (${platform})"
        else
            log_error "$tool MISSING or broken in ${image} (${platform})"
            all_present=false
        fi
    done

    $all_present
}

# Full verification for a single profile
verify_profile() {
    local registry="$1"
    local profile="$2"
    local arch="$3"

    local tag="${VERSION}-${profile}"
    local image="${registry}:${tag}"

    echo ""
    log_info "========================================="
    log_info "Verifying: ${image}"
    log_info "Architecture: ${arch}"
    log_info "========================================="

    # Check if image exists
    if ! check_image_exists "$registry" "$profile"; then
        log_warn "Skipping detailed tests for unavailable image"
        return 1
    fi

    # Pull the image
    log_info "Pulling ${image} for ${arch}..."
    if ! docker pull --platform "$arch" "$image" >/dev/null 2>&1; then
        log_error "Failed to pull ${image} for ${arch}"
        return 1
    fi

    # Run GPL compliance check
    check_emacs_absent "$image" "$arch"

    # Run editor checks
    check_editors_present "$image" "$arch"

    # Run dev tools check
    check_dev_tools "$image" "$arch"

    # Run AI tools check if applicable
    check_ai_tools "$image" "$arch" "$profile"

    log_info "Completed verification for ${image} (${arch})"
}

# Main execution
main() {
    echo ""
    log_info "========================================================"
    log_info "GPL-Free Build Verification for v${VERSION}"
    log_info "Issue: #453"
    log_info "========================================================"
    echo ""

    # Check which profiles to test
    local test_profiles=()
    if [ "${1:-all}" = "all" ]; then
        test_profiles=("${PROFILES[@]}")
    else
        test_profiles=("$@")
    fi

    # Determine which architecture(s) to test
    local test_archs=("${ARCHITECTURES[@]}")

    # Allow testing only amd64 if on non-emulated system
    if [ "${ARCH_FILTER:-}" = "amd64" ]; then
        test_archs=("linux/amd64")
        log_warn "Testing only amd64 architecture"
    fi

    # Test GHCR registry
    log_info "Testing GitHub Container Registry (GHCR)"
    for profile in "${test_profiles[@]}"; do
        for arch in "${test_archs[@]}"; do
            verify_profile "$GHCR_REGISTRY" "$profile" "$arch" || true
        done
    done

    # Test Docker Hub if configured
    if [ "${TEST_DOCKERHUB:-false}" = "true" ]; then
        log_info "Testing Docker Hub"
        for profile in "${test_profiles[@]}"; do
            for arch in "${test_archs[@]}"; do
                verify_profile "$DOCKERHUB_REGISTRY" "$profile" "$arch" || true
            done
        done
    else
        log_info "Skipping Docker Hub tests (set TEST_DOCKERHUB=true to enable)"
    fi

    # Print summary
    echo ""
    log_info "========================================================"
    log_info "VERIFICATION SUMMARY"
    log_info "========================================================"
    log_info "Total tests:  ${TOTAL_TESTS}"
    log_success "Passed:       ${PASSED_TESTS}"
    log_error "Failed:       ${FAILED_TESTS}"
    echo ""

    if [ "$FAILED_TESTS" -eq 0 ]; then
        log_success "All GPL-free verification tests PASSED!"
        return 0
    else
        log_error "Some verification tests FAILED!"
        log_info "Review the output above for details"
        return 1
    fi
}

# Handle script arguments
if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
    cat <<EOF
Usage: $0 [profile1 profile2 ...] [options]

Verify GPL-free v${VERSION} code-server builds for issue #453.

Arguments:
  profile1 profile2...  Specific profiles to test (default: all)
                        Available: minimal, standard, ai, web, full

Environment Variables:
  VERSION              Version to test (default: 1.1.1)
  TEST_DOCKERHUB       Set to 'true' to test Docker Hub (default: false)
  ARCH_FILTER          Set to 'amd64' to test only amd64 (default: both)

Examples:
  # Test all profiles on all architectures
  $0

  # Test only standard profile
  $0 standard

  # Test multiple specific profiles
  $0 minimal standard

  # Test only amd64 architecture
  ARCH_FILTER=amd64 $0

  # Include Docker Hub in tests
  TEST_DOCKERHUB=true $0

Exit codes:
  0 - All tests passed
  1 - Some tests failed

EOF
    exit 0
fi

# Run main function
main "$@"
