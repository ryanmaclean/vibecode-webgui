# Issue Draft: Repair `infrastructure-tests` Workflow

## Summary
The infrastructure regression workflow provisions Azure resources with OpenTofu, runs Python-based validation, and exports artifacts. It now requires manual triggering after repeated failures due to missing Azure credentials and long provisioning times. Bringing it back online is essential before the next infrastructure change window.

## Current Status
- Push/PR triggers restored for infra paths; manual dispatch remains available for drills.
- Secrets required: `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_SUBSCRIPTION_ID`, `POSTGRES_CONNECTION`, `DD_API_KEY`, `DD_APP_KEY`, plus GitHub environment protection rules.
- `validate-secrets` job surfaces missing credentials and skips integration/e2e stages to avoid wasted provisioning minutes.
- Cleanup step is optional; stale resource groups have been left behind in prior runs.

## Proposed Remediation
1. **Credential audit**: Verify Azure service principal and Datadog keys exist in the target environment; document storage location and rotation plan.
2. **Preflight checks**: Add a `validate-secrets` job mirroring release CI that fails fast with actionable messages when credentials missing.
3. **Timeout tuning**: Increase `timeout-minutes` to 60 but add progress logging and explicit `--timeout` flags in OpenTofu commands to avoid hanging on failure.
4. **Resource cleanup**: Make cleanup step default true and add defensive logic to delete partial resources even on job failure.
5. **Trigger strategy**: Re-enable PR trigger for infra-affecting paths with concurrency control so only one run executes at a time. Keep manual dispatch for ad-hoc verification.

## Acceptance Criteria
- Workflow passes end-to-end on a test branch with injected secrets.
- Resource groups created during tests are deleted automatically even if validation fails.
- Logs clearly identify which secrets or environment variables are missing when runs abort early.
- Push/PR triggers for infra paths restored with concurrency guard to prevent overlap.
- Monitoring entry added to DECISION_LOG documenting when and why the workflow was re-enabled.

## Follow-ups / Dependencies
- Coordinate with FinOps to estimate Azure spend per run; consider running nightly in a cost-controlled subscription.
- Evaluate whether some tests can be shifted to integration/unit level to reduce full provisioning frequency.

## Progress Log
- **2025-09-30:** Re-enabled path-based triggers with concurrency guard and added `validate-secrets` gating so integration/e2e stages skip unless Azure/DB/Datadog credentials are present. Unit tests continue to run by default; still need to implement automatic cleanup and extend logging.
