# CI Workflow File References

_Last updated: 2025-09-29 22:45 UTC_

This note collects the path filters used by active GitHub Actions workflows so upcoming file moves (Dockerfiles, documentation, infrastructure) can be coordinated without breaking automation. Disabled workflows are recorded separately for reference.

## Active workflows

| Workflow | Path filters (push / pull_request) | Notes |
| --- | --- | --- |
| `build-and-push-image.yml` | `src/**`, `public/**`, `package.json`, `package-lock.json`, `next.config.js`, `tailwind.config.js`, `tsconfig.json`, `Dockerfile.production` | Relocating `Dockerfile.production` or config files requires updating this list. |
| `gitops-deployment.yml` | `src/**`, `package.json`, root `Dockerfile`, `infrastructure/**`, workflow file | Any move of the root Dockerfile or `infrastructure/` tree needs a filter change. |
| `docs-ci-cd.yml` | `docs/**`, `*.md` (root markdown), workflow file | `*.md` catches remaining root markdown files; safe once all top-level docs migrate. |
| `docs-automation.yml` | `src/**`, `package.json`, `docs/**`, `**/*.md` | Very broad; expect this workflow to fire on any markdown change anywhere. |
| `dependency-compatibility.yml` | `package.json`, `package-lock.json` | No directory assumptions besides the root manifests. |
| `helm-package.yaml` | `charts/**`, `helm/**`, workflow file | Keep Helm assets within these directories. |
| `datadog-service-catalog.yml` | `datadog/service-catalog/**`, workflow file | Watches Datadog service catalog definitions. |
| `docs-automation.yml` (update job) | same filters as above | Generates documentation artefacts on pushes to `main`. |
| `azure-appservice-deploy.yml` | `services/ai-gateway/**`, workflow file (build context includes `services/ai-gateway/Dockerfile`) | Ensure Dockerfile stays in `services/ai-gateway/`. |
| `azure-webgui-deploy.yml` | Workflow expects repository root Dockerfile | Update if the main Dockerfile is moved under `docker/`. |
| `infrastructure-tests.yml` | `infrastructure/**`, `scripts/infrastructure/**`, workflow file | Covers terraform/helm manifests and helper scripts. |
| `db-monitoring-deployment.yml` | `datadog/dbm/**`, workflow file | Watches DBM deployment manifests. |

### Other notable workflows

- `docs-ci-cd.yml` and `docs-automation.yml` both monitor root markdown (`*.md` / `**/*.md`). Holding back the final root-level markdown move until these filters are tightened will avoid redundant runs.
- `azure` deployment workflows rely on the presence of Dockerfiles in their existing locations (root and `services/ai-gateway/`). When we consolidate Dockerfiles into `docker/`, update the `paths` filters and the explicit `docker build` commands simultaneously.

## Disabled / archived workflows

Workflows under `.github/workflows/disabled-expensive/` reference the old layout but may be revived later:

- `docker-multiarch.yml` enumerates Dockerfiles under the root, `services/ai-gateway/`, `docker/`, `docs/`, and `watermarkpodautoscaler/`.
- `docs-ci-cd.yml`, `gitops-deployment.yml`, and `azure-*.yml` variants mirror the active workflows above and will also need updated path filters if re-enabled.

## Follow-up

- When Dockerfiles move into a consolidated `docker/` directory, update the relevant `paths` arrays and build commands and reflect the change here.
- After migrating remaining root markdown, tighten `*.md` / `**/*.md` globs to the intended documentation locations and note the change.
