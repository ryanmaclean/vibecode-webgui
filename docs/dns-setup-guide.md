# VibeCode DNS and SSL Configuration Guide

This document outlines the process for configuring DNS and SSL for the VibeCode platform, specifically for the domain `vibecode.eastus2.cloudapp.azure.com`.

## Overview

VibeCode uses Azure Kubernetes Service (AKS) with an NGINX Ingress Controller. External access to the application is provided through an Azure Public IP with a DNS name label, which creates an Azure-managed domain in the format `<label>.<region>.cloudapp.azure.com`.

## Prerequisites

- Azure CLI (`az`) installed and configured
- Access to the VibeCode Azure subscription
- `kubectl` configured to access the AKS cluster
- OpenTofu (Terraform alternative) installed

## DNS Configuration Steps

### 1. Restore AKS Cluster (if needed)

If your AKS cluster needs to be recreated:

1. Fix any issues with the Terraform/OpenTofu configurations:
   ```bash
   # Fix network policy issues
   ./scripts/fix-network-policy.sh
   
   # Apply OpenTofu changes
   cd tofu
   tofu init
   tofu plan
   tofu apply
   ```

2. Wait for Azure DNS propagation (this can take 5-15 minutes)

### 2. Configure Public IP with DNS Name Label

The script `scripts/create-public-ip.sh` will create a public IP with the DNS name label 'vibecode' in the eastus2 region:

```bash
# Authenticate to Azure (if not already done)
az login

# Create the public IP with DNS name label
./scripts/create-public-ip.sh
```

This will create an Azure Public IP resource with:
- DNS name: `vibecode.eastus2.cloudapp.azure.com`
- Static IP assignment

### 3. Verify DNS Configuration

Use the provided verification script to check DNS resolution:

```bash
# Verify DNS and SSL
./scripts/verify-dns-ssl.sh
```

### 4. Configure AKS Ingress to Use the Public IP

Once the AKS cluster is restored, you'll need to configure the ingress to use the newly created public IP:

1. Get the AKS credentials:
   ```bash
   az aks get-credentials --resource-group rg-vibecode-aks-prod --name vibecode-aks --admin
   ```

2. Update the ingress service to use the public IP:
   ```bash
   # Get the Resource ID of the public IP
   PUBLIC_IP_ID=$(az network public-ip show --resource-group rg-vibecode-aks-prod --name vibecode-ingress-ip --query id -o tsv)
   
   # Update the ingress service to use the public IP
   kubectl annotate service -n ingress-nginx ingress-nginx-controller service.beta.kubernetes.io/azure-load-balancer-resource-group=rg-vibecode-aks-prod
   kubectl annotate service -n ingress-nginx ingress-nginx-controller service.beta.kubernetes.io/azure-pip-name=vibecode-ingress-ip
   ```

3. Verify the ingress is working:
   ```bash
   kubectl get svc -n ingress-nginx
   ```

## SSL Certificate Configuration

VibeCode uses Let's Encrypt for SSL certificates, managed through cert-manager in Kubernetes.

### 1. Install cert-manager (if needed)

If cert-manager is not already installed:

```bash
# Add the Jetstack Helm repository
helm repo add jetstack https://charts.jetstack.io
helm repo update

# Install cert-manager
helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager \
  --create-namespace \
  --set installCRDs=true
```

### 2. Create ClusterIssuer for Let's Encrypt

```bash
# Apply the Let's Encrypt ClusterIssuer
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@yourdomain.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF
```

### 3. Update Ingress to Use Let's Encrypt

Ensure the ingress resource has the necessary annotations for cert-manager:

```bash
kubectl annotate ingress vibecode-ingress -n vibecode-platform cert-manager.io/cluster-issuer=letsencrypt-prod
kubectl annotate ingress vibecode-ingress -n vibecode-platform kubernetes.io/tls-acme=true
```

### 4. Verify SSL Certificate

Use the verification script to check the SSL certificate:

```bash
./scripts/verify-dns-ssl.sh
```

## Troubleshooting

### DNS Issues

1. **DNS Not Resolving**:
   - Check if the public IP resource exists and has the correct DNS name label
   - Verify the resource group and region are correct
   - Allow time for DNS propagation (5-15 minutes)

2. **IP Mismatch**:
   - If the resolved IP doesn't match the expected IP, check the Azure Load Balancer configuration
   - Ensure the ingress service is properly annotated to use the correct public IP

### SSL Certificate Issues

1. **Certificate Not Issued**:
   - Check cert-manager logs: `kubectl logs -n cert-manager -l app=cert-manager`
   - Verify the ClusterIssuer is properly configured
   - Check certificate status: `kubectl get certificate -n vibecode-platform`
   - Check challenge status: `kubectl get challenge -n vibecode-platform`

2. **Certificate Renewal**:
   - Let's Encrypt certificates are valid for 90 days and should auto-renew
   - To force renewal: `kubectl annotate certificate vibecode-tls -n vibecode-platform cert-manager.io/renew=true`

## Additional Resources

- [Azure DNS Documentation](https://docs.microsoft.com/en-us/azure/dns/)
- [cert-manager Documentation](https://cert-manager.io/docs/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [NGINX Ingress Controller Documentation](https://kubernetes.github.io/ingress-nginx/)