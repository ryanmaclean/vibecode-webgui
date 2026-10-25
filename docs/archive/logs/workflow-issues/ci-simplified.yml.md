# Issue Draft: Tighten `ci-simplified` Pipeline

## Summary
The simplified CI pipeline runs linting, audits, and root tests with optional Datadog/Lighthouse integration. Secret gating was added, but we still run several commands with `continue-on-error`, making it easy to miss failures. We need to capture concrete follow-ups so the flow is actionable again.

## Current Status
- Push/PR triggers on `main`/`develop`; concurrency guard already present.
- Secret validation now outputs flags (`has_dd_api_key`, `has_dd_app_key`, `has_lhci_token`, `has_dd_synthetic_ids`) but downstream jobs still ignore the outputs.
- Root tests run with `continue-on-error`, so failures emit warnings without failing the workflow.
- LHCI and synthetic checks absent; Datadog CI visibility toggled via env variable.

## Proposed Remediation
1. **Wire outputs**: Use the secret flags to conditionally run Datadog/LHCI steps once they exist, avoiding noisy warnings.
2. **Failure policy**: Decide which test commands must fail the job and remove `continue-on-error` where appropriate; surface optional failures via artifacts.
3. **Cache hygiene**: Revisit package install step (currently deletes lockfile); ensure cross-platform installs stay deterministic.
4. **Reporting**: Post a short summary comment when optional steps are skipped for missing secrets.

## Acceptance Criteria
- Pipeline fails when critical audits/tests fail, while optional steps provide clear skip messaging.
- TODO entry links to GitHub issue with owner and timeline for completing cleanup.

## Progress Log
- **2025-09-30:** Added secret validation outputs for Datadog/LHCI and kept concurrency guard; next step is to consume outputs and tighten failure handling.
