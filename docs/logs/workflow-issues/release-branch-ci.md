# Issue Draft: Stabilize `release-branch-ci` Workflow

## Summary
The comprehensive release branch pipeline was switched to manual dispatch to stop repeated failures caused by missing secrets and long-running tests. We need to re-enable automatic triggers once the configuration is hardened so release branches regain CI coverage.

## Current Status
- Push/PR triggers restored for `release/*` and `hotfix/*`; workflow also supports manual dispatch for hotfix drills.
- Secrets required: `DD_API_KEY`, `DD_APP_KEY`, `LHCI_GITHUB_APP_TOKEN`, `vars.DD_SYNTHETIC_TEST_IDS`, container registry credentials (uses default `GITHUB_TOKEN`).
- Matrix jobs cover unit, integration, and Playwright e2e with Postgres/Redis services; Datadog/Lighthouse steps now gate on secret availability to avoid hard failures.
- Playwright stage waits for the dev server before running tests; cost-report and downstream jobs run automatically when earlier stages succeed.

## Proposed Remediation
1. **Secret inventory**: Coordinate with infra to load Datadog + Lighthouse secrets into repo/environment secrets. Confirm `DD_SYNTHETIC_TEST_IDS` contains the active synthetic test IDs.
2. **Secret guards**: Add conditional skips around Datadog/Lighthouse steps when secrets missing, producing actionable warnings rather than hard failures.
3. **Playwright stability**: Bump `BASE_URL` to `http://127.0.0.1:3000` and add readiness polling to reduce startup flakes.
4. **Cost visibility**: Emit job duration metrics to Datadog CI visibility once secrets restored so we can monitor spend.
5. **Re-enable triggers**: Restore push/PR triggers for `release/*` and `hotfix/*` after the above steps are merged.

## Acceptance Criteria
- All secrets validated in `validate-ci-config`; missing ones result in skipped steps with warnings, not job failure.
- `npm run test:unit`, integration, and Playwright jobs pass on a seeded release branch in CI.
- Docker image build/push job completes and publishes tags for the test branch.
- Workflow runs automatically on push to `release/<version>` and reports success in the Checks tab.
- Documentation updated (`docs/ci/README.md` or equivalent) explaining required secrets and how to run the workflow manually for hotfixes.

## Follow-ups / Dependencies
- Coordinate with Docs team to ensure release readiness checklist references the re-enabled workflow.
- Pair with Observability team to confirm Datadog dashboards for release CI are still wired up.
- Once stable, update TODO.md to mark the workflow as tracked and monitored.

## Progress Log
- **2025-09-30:** Re-enabled push/pull-request triggers with secret-aware gating in `validate-ci-config`. Added a dev-server readiness probe for Playwright so the workflow passes without manual sleep tuning. Remaining work: provision Datadog/LHCI secrets and capture cost telemetry.
