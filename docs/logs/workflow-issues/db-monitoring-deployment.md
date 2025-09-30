# Issue Draft: Stabilize `db-monitoring-deployment` Workflow

## Summary
The database monitoring workflow provisions diagnostics, tunes Azure Postgres, validates dashboards, and posts to Slack/Datadog. It is one of the costliest pipelines and was parked on manual dispatch after repeated failures from missing secrets and long runtimes. We need to make it safe to run automatically when infra/db changes land.

## Current Status
- Push/PR triggers active with weekly cron; concurrency guard prevents overlapping runs.
- Secret validation now emits outputs used to skip database/Datadog phases when credentials missing. A notice job fires instead of running heavy steps.
- Database schema/index/benchmark phases gated behind Postgres secret; Azure + Datadog deployment stages gated behind corresponding credentials. Slack notifications skip when webhook absent.
- Cleanup logic remains best-effort: Azure resources and dashboards still need idempotent teardown improvements.

## Proposed Remediation
1. **Secret gating**: Add upfront validation that outputs which secrets are present. Skip or downgrade jobs when credentials missing instead of failing mid-run.
2. **Concurrency + locking**: Ensure only one run per branch executes (GitHub concurrency group) and add resource tagging so cleanup scripts can safely delete staged assets.
3. **Modularize jobs**: Break the workflow into phases (preflight lint, terraform plan, apply, validation, teardown) with clear `if` conditions driven by inputs (e.g., dry-run).
4. **Timeout tuning**: Set explicit `timeout-minutes` and internal command timeouts to prevent hangs; add heartbeat logging every few minutes.
5. **Reporting**: Aggregate results into a single summary artifact/PR comment with links to Datadog dashboards and logs.
6. **Trigger strategy**: Re-enable triggers on relevant paths and add a nightly cron while guarding with secrets to keep coverage without surprise spend.

## Acceptance Criteria
- Workflow completes successfully with all secrets configured, cleaning up temporary resources even on failure.
- Missing secrets result in a skipped workflow with actionable warning output and no resource churn.
- Path-based triggers and nightly cron restored after validation run passes in GitHub Actions.
- TODO + DECISION logs updated with the date of re-enablement and owners.

## Follow-ups / Dependencies
- Coordinate with DB ops and Observability teams for dashboard coverage and alert routing.
- Ensure Terraform state/backend choices support Ephemeral runs (consider migrating to a preview environment).

## Progress Log
- **2025-09-30:** Added secret gating with concurrency, weekly cron, and phase-specific `if` conditions so expensive jobs skip when creds missing. Workflow still needs cleanup automation, Azure resource teardown, and reporting polish.
