# AKS RBAC Configuration Guide

This guide covers Azure RBAC setup for AKS clusters with Azure Active Directory (AAD) integration.

## Prerequisites

- Azure CLI installed and logged in (`az login`)
- kubelogin installed (`brew install Azure/kubelogin/kubelogin`)
- Access to an AKS cluster with AAD integration enabled

## Current Cluster Configuration

| Setting | Value |
|---------|-------|
| Cluster Name | us1-default-aks-dev |
| Resource Group | aks-infra-rg |
| Subscription | 448316c8-7dd5-437c-9875-40be1dbc4b9f |
| Region | eastus |
| Kubernetes Version | 1.32.9 |
| AAD Integration | Managed |
| Azure RBAC | Enabled |

## Required Tools Setup

### 1. Install kubelogin

kubelogin is required for AAD-authenticated AKS clusters:

```bash
# macOS
brew install Azure/kubelogin/kubelogin

# Linux
curl -LO https://github.com/Azure/kubelogin/releases/latest/download/kubelogin-linux-amd64.zip
unzip kubelogin-linux-amd64.zip -d ~/bin
chmod +x ~/bin/bin/linux_amd64/kubelogin
sudo mv ~/bin/bin/linux_amd64/kubelogin /usr/local/bin/

# Verify installation
kubelogin --version
```

### 2. Get AKS Credentials

```bash
# Get credentials (will configure kubeconfig for AAD auth)
az aks get-credentials \
  --resource-group aks-infra-rg \
  --name us1-default-aks-dev \
  --overwrite-existing

# Convert kubeconfig to use Azure CLI authentication
kubelogin convert-kubeconfig -l azurecli
```

## Azure RBAC Role Assignments

### Required Roles

For full cluster access, users need one of these role assignments:

| Role | Scope | Description |
|------|-------|-------------|
| Azure Kubernetes Service RBAC Cluster Admin | Cluster | Full admin access via Azure RBAC |
| Azure Kubernetes Service Cluster Admin Role | Cluster | Admin access (legacy, non-RBAC) |
| Azure Kubernetes Service RBAC Admin | Namespace | Namespace-scoped admin |
| Azure Kubernetes Service RBAC Reader | Cluster/Namespace | Read-only access |

### Assign Cluster Admin Role

```bash
# Get your user ID
USER_ID=$(az ad signed-in-user show --query id -o tsv)
echo "User ID: $USER_ID"

# Assign Azure Kubernetes Service RBAC Cluster Admin
az role assignment create \
  --assignee $USER_ID \
  --role "Azure Kubernetes Service RBAC Cluster Admin" \
  --scope /subscriptions/448316c8-7dd5-437c-9875-40be1dbc4b9f/resourceGroups/aks-infra-rg/providers/Microsoft.ContainerService/managedClusters/us1-default-aks-dev

# Verify assignment
az role assignment list \
  --assignee $USER_ID \
  --scope /subscriptions/448316c8-7dd5-437c-9875-40be1dbc4b9f/resourceGroups/aks-infra-rg/providers/Microsoft.ContainerService/managedClusters/us1-default-aks-dev \
  -o table
```

### RBAC Propagation

Azure RBAC role assignments can take **5-15 minutes** to propagate. If you receive "Forbidden" errors immediately after role assignment:

1. Wait 5-10 minutes
2. Re-run `kubelogin convert-kubeconfig -l azurecli`
3. Retry the kubectl command

## Verify Access

```bash
# Test cluster access
kubectl get nodes

# Expected output:
# NAME                                STATUS   ROLES    AGE   VERSION
# aks-nodepool1-xxxxx-vmss000000     Ready    <none>   Xd    v1.32.9
```

## Cluster Information

```bash
# Check cluster configuration
az aks show -g aks-infra-rg -n us1-default-aks-dev \
  --query "{name:name,k8sVersion:kubernetesVersion,location:location,aadProfile:aadProfile}" \
  -o json

# Check node pools
az aks nodepool list -g aks-infra-rg --cluster-name us1-default-aks-dev -o table

# Check cluster health
kubectl get componentstatuses
kubectl cluster-info
```

## Troubleshooting

### Error: "User does not have access to the resource in Azure"

This error occurs when:
1. RBAC role assignment is missing
2. RBAC role assignment is still propagating (wait 5-15 mins)
3. kubeconfig is using wrong authentication method

**Fix:**
```bash
# Verify role assignment exists
az role assignment list --assignee $(az ad signed-in-user show --query id -o tsv) \
  --scope /subscriptions/448316c8-7dd5-437c-9875-40be1dbc4b9f/resourceGroups/aks-infra-rg/providers/Microsoft.ContainerService/managedClusters/us1-default-aks-dev

# Refresh credentials
az aks get-credentials -g aks-infra-rg -n us1-default-aks-dev --overwrite-existing
kubelogin convert-kubeconfig -l azurecli
```

### Error: "kubelogin not found"

```bash
# Install kubelogin
brew install Azure/kubelogin/kubelogin

# Verify in PATH
which kubelogin
```

### Error: "AADSTS700016: Application not found"

This error occurs when the cluster's AAD application is misconfigured. Contact your Azure administrator.

## Service Principal Access (CI/CD)

For automated pipelines, use a service principal:

```bash
# Create service principal
SP_OUTPUT=$(az ad sp create-for-rbac --name "aks-deployer" --skip-assignment)
SP_ID=$(echo $SP_OUTPUT | jq -r '.appId')
SP_SECRET=$(echo $SP_OUTPUT | jq -r '.password')

# Assign RBAC role to service principal
az role assignment create \
  --assignee $SP_ID \
  --role "Azure Kubernetes Service RBAC Cluster Admin" \
  --scope /subscriptions/448316c8-7dd5-437c-9875-40be1dbc4b9f/resourceGroups/aks-infra-rg/providers/Microsoft.ContainerService/managedClusters/us1-default-aks-dev

# In CI/CD, authenticate:
az login --service-principal -u $SP_ID -p $SP_SECRET --tenant $TENANT_ID
kubelogin convert-kubeconfig -l spn
```

## Related Documentation

- [docs/aks-bootstrap-guide.md](./aks-bootstrap-guide.md) - Full AKS deployment guide
- [docs/aks-datadog-monitoring-guide.md](./aks-datadog-monitoring-guide.md) - Monitoring setup
- [Azure AKS RBAC Documentation](https://learn.microsoft.com/en-us/azure/aks/manage-azure-rbac)
