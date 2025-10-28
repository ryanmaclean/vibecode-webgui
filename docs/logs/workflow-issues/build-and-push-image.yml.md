# Workflow Audit: .github/workflows/build-and-push-image.yml

- **Workflow file**: `.github/workflows/build-and-push-image.yml`
- **Tracking issue**: #357
- **Current notes**: GHCR build via Dockerfile.production with Buildx cache, Trivy SARIF upload, optional AKS Helm deploy (`AZURE_CREDENTIALS`, vars.AKS_*); issue should confirm secrets + helm chart alignment.

## Action Items
- [ ] Confirm secrets/prerequisites in TODO entry.
- [ ] Capture last run status or failures (if any).
- [ ] Define remediation steps / owners.

> Updated 2025-09-30 04:26 UTC — replace placeholder text when filing the issue.
