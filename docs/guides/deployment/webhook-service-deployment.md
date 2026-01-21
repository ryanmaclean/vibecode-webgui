# Webhook Service Deployment

This guide covers running the webhook service locally with Docker Compose and deploying it to Kubernetes.

## Overview

The webhook service listens on port `5001` for incoming POST requests to `/webhook` and provides `/health` for probes.

## Local development (Docker Compose)

```bash
cd services/webhook-service
docker compose up --build
```

Send a test request:

```bash
curl -X POST http://localhost:5001/webhook \
  -H 'content-type: application/json' \
  -d '{"status":"ok"}'
```

## Kubernetes deployment

1. Build and push the image:

```bash
docker build -t ghcr.io/vibecode/webhook-service:latest services/webhook-service
docker push ghcr.io/vibecode/webhook-service:latest
```

2. Apply manifests:

```bash
kubectl apply -f k8s/webhook-service/00-namespace.yaml
kubectl apply -f k8s/webhook-service/01-configmap.yaml
kubectl apply -f k8s/webhook-service/02-secrets.yaml
kubectl apply -f k8s/webhook-service/03-deployment.yaml
kubectl apply -f k8s/webhook-service/04-service.yaml
kubectl apply -f k8s/webhook-service/05-hpa.yaml
```

3. Verify:

```bash
kubectl -n vibecode-platform get pods -l app=webhook-service
kubectl -n vibecode-platform port-forward service/webhook-service 5001:5001
curl -s http://localhost:5001/health
```

## Configuration

Set configuration in `k8s/webhook-service/01-configmap.yaml` and secrets in `k8s/webhook-service/02-secrets.yaml`.

- `PORT` (default: 5001)
- `JSON_LIMIT` (default: 1mb)
- `WEBHOOK_SECRET` (optional)

### Signature validation

If `WEBHOOK_SECRET` is set, the service expects a SHA-256 HMAC hex digest in `x-webhook-signature`.
For GitHub-style signatures, use `x-hub-signature-256: sha256=<hex>`.
