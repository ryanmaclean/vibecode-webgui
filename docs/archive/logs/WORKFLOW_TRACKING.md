# Workflow Tracking (2025-09-30)

This table maps each workflow called out in TODO.md to its tracking issue and notes about the intended follow-up. Use it when filing updates and closing TODO items.

| Workflow(s) | Issue | Notes |
| --- | --- | --- |
| `.github/workflows/azure-appservice-deploy.yml` | #355 | Active workflow validated; disabled-expensive duplicate removed so this remains the single source. Issue draft: docs/logs/workflow-issues/azure-appservice-deploy.md. |
| `.github/workflows/azure-webgui-deploy.yml` | #356 | Duplicate disabled workflow deleted; continue to monitor App Service deploy health checks. Issue draft: docs/logs/workflow-issues/azure-webgui-deploy.md. |
| `.github/workflows/build-and-push-image.yml` | #357 | Active GHCR build pipeline under review; disabled-expensive duplicate removed. Issue draft: docs/logs/workflow-issues/build-and-push-image.md. |
| `.github/workflows/ci-simplified.yml` (+ disabled variant) | #361 | Align simplified CI job with archived copy; capture missing checks or delete duplicate. Issue draft: docs/logs/workflow-issues/ci-simplified.yml.md. Secret outputs added 2025-09-30. |
| `.github/workflows/claude-code-review.yml` (+ disabled variant) | #363 | Confirm Anthropics reviewer configuration, token scope, and consolidate workflows. Issue draft: docs/logs/workflow-issues/claude-code-review.md. Secret gating added 2025-09-30. |
| `.github/workflows/claude.yml` (+ disabled variant) | #364 | Validate @claude responder triggers/permissions; secret gating added 2025-09-30. Issue draft: docs/logs/workflow-issues/claude.yml.md. |
| `.github/workflows/cost-monitor.yml` (+ disabled variant) | #365 | Decide whether to keep weekly reminders or replace with real cost metrics; remove redundant copy. Issue draft: docs/logs/workflow-issues/cost-monitor.md. |
| `.github/workflows/datadog-service-catalog.yml` (+ disabled variant) | #366 | Keep service metadata in sync and ensure secrets remain valid. Issue draft: docs/logs/workflow-issues/datadog-service-catalog.md. |
| `.github/workflows/datadog-trace-verify.yml` | #392 | Added guard for missing secrets and artefact warnings; next step is to re-enable scheduled runs once creds available. |
| `.github/workflows/db-monitoring-deployment.yml` (+ disabled variant) | #367 | Review extensive Datadog/Azure monitoring job, streamline secrets, and archive duplicates. Issue draft: docs/logs/workflow-issues/db-monitoring-deployment.md. |
| `.github/workflows/dbm-verifier-run.yml` (disabled) | #368 | Determine whether DBM verifier workflow is still needed or can be removed. |
| `.github/workflows/demo-validation.yml` (+ disabled variant) | #390 | Validate Go/KinD demo checks and consolidate duplicate workflows. Issue draft: docs/logs/workflow-issues/demo-validation.md. |
| `.github/workflows/dependency-compatibility.yml` (+ disabled variant) | #369 | Maintain Node version matrix, npm audits, and Github-script issue creation without spam. Issue draft: docs/logs/workflow-issues/dependency-compatibility.md. |
| `.github/workflows/deploy-aks-monitoring.yml` | #393 | Review manual AKS deploy flow, required inputs, and `skip_datadog` flag behavior. Issue draft: docs/logs/workflow-issues/deploy-aks-monitoring.md. |
| `.github/workflows/deploy-docs.yml` | #394 | Confirm Astro/Next.js dual-mode deploy remains accurate with GitHub Pages concurrency. Issue draft: docs/logs/workflow-issues/deploy-docs.md. |
| `.github/workflows/docs-automation.yml` (+ disabled variant) | #370 | Ensure auto README/API updates run safely and old workflow is removed. Issue draft: docs/logs/workflow-issues/docs-automation.md. Triggers/cron restored 2025-09-30 with artifact-based flow. |
| `.github/workflows/docs-ci-cd.yml` (+ disabled variant) | #371 | Audit docs CI/CD (security scans, container push) and reconcile with deploy-docs. Issue draft: docs/logs/workflow-issues/docs-ci-cd.md. Triggers restored with secret gating 2025-09-30; pending secret refresh + cleanup. |
| `.github/workflows/error-tracking-integration.yml` (+ disabled variant) | #372 | Check Datadog error tracking automation, `[skip ci]` commits, and duplicates. Issue draft: docs/logs/workflow-issues/error-tracking-integration.md. PR trigger + secret gating restored 2025-09-30; awaiting secrets + alerting. |
| `.github/workflows/ethicalcheck.yml` (disabled) | #373 | Evaluate value of EthicalCheck security workflow and decide on removal. |
| `.github/workflows/gitops-deployment.yml` (+ disabled variant) | #374 | Confirm GitOps pipeline steps, secret usage, and overlap with current deploys. |
| `.github/workflows/infrastructure-tests.yml` (+ disabled variant) | #375 | Harden Python/OpenTofu infra tests, consider caching, and archive duplicates. |
| `.github/workflows/k8s-deploy.yml` (disabled) | #376 | Decide whether the old Kubernetes deploy workflow is still needed. |
| `.github/workflows/kind-code-server-smoke.yml` | #395 | Monitor nightly KinD smoke runtime (<5 min) and diagnostics retention. |
| `.github/workflows/kind-testing.yml` (disabled) | #377 | Compare legacy KinD suite with new smoke test and retire if redundant. |
| `.github/workflows/main-branch-ci.yml` (+ disabled variant) | #378 | Reassess lightweight CI (Codex MCP, lint/type-check strategy) and consolidate copies. Issue draft: docs/logs/workflow-issues/main-branch-ci.yml.md. |
| `.github/workflows/performance-gates.yml` (disabled) | #379 | Capture performance test prerequisites before deciding on re-enable/remove. |
| `.github/workflows/production-deployment.yml` (disabled) | #380 | Reconcile legacy production deploy job with modern GitOps/Azure flows. |
| `.github/workflows/release-branch-ci.yml` (+ disabled variant) | #381 | Manage comprehensive release CI (Playwright, GHCR, LHCI, Datadog triggers). |
| `.github/workflows/secret-scanning.yml` (+ disabled variant) | #382 | Align TruffleHog diff scanning across workflows and avoid duplication. Concurrency added 2025-09-30. |
| `.github/workflows/stale.yml` (+ disabled variant) | #383 | Ensure actions/stale configuration matches triage policy; remove extra copy. Concurrency added 2025-09-30. |
| `.github/workflows/standup-report.yml` (+ disabled variant) | #384 | Validate daily standup automation (GH issue + Slack) and consolidate workflows. Concurrency + summary added 2025-09-30. |
| `.github/workflows/synthetic-test.yml` (disabled) | #385 | Decide whether synthetic monitoring should be replaced or abandoned. |
| `.github/workflows/test-ci-simplified.yml` (+ disabled variant) | #386 | Review root infra tests pipeline and dedupe Docker setup steps. |
| `.github/workflows/test-simple.yml` (+ disabled variant) | #387 | Determine ongoing value of simple Jest/Babel sanity checks. |
| `.github/workflows/trufflehog-on-demand.yml` (disabled) | #388 | Evaluate need for manual TruffleHog workflow given primary secret scanning. |
| `.github/workflows/working-ci.yml` (disabled) | #389 | Remove the generic CI placeholder after verifying no references remain. |
| `.github/workflows/docker-multiarch.yml` (disabled) | #391 | Decide whether multi-arch builds are still required or remove the workflow. |
