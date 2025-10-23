#!/usr/bin/env bash
# Helper script to run builds in Lima Alpine instance

set -euo pipefail

LIMA_INSTANCE="${LIMA_INSTANCE:-alpine-dd}"

if ! limactl list | grep -q "$LIMA_INSTANCE.*Running"; then
  echo "Error: Lima instance '$LIMA_INSTANCE' is not running"
  echo "Start it with: limactl start $LIMA_INSTANCE"
  exit 1
fi

# Run command in Lima
limactl shell "$LIMA_INSTANCE" "$@"
