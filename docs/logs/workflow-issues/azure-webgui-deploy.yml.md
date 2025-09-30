# Workflow Audit: .github/workflows/azure-webgui-deploy.yml

- **Workflow file**: `.github/workflows/azure-webgui-deploy.yml`
- **Tracking issue**: #356
- **Current notes**: builds root Dockerfile, pushes to same ACR, deploys App Service `${{ secrets.APP_NAME_WEBGUI }}`, smoke hits `/`; confirm env secrets + health path adequate.

## Action Items
- [ ] Confirm secrets/prerequisites in TODO entry.
- [ ] Capture last run status or failures (if any).
- [ ] Define remediation steps / owners.

> Updated 2025-09-30 04:26 UTC — replace placeholder text when filing the issue.
