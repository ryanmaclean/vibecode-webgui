# Webhook Service

Minimal webhook receiver for local development and deployments. It accepts POST requests at `/webhook` and exposes a `/health` endpoint.

## Local usage

```bash
docker compose up --build
```

## Environment variables

- `PORT` (default: 5001)
- `JSON_LIMIT` (default: 1mb)
- `WEBHOOK_SECRET` (optional, HMAC SHA-256)

When `WEBHOOK_SECRET` is set, send `x-webhook-signature` as a hex digest, or `x-hub-signature-256` as `sha256=<hex>`.
