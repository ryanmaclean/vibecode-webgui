# Datadog Data Observability - OpenLineage Integration

Complete guide to the OpenLineage integration between Tundra Dome KIND clusters and Datadog Data Observability.

## Overview

The Tundra Dome project runs 3 KIND (Kubernetes IN Docker) clusters that send Airflow job lineage data to Datadog Data Observability via the OpenLineage protocol. Each cluster emits events under a unique namespace for proper separation in Datadog.

## Architecture

```
+-------------------+     +-------------------+     +----------------------+
| kind-tundra-dome  |     | kind-gastown      |     | kind-vibecode-local  |
| namespace:        |     | namespace:        |     | namespace:           |
| tundra-dome       |     | gastown           |     | vibecode-local       |
+--------+----------+     +--------+----------+     +--------+-------------+
         |                         |                         |
         v                         v                         v
    +---------------------------------------------------------+
    |            HTTPS (OpenLineage Protocol)                 |
    |         https://data-obs-intake.datadoghq.com           |
    +---------------------------------------------------------+
                              |
                              v
                  +------------------------+
                  |  Datadog Data          |
                  |  Observability         |
                  |  (Lineage, Jobs,       |
                  |   Datasets)            |
                  +------------------------+
```

## Cluster Configuration

### KIND Clusters

| Cluster Name | kubectl Context | OpenLineage Namespace | Status |
|-------------|-----------------|----------------------|--------|
| tundra-dome | kind-tundra-dome | tundra-dome | Active |
| gastown | kind-gastown | gastown | Active |
| vibecode-local | kind-vibecode-local | vibecode-local | Active |

### Kubernetes Namespace

All components run in the `tundra-dome` namespace across all clusters.

## Configuration Components

### 1. ConfigMap: airflow-openlineage-config

The OpenLineage transport configuration is stored in a ConfigMap on each cluster.

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: airflow-openlineage-config
  namespace: tundra-dome
data:
  TRANSPORT: '{"type": "http", "url": "https://data-obs-intake.datadoghq.com", "auth": {"type": "api_key", "api_key": "<DD_API_KEY>"}}'
```

**Verify ConfigMap:**
```bash
# Check ConfigMap on each cluster
kubectl get configmap airflow-openlineage-config -n tundra-dome --context kind-tundra-dome -o yaml
kubectl get configmap airflow-openlineage-config -n tundra-dome --context kind-gastown -o yaml
kubectl get configmap airflow-openlineage-config -n tundra-dome --context kind-vibecode-local -o yaml
```

### 2. Secret: tundra-secrets

The Datadog API key is stored in a Kubernetes Secret.

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: tundra-secrets
  namespace: tundra-dome
type: Opaque
data:
  DD_API_KEY: <base64-encoded-api-key>
```

**Verify Secret exists:**
```bash
kubectl get secret tundra-secrets -n tundra-dome --context kind-tundra-dome
```

### 3. Airflow Environment Variables

The Airflow pods receive the following environment variables:

| Variable | Source | Description |
|----------|--------|-------------|
| `AIRFLOW__OPENLINEAGE__NAMESPACE` | Deployment spec | Unique namespace per cluster |
| `AIRFLOW__OPENLINEAGE__TRANSPORT` | ConfigMap (airflow-openlineage-config) | HTTP transport configuration |

**Verify environment variables:**
```bash
# Check on each cluster's Airflow pod
kubectl exec <airflow-pod> -n tundra-dome --context kind-<cluster> -c airflow -- env | grep -i openlineage
```

Expected output:
```
AIRFLOW__OPENLINEAGE__NAMESPACE=<cluster-namespace>
AIRFLOW__OPENLINEAGE__TRANSPORT={"type": "http", "url": "https://data-obs-intake.datadoghq.com", ...}
```

## Verification Procedures

### 1. Check Cluster Connectivity

```bash
# Verify all clusters are running
kind get clusters

# Expected output:
# gastown
# tundra-dome
# vibecode-local

# Verify contexts are available
kubectl config get-contexts | grep kind
```

### 2. Verify Airflow Pods

```bash
# List pods in tundra-dome namespace
kubectl get pods -n tundra-dome --context kind-tundra-dome
kubectl get pods -n tundra-dome --context kind-gastown
kubectl get pods -n tundra-dome --context kind-vibecode-local

# Look for airflow-api-server pods in Running state
```

### 3. Check OpenLineage Event Emission

```bash
# Search Airflow logs for OpenLineage events
kubectl logs <airflow-pod> -n tundra-dome --context kind-<cluster> -c airflow | grep -i "emitted"

# Expected log entries:
# Successfully emitted OpenLineage `START` event of id `...`
# Successfully emitted OpenLineage `COMPLETE` event of id `...`
```

### 4. Trigger DAG Runs

```bash
# Trigger a DAG run to generate OpenLineage events
kubectl exec <airflow-pod> -n tundra-dome --context kind-<cluster> -c airflow -- \
  airflow dags trigger tundra_dome_integrations

# Check DAG run status
kubectl exec <airflow-pod> -n tundra-dome --context kind-<cluster> -c airflow -- \
  airflow dags list-runs tundra_dome_integrations
```

### 5. Verify No Errors

```bash
# Check for authentication or HTTP errors
kubectl logs <airflow-pod> -n tundra-dome --context kind-<cluster> -c airflow | \
  grep -i -E "(error|failed|401|403|timeout)" | grep -i openlineage
```

