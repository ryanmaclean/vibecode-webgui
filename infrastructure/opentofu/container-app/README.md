# Azure Container Apps Deployment (Cost-Optimized Demo)

This OpenTofu configuration provisions a lightweight footprint for the VibeCode chat + RAG demo without the overhead of AKS. It creates:

- Azure Resource Group
- Log Analytics workspace
- Container Apps Environment + Container App (Next.js frontend/API)
- Azure Database for PostgreSQL Flexible Server (pgvector enabled)

## Usage

```bash
cd infrastructure/opentofu/container-app
cp terraform.tfvars.example terraform.tfvars
# edit terraform.tfvars with your container image, Azure OpenAI endpoint/key (or leave blank to let this module create one), etc.
tofu init
tofu apply
```

Outputs include the Container App FQDN and PostgreSQL connection string (with SSL required). The Container App exposes the application publicly and injects the Azure OpenAI key via secrets (either the provided key or the one generated for the newly created account).

If you've recently deleted an Azure OpenAI account with the same name, set `azure_openai_restore_soft_deleted = true` in `terraform.tfvars` so OpenTofu can restore it during apply.

## Follow-up

- Configure Application Insights / Datadog agents as needed for observability.
- Rotate the generated PostgreSQL password into Key Vault or Secret Manager.
- Update the Next.js application settings to respect the Container App ingress URL.
