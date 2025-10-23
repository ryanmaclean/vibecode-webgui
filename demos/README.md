# VibeCode Demos

This directory collects the various demo entrypoints used during GenAI and monitoring walkthroughs. Each script assumes you have the dependencies installed (`npm install`) and any required services (PostgreSQL, Datadog) available locally or via Docker.

## Contents

| File | Description |
| --- | --- |
| `genai-workflow.ts` | TypeScript workflow that exercises end-to-end GenAI with PostgreSQL pgvector and Datadog monitoring. |
| `easy-mode-postgres-genai.sh` | Shell quickstart script that bootstraps the GenAI demo against a local Docker Compose environment. |
| `simple-vector-demo.cjs` | Minimal CommonJS script showing basic vector operations for onboarding workshops. |
| `web-interface.html` | Static walkthrough to manually validate the demo UI from a browser. |

## Running the TypeScript workflow

```bash
# from repository root
npm install
npm run dev # optional: if you want the UI running in parallel
cd demos
npx ts-node genai-workflow.ts
```

## Shell quickstart

```bash
./demos/easy-mode-postgres-genai.sh
```

This script expects Docker Compose to be available and will launch the required services for you.

## Simple vector demo

```bash
node demos/simple-vector-demo.cjs
```

## Static walkthrough

You can open the HTML helper directly in a browser:

```bash
open demos/web-interface.html
```

## Monitoring assets

Datadog dashboards, values files, and supporting assets now live under `ops/monitoring/`. Import the dashboards with `datadog-ci` per `docs/DATADOG_MONITORING_CONFIGURATION.md`.

## Fast OpenVSCode microVM

The prebuilt OpenVSCode microVM used for instant IDE boot is packaged as a GitHub Release asset:

- Release tag: [`fast-openvscode-vm-v0.1.0`](https://github.com/ryanmaclean/vibecode-webgui/releases/tag/fast-openvscode-vm-v0.1.0)
- Archive contents: kernel (`vmlinuz-host`), initramfs, rootfs, and helper downloads.

To rebuild the package locally, run:

```bash
scripts/release/package-fast-openvscode-vm.sh
```

This creates a timestamped archive in `dist/` along with a SHA256 checksum. Upload the generated files to a new release via:

```bash
gh release create fast-openvscode-vm-v<new-version> dist/fast-openvscode-vm-*.tar.gz dist/fast-openvscode-vm-*.tar.gz.sha256 \
  --title "Fast OpenVSCode VM v<new-version>" --notes "<summary>"
```

The packaging script intentionally ignores the VM sources via `.gitignore`, so the repository remains lightweight for other collaborators.

### Automated Packaging Workflow (Draft)

- Workflow file: see `archive/agents/release/2025-10-22-ci-workflow-skeleton.yml`
- Jobs:
  1. **package** – runs `scripts/release/package-fast-openvscode-vm.sh`, computes SHA256 sums, uploads artifacts
  2. **draft-release** – downloads artifacts and creates a draft GitHub release with checksums attached
- Trigger: `workflow_dispatch` (manual) with input `build-type` (`stable` or `insiders`)
- Next steps: move the skeleton into `.github/workflows/` once handshake and benchmark checks are green.

### Handshake Smoke Test

Use `scripts/tests/fast-openvscode-handshake.sh` to verify the packaged image serves `/` without connection resets:

```bash
FAST_OPENVSCODE_HOST=http://localhost:8080 scripts/tests/fast-openvscode-handshake.sh
```

The script records curl traces under `artifacts/` for triage.

### Nightly Verification Report

- Template: `reports/nightly/template.md`
- Checklist items: MCP health, Next.js API integration test, handshake smoke test, benchmark upload, release artifact verification, documentation updates.
- Automation: Codex-Verification personas will wire the template into CI once benchmark and release jobs are stable.
