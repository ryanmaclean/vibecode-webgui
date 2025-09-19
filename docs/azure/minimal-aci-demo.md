---
title: Minimal Azure Demo (ACI + PostgreSQL Basic)
description: Low-cost deployment plan for validating the VibeCode stack without full AKS
---

## Goal
Deploy a functional VibeCode demo environment on Azure using **Azure Container Instances (ACI)** and **Azure Database for PostgreSQL Flexible Server (Basic tier)**. The target is to keep the environment under **$50/month** while providing end-to-end validation of the core app, database connectivity, and monitoring hooks.

## Architecture Overview
```
Azure Resource Group (rg-vibecode-demo)
├─ Azure Container Instance (aci-vibecode-demo)
│  ├─ Pulls image from Azure Container Registry (ACR)
│  ├─ Loads environment variables from Key Vault / .env
│  ├─ Exposes HTTPS via Application Gateway (optional) or public IP
│  └─ Emits logs to Azure Log Analytics
└─ Azure Database for PostgreSQL Flexible Server (Basic, 2 vCores)
   ├─ Enables pgvector extension
   └─ Restricts access to ACI outbound IP
```

## Container Image Contract
| Variable | Description | Example |
|----------|-------------|---------|
| `IMAGE_NAME` | Fully qualified image (ACR or GHCR) | `myregistry.azurecr.io/vibecode-webgui:demo` |
| `PORT` | Exposed port | `3000` |
| `POSTGRES_HOST` | Flexible server FQDN | `vibecode-demo.postgres.database.azure.com` |
| `POSTGRES_USER` | Database user | `aci_user` |
| `POSTGRES_PASSWORD` | Database password (Key Vault secret) | — |
| `POSTGRES_DB` | Target database | `vibecode_app` |
| `DD_API_KEY` | Optional Datadog API key | — |

### Environment File Template (`.env.demo`)
```
PORT=3000
POSTGRES_HOST=
POSTGRES_USER=
POSTGRES_PASSWORD=
POSTGRES_DB=vibecode_app
DD_API_KEY=
DD_SITE=datadoghq.com
```

## Deployment Script (`scripts/deploy_aci_demo.py`)

Use the helper committed in `scripts/deploy_aci_demo.py` to provision the environment:

```bash
python3 scripts/deploy_aci_demo.py \
  --image vibecodecr84859296.azurecr.io/vibecode-webgui:demo \
  --env-file .env.demo.example \
  --postgres-password "$(python3 -c 'import secrets;print(secrets.token_urlsafe(16))')" \
  --dry-run   # remove this flag for a real deployment
```

- `--dry-run` prints the Azure CLI commands without executing them. Drop the flag to provision resources.
- The script ensures the resource group, PostgreSQL flexible server, and Container Instance are created with the chosen image and environment variables.
- Before running for real, copy `.env.demo.example` to `.env.demo` and populate secrets locally (avoid committing the populated file).
- After validation, run the teardown commands below to avoid ongoing charges.

## Teardown Checklist
```
az container delete --name aci-vibecode-demo --resource-group rg-vibecode-demo --yes
az postgres flexible-server delete --name vibecode-demo --resource-group rg-vibecode-demo --yes
az group delete --name rg-vibecode-demo --yes --no-wait
```

## Cost Estimate (Monthly)
| Resource | SKU | Approx. Cost |
|----------|-----|--------------|
| ACI (1 vCPU / 2 GB, 24x7) | Linux plan | ~$20 |
| PostgreSQL Flexible Server | Standard_B1ms | ~$25 |
| Log Analytics workspace | 5 GB ingestion | ~$5 |
| **Estimated Total** |  | **$45-$50** |

## Validation Checklist
- [ ] Application reachable via public IP or Application Gateway
- [ ] Connection to PostgreSQL succeeds (`SELECT 1`) via app logs
- [ ] pgvector extension enabled (`SELECT extname FROM pg_extension WHERE extname='vector'`)
- [ ] Optional: Datadog ingest receiving container logs/metrics
- [ ] Document actual spend in `GAP-ANALYSIS.md`

## Next Steps
1. Implement `scripts/deploy_aci_demo.py` with parameterized CLI (image, env file, optional Key Vault integration).
2. Add smoke test script (curl health endpoint, run DB query).
3. Update CI or runbook to trigger the demo deployment as part of release validation.
4. Record measured Azure spend and adjust the plan if costs exceed target.
