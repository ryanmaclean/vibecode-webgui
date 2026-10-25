# Issue Draft: Harden `deploy-aks-monitoring` Workflow

## Summary
The manual AKS deployment workflow provisions ingress, cert-manager, application, and Datadog monitoring. We introduced concurrency and secret gating so runs skip when Azure/Datadog credentials are missing. We still need to streamline the optional paths, ensure idempotent cleanup, and document usage.

## Current Status
- Workflow dispatch only; concurrency guard stops overlapping runs.
- Secret validation now sets outputs so AKS stages run only when Azure secrets exist; Datadog stages depend on both secrets and the skip flag.
- Missing secrets emit notices via `missing-azure-secrets` job; Datadog steps skip silently when keys absent.
- Long-running helm installs and scripts still have generous timeouts and limited retry logic.

## Proposed Remediation
1. **Credential audit**: Confirm Azure and Datadog secrets in repository environments; document rotation cadence.
2. **Optional stages**: Surface skip reasons in summary (not just logs) and consider adding PR comments when Datadog is disabled.
3. **Timeout tuning**: Review helm installs and health checks for better retry/backoff instead of fixed sleeps.
4. **Cleanup**: Ensure ingress/cert-manager deploys are idempotent and add tear-down guidance for failures.
5. **Documentation**: Update runbooks to explain workflow inputs (`skip_datadog`, namespace overrides) and escalate instructions.

## Acceptance Criteria
- Workflow exits cleanly with actionable messaging when secrets absent.
- Successful runs produce a summary referencing Datadog, ingress, and cert-manager status.
- TODO entry links the GitHub issue; DECISION/COORDINATION logs note when automated runs resume.

## Progress Log
- **2025-09-30:** Added concurrency and secret gating, optional Datadog guard, and missing-secret notice job.
