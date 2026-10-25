# Feature Audit 1301: Prometheus metrics (port 9090)

Issue: #1301

## Current signals in repo
- Kubernetes agentapi tests look for metrics on port 9090: `platforms/kubernetes/scripts/agentapi/test.py`.
- SkyWalking scripts check metrics export on localhost:1234 (not 9090): `platforms/kubernetes/scripts/skywalking/verify.py`.

## Gaps / missing info
- No clear server-side metrics endpoint implementation located in app runtime.
- Port 9090 metrics claim may be limited to k8s deployment or missing in mainline.

## Plan / TODO
- [ ] Locate metrics exporter in runtime services (server/agentapi/etc.).
- [ ] If missing, add Prometheus exporter on 9090 and document configuration.
- [ ] Add smoke test for /metrics endpoint.

## Tests
- N/A (audit doc only).
