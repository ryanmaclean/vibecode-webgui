#!/usr/bin/env bash
set -euo pipefail

# 1. Build minimal Monaco 0.53 code-server image
if ! docker image inspect vibecode/code-server:monaco053 >/dev/null 2>&1; then
  echo "ℹ️  Building vibecode/code-server:monaco053"
  docker build -t vibecode/code-server:monaco053 -f docker/code-server/Dockerfile.kind .
fi

# 2. Load image into the KinD cluster
kind load docker-image vibecode/code-server:monaco053 --name vibecode-test

# 3. Apply the KinD manifest
kubectl apply -f k8s/code-server-kind.yaml

# 4. Wait for deployment to roll out
kubectl rollout status deployment/code-server-kind -n vibecode-platform --timeout=120s

# 5. Port-forward and curl the editor
kubectl port-forward svc/code-server-kind -n vibecode-platform 3100:8080 >/tmp/code-server-kind-port-forward.log 2>&1 &
PF_PID=$!
trap "kill $PF_PID" EXIT
sleep 3
curl -sI http://localhost:3100 | head -n 1
