# Datadog Observability Baseline

*Last updated: 2025-09-27*

This matrix captures the current monitoring posture based on the assets recently committed (`datadog/`, `docs/runbooks/`, Helm/Kubernetes manifests). It satisfies issue #296 and feeds the execution plan tracked in #297–#306. Each capability lists its status, primary evidence, and the next actions needed to consider it complete. Status codes: ✅ complete, 🔄 in progress, ⚠️ blocked, ⬜ not started.

## 1. Baseline & Gap Analysis

| Capability | Status | Evidence | Next Steps |
| --- | --- | --- | --- |
| Inventory & status matrix | 🔄 In progress | This document; TODO.md agent updates; runbooks under `docs/runbooks/` | Fill remaining rows as work lands and keep table current (issue #296). |

## 2. Core Observability Suite

| Capability | Status | Evidence | Next Steps |
| --- | --- | --- | --- |
| Infrastructure Monitoring (hosts/containers/K8s) | 🔄 | Helm overrides `k8s/datadog-values-kind.yaml`, `charts/vibecode/values-aks.yaml`; KIND DBM evidence (`datadog/dbm-kind-*`) | Extend validation to Azure AKS once KIND is stable (#312) and capture automated CI results. |
| APM & Distributed Tracing | 🔄 | Trace exports `datadog/vibecode-webgui-smoke-traces-*.json`, runbook `docs/runbooks/datadog-trace-search-access.md` | Automate verification via CI (#316) and attach Trace Search artefacts once access restored (#314). |
| Log Management & Analytics | ⚠️ | Basic log shipping through Datadog agent manifests; no pipeline evidence captured | Define pipelines/retention strategy and capture dashboards; fold into #297 follow-up. |
| Universal Service Monitoring | ⬜ | — | Evaluate requirement; open follow-up issue if needed. |
| Database Monitoring (DBM) | ✅ | Runbook `docs/runbooks/datadog-kind-dbm.md`; exports in `datadog/dbm-kind-*` | Restore Azure PG access (#315) and automate smoke tests (`scripts/verify-datadog-dbm.sh`). |
| Synthetic Monitoring | 🔄 | CLI scripts `npm run test:synthetics`, references in `scripts/run-performance-tests.js` | Ensure CI job runs `datadog-ci synthetics` with artefacts; document results. |
| Real User Monitoring (Browser/Mobile) | 🔄 | Configuration in `docs/datadog-error-tracking-env.example`, `AUTOMATED_ERROR_TRACKING_GUIDE.md` | Validate RUM traffic in Datadog and screenshot dashboards; ensure GDPR/privacy settings noted. |
| Session Replay | ⬜ | — | Determine if needed; otherwise mark out-of-scope in roadmap. |
| Continuous Profiler | ⬜ | — | Confirm profiling agent configuration or plan rollout. |
| Error Tracking (frontend/backend) | 🔄 | `AUTOMATED_ERROR_TRACKING_GUIDE.md`, integration tests referencing Sentry/RUM | Automate error smoke tests and capture Datadog events. |
| Serverless Monitoring | ⬜ | — | Evaluate coverage for Azure Functions/Lambda; open follow-up if required. |
| Data Streams Monitoring | ⬜ | — | TBD after core telemetry stabilises. |
| Service Level Objectives & Error Budgets | ⬜ | — | Define initial SLOs tied to dashboards/alerts. |
| Watchdog AI / Anomaly Detection | ⬜ | — | Enable once baseline metrics confirmed. |
| Dashboards / Analytics Studio / Notebooks | ✅ | JSON/MD exports under `datadog/` (e.g., DBM summaries) | Keep dashboards linked in issues; automate export process via CI later. |

## 3. Network & Edge Visibility

| Capability | Status | Evidence | Next Steps |
| --- | --- | --- | --- |
| NPM / NDM / Path monitoring | ⬜ | — | Covered by issue #298; no artefacts yet. |
| Cloud network monitoring (VPC/GWLB) | ⬜ | — | Await infra decision; track in #298. |
| DNS/CDN/Edge monitoring | ⬜ | — | Document desired checks before implementation. |

## 4. DevOps & Delivery Collaboration

| Capability | Status | Evidence | Next Steps |
| --- | --- | --- | --- |
| CI visibility & test analytics | 🔄 | Workflows under `.github/workflows/` (e.g., `main-branch-ci.yml`, `test-simple.yml`) | Add Datadog CI visibility integration when workflow audit (#295) completes; track via #299. |
| Deployment tracking | 🔄 | Helm manifests (`charts/vibecode`, `helm/helmfile.yaml`) | Publish deployment markers via CI (Datadog API) and document in #299. |
| Service catalog & service map | ⬜ | — | Align with Core suite for ownership metadata. |
| Incident management & on-call | ⬜ | — | Needs integration planning (PagerDuty/Slack). |
| Observability pipelines | ⬜ | — | Evaluate requirement post-baseline. |
| Cost management / FinOps | ⬜ | — | Handled by #305. |

## 5. Security Platform

| Capability | Status | Evidence | Next Steps |
| --- | --- | --- | --- |
| CSPM / CWS / ASM / SIEM | ⬜ | — | Tracked via #300; no current artefacts. |
| Sensitive data scanner / Threat intel / Compliance | ⬜ | — | Plan in #300 once baseline sorted. |

## 6. AI & LLM Observability

| Capability | Status | Evidence | Next Steps |
| --- | --- | --- | --- |
| LLM observability & agentic AI | 🔄 | Trace exports for RAG demo (`datadog/vibecode-rag-*`), scripts under `scripts/smoke/` | Complete automation once Trace Search is live (#314/#316) and KIND ingestion stabilises (#312). |

## 7. Digital Experience & Business Impact

| Capability | Status | Evidence | Next Steps |
| --- | --- | --- | --- |
| UX/RUM KPI dashboards | ⬜ | — | Build after RUM validation (#302). |
| Mobile performance monitoring | ⬜ | — | Determine if applicable to demos; track via #302. |

## 8. Integrations & Ecosystem

| Capability | Status | Evidence | Next Steps |
| --- | --- | --- | --- |
| Marketplace/integration audit | ⬜ | — | Perform audit per #303. |
| Terraform/OpenTofu compliance | 🔄 | Manifests in `helm/` and `tofu/` directories | Add compliance checks and document. |

## 9. Operations & Governance

| Capability | Status | Evidence | Next Steps |
| --- | --- | --- | --- |
| Org management, RBAC, audit, service health | ⬜ | — | Implement per #304 once baseline is done. |

## 10. FinOps & Reporting

| Capability | Status | Evidence | Next Steps |
| --- | --- | --- | --- |
| Usage/budget monitoring, savings planner, chargeback | ⬜ | — | Define approach in #305 after observability foundations. |

## 11. Specialised Modules

| Capability | Status | Evidence | Next Steps |
| --- | --- | --- | --- |
| Industry packs / IoT / SaaS benchmarks | ⬜ | — | Planning tracked in #306; likely backlog unless specific demos demand it. |

---

### Immediate Follow-ups
- Close action items for #296 by reviewing this matrix with maintainers and filing any missing gaps as issues.
- Drive the top priority blockers: KIND stability (#312), Trace Search access (#314), CI automation for traces (#316), Azure PG connectivity (#315).
- Update this document whenever a capability advances (commit reference + Datadog evidence link).
