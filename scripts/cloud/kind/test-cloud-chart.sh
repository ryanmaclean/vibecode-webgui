#!/usr/bin/env bash
set -euo pipefail

CLUSTER_NAME=${CLUSTER_NAME:-codeserver-cloud}
HELM_RELEASE=${HELM_RELEASE:-codeserver}
CHART_PATH=${CHART_PATH:-helm/code-server-cloud}

command -v kind >/dev/null 2>&1 || { echo "kind is required" >&2; exit 1; }
command -v kubectl >/dev/null 2>&1 || { echo "kubectl is required" >&2; exit 1; }
command -v helm >/dev/null 2>&1 || { echo "helm is required" >&2; exit 1; }

if ! kind get clusters | grep -q "^${CLUSTER_NAME}$"; then
  kind create cluster --name "$CLUSTER_NAME"
fi

kubectl config use-context "kind-${CLUSTER_NAME}"

helm upgrade --install "$HELM_RELEASE" "$CHART_PATH" \
  --set auth.password="kindtest" \
  --namespace default

echo "Waiting for deployment rollout..."
kubectl rollout status deployment/$HELM_RELEASE --timeout=180s

echo "Run 'kubectl port-forward svc/$HELM_RELEASE 8765:80' to access code-server."
