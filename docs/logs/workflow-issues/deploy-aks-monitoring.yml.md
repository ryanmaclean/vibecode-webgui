# Workflow Audit: .github/workflows/deploy-aks-monitoring.yml

- **Workflow file**: `.github/workflows/deploy-aks-monitoring.yml`
- **Tracking issue**: #393
- **Current notes**: manual AKS rollout incl. ingress, cert-manager, Datadog monitors; depends on `AZURE_*` secrets, Datadog keys, `scripts/*.sh`; issue should review manual inputs + `skip_datadog` flag coverage.

## Action Items
- [ ] Confirm secrets/prerequisites in TODO entry.
- [ ] Capture last run status or failures (if any).
- [ ] Define remediation steps / owners.

> Updated 2025-09-30 04:26 UTC — replace placeholder text when filing the issue.
