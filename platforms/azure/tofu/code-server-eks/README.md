# code-server EKS Module (experimental)

Installs the `code-server-cloud` Helm chart onto an existing Amazon EKS cluster. Provide the cluster endpoint, CA cert, and an authentication token (for example, from `aws eks get-token`).

```hcl
data "aws_eks_cluster" "main" {
  name = "my-eks"
}

data "aws_eks_cluster_auth" "main" {
  name = data.aws_eks_cluster.main.name
}

module "codeserver" {
  source = "./tofu/code-server-eks"

  region                   = "us-east-1"
  cluster_endpoint         = data.aws_eks_cluster.main.endpoint
  cluster_ca_certificate   = data.aws_eks_cluster.main.certificate_authority[0].data
  auth_token               = data.aws_eks_cluster_auth.main.token
  code_server_password     = "supersecret"
  storage_class            = "efs-sc"
}
```

Future iterations will add optional EFS provisioning, Datadog sidecar settings, and auto-stop hooks.
