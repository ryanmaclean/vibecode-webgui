# Runbook: Deploying the Next.js Documentation App (Server-Backed)

*Last updated: 2025-10-01*  
*Owners: Docs Infra Guild (docs-infra@vibecode.com)*

## Goal

Serve the VibeCode documentation experience rendered by the Next.js app under `src/` from an environment that supports server-side rendering, API routes, and Datadog instrumentation. GitHub Pages remains Astro-only; this runbook captures the steps to deploy the Next.js variant to a managed compute target (Azure Web App for Containers or AWS App Runner) using the standalone output produced by the existing `deploy-docs` workflow.

## Prerequisites

- Access to the `vibecode-webgui` GitHub repository with permission to run workflows and read artifacts.
- Container registry credentials (Azure Container Registry or Amazon ECR) and runtime secrets (NextAuth, Datadog, OpenAI/Anthropic) stored in the respective cloud secret manager.
- `gh` CLI authenticated as a release operator.
- Docker engine (for local validation) or GitHub-hosted runners with Docker enabled.

## Build Pipeline

1. **Trigger the workflow artifact**
   ```bash
   gh workflow run deploy-docs.yml -f docs_system=nextjs
   gh run download --name nextjs-standalone-<run_id> --dir dist/nextjs
   ```
   - The artifact contains `.next/standalone` and `.next/static/` ready for Node execution.
2. **Assemble a runtime image (local)**
   ```dockerfile
   # Dockerfile.next-docs
   FROM node:20-slim
   WORKDIR /app
   COPY next-standalone ./
   ENV PORT=3000 NODE_ENV=production
   EXPOSE 3000
   CMD ["node", "server.js"]
   ```
   ```bash
   tar -C dist/nextjs -cf - . | docker build -t vibecode/docs-next:preview -f Dockerfile.next-docs -
   ```
3. **Smoke test locally**
   ```bash
   docker run --rm -p 3000:3000 \
     -e NEXTAUTH_URL=http://localhost:3000 \
     vibecode/docs-next:preview

   curl -I http://localhost:3000/docs
   ```
   - Expect `200 OK` and `x-powered-by: Next.js` header.

## Azure Web App for Containers

1. **Provision resources (once)**
   ```bash
   az group create --name rg-vibecode-docs --location eastus
   az appservice plan create --name plan-docs --resource-group rg-vibecode-docs --sku P1v3 --is-linux
   az webapp create --name vibecode-docs-next --plan plan-docs --resource-group rg-vibecode-docs --deployment-container-image-name <registry>.azurecr.io/vibecode/docs-next:latest
   ```
2. **Configure secrets**
   ```bash
   az webapp config appsettings set --resource-group rg-vibecode-docs --name vibecode-docs-next --settings \
     NEXTAUTH_URL=https://docs.vibecode.dev \
     DD_API_KEY=@Microsoft.KeyVault(SecretUri=https://kv-vibecode.vault.azure.net/secrets/DD_API_KEY/...) \
     OPENAI_API_KEY=@Microsoft.KeyVault(...)
   ```
3. **Deploy container**
   ```bash
   az acr login --name <registry>
   docker push <registry>.azurecr.io/vibecode/docs-next:preview
   az webapp config container set --resource-group rg-vibecode-docs --name vibecode-docs-next \
     --docker-custom-image-name <registry>.azurecr.io/vibecode/docs-next:preview
   ```
4. **Validate**
   ```bash
   curl -I https://vibecode-docs-next.azurewebsites.net/docs
   ```

## AWS App Runner (alternative)

1. **Package ECR image**
   ```bash
   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account>.dkr.ecr.us-east-1.amazonaws.com
   docker tag vibecode/docs-next:preview <account>.dkr.ecr.us-east-1.amazonaws.com/vibecode-docs-next:preview
   docker push <account>.dkr.ecr.us-east-1.amazonaws.com/vibecode-docs-next:preview
   ```
2. **Create App Runner service**
   ```bash
   aws apprunner create-service \
     --service-name vibecode-docs-next \
     --source-configuration ImageRepository={RepositoryType=ECR,ImageIdentifier=<account>.dkr.ecr.us-east-1.amazonaws.com/vibecode-docs-next:preview,ImageConfiguration={Port=3000}} \
     --instance-configuration Cpu=1 vCPU,Memory=2 GB \
     --auto-scaling-configuration-arn arn:aws:apprunner:us-east-1:<account>:autoscalingconfiguration/default
   ```
