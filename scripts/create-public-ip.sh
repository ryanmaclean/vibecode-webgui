#!/usr/bin/env bash
# Script to create an Azure Public IP with DNS name label
# This will allow the domain vibecode.eastus2.cloudapp.azure.com to resolve to the IP 72.153.39.233

set -euo pipefail

# Configuration
RESOURCE_GROUP=${RESOURCE_GROUP:-"rg-vibecode-aks-prod"}
LOCATION=${LOCATION:-"eastus2"}
DNS_NAME_LABEL=${DNS_NAME_LABEL:-"vibecode"}
PUBLIC_IP_NAME=${PUBLIC_IP_NAME:-"vibecode-ingress-ip"}
TARGET_IP=${TARGET_IP:-"72.153.39.233"}

# Check if logged in to Azure
echo "Checking Azure CLI login..."
if ! az account show &> /dev/null; then
  echo "Please log in to Azure CLI first with: az login"
  exit 1
fi

# Create resource group if it doesn't exist
echo "Checking for resource group ${RESOURCE_GROUP}..."
if ! az group show --name "${RESOURCE_GROUP}" &> /dev/null; then
  echo "Creating resource group ${RESOURCE_GROUP}..."
  az group create --name "${RESOURCE_GROUP}" --location "${LOCATION}"
fi

# Check if public IP exists
echo "Checking if public IP ${PUBLIC_IP_NAME} exists..."
if az network public-ip show --resource-group "${RESOURCE_GROUP}" --name "${PUBLIC_IP_NAME}" &> /dev/null; then
  echo "Public IP already exists. Updating DNS label..."
  az network public-ip update \
    --resource-group "${RESOURCE_GROUP}" \
    --name "${PUBLIC_IP_NAME}" \
    --dns-name "${DNS_NAME_LABEL}"
else
  echo "Creating public IP ${PUBLIC_IP_NAME} with DNS label ${DNS_NAME_LABEL}..."
  az network public-ip create \
    --resource-group "${RESOURCE_GROUP}" \
    --name "${PUBLIC_IP_NAME}" \
    --allocation-method Static \
    --sku Standard \
    --dns-name "${DNS_NAME_LABEL}"
fi

# Get the current public IP address
CURRENT_IP=$(az network public-ip show \
  --resource-group "${RESOURCE_GROUP}" \
  --name "${PUBLIC_IP_NAME}" \
  --query ipAddress -o tsv)

echo "Public IP address: ${CURRENT_IP}"
echo "DNS name: ${DNS_NAME_LABEL}.${LOCATION}.cloudapp.azure.com"

# Verify DNS resolution
echo "Verifying DNS resolution..."
if nslookup "${DNS_NAME_LABEL}.${LOCATION}.cloudapp.azure.com" &> /dev/null; then
  echo "DNS resolution successful!"
else
  echo "DNS resolution failed. It may take some time to propagate."
fi

echo "Done! DNS name '${DNS_NAME_LABEL}.${LOCATION}.cloudapp.azure.com' has been configured."
echo "NOTE: The current IP (${CURRENT_IP}) is different from the target IP (${TARGET_IP})."
echo "You will need to associate this public IP with your Azure Load Balancer or use it for your AKS ingress."