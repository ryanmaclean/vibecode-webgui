# litellm-pgvector Deployment Guide

This guide explains how to deploy the LiteLLM+pgvector sample stack alongside `code-server` using the Helm assets that now live in this repository.

## Prerequisites

- Kubernetes cluster or local kind cluster (v1.28+ recommended)
- `helm` 3.13+
- `helmfile` 0.156+ (optional but recommended)
- Access to container registry for the images referenced in `values.yaml`
- OpenRouter/OpenAI API credentials (if you want live completions)

## Deploying with helmfile

```bash
# Ensure dependencies are available
helm dependency update charts/litellm-pgvector

# Point helmfile at the repo root
cd helm
helmfile apply
```

The `helmfile` installs two releases:

1. `code-server` in the `dev-tools` namespace (using the upstream coder chart)
2. `litellm-pgvector` in the `ai-platform` namespace

### Secrets

Before running `helmfile apply`, create the required secrets:

```bash
kubectl create namespace ai-platform
kubectl create secret generic litellm-openrouter \
  --from-literal=OPENROUTER_API_KEY="sk-or-..." \
  --namespace ai-platform

kubectl create secret generic litellm-postgresql \
  --from-literal=password="strongpassword" \
  --namespace ai-platform
```

If you prefer to use OpenAI/Azure OpenAI, add the corresponding environment variables to `helm/values/litellm-pgvector.yaml`.

### Shared Volume with code-server

`helm/values/code-server.yaml` mounts the `litellm-data` PVC (created by the sample chart) at `/home/coder/shared` so you can inspect embeddings or logs from within VS Code.

## Deploying Single Charts

You can install each chart individually if helmfile is not desired:

```bash
# Install the sample app
helm dependency update charts/litellm-pgvector
helm upgrade --install litellm charts/litellm-pgvector \
  --namespace ai-platform --create-namespace \
  -f helm/values/litellm-pgvector.yaml

# Install code-server using upstream chart
helm repo add coder-vscode https://coder-vscode.github.io/helm
helm upgrade --install code-server coder-vscode/code-server \
  --namespace dev-tools --create-namespace \
  -f helm/values/code-server.yaml
```

## Post-install Smoke Tests

After both releases are running, you can verify connectivity:

```bash
# Forward the LiteLLM service
kubectl -n ai-platform port-forward svc/litellm-pgvector 8080:8080

# Query health
curl http://127.0.0.1:8080/health

# Run an embedding search (requires seeded data)
curl -X POST http://127.0.0.1:8080/vector/search \
  -H 'Content-Type: application/json' \
  -d '{"query": "vector databases"}'
```

For the code-server instance:

```bash
kubectl -n dev-tools port-forward svc/code-server 8443:8443
# Open https://127.0.0.1:8443 using the password configured in helm/values/code-server.yaml
```

## Cleanup

```bash
helmfile destroy
# or
helm uninstall litellm -n ai-platform
helm uninstall code-server -n dev-tools
```

## Next Steps

- Extend the placeholder migrations job in `values.yaml` to run real seed scripts.
- Wire the chart into CI (see `.github/workflows/helm-package.yaml`).
- Add Ingress/Cert-Manager blocks once domain/TLS settings are available.
