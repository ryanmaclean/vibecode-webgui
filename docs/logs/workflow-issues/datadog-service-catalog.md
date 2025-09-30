# Issue Draft: Refresh `datadog-service-catalog` Workflow

## Summary
The Datadog service catalog workflow validates our `*.datadog.yaml` descriptors and registers them with Datadog. It was moved to manual dispatch after secrets drift and schema mismatches caused repeated failures. We need to verify configuration and make the automation safe to run on a schedule again.

## Current Status
- Trigger sits under disabled-expensive; workflow currently manual-only via `workflow_dispatch`.
- Requires `DD_API_KEY`, `DD_APP_KEY`, and access to the `datadog/service-catalog/action`. Keys were last rotated before the API migration.
- YAML inventory has grown; missing or invalid entries cause the workflow to fail fast without clear mapping to owners.

## Proposed Remediation
1. **Secret validation**: Confirm API/app keys exist in GitHub Secrets and map to the correct Datadog org/permissions (service catalog write scope).
2. **Schema linting**: Add a local step that runs `datadog-ci service-catalog lint` against each descriptor to provide actionable errors before hitting the API.
3. **Ownership metadata**: Ensure each service YAML lists the correct `team`, `contact`, and `tier` so alerts route properly.
4. **Scheduling**: Reintroduce a weekly cron plus PR/docs triggers to catch stale descriptors, with secret-aware gating so the job skips gracefully if keys are missing.
5. **Reporting**: Publish a summary artifact (or PR comment) highlighting which services were updated/registered and any warnings.

## Acceptance Criteria
- Workflow succeeds with current secrets, linting all descriptors and registering them with Datadog.
- Missing or invalid descriptors surface as GitHub annotations indicating file + field.
- Weekly scheduled run completes without manual intervention and posts summary output.
- TODO entry updated with link to GitHub issue once filed, and documentation notes rotation cadence/location of keys.

## Follow-ups / Dependencies
- Coordinate with Observability team on service ownership list and escalate any missing teams.
- Decide whether to couple this workflow with the Datadog trace verification job for unified reporting.

## Progress Log
- **2025-09-30:** Drafted remediation outline; awaiting secret confirmation and linting updates before re-enabling triggers.
