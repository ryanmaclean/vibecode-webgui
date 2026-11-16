# Workflow Audit: .github/workflows/gitops-deployment.yml

- **Workflow file**: `.github/workflows/gitops-deployment.yml`
- **Current notes**: full GitOps pipeline with Trivy/Snyk, build/push, optional force_deploy, uses Datadog CI visibility and pushes to GHCR; issue to confirm secret sprawl (DD, SNYK_TOKEN) and deployment steps alignment.

## Action Items
- [ ] Confirm secrets/prerequisites in TODO entry.
- [ ] Capture last run status or failures (if any).
- [ ] Define remediation steps / owners.

> Updated 2025-09-30 04:26 UTC — replace placeholder text when filing the issue.

- **2025-09-30:** Added Azure secret gating for staging/production deploys and missing-secret notice job.
## Secrets checklist
- `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` (App Service/AKS Service Principal).
- `AZURE_RESOURCE_GROUP`, `AKS_CLUSTER_NAME` (repository variables feeding GitOps deploy).
- `KUBECONFIG_STAGING`, `KUBECONFIG_PRODUCTION` (base64 kubeconfig secrets).
- Datadog (`DD_API_KEY`, `DD_APP_KEY`) and `SNYK_TOKEN` remain optional/guarded.
