---
title: Datadog Monitoring Configuration
description: Checklist and references for configuring Datadog across VibeCode environments.
---

# Datadog Monitoring Configuration

This page centralizes the configuration steps that were previously scattered across multiple documents. Use it as a jumping-off point when wiring Datadog into new or existing environments.

## Prerequisites

- Review the [Datadog Local Development guide](./DATADOG_LOCAL_DEVELOPMENT/) for environment variables and local agent setup.
- Confirm the compatibility matrix in [Datadog Compatibility](./datadog-compatibility/) to ensure required integrations are enabled.
- Collect API keys and application keys for each environment (store them in the platform secret manager; never commit them to git).

## Core Configuration Checklist

1. **Agents and Integrations**
   - Enable the `datadog-agent` container in each Kubernetes namespace.
   - Activate APM (`DD_APM_ENABLED=true`) and Live Processes for the services that emit traces.
   - Add the Vector DB pipelines outlined in [PostgreSQL GenAI Demo Guide](./postgresql-genai-demo-guide/).

2. **Environment Variables**
   - Reference the canonical list in [Environment Variables](./env-variables/).
   - Override `DD_ENV`, `DD_SERVICE`, and `DD_VERSION` per workload to keep telemetry segmented.

3. **Dashboards and Monitors**
   - Import the JSON dashboards under `datadog/` in the repository (for example, `datadog-dashboard-embedding-metrics.json`).
   - Wire RUM and synthetic monitors when deploying the Docs site by following `docs/datadog-synthetics.json`.

4. **Security & Compliance**
   - Enable Sensitive Data Scanner with the allowlist described in `security/datadog/allowlists.md`.
   - Route audit events to the security team Slack channel.

5. **CI/CD Hooks**
   - Ensure the GitHub Actions workflows include the Datadog API key secrets (`DD_API_KEY`, `DD_APP_KEY`).
   - Keep the `datadog-ci` step in Docs automation to validate links and emit metrics.

## Validation

Run the following command to verify that telemetry is flowing after configuration changes:

```bash
DD_SITE=datadoghq.com ./scripts/verify-datadog-dbm.sh
```

For local smoke tests, use:

```bash
DD_ENV=local npm run test:monitoring
```

## Further Reading

- [Datadog Local Development](./DATADOG_LOCAL_DEVELOPMENT/)
- [Datadog Compatibility](./datadog-compatibility/)
- [Azure OpenAI Monitoring](./azure-openai-monitoring/)
- [Deploy Azure OpenAI Monitoring](./deploy-azure-openai-monitoring/)
- [Production Deployment Guide](./production-deployment-guide/)

If you discover new required steps, update this checklist so the validator keeps the documentation tree consistent.
