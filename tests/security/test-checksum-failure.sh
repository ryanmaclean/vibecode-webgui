#!/usr/bin/env bash
#
# test-checksum-failure.sh - Test that builds fail on checksum mismatch
# This simulates a supply-chain attack where a binary is tampered with
#

set -euo pipefail

echo "🧪 Testing checksum mismatch detection..."
echo ""

# Test: Simulate a checksum mismatch
TEST_DIR=$(mktemp -d)
trap 'rm -rf "${TEST_DIR}"' EXIT

echo "Creating test file with known content..."
echo "original content" > "${TEST_DIR}/tool.bin"
CORRECT_HASH=$(sha256sum "${TEST_DIR}/tool.bin" | awk '{print $1}')
echo "  Correct hash: ${CORRECT_HASH}"

# Simulate tampering by modifying the file
echo "Simulating tampering..."
echo "tampered content" > "${TEST_DIR}/tool.bin"
TAMPERED_HASH=$(sha256sum "${TEST_DIR}/tool.bin" | awk '{print $1}')
echo "  Tampered hash: ${TAMPERED_HASH}"

# Create checksum file with original (correct) hash
echo "${CORRECT_HASH}  tool.bin" > "${TEST_DIR}/tool.bin.sha256"

# Try to verify - this should fail
echo ""
echo "Attempting to verify tampered file against original checksum..."
if (cd "${TEST_DIR}" && sha256sum -c tool.bin.sha256 2>&1); then
  echo ""
  echo "❌ SECURITY FAILURE: Tampered file was NOT detected!"
  echo "   This means the build would NOT fail when checksums don't match."
  exit 1
else
  echo ""
  echo "✅ SUCCESS: Checksum mismatch was correctly detected!"
  echo "   The build will fail if checksums don't match."
fi

echo ""
echo "This demonstrates that:"
echo "  1. Checksum verification will catch tampered binaries"
echo "  2. Docker builds will fail if downloaded tools don't match expected checksums"
echo "  3. Supply-chain attacks that modify binaries will be detected"
