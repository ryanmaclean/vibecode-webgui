# Datadog Cluster Agent Support in KIND

The `scripts/min-kind-bootstrap.sh` workflow now installs the full Datadog monitoring stack—node agents *and* the Datadog Cluster Agent—inside every KIND cluster. This ensures orchestrator explorer data and Kubernetes resource collection are available before any application workloads start.

## What the bootstrap does

1. Loads secrets from `.env.local` (or the file referenced by `ENV_FILE`). At minimum, set `DD_API_KEY` and optionally `DD_APP_KEY` and `DD_CLUSTER_AGENT_TOKEN`.
2. Creates the `datadog` namespace, API key secret, and a generated Cluster Agent auth token secret (`datadog-cluster-agent-token`).
3. Applies RBAC, the node DaemonSet (`k8s/datadog-agent-fixed.yaml`), and the Cluster Agent deployment (`k8s/datadog-cluster-agent.yaml`).
4. Waits for **both** `daemonset/datadog-agent` and `deployment/datadog-cluster-agent` to become Ready before moving on to Postgres/Valkey and the web app.
5. Enables orchestrator explorer and cluster checks in the DaemonSet, pointing the agents at `http://datadog-cluster-agent.datadog.svc.cluster.local:5005` with TLS disabled for local testing.

## Verifying the installation

After `./scripts/min-kind-bootstrap.sh` completes (you can speed it up with `SKIP_BUILD=1` to reuse the existing image), run:

```bash
kubectl get namespace datadog
kubectl get daemonset datadog-agent -n datadog
kubectl get deployment datadog-cluster-agent -n datadog
kubectl get pods -l app=datadog-agent -n datadog
kubectl get pods -l app=datadog-cluster-agent -n datadog
kubectl logs -l app=datadog-agent -n datadog --tail=50 | grep -i 'error\|fatal'
```

You should see `3/3 Ready` for the daemonset, `1/1` ready for the Cluster Agent, and no critical errors in the logs. To exercise the Datadog API end-to-end, source `.env.local` and run:

```bash
. .env.local
DD_API_KEY="$DD_API_KEY" DD_SITE="${DD_SITE:-datadoghq.com}" node test-datadog-api.cjs
```

## CI guidance

- Use `SKIP_BUILD=1 ./scripts/min-kind-bootstrap.sh` when the application image is already built. This keeps the monitoring bring-up around 8 minutes.
- Add a smoke test (shell or Jest) that asserts:
  - `kubectl get daemonset datadog-agent -n datadog | grep '3 *3 *3'`
  - `kubectl get deployment datadog-cluster-agent -n datadog | grep '1/1'`
  - `kubectl logs -l app=datadog-agent -n datadog --tail=50` contains no `error`/`fatal`
- The bootstrap exits if `DD_API_KEY` is missing, so remember to provide it in GitHub Actions secrets.

## Open-source alternatives (MIT/BSD/Apache compatible)

If you need a lighter-weight or fully OSS stack, consider:

- **Prometheus + Grafana** (Apache 2.0): scrape metrics with `kube-prometheus-stack` Helm chart; Grafana provides dashboards and alerting.
- **OpenTelemetry Collector** (Apache 2.0): send traces/metrics/logs to backends such as Tempo, Loki, or Prometheus.
- **VictoriaMetrics Operator** (Apache 2.0): a Prometheus-compatible time-series database with Kubernetes auto-discovery.

These can coexist with Datadog or replace it if you have licensing constraints, but Datadog remains the default path for this project.
