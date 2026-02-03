# Tundra Dome KIND Manifests

This folder captures the working KIND deployment we run on the vibecode VM for Tundra Dome + Datadog.

## Contents
- `tundra-dome.yaml`        – full cluster dump (Deployments, DaemonSets, ConfigMaps, Secrets refs) from the running KIND cluster.
- `tundra-dome.clean.yaml`  – same dump after light cleanup (no socket files), safe to re-apply.
- `tundra-dome.json`        – kubectl JSON export of the same resources.
- `datadog.json`            – Datadog agent config snapshot from the cluster.
- `tundra-export.json`      – placeholder for future filtered export (currently empty).

## How to apply on a fresh KIND cluster (vibecode VM)
1. Create namespaces:
   ```bash
   kubectl create ns tundra-dome
   kubectl create ns datadog
   ```
2. Provide secrets (no keys are stored here):
   ```bash
   kubectl -n tundra-dome create secret generic tundra-dome-secrets \
     --from-literal=DD_API_KEY=<your_dd_api_key> --from-literal=DD_APP_KEY="" --dry-run=client -o yaml | kubectl apply -f -
   kubectl -n datadog create secret generic tundra-dome-secrets \
     --from-literal=DD_API_KEY=<your_dd_api_key> --dry-run=client -o yaml | kubectl apply -f -
   ```
3. Apply the manifest:
   ```bash
   kubectl apply -f infra/tundra-dome/tundra-dome.clean.yaml
   ```
4. Verify:
   ```bash
   kubectl get pods -n tundra-dome
   kubectl get pods -n datadog
   ```

## Notes
- DD_API_KEY is intentionally omitted here; inject via the secret step above.
- The Airflow components expect StatSD at `datadog-agent.datadog.svc.cluster.local:8125` and Kafka inside the same cluster.
- These manifests were lifted from the working KIND setup as of 2026-02-02.
