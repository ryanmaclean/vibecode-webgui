# Monitoring Assets

Centralised Datadog manifests, dashboards, and evidence exported from KIND / demo runs.

## Key Files

- `datadog-agent-lean.yaml` – Trimmed DaemonSet for local or KIND clusters.
- `datadog-agent-patch.json` – Strategic merge patch used during CI validation.
- `datadog-azure-embedding-dashboard.json` – Dashboard focused on Azure embedding workloads.
- `templates/` – Reusable manifest templates consumed by automation scripts.
- `training/`, `vector-database-dashboard.json`, `vector-db-alerts.json` – Historical dashboards and alerts archived during workspace consolidation.

Usage instructions live in `docs/src/content/docs/monitoring/overview.md` and `archive/README-GITOPS.md`.
