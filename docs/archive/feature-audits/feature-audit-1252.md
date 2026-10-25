# Feature Audit #1252: Key Rotation (Easy API Key Updates)

## Summary
Key rotation is documented for infrastructure deployments (Azure Key Vault,
Kubernetes secrets automation) but there is no dedicated in-app key rotation
workflow surfaced in the UI.

## Evidence
- Key Vault rotation in infrastructure docs: `docs/src/content/docs/azure-infrastructure.md`
- Secrets automation + rotation support: `docs/src/content/docs/kubernetes-secrets-automation.md`
- Production checklist mentions secret rotation: `docs/deployment/PRODUCTION_CHECKLIST.md`

## Status
Partial: rotation is supported in infra pipelines; application-level key rotation
UX not explicitly implemented.

## Gaps / TODO
- Add UI/API flow for rotating provider keys and verifying rollovers.

## Test Plan
- Not run (documentation/infrastructure guidance only).
