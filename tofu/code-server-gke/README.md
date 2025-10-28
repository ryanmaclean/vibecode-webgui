# code-server GKE Module (experimental)

This OpenTofu module installs the `helm/code-server-cloud` chart onto an existing GKE cluster. It assumes you already created the cluster (preferably spot/autopilot) and have credentials for the Kubernetes API.

```hcl
module "codeserver" {
  source = "./tofu/code-server-gke"

  cluster_endpoint           = data.google_container_cluster.main.endpoint
  client_certificate         = data.google_container_cluster.main.master_auth[0].client_certificate
  client_key                 = data.google_container_cluster.main.master_auth[0].client_key
  cluster_ca_certificate     = data.google_container_cluster.main.master_auth[0].cluster_ca_certificate
  code_server_password       = "supersecret"
  storage_class              = "standard"
  enable_persistent_volume   = true
  enable_datadog_sidecar     = true
}
```

> **Note:** The module does **not** create the cluster or persistent disks; it simply deploys the Helm release using the credentials provided. Expect further changes while the GKE/GCP automation solidifies.