## Datadog Data Observability Dashboard

### Accessing Data in Datadog

1. Navigate to **Data Observability** in the Datadog UI
2. Filter by namespace:
   - `tundra-dome`
   - `gastown`
   - `vibecode-local`
3. View:
   - **Jobs**: Airflow DAG runs
   - **Datasets**: Input/output data assets
   - **Lineage**: Data flow visualization

### Expected Events

Each Airflow task generates:
- `START` event when task begins
- `COMPLETE` event when task succeeds
- `FAIL` event if task fails

Events include:
- Job name (DAG + task ID)
- Run ID
- Namespace
- Input/output datasets (if configured)
- Duration metrics

## Available DAGs

The following DAGs are configured to emit OpenLineage events:

| DAG ID | Description |
|--------|-------------|
| tundra_dome_integrations | Integration tests and checks |
| tundra_dome_kafka_emit | Kafka event emission |
| tundra_gitea_cicd | Gitea CI/CD pipeline |
| tundra_auto_recovery | Auto-recovery procedures |
| tundra_ci_cd_rigor | CI/CD validation |
| tundra_convoy_watchdog | Convoy monitoring |
| tundra_escalation_gate | Escalation gate checks |
| tundra_lane_router | Lane routing |
| tundra_lane_watchdog | Lane monitoring |
| tundra_mail_watchdog | Mail monitoring |
| tundra_merge_watchdog | Merge monitoring |
| tundra_nudge_watchdog | Nudge monitoring |
| tundra_role_allocator | Role allocation |
| tundra_work_spawn | Work spawning |

## Troubleshooting

### Issue: No events appearing in Datadog

1. **Check ConfigMap exists:**
   ```bash
   kubectl get configmap airflow-openlineage-config -n tundra-dome --context kind-<cluster>
   ```

2. **Verify transport URL:**
   ```bash
   kubectl get configmap airflow-openlineage-config -n tundra-dome --context kind-<cluster> -o jsonpath='{.data.TRANSPORT}' | jq .
   ```

3. **Check API key is valid:**
   ```bash
   # Decode and verify API key format (should be 32 hex characters)
   kubectl get secret tundra-secrets -n tundra-dome --context kind-<cluster> -o jsonpath='{.data.DD_API_KEY}' | base64 -d
   ```

### Issue: Authentication failures (401/403)

1. **Regenerate API key** in Datadog Organization Settings
2. **Update Secret:**
   ```bash
   kubectl create secret generic tundra-secrets \
     --from-literal=DD_API_KEY=<new-api-key> \
     -n tundra-dome \
     --context kind-<cluster> \
     --dry-run=client -o yaml | kubectl apply -f -
   ```
3. **Restart Airflow pod:**
   ```bash
   kubectl rollout restart deployment/airflow-api-server -n tundra-dome --context kind-<cluster>
   ```

### Issue: Namespace not set correctly

1. **Check deployment spec:**
   ```bash
   kubectl get deployment airflow-api-server -n tundra-dome --context kind-<cluster> -o yaml | \
     grep -A 2 AIRFLOW__OPENLINEAGE__NAMESPACE
   ```

2. **Update deployment if needed:**
   ```bash
   kubectl set env deployment/airflow-api-server \
     AIRFLOW__OPENLINEAGE__NAMESPACE=<correct-namespace> \
     -n tundra-dome \
     --context kind-<cluster>
   ```

### Issue: Airflow pod OOMKilled

The Airflow pod may be killed due to memory limits. Increase resources:

```bash
kubectl patch deployment airflow-api-server -n tundra-dome --context kind-<cluster> \
  -p '{"spec":{"template":{"spec":{"containers":[{"name":"airflow","resources":{"limits":{"memory":"4Gi"},"requests":{"memory":"1Gi"}}}]}}}}'
```

## Security Considerations

**WARNING:** The current configuration embeds the API key directly in the ConfigMap. For production deployments:

1. **Use Kubernetes Secrets** for the API key instead of embedding in ConfigMap
2. **Reference secret in deployment:**
   ```yaml
   env:
     - name: AIRFLOW__OPENLINEAGE__TRANSPORT
       valueFrom:
         secretKeyRef:
           name: openlineage-transport-config
           key: TRANSPORT
   ```
3. **Enable RBAC** to restrict access to secrets
4. **Rotate API keys** periodically

## Verification Status (2026-02-05)

| Cluster | ConfigMap | Secret | Namespace Env | Events Emitting |
|---------|-----------|--------|---------------|-----------------|
| kind-tundra-dome | OK | OK | tundra-dome | OK |
| kind-gastown | OK | OK | gastown | OK |
| kind-vibecode-local | OK | OK | vibecode-local | OK |

All three clusters are successfully emitting OpenLineage events to Datadog Data Observability.

## Related Documentation

- [Datadog Integration Guide](./DATADOG_INTEGRATION_GUIDE.md)
- [OpenLineage Documentation](https://openlineage.io/docs/)
- [Airflow OpenLineage Provider](https://airflow.apache.org/docs/apache-airflow-providers-openlineage/stable/index.html)
- [Datadog Data Observability](https://docs.datadoghq.com/data_observability/)

---

**Last Verified**: 2026-02-05
**Integration Lead**: Datadog Integration Team
