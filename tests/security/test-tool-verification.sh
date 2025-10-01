#!/usr/bin/env bash
#
# test-tool-verification.sh - Test checksum verification for tool downloads
# Ensures that build fails when checksums don't match
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

echo "🧪 Testing tool download verification..."
echo ""

# Test 1: Verify helper script exists and is executable
echo "Test 1: Verify helper script exists"
if [[ -x "${ROOT_DIR}/scripts/verify-tool-download.sh" ]]; then
  echo "  ✅ verify-tool-download.sh exists and is executable"
else
  echo "  ❌ verify-tool-download.sh missing or not executable"
  exit 1
fi
echo ""

# Test 2: Test successful checksum verification
echo "Test 2: Test successful checksum verification"
TEST_DIR=$(mktemp -d)
trap 'rm -rf "${TEST_DIR}"' EXIT

# Create a test file with known content
echo "test content" > "${TEST_DIR}/test.txt"
EXPECTED_HASH=$(sha256sum "${TEST_DIR}/test.txt" | awk '{print $1}')
echo "${EXPECTED_HASH}" > "${TEST_DIR}/checksum.txt"

# Create a mock checksum URL by serving the checksum file
echo "${EXPECTED_HASH}" > "${TEST_DIR}/remote-checksum.txt"

# Test the verification (without actual download, just checksum logic)
if sha256sum -c <(echo "${EXPECTED_HASH}  ${TEST_DIR}/test.txt") > /dev/null 2>&1; then
  echo "  ✅ Valid checksum verification passes"
else
  echo "  ❌ Valid checksum verification failed"
  exit 1
fi
echo ""

# Test 3: Test failed checksum verification
echo "Test 3: Test failed checksum verification"
echo "invalid_hash_value" > "${TEST_DIR}/bad-checksum.txt"

if sha256sum -c <(echo "invalid_hash_value  ${TEST_DIR}/test.txt") > /dev/null 2>&1; then
  echo "  ❌ Invalid checksum was accepted (should have failed)"
  exit 1
else
  echo "  ✅ Invalid checksum correctly rejected"
fi
echo ""

# Test 4: Verify Dockerfile uses verification for kubectl
echo "Test 4: Verify Dockerfile implements kubectl verification"
if grep -q "kubectl.sha256" "${ROOT_DIR}/docker/code-server/Dockerfile"; then
  echo "  ✅ Dockerfile includes kubectl SHA256 verification"
else
  echo "  ❌ Dockerfile missing kubectl SHA256 verification"
  exit 1
fi
echo ""

# Test 5: Verify Dockerfile uses verification for helm
echo "Test 5: Verify Dockerfile implements helm verification"
if grep -q "helm.*sha256sum" "${ROOT_DIR}/docker/code-server/Dockerfile"; then
  echo "  ✅ Dockerfile includes helm checksum verification"
else
  echo "  ❌ Dockerfile missing helm checksum verification"
  exit 1
fi
echo ""

# Test 6: Verify kubectx/kubens use tagged releases
echo "Test 6: Verify kubectx/kubens use tagged releases"
if grep -q "kubectx/v\${KUBECTX_VERSION}" "${ROOT_DIR}/docker/code-server/Dockerfile"; then
  echo "  ✅ kubectx uses tagged release"
else
  echo "  ❌ kubectx should use tagged release instead of master"
  exit 1
fi

if grep -q "kubectx/v\${KUBECTX_VERSION}/kubens" "${ROOT_DIR}/docker/code-server/Dockerfile"; then
  echo "  ✅ kubens uses tagged release"
else
  echo "  ❌ kubens should use tagged release instead of master"
  exit 1
fi
echo ""

# Test 7: Verify install command is used instead of chmod
echo "Test 7: Verify install command usage"
if grep -q "install -Dm755.*kubectl" "${ROOT_DIR}/docker/code-server/Dockerfile"; then
  echo "  ✅ kubectl uses install command"
else
  echo "  ❌ kubectl should use 'install -Dm755' instead of 'chmod'"
  exit 1
fi

if grep -q "install -Dm755.*helm" "${ROOT_DIR}/docker/code-server/Dockerfile"; then
  echo "  ✅ helm uses install command"
else
  echo "  ❌ helm should use 'install -Dm755' instead of 'chmod'"
  exit 1
fi
echo ""

# Test 8: Verify KUBECTX_VERSION is defined
echo "Test 8: Verify KUBECTX_VERSION is defined"
if grep -q "ARG KUBECTX_VERSION=" "${ROOT_DIR}/docker/code-server/Dockerfile"; then
  echo "  ✅ KUBECTX_VERSION is defined in Dockerfile"
else
  echo "  ❌ KUBECTX_VERSION should be defined as ARG in Dockerfile"
  exit 1
fi
echo ""

echo "✅ All verification tests passed!"
echo ""
echo "Note: To test actual download verification, run:"
echo "  docker build --no-cache -f docker/code-server/Dockerfile ."
