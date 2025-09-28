#!/usr/bin/env bash
set -euo pipefail

IMAGES=${HELM_IMAGES:-"codercom/code-server:latest bitnami/postgresql:16"}
CLUSTER_NAME=${KIND_CLUSTER_NAME:-"vibecode-provisioning-test"}

if ! command -v docker >/dev/null 2>&1; then
  echo "docker not found; skipping image pre-pull" >&2
  exit 0
fi

for IMAGE in $IMAGES; do
  echo "Pulling $IMAGE..."
  docker pull "$IMAGE" || echo "warning: failed to pull $IMAGE" >&2
  if command -v kind >/dev/null 2>&1 && kind get clusters | grep -qx "$CLUSTER_NAME"; then
    echo "Loading $IMAGE into kind cluster $CLUSTER_NAME..."
    kind load docker-image "$IMAGE" --name "$CLUSTER_NAME" || echo "warning: failed to load $IMAGE into kind" >&2
  fi
done
