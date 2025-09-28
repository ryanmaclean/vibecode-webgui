# Datadog Observability Roadmap

This roadmap groups the Datadog capabilities we adopted (or still need to adopt) so every agent shares the same target state. Each checklist below should tie back to an issue with automated validation (CI workflow, script, or documented command).

## Licensing & Tooling Principles
- Prefer MIT, Apache 2.0, or BSD-licensed dependencies whenever we add tooling around Datadog.
- Choose open alternatives such as **Valkey** (Redis fork) and **OpenTofu** (Terraform fork) before commercial/OpenCore options.
- Datadog’s free tier is approved for workshop/demo environments; additional SaaS spend requires maintainer sign-off.

## Operating Constraints
- Every capability must include automated validation and evidence (Datadog dashboards, logs, traces).
- Documentation lives alongside the code (runbooks under `docs/runbooks/`, evidence under `datadog/`).
- Secrets are managed through 1Password/Vault and GitHub/Azure Key Vault; never commit credentials.

## Capability Clusters
1. **Baseline & Gap Analysis** – inventory what is already instrumented and publish the status matrix.
2. **Core Observability Suite** – infrastructure metrics, APM/tracing, logs, DBM, synthetics, RUM, profiling, error tracking, SLOs, Watchdog, and shared dashboards/notebooks.
3. **Network & Edge Visibility** – NPM, NDM, path monitoring, cloud network telemetry, DNS/CDN checks.
4. **DevOps & Delivery Collaboration** – CI visibility, deployment tracking, service catalog, incident/on-call automation, observability pipelines, cost controls.
5. **Security Platform** – CSPM, CWS, CIEM, ASM (SAST/SCA/IAST/runtime), Cloud SIEM, sensitive data scanning, threat intel, compliance reporting.
6. **AI & LLM Observability** – LLM monitoring/evaluation, agentic AI remediation, governance pipelines, autotelic instrumentation.
7. **Digital Experience & Business Impact** – UX analytics, RUM KPI correlations, mobile crash/ANR monitoring.
8. **Integrations & Ecosystem** – Marketplace audit, custom API usage, Terraform/OpenTofu compliance, partner alignment.
9. **Operations & Governance** – Org management, RBAC/ABAC, audit trails, service health catalogues, runbook automation.
10. **FinOps & Reporting** – Usage metering, budget alerts, savings planner, chargeback/showback.
11. **Specialised/Industry Modules** – IoT, healthcare/PCI/GovCloud packs, SaaS reliability scorecards.

Track completion by updating `docs/monitoring/current-state.md` and closing the issues associated with each checklist item.
