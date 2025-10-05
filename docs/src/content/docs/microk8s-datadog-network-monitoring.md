---
title: MicroK8s Datadog Network Monitoring
description: Enable Datadog Cloud Network Monitoring on MicroK8s based clusters
---

# Datadog Network Monitoring on MicroK8s

Use this runbook to enable Datadog Cloud Network Monitoring (CNM) on the MicroK8s footprint that mirrors our KIND and AKS deployments.

## ✅ Prerequisites
- MicroK8s 1.30+ with `microk8s enable dns storage metallb:10.64.140.43-10.64.140.49`
- `helm` available on the host (`sudo snap install helm --classic`)
- Datadog API and application keys stored in `.env.local` or exported in the shell
- Linux host with kernel headers available so the Datadog system-probe can attach eBPF hooks

## 🚀 Installation
1. **Create the namespace and secret**
   ```bash
   microk8s kubectl create namespace datadog --dry-run=client -o yaml | microk8s kubectl apply -f -
   microk8s kubectl create secret generic datadog-secret -n datadog \
     --from-literal=api-key="$DD_API_KEY" \
     --from-literal=app-key="$DD_APP_KEY"
   ```
2. **Install or upgrade the Datadog Helm chart**
   ```bash
   helm repo add datadog https://helm.datadoghq.com
   helm repo update
   helm upgrade --install datadog datadog/datadog \
     --kubeconfig <(microk8s config) \
     --namespace datadog \
     -f k8s/datadog-values-microk8s.yaml
   ```
   - Do **not** override `datadog.networkMonitoring.enabled` or `systemProbe.enabled`; both are required for CNM dashboards.
3. **Label workloads so CNM tags traffic correctly**
   ```bash
   microk8s kubectl label namespace vibecode env=microk8s --overwrite
   microk8s kubectl annotate namespace vibecode tags.datadoghq.com/service=vibecode-webgui --overwrite
   ```

## 🔍 Verification
- Confirm the agents are healthy
  ```bash
  microk8s kubectl get pods -n datadog
  ```
- Inspect the system-probe and network modules
  ```bash
  microk8s kubectl -n datadog exec daemonset/datadog-agent -- agent status | grep -A5 "Network"
  microk8s kubectl -n datadog exec daemonset/datadog-agent -- agent status | grep -A10 "System Probe"
  ```
- Validate Valkey and Postgres integrations are present
  ```bash
  microk8s kubectl -n datadog exec daemonset/datadog-agent -- agent configcheck | grep -E "redisdb|postgres"
  npm run test:k8s -- datadog-k8s-config.test.ts
  ```
- Check that the elevated security context made it into the DaemonSet
  ```bash
  microk8s kubectl -n datadog get daemonset datadog-agent -o yaml | grep -A3 "system-probe"
  ```

## 🛠️ Troubleshooting
- **`system-probe` fails with AppArmor errors** → run `sudo aa-status` and ensure the microk8s snap ships the `unconfined` profile (our Helm values set `seccomp` and `appArmor` to `unconfined`).
- **No flows in Datadog** → verify host networking is enabled (`useHostNetwork: true`) and that port 5000 is free.
- **Kernel headers missing** → install your distro headers (`sudo apt install linux-headers-$(uname -r)`) and restart the Datadog DaemonSet.

Once these checks pass, the MicroK8s environment emits the same CNM telemetry as KIND and AKS, including flow logs and service maps.
