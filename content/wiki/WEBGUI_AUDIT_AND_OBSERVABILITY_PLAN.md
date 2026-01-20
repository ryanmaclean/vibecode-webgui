---
title: WebGUI npm audit + observability coordination
description: npm audit fix results plus architecture, integration, testing, and documentation focus areas for WebGUI on Azure with Datadog LLM observability.
---

# WebGUI npm Audit & Observability Plan — 2026-01-20

## ✅ `npm audit fix --force`
```
npm audit fix --force
# npm 11.6.2 / node 25.2.1
# added 2325 packages, audited 2326 in 33s
# found 0 vulnerabilities
```
- Command executed from repo root (`vibecode/`).
- No lockfile changes were required; only local `node_modules/` content was generated.
- This run verifies that the current dependency graph already satisfies npm security guidance, so we can focus on architecture + observability deliverables for `st-981`.

## 🏗️ Architecture Review Snapshot
- **WebGUI + IDE surface** — `src/components/ide/CodeServerIDE.tsx` and related `src/components/ai/CodeAssistant.tsx` drive the browser IDE. Both rely on the `server/` WebSocket gateway for low-latency collaboration, so telemetry has to flow from the frontend (`next/app`) through `server/` to Datadog.
- **AI + LLM flows** — `src/lib/azure-ai-client.ts` already wraps Azure OpenAI, embeddings, and Computer Vision; it should emit spans + structured logs so Datadog LLM Observability sees prompt/response metadata without leaking secrets.
- **Azure infrastructure** — Terraform/Bicep stacks in `azure/` and `content/wiki/AZURE_INFRASTRUCTURE_SUMMARY.md` define AKS, PostgreSQL (pgvector), Key Vault, and AI Services. Each applies Datadog agents (+ Workload Identity) to ship metrics/traces.
- **Datadog estate** — `datadog/` holds service monitors, dashboards, and trace captures (`vibecode-webgui-smoke-traces-*.json`). The `vibecode-ai-gateway.datadog.yaml` + `vibecode-rag-app.datadog.yaml` configs stitch application + LLM signal back into Datadog.

## 🔌 Integration Points to Keep Tight
1. **Web telemetry → Datadog**: Use `datadog/browser-sdk` within WebGUI (check `public/vibecode-telemetry` assets) and ensure dashboards such as `datadog/vibecode-telemetry-dashboard.json` capture frontend KPIs.
2. **Backend spans**: `server/` (WebSocket + worker queue) and `queue-worker/` should add Datadog tracing middleware so LLM calls, workspace sync events, and Azure resource provisioning are correlated.
3. **Azure AI client metrics**: Wrap `src/lib/azure-ai-client.ts` responses with timing + token metadata, forwarding via `datadog/vibecode-ai-gateway.datadog.yaml` pipelines for LLM observability.
4. **Database + vector store**: Monitor Postgres (pgvector) + Valkey with `datadog/postgres.datadog.yaml` and `datadog/vibecode-valkey.datadog.yaml`; ensure ingestion services (e.g., `vibecode-pgvector/`) emit the same tags used on Azure infra dashboards.
5. **Deployment + CI**: `azure/build-unified-services-with-datadog.sh` and `docker-compose.repo.yml` both need environment parity so Datadog + Azure instrumentation behave consistently across local, CI, and prod.

## 🧪 Testing Strategy Refresh
- **Unit & integration**: Prioritize `tests/azure-embedding-e2e.test.ts`, `tests/vector/vector-db-connection-router.test.ts`, and `tests/datadog/local-dev-datadog-tests.sh` to verify Azure + Datadog glue before merging infra tweaks.
- **Synthetic + smoke**: Re-run `datadog/datadog-synthetics.json` monitors after any WebGUI deploy; correlate with `datadog/vibecode-webgui-smoke-traces-*.json` exports for LLM spans.
- **Load + perf**: Leverage `tests/performance-jest.setup.js` and `test-rag-basic.ts` to stress code-paths that call Azure OpenAI; compare with Datadog dashboards to confirm trace counts + latency budgets.
- **Documentation-driven testing**: `tests/TESTING_GUIDE.md` plus `content/wiki/AZURE_INFRASTRUCTURE_SUMMARY.md` outline environment contracts—use them to define acceptance for any new Datadog LLM observability hooks.

## 📚 Documentation & Coordination
- This note (`content/wiki/WEBGUI_AUDIT_AND_OBSERVABILITY_PLAN.md`) documents the audit run + next architectural focus so pyrite (lead on `st-981`) can plug it into the epic’s integration plan.
- Update linked docs as work lands:
  - `content/wiki/AZURE_INFRASTRUCTURE_SUMMARY.md` for infra deltas
  - `datadog/README.md` for monitor changes + LLM signal mapping
  - `docs/archive/FINAL-COMPREHENSIVE-ANALYSIS.md` if architecture assumptions shift
- Next coordination step: share this summary + audit status with `vibecode/polecats/pyrite`, call out any blockers, and align on Datadog dashboards + Azure resource owners.

## 📌 Next Steps
1. Attach Datadog span/log hooks to `src/lib/azure-ai-client.ts` + queue workers so every LLM hop includes prompt/token metadata.
2. Validate dashboards + monitors from `datadog/vibecode-telemetry-dashboard.json` against live traffic once WebGUI hits Azure staging.
3. Expand integration tests for WebGUI ↔ Datadog ↔ Azure in `tests/integration/` so we catch regressions before shipping.
4. Keep npm audit zeroed—schedule `npm audit --production` in CI and document remediation procedures alongside Datadog observability steps.
