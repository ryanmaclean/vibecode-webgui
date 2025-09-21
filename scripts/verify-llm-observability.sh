#!/usr/bin/env bash

set -euo pipefail

NAMESPACE=${NAMESPACE:-vibecode-platform}
DEPLOYMENT=${DEPLOYMENT:-vibecode-webgui}
CONFIG_MAP=${CONFIG_MAP:-vibecode-config}
EXPECTED_ML_APP=${EXPECTED_ML_APP:-vibecode-ai}

command -v kubectl >/dev/null 2>&1 || {
  echo "kubectl is required for this check" >&2
  exit 1
}

echo "🔎 Checking Datadog LLM Observability wiring in namespace ${NAMESPACE}" 

echo "• Validating ConfigMap ${CONFIG_MAP} contains DD_LLMOBS_* keys (optional)"
if ! kubectl get configmap "${CONFIG_MAP}" -n "${NAMESPACE}" >/dev/null 2>&1; then
  echo "⚠️ ConfigMap ${CONFIG_MAP} not found; continuing because env vars may be injected directly"
else
  if ! kubectl get configmap "${CONFIG_MAP}" -n "${NAMESPACE}" -o jsonpath='{.data}' \
    | tr ',' '\n' \
    | grep -qE 'DD_LLMOBS_|DD_SITE'; then
    echo "⚠️ ConfigMap ${CONFIG_MAP} does not list DD_LLMOBS_* keys; ensure env vars are set elsewhere"
  else
    echo "✅ ConfigMap ${CONFIG_MAP} includes DD_LLMOBS_* keys"
  fi
fi

echo "• Inspecting env vars on deployment/${DEPLOYMENT}"
kubectl get deploy "${DEPLOYMENT}" -n "${NAMESPACE}" -o \
  jsonpath='{range .spec.template.spec.containers[0].env[*]}{.name}={.value}\n{end}' \
  | grep -E 'DD_LLMOBS_|DD_SITE'

echo "• Fetching first pod for deployment/${DEPLOYMENT}"

MATCH_LABELS_JSON=$(kubectl get deploy "${DEPLOYMENT}" -n "${NAMESPACE}" -o jsonpath='{.spec.selector.matchLabels}' 2>/dev/null || true)

if [[ -z "${MATCH_LABELS_JSON}" ]]; then
  echo "❌ Unable to read selector labels from deployment/${DEPLOYMENT}" >&2
  exit 1
fi

SELECTOR=$(MATCH_LABELS_JSON="${MATCH_LABELS_JSON}" python3 -c 'import json, os
data = os.environ.get("MATCH_LABELS_JSON", "").strip()
if not data:
    raise SystemExit(1)
labels = json.loads(data)
print(",".join(f"{k}={v}" for k, v in labels.items()))')

if [[ -z "${SELECTOR}" ]]; then
  echo "❌ Deployment ${DEPLOYMENT} has no selector labels" >&2
  exit 1
fi

POD=$(kubectl get pods -n "${NAMESPACE}" -l "${SELECTOR}" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)

if [[ -z "${POD}" ]]; then
  echo "❌ No pods found for deployment/${DEPLOYMENT} in ${NAMESPACE}" >&2
  exit 1
fi


echo "• Checking env vars inside pod ${POD}"
if ! kubectl exec -n "${NAMESPACE}" "${POD}" -- printenv DD_LLMOBS_ENABLED DD_LLMOBS_AGENTLESS_ENABLED DD_LLMOBS_ML_APP DD_SITE; then
  echo "⚠️ kubectl exec failed (container may be distroless); relying on deployment env inspection"
fi

echo "• Searching pod logs for tracer activation banner"
if kubectl logs -n "${NAMESPACE}" "${POD}" 2>/dev/null | grep -q "Datadog LLM Observability enabled"; then
  echo "✅ Found LLM Observability startup log"
else
  echo "⚠️ Did not find LLM Observability startup log in the current log window"
fi

echo "• Trigger an AI workflow to generate spans (manual step)"
echo "  curl -s http://<app-host>/api/ai/chat ... or use the UI to send a chat message"
echo "  Then confirm spans under service 'vibecode-webgui-openai' in Datadog APM (filter by ml.app=${EXPECTED_ML_APP})."

echo "✅ Verification script completed"
