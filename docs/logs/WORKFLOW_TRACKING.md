# Workflow Issue Drafts (Generated 2025-09-30)

This file captures draft titles and bullet-point notes for the outstanding CI/CD workflows so we can open GitHub issues quickly while keeping TODO.md in sync.

| Workflow | Suggested Issue Title | Notes |
| --- | --- | --- |
| `.github/workflows/azure-appservice-deploy.yml` | `infra: review azure appservice deploy workflow` | Active version uses ACR + App Service; disabled variant exists. Verify secrets (`AZURE_*`) and health probes remain valid. |
| `.github/workflows/azure-webgui-deploy.yml` | `infra: validate azure webgui appservice deploy` | Same pattern as AI gateway; confirm doc parity with disabled copy. |
| `.github/workflows/build-and-push-image.yml` | `ci: audit ghcr build-and-push workflow` | GHCR build, Trivy scan, AKS deploy. Check secrets + helm values. Disabled legacy copy should be removed or documented. |
| `.github/workflows/ci-cd.yml` (disabled) | `ci: decide fate of legacy ci-cd workflow` | Full unit/e2e/build pipeline. Determine if archived. |
| `.github/workflows/ci-complex.yml` (disabled) | `ci: evaluate heavy security pipeline resurrection` | Contains Trivy, Snyk, Datadog CLI. Document reason for disablement. |
| `.github/workflows/ci-enhancements.yml` (disabled) | `ci: close out “ci enhancements” experiment` | Capture lessons; remove if obsolete. |
| `.github/workflows/ci-simplified.yml` (disabled) | `ci: align simplified ci variants` | Disabled copy vs active `.github/workflows/ci-simplified.yml`. Confirm duplication. |
| `.github/workflows/ci.yml` (disabled) | `ci: remove placeholder workflow` | Generic placeholder under disabled-expensive; determine removal. |
| `.github/workflows/claude-code-review.yml` | `ai: audit claude code review workflow` | Ensure OAuth token scope, prompt tuning, sticky comments settings; disabled copy to be pruned. |
| `.github/workflows/claude.yml` | `ai: validate @claude responder workflow` | Confirm rate limits, additional permissions, and lack of duplicates. |
| `.github/workflows/cost-monitor.yml` | `ops: replace cost monitor stub with metrics` | Weekly reminder only; decide on upgrade or removal of disabled copy. |
| `.github/workflows/datadog-service-catalog.yml` | `ops: update datadog service catalog registration` | Ensure service list up to date, secrets valid, disabled version consistent. |
| `.github/workflows/db-monitoring-deployment.yml` | `infra: tame db monitoring deployment workflow` | Huge pipeline (benchmarks, dashboards, azure config). Validate secrets & continue-on-error steps; disabled copy to archive. |
| `.github/workflows/dbm-verifier-run.yml` (disabled) | `infra: decide on dbm verifier workflow` | Verify overlap with db monitoring workflow; remove or rewrite. |
| `.github/workflows/demo-validation.yml` | `docs: streamline demo validation` | Ensure Go/KinD demo tests, shell lint, README checks still needed; disabled copy status. |
| `.github/workflows/dependency-compatibility.yml` | `ci: dependency compatibility matrix maintenance` | Node 18/20/22 matrix with issue auto-creation. Confirm throttling/issue creation logic; disabled copy alignment. |
| `.github/workflows/docker-multiarch.yml` (disabled) | `ci: retire docker multi-arch workflow` | Confirm need; remove if unused. |
| `.github/workflows/docs-automation.yml` | `docs: verify automation workflow auto-commits` | Ensure secrets, lychee link checks, disabled copy removal. |
| `.github/workflows/docs-ci-cd.yml` | `docs: audit docs ci/cd pipeline` | Overlaps deploy-docs; confirm container build + KUBE_CONFIG flow; disabled copy alignment. |
| `.github/workflows/error-tracking-integration.yml` | `ci: review error tracking integration workflow` | Auto-commits on main; confirm `[skip ci]` and deployment placeholder; disabled version doc. |
| `.github/workflows/ethicalcheck.yml` (disabled) | `security: evaluate ethicalcheck workflow` | Determine if to re-enable or drop. |
| `.github/workflows/gitops-deployment.yml` | `infra: rationalize gitops deployment pipeline` | Heavy security + deploy; confirm secrets list; disabled copy alignment. |
| `.github/workflows/infrastructure-tests.yml` | `infra: harden infrastructure tests pipeline` | Python/OpenTofu tests; note missing cache; disabled copy cleanup. |
| `.github/workflows/k8s-deploy.yml` (disabled) | `infra: close old k8s deploy workflow` | Ensure functionality covered elsewhere. |
| `.github/workflows/kind-code-server-smoke.yml` | `ci: monitor kind code-server smoke runtime` | Keep runtime under 5 min; confirm diagnostics retention. |
| `.github/workflows/kind-testing.yml` (disabled) | `ci: decide on legacy kind testing workflow` | Compare to new smoke test. |
| `.github/workflows/main-branch-ci.yml` | `ci: tune main branch lightweight ci` | Decide on codex install, lint/type-check behavior; check disabled copy. |
| `.github/workflows/performance-gates.yml` (disabled) | `perf: revisit performance gate workflow` | Document infra prerequisites before re-enabling. |
| `.github/workflows/production-deployment.yml` (disabled) | `infra: reconcile legacy production deployment workflow` | Align with current GitOps/Azure flows. |
| `.github/workflows/release-branch-ci.yml` | `ci: manage release branch comprehensive pipeline` | Evaluate runtime cost, secrets, force_deploy logic; disabled variant sync. |
| `.github/workflows/secret-scanning.yml` | `security: align secret scanning workflows` | Ensure skip logic matches main branch guard; disabled duplicate removal. |
| `.github/workflows/stale.yml` | `ops: review stale issue automation` | Confirm labels/exemptions; disabled copy removal. |
| `.github/workflows/standup-report.yml` | `ops: streamline standup report automation` | Confirm GH token scope + Slack channel usage; disabled copy removal. |
| `.github/workflows/synthetic-test.yml` (disabled) | `ops: retire synthetic test workflow` | Determine replacement (Datadog?). |
| `.github/workflows/test-ci-simplified.yml` | `ci: align simplified root test workflow` | Review docker setup & Datadog env; disabled copy parity. |
| `.github/workflows/test-simple.yml` | `ci: validate simple test workflow relevance` | Check Babel + Datadog path; disabled copy status. |
| `.github/workflows/trufflehog-on-demand.yml` (disabled) | `security: evaluate trufflehog on-demand workflow` | Decide if main guard covers need. |
| `.github/workflows/working-ci.yml` (disabled) | `ci: delete working-ci placeholder` | Remove if no longer used. |

Use these drafts when opening tracking issues, then link each GitHub issue back to `TODO.md`.
