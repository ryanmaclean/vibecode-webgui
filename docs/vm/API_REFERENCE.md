# OpenClaw VM API Reference

## Gateway API
- **Health Check**: `GET /health`
- **Status**: `GET /status`
- **Metrics**: `GET /metrics`

## Tailscale API
- **Status**: `GET /tailscale/status`
- **IP**: `GET /tailscale/ip`

## Monitoring API
- **Datadog**: `GET /datadog/metrics`
- **Alerts**: `GET /alerts`

## Authentication
All APIs require authentication token from `gateway.auth.token`.

## Examples
```bash
# Health check
curl http://localhost:18789/health

# With auth token
curl -H "Authorization: Bearer $TOKEN" http://localhost:18789/status
```
