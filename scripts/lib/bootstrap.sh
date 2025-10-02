#!/usr/bin/env bash

# Shared bootstrap helpers for scripts living under scripts/ops and scripts/tests.
# Provides a consistent way to derive $SCRIPTS_ROOT and $LIB_DIR.

if [[ -n "${BOOTSTRAP_SH_SOURCED:-}" ]]; then
  return
fi

BOOTSTRAP_SH_SOURCED=1

bootstrap_init() {
  if [[ $# -lt 1 ]]; then
    echo "bootstrap_init requires the calling script directory" >&2
    return 1
  fi

  local caller_dir="${1}"

  if [[ ! -d "$caller_dir" ]]; then
    echo "bootstrap_init: directory not found: $caller_dir" >&2
    return 1
  fi

  if [[ -z "${SCRIPTS_ROOT:-}" ]]; then
    if [[ "$(basename "$caller_dir")" == "scripts" ]]; then
      SCRIPTS_ROOT="$caller_dir"
    else
      SCRIPTS_ROOT="$(cd "$caller_dir/.." && pwd)"
    fi
  fi

  if [[ -z "${LIB_DIR:-}" ]]; then
    LIB_DIR="${SCRIPTS_ROOT}/lib"
  fi

  if [[ ! -d "$LIB_DIR" ]]; then
    echo "Unable to locate scripts/lib directory (expected at $LIB_DIR)" >&2
    return 1
  fi

  export SCRIPTS_ROOT
  export LIB_DIR
}
