# Tundra Dome Operational Runbook

This runbook covers day-to-day operations, deployments, and incident response for Tundra Dome running on KIND clusters.

> **Related docs:** `docs/tundra-dome.md` (architecture), `docs/tundra-dome-airflow.md` (Airflow DAGs), `docs/dsm-message-capture-runbook.md` (Kafka DSM capture), `superdome-ops.md` (management model).

---

## Architecture quick reference

| Layer | Components | Namespace |
|---|---|---|
| Ingress | `gastown-to-tundra-bridge`, `td` CLI | `tundra-dome` |
| Routing | Airflow DAGs (lane router, watchdogs) | `tundra-dome` |
| Kafka | Bitnami Kafka (KRaft, single node) | `tundra-dome` |
| DSM services | `td-event-emitter`, `tundra-observer`, `gt-kafka-consumer` | `tundra-dome` |
| Observability | Datadog Agent (DaemonSet) | `datadog` |

Manifests live under `infra/tundra-dome/`. The ArgoCD application is at `infra/tundra-dome/argocd/tundra-dome-app.yaml`.

---

## Prerequisites

- `kubectl` configured for the target KIND cluster (`kind-tundra-dome`)
- `DD_API_KEY` available as an environment variable
- `kind` ≥ v0.22, `kubectl` ≥ v1.27

---

## Roll-forward (deploy / upgrade)

### Standard deploy

```bash
# 1. Validate all YAML before applying
cd infra/tundra-dome
for f in $(find . -name "*.yaml" -o -name "*.yml"); do
  python3 -c "import yaml; yaml.safe_load(open('$f'))" && echo "OK: $f"
done

# 2. Ensure secrets exist
kubectl -n tundra-dome get secret tundra-dome-secrets &>/dev/null || \
  kubectl -n tundra-dome create secret generic tundra-dome-secrets \
    --from-literal=DD_API_KEY="${DD_API_KEY}"

kubectl -n datadog get secret tundra-dome-secrets &>/dev/null || \
  kubectl -n datadog create secret generic tundra-dome-secrets \
    --from-literal=DD_API_KEY="${DD_API_KEY}"

# 3. Apply manifests (idempotent)
kubectl apply -f infra/tundra-dome/manifests/
kubectl apply -f infra/tundra-dome/tundra-dome.clean.yaml

# 4. Verify pods reach Running state
kubectl rollout status deployment/kafka          -n tundra-dome --timeout=120s
kubectl rollout status deployment/td-event-emitter -n tundra-dome --timeout=120s
kubectl rollout status deployment/tundra-observer  -n tundra-dome --timeout=120s
kubectl rollout status deployment/gt-kafka-consumer -n tundra-dome --timeout=120s
```

### Updating a single service

```bash
# Example: redeploy td-event-emitter after image or config change
kubectl rollout restart deployment/td-event-emitter -n tundra-dome
kubectl rollout status  deployment/td-event-emitter -n tundra-dome --timeout=120s
```

### Bootstrap a fresh KIND cluster

```bash
cd infra/tundra-dome
./deploy.sh --stack-only
```

See `tundra-dome/docs/kind-deployment.md` for the full KIND setup walkthrough.

---

## Rollback

### Rolling back a single deployment

```bash
# View rollout history
kubectl rollout history deployment/<name> -n tundra-dome

# Roll back to the previous revision
kubectl rollout undo deployment/<name> -n tundra-dome

# Roll back to a specific revision
kubectl rollout undo deployment/<name> -n tundra-dome --to-revision=<N>

# Confirm rollback completed
kubectl rollout status deployment/<name> -n tundra-dome --timeout=120s
```

### Rolling back all tundra-dome deployments

```bash
for d in td-event-emitter tundra-observer gt-kafka-consumer gastown-to-tundra-bridge kafka; do
  echo "Rolling back $d..."
  kubectl rollout undo deployment/$d -n tundra-dome
done
kubectl get pods -n tundra-dome
```

