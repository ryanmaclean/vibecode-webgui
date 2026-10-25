# docs/archive/infra-1024

Infra leaves archived on 2026-10-24 by WS9 of the vibecode-webgui split plan (#2125, #2128, #2131).
They were moved here unchanged with `git mv` from main 45b66abb0. History is kept (`git log --follow`).
Nothing in code, CI, `package.json` or a Dockerfile referenced them. This tree is not built, linted or
tested: `config/jest.config.js` ignores `<rootDir>/docs/archive/`, `tsconfig.json` includes only `src/`, and
`npm run lint` lints only `src/app/api/*`. WS10 moved this tree from `archive/infra-1024/` to `docs/archive/infra-1024/` on 2026-10-25 (see `../INDEX.md`).

Licence: MIT, same as the repo.

| archived path | origin | reason |
|---|---|---|
| `docker-compose.openvscode.yml` | repo root | OpenVSCode + PostgreSQL demo compose, not used by CI. Run with `--project-directory .` from the repo root |
| `platforms/electron-vibecode/` | `platforms/` | Electron runtime, not shipped (docs/ADR/desktop-runtime.md) |
| `infrastructure/database/` | `infrastructure/` | SQL setup scripts; `init-db.sql` at the root and `infrastructure/postgres/` are the live copies. WS10 removed 7 files here that were byte-identical to `prisma/*.sql` (see `docs/reports/repo-cleanup-2026-10/ws10-docs/pass2-removed.tsv`) |
| `infrastructure/litellm/` | `infrastructure/` | LiteLLM config; `config/docker/docker-compose.litellm.yml` is the live stack |
| `infrastructure/datadog-azure/`, `infrastructure/modules/` | `infrastructure/` | Azure OpenAI monitoring Terraform module, not wired into `infrastructure/terraform` |
| `infrastructure/launchd/` | `infrastructure/` | single launchd plist for a container runtime |
| `infrastructure/queue-worker/` | `infrastructure/` | Azure Functions PDF ingest worker, not deployed |
| `infrastructure/dashboards/` | `infrastructure/` | 4 early Datadog dashboards; `infrastructure/monitoring/datadog/dashboards/` is live |
| `infrastructure/lima/` | `infrastructure/` | Lima VM definition; `config/lima/` is live |
| `infrastructure/kind/` | `infrastructure/` | KIND cluster config; `platforms/kubernetes/k8s/kind-cluster-config.yaml` is live |
| `infrastructure/services/github-webhook/`, `infrastructure/services/webhook-service/` | `infrastructure/services/` | webhook services, not built by CI |
| `monitoring/datadog/dashboards/llm-observability-enhanced.json` | root `monitoring/` | near-duplicate variant of `infrastructure/monitoring/datadog/dashboards/llm-observability-enhanced.json` (adds `show_legend`, different cost/request queries); kept as a record, the live copy is unchanged |
