# code-server-cloud Helm Chart (experimental)

This chart deploys a single code-server workspace pod with optional persistent storage and Datadog sidecar monitoring. It is intended for spot/preemptible clusters (GKE Autopilot, EKS managed node groups) and serves as a baseline for the cloud-workspace automation.

## Usage

```bash
helm upgrade --install codeserver helm/code-server-cloud \
  --set auth.password="supersecret" \
  --set workspace.persistentVolume.enabled=true \
  --set workspace.persistentVolume.storageClass="standard" \
  --set sidecar.datadog.enabled=true \
  --set sidecar.datadog.apiKeySecretName="datadog-secret"
```

Key features:
- Optional PersistentVolumeClaim (`workspace.persistentVolume.enabled=true`).
- Optional Datadog agent sidecar (`sidecar.datadog.enabled=true`).
- Configurable node selectors/tolerations for spot nodes.

This chart is still evolving—expect breaking changes while the GKE/EKS OpenTofu modules are fleshed out.