### Re-applying a known-good manifest snapshot

```bash
# The clean manifest is the last known-good full-cluster snapshot
kubectl apply -f infra/tundra-dome/tundra-dome.clean.yaml
```

---

## Tracing configuration

Tracing env vars are centralised in `infra/tundra-dome/manifests/tracing-config.yaml` as the `tundra-dome-tracing` ConfigMap. Apply it before deploying pods:

```bash
kubectl apply -f infra/tundra-dome/manifests/tracing-config.yaml
```

Pods reference it via `envFrom`:

```yaml
envFrom:
  - configMapRef:
      name: tundra-dome-tracing
  - configMapRef:
      name: tundra-dome-config
  - secretRef:
      name: tundra-dome-secrets
      optional: true
```

Key variables set by `tundra-dome-tracing`:

| Variable | Value | Purpose |
|---|---|---|
| `DD_TRACE_ENABLED` | `true` | Enable APM tracing |
| `DD_LOGS_INJECTION` | `true` | Correlate logs with traces |
| `DD_DATA_STREAMS_ENABLED` | `true` | Enable Kafka DSM |
| `DD_RUNTIME_METRICS_ENABLED` | `true` | Runtime metrics |
| `DD_AGENT_HOST` | `datadog-agent.datadog.svc.cluster.local` | In-cluster agent |
| `DD_TRACE_AGENT_PORT` | `8126` | APM agent port |
| `DD_DOGSTATSD_PORT` | `8125` | DogStatsD port |

See `docs/dsm-tracer-versions.md` for minimum tracer version requirements per language.

---

## Health checks

```bash
# Pod status
kubectl get pods -n tundra-dome
kubectl get pods -n datadog

# Consumer lag (requires kafka pod running)
bash infra/tundra-dome/scripts/kafka_lag_check.sh

# Airflow DAG status
kubectl exec -n tundra-dome deployment/airflow-scheduler -- airflow dags list
kubectl exec -n tundra-dome deployment/airflow-scheduler -- airflow dags list-runs --dag-id tundra_dome_kafka_emit --num-runs 5

# Bridge dry-run status (should be false in prod, true in dev/ci)
kubectl -n tundra-dome get configmap tundra-dome-config -o jsonpath='{.data.BRIDGE_DRY_RUN}'
```

---

## Key monitors (Datadog)

| Monitor | Threshold | Action |
|---|---|---|
| Bridge stalled | No `tundra.td_event_emitter.processed` for 5 min | Restart `td-event-emitter` |
| Observer stalled | No `tundra.observer.processed` for 5 min | Restart `tundra-observer` |
| Consumer lag high | Lag > 500 for `gastown-to-tundra-bridge` | Check bridge logs; scale if needed |
| Airflow DAG failure | Any DAG failed in last 15 min | Check DAG logs; triage in Airflow UI |
| Kafka broker down | Kafka pod not Ready for 2 min | Check PVC; restart deployment |

---

## Emergency procedures

### Bridge producing bad messages

1. Set dry-run: `kubectl -n tundra-dome set env deployment/gastown-to-tundra-bridge BRIDGE_DRY_RUN=true`
2. Capture messages with DSM: see `docs/dsm-message-capture-runbook.md`
3. Fix code/config, redeploy, then clear dry-run flag.

### Schema DLQ growing

1. Inspect: consume from `tundra-schema-dlq`
2. Identify bad producer and hot-fix its schema
3. Drain DLQ by replaying corrected messages to the source topic

### Complete cluster teardown + rebuild

```bash
kind delete cluster --name tundra-dome
kind create cluster --name tundra-dome --config infra/tundra-dome/kind-config.yaml
cd infra/tundra-dome && ./deploy.sh --stack-only
```

---

## Archival

This runbook corresponds to the `feat/multi-cluster-tundra-dome` recovery effort. Once all split PRs have merged to `main`, the source branch can be archived under `refs/tags/archive/multi-cluster-tundra-dome`.