3. **Secrets**: use App Runner [connection scaling](https://docs.aws.amazon.com/apprunner/latest/dg/manage-secrets.html) to mount NEXTAUTH, Datadog, and OpenAI keys.

## CI/CD Integration

- `.github/workflows/deploy-next-docs.yml` builds the standalone artifact, packages it with `docker/Dockerfile.docs-next`, pushes the image to Azure Container Registry, and updates the Web App target. The workflow runs on pushes to `main`, via a nightly cron, or manually with `workflow_dispatch` inputs for environment and image tag overrides.
- Configure GitHub environments (`docs-next-staging`, `docs-next-production`) with the following secrets: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `ACR_NAME`, `AZURE_RESOURCE_GROUP`, `AZURE_WEBAPP_NAME`, and optional `DOCS_NEXT_HEALTHCHECK_URL` when the health probe differs from `/api/readyz`. Missing secrets now fail the workflow early, so re-run after vault rotation to confirm the guard passes.
- The build job publishes a `next-docs-standalone` artifact (tarball containing `next-standalone/`) that can be downloaded for manual testing or alternate deployments.
- Post-deploy smoke tests poll the health endpoint up to five times with an increasing delay (15s, 30s, 45s, 60s, 75s). If the App Service is routinely slow to warm, adjust `DOCS_NEXT_HEALTHCHECK_URL` to a lightweight probe or extend the retry window.

## Observability & Diagnostics

- **GitHub Actions**: Use the run summary to review console output and step timings. For a quick tail from the terminal, run `gh run watch --exit-status --workflow deploy-next-docs.yml --branch main`.
- **Workflow artifacts**: The `next-docs-standalone` artifact retains for 7 days; download it (`gh run download --name next-docs-standalone --dir dist/rollbacks`) when preparing an immediate rollback image.
- **Azure App Service logs**: Stream container output with `az webapp log tail --name vibecode-docs-next --resource-group rg-vibecode-docs`. For historical inspection, pull the latest bundle via `az webapp log download --name vibecode-docs-next --resource-group rg-vibecode-docs --log-file docs-next-logs.zip` and open `LogFiles/Application/docker.log`.
- **Datadog dashboards**: Observability is publishing a Docs Next overview board (folder `Observability/Docs`) that charts `azure.app_service.http.5xx`, `azure.app_service.cpu.usage`, and `trace.next.render` filtered by `resource_group:rg-vibecode-docs`. Request the dash slug in `#observability-help` if it is missing.
- **Datadog monitors**: Subscribe to the `docs-next smoke check` and `docs-next 5xx error rate` monitors (Datadog Manage → Monitors → Shared With Team) so alerts land in `#docs-infra-alerts`. If those monitors have not been created yet, file an Observability ticket referencing GitHub issue #405.

> TODO (Observability, track via #405): Capture approved retention windows for GitHub logs/artifacts, Datadog logs, and the rollback image registry so the runbook can include explicit expiry expectations.

## Validation Checklist

- [ ] GitHub Actions run publishes the container image and records the digest in the summary.
- [ ] Health endpoint (`/api/readyz`) returns `200` with Datadog headers present.
- [ ] Static asset (`/_next/static/...`) served with cache-control `public, max-age=31536000`.
- [ ] Datadog trace search displays span names `next.render` within 5 minutes of deploy.
- [ ] Rollback command documented for both Azure (`az webapp config container set --docker-custom-image-name <prev>`) and AWS (`aws apprunner update-service --image-identifier <prev>`).

## Escalation

If deploys fail or traffic spikes exhaust the single instance:
- Page the Docs Infra Guild (`#docs-infra-alerts` on Slack).
- Engage Cloud Platform on-call for scaling changes to the App Service plan or App Runner configuration.
- If Datadog monitors stay red after the smoke retry window, collect the failing GitHub Actions run URL, the App Service log bundle, and a screenshot of the Docs Next dashboard before handing off to Observability on-call (`#observability-oncall`).
- Reference GitHub issue #405 for the current action items and historical context.
