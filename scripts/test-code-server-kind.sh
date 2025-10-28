#!/usr/bin/env bash
set -euo pipefail

SMOKE_START=$(date +%s)

CLUSTER_NAME=${KIND_CLUSTER_NAME:-vibecode-test}
NAMESPACE=vibecode-platform
SERVICE=code-server-kind
IMAGE=${CODE_SERVER_IMAGE:-ghcr.io/ryanmaclean/vibecode-codeserver:latest}

if [ "${SKIP_CODE_SERVER_BUILD:-false}" != "true" ]; then
  echo "==> Building local code-server image"
  if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
    docker build -t "$IMAGE" -f docker/code-server/Dockerfile.kind .
  fi
else
  echo "==> Skipping local build; using existing image $IMAGE"
fi

echo "==> Loading image into KinD cluster $CLUSTER_NAME"
if [ "${SKIP_CODE_SERVER_BUILD:-false}" != "true" ]; then
  kind load docker-image "$IMAGE" --name "$CLUSTER_NAME"
else
  echo "==> Skipping kind image load for remote image"
fi

echo "==> Ensuring namespace $NAMESPACE exists"
kubectl get namespace "$NAMESPACE" >/dev/null 2>&1 || kubectl create namespace "$NAMESPACE" >/dev/null

echo "==> Applying k8s manifest"
kubectl apply -f k8s/code-server-kind.yaml >/dev/null

if [ "${CODE_SERVER_IMAGE:-ghcr.io/ryanmaclean/vibecode-codeserver:latest}" != "ghcr.io/ryanmaclean/vibecode-codeserver:latest" ]; then
  echo "==> Patching deployment to use ${CODE_SERVER_IMAGE}"
  kubectl set image deployment/$SERVICE -n "$NAMESPACE" code-server=${CODE_SERVER_IMAGE} >/dev/null
fi

echo "==> Restarting deployment to pick up latest image"
kubectl rollout restart deployment/$SERVICE -n "$NAMESPACE" >/dev/null

echo "==> Waiting for rollout"
kubectl rollout status deployment/$SERVICE -n "$NAMESPACE" --timeout=120s >/dev/null

echo "==> Port-forward check"
kubectl port-forward svc/$SERVICE -n "$NAMESPACE" 3100:8765 >/tmp/code-server-portforward.log 2>&1 &
PF_PID=$!
trap 'kill $PF_PID >/dev/null 2>&1 || true' EXIT
sleep 8
curl -s -L --max-redirs 2 -w '%{http_code}\n' -o /dev/null http://localhost:3100

kill $PF_PID >/dev/null 2>&1 || true

echo "==> NodePort check"
CONTROL_PLANE_IP=$(docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' ${CLUSTER_NAME}-control-plane)
NODE_PORT=$(kubectl get svc/$SERVICE -n "$NAMESPACE" -o jsonpath='{.spec.ports[0].nodePort}')
curl -s -L --max-redirs 2 -w '%{http_code}\n' -o /dev/null http://$CONTROL_PLANE_IP:$NODE_PORT

echo "==> Verifying terminal editors"
CODE_SERVER_NAMESPACE="$NAMESPACE" CODE_SERVER_SELECTOR="app=code-server,tier=workspace" \
  ./scripts/test-code-server-editors.sh

echo "✅ code-server reachable via port-forward and NodePort"

SMOKE_END=$(date +%s)
if [ -n "${DD_API_KEY:-}" ] && command -v datadog-ci >/dev/null 2>&1; then
  duration=$(( SMOKE_END - SMOKE_START ))
  export DATADOG_SITE="${DATADOG_SITE:-datadoghq.com}"
  datadog-ci metrics submit codeserver.kind.latency "$duration" --type gauge --tags "arch:amd64,cluster:${KIND_CLUSTER_NAME:-vibecode-ci},repo:${GITHUB_REPOSITORY:-local},run:${GITHUB_RUN_ID:-local},image:${CODE_SERVER_IMAGE:-unknown}"
  datadog-ci metrics submit codeserver.kind.success 1 --type gauge --tags "arch:amd64,cluster:${KIND_CLUSTER_NAME:-vibecode-ci},repo:${GITHUB_REPOSITORY:-local},run:${GITHUB_RUN_ID:-local},image:${CODE_SERVER_IMAGE:-unknown}"
  datadog-ci events post "code-server KinD smoke success" "Image ${CODE_SERVER_IMAGE:-unknown} validated in ${duration}s" --tags "cluster:${KIND_CLUSTER_NAME:-vibecode-ci},workflow:codeserver-multiarch,repo:${GITHUB_REPOSITORY:-local}"
fi
