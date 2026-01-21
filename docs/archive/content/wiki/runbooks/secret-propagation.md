# Runbook: Propagating Rotated Secrets to Automation & CI

*Updated: 2025-09-24*  
*Owners: Kim Smith, Jessie*

## Goals
- Ensure rotated keys in `.env.local` reach Kubernetes secrets, GitHub Actions, and Terraform automation.

## Steps

1. **Update `.env.local`** (already done during rotation).

2. **Render Kubernetes secret manifest**
   ```bash
   node scripts/tools/render-secret-manifest.js > /tmp/vibecode-secrets.json
   jq '.' /tmp/vibecode-secrets.json
   kubectl apply -f /tmp/vibecode-secrets.json
   kubectl rollout restart deployment/vibecode-webgui -n vibecode-platform
   kubectl rollout restart deployment/vibecode-ai-gateway -n vibecode-platform
   ```

3. **Sync GitHub secrets**
   ```bash
   gh secret set OPENROUTER_API_KEY --body "$(grep '^OPENROUTER_API_KEY=' .env.local | cut -d= -f2-)"
   gh secret set DD_API_KEY --body "$(grep '^DD_API_KEY=' .env.local | cut -d= -f2-)"
   gh secret set DD_APP_KEY --body "$(grep '^DD_APP_KEY=' .env.local | cut -d= -f2-)"
   ```

4. **Update Terraform override (if needed)**
   ```hcl
   # terraform.tfvars
   postgres_admin_password_override = "<value from Key Vault>"
   ```
   ```bash
   cd infrastructure/terraform/azure
   terraform plan -var-file=terraform.tfvars
   terraform apply -var-file=terraform.tfvars
   ```

5. **Validate**
   ```bash
   DATADOG_TRACE_SEARCH_BASE_URL=http://127.0.0.1:5005 \
     ddtrace-run python3 scripts/verify-trace-search.py \
       --service vibecode-webgui-smoke --env production --window 1h
   ddtrace-run python3 scripts/verify-dbm-apm-connection.py --env staging
   ```

6. **Document completion**
   - Update `TODO.md` entries.
   - Store evidence (JSON outputs) under `datadog/`.

## Notes
- Use the local mock server only until real Datadog access is restored.
- Keep Key Vault secrets (`datadog-dbmon-*`, `postgres-admin-password`) aligned via Terraform overrides.
