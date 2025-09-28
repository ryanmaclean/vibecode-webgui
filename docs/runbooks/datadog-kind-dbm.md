# Runbook: Enabling Datadog DBM Telemetry for KIND / Dev Flexible Server

*Last updated: 2025-09-24*  
*Owners: Kim Smith (kim.smith@vibecode.com), Jessie (jessie@vibecode.com)*

## Goal

Ensure the local KIND cluster and the dev Azure PostgreSQL flexible server (`vibecode-pgflex-1758429506`) emit Database Monitoring metrics.

## KIND Agent Setup

1. **Set credentials**
   ```bash
   export DD_API_KEY=your-low-scope-key
   export DD_APP_KEY=your-app-key
   ```
2. **Deploy the training manifest**
   ```bash
   kubectl apply -f k8s/datadog-dbmon-kind.yaml
   ```
   - Manifest wraps the minimal Datadog Agent + DBM config described in `scripts/deploy-dbm-apm-kind.sh`.
3. **Wait for connectivity**
   ```bash
   kubectl -n datadog wait --for=condition=ready pod -l app=datadog --timeout=120s
   ```
4. **Verify**
   ```bash
   ddtrace-run python3 scripts/verify-dbm-apm-connection.py --env kind
   kc logs -n datadog deploy/datadog --tail=50 | grep training:20250924
   ```

## Dev Flexible Server Networking

1. **Allow AKS & workshop IPs**
   ```bash
   az postgres flexible-server firewall-rule create \
     --resource-group rg-vibecode-db \
     --name vibecode-pgflex-1758429506 \
     --rule-name allow-aks-egress \
     --start-ip-address 4.152.98.5 \
     --end-ip-address 4.152.98.5

   az postgres flexible-server firewall-rule create \
     --resource-group rg-vibecode-db \
     --name vibecode-pgflex-1758429506 \
     --rule-name allow-workshop \
     --start-ip-address <your-public-ip> \
     --end-ip-address <your-public-ip>
   ```
2. **Rotate / confirm credentials**
   ```bash
   az postgres flexible-server update \
     --resource-group rg-vibecode-db \
     --name vibecode-pgflex-1758429506 \
     --administrator-login-password "$POSTGRES_ADMIN_PASSWORD"
   ```
3. **Update Kubernetes secret**
   ```bash
   kubectl create secret generic datadog-dbmon-dev \
     --from-literal=DB_HOST=vibecode-pgflex-1758429506.postgres.database.azure.com \
     --from-literal=DB_NAME=vibecode_dev \
     --from-literal=DB_USER=datadog \
     --from-literal=DB_PASSWORD="$DD_DEV_DB_PASSWORD" \
     --dry-run=client -o yaml | kubectl apply -f -
   ```
4. **Patch ExternalSecret (when available)**
   - Update `k8s/datadog-dbmon.yaml` once ExternalSecret CRD is deployed.

## Validation Checklist

- [ ] `datadog/kind-agent-status-<timestamp>.txt` shows `Database Monitoring` OK.
- [ ] `datadog/dbm-kind-query-summary-<timestamp>.json` lists non-empty series.
- [ ] KIND dashboard (`env:kind training:20250924`) displays the simulated blocking queries from `datadog/training/blocking-query-snapshots-20250924.md`.
- [ ] Dev DBM monitors alert on real metrics (remove the training tag once smoke tests pass).

## Escalation

If the agent still returns `no series`, escalate to Kim or Jessie to confirm the Datadog plan includes DBM for the relevant environments.
