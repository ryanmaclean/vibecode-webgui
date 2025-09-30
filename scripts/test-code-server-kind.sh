#!/usr/bin/env bash
set -euo pipefail

CLUSTER_NAME=${KIND_CLUSTER_NAME:-vibecode-test}
NAMESPACE=vibecode-platform
SERVICE=code-server-kind
IMAGE=vibecode/code-server:monaco053

echo "==> Building local code-server image (Monaco 0.53)"
if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  docker build -t "$IMAGE" -f docker/code-server/Dockerfile.kind .
fi

echo "==> Loading image into KinD cluster $CLUSTER_NAME"
kind load docker-image "$IMAGE" --name "$CLUSTER_NAME"

echo "==> Applying k8s manifest"
kubectl apply -f k8s/code-server-kind.yaml >/dev/null

echo "==> Waiting for rollout"
kubectl rollout status deployment/$SERVICE -n "$NAMESPACE" --timeout=120s >/dev/null

echo "==> Port-forward check"
kubectl port-forward svc/$SERVICE -n "$NAMESPACE" 3100:8080 >/tmp/code-server-portforward.log 2>&1 &
PF_PID=$!
trap 'kill $PF_PID >/dev/null 2>&1 || true' EXIT
sleep 3
curl -sI http://localhost:3100 | head -n 1

kill $PF_PID >/dev/null 2>&1 || true

echo "==> NodePort check"
CONTROL_PLANE_IP=$(docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' ${CLUSTER_NAME}-control-plane)
curl -sI http://$CONTROL_PLANE_IP:31080 | head -n 1

echo "==> Verifying terminal editors"
CODE_SERVER_NAMESPACE="$NAMESPACE" CODE_SERVER_SELECTOR="app=code-server,tier=workspace" \
  ./scripts/test-code-server-editors.sh

echo "✅ code-server reachable via port-forward and NodePort"
