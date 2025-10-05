# Issue Draft: Harden `docs-ci-cd` Pipeline

## Summary
The docs CI/CD workflow performs security scans, Astro builds, container pushes, and optional Kubernetes deploys. It was forced to manual dispatch after recurring failures triggered by missing Azure and Datadog secrets during scheduled runs. We need to stabilize the pipeline and safely restore automated execution on docs changes.

## Current Status
- Push/PR path filters and weekly cron restored (docs files + workflow) with concurrency guard.
- Secret gating now publishes outputs (`has_dd_api_key`, `has_acr_creds`, `has_kube_config`) so container push, staging, production, and Datadog notification steps skip when credentials absent.
- Container fallback tags the image locally so KIND deployment can proceed even without ACR push; Datadog checks on staging are skipped unless keys are configured.
- Production deployment still blocks on both ACR and cluster credentials; secrets remain outstanding.

## Proposed Remediation
1. **Secret refresh**: Work with platform team to confirm Azure service principal credentials and Datadog keys. Document rotation cadence.
2. **Job gating**: Add `if` conditions to skip Azure deploy + Datadog notification steps when secrets missing, while still allowing build/test portions to succeed.
3. **Path filters**: Reintroduce push/PR triggers but scope to `docs/**` and `docs/astro/**` plus critical markdown; exclude trivial doc updates via commit message opt-out (`[skip docs-ci]`).
4. **Caching review**: Audit npm/astro cache keys to reduce repeated setup time.
5. **Observability**: Emit build/deploy duration metrics to Datadog once API keys present to track cost.

## Acceptance Criteria
- Docs build succeeds with only GitHub standard secrets present; Azure + Datadog steps politely skip when credentials absent.
- Scheduled run (weekly) succeeds end-to-end with valid secrets supplied.
- Auto-trigger on PR modifying `docs/**` executes within 15 minutes and reports status back to the PR.
- Documentation updated in `docs/logs/WORKFLOW_TRACKING.md` with remediation steps and owner.
- TODO.md checklist item for this workflow marked complete with GitHub issue reference.

## Follow-ups / Dependencies
- Align with Release team on whether container-based docs deploy is still desired or if GitHub Pages is sufficient.
- Confirm `docs/deploy/README.md` reflects the final workflow behavior and emergency rollback steps.

## Progress Log
- **2025-09-30:** Re-enabled docs triggers (push, PR, weekly cron) with secret-aware gating around container push, cluster deploy, and Datadog notifications. Staging job now skips Datadog validation when keys absent, and local image builds are tagged for KIND loading when ACR credentials are missing. Next steps: refresh Azure/Datadog secrets and document cache strategy.
