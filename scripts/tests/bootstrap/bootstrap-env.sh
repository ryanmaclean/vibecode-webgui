#!/usr/bin/env bash
# Shared helpers for bootstrap validation scripts.

if [[ -n "${BOOTSTRAP_TEST_ENV_SOURCED:-}" ]]; then
  return
fi

BOOTSTRAP_TEST_ENV_SOURCED=1

BOOTSTRAP_TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BOOTSTRAP_TEST_REPO_ROOT="$(cd "$BOOTSTRAP_TEST_DIR/../.." && pwd)"
BOOTSTRAP_TEST_SCRIPTS_DIR="${BOOTSTRAP_TEST_REPO_ROOT}/scripts"

export BOOTSTRAP_TEST_DIR
export BOOTSTRAP_TEST_REPO_ROOT
export BOOTSTRAP_TEST_SCRIPTS_DIR

BOOTSTRAP_TEST_ENV_FILE="${BOOTSTRAP_TEST_DIR}/test-env.sh"
BOOTSTRAP_TEST_ENV_EXAMPLE="${BOOTSTRAP_TEST_DIR}/test-env.example.sh"

if [[ -f "$BOOTSTRAP_TEST_ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$BOOTSTRAP_TEST_ENV_FILE"
elif [[ -f "$BOOTSTRAP_TEST_ENV_EXAMPLE" ]]; then
  # shellcheck disable=SC1090
  source "$BOOTSTRAP_TEST_ENV_EXAMPLE"
else
  echo "⚠️  No bootstrap test environment stub found; continuing with defaults" >&2
fi
