#!/usr/bin/env bash
# Creates (or reuses) an Azure Storage account + blob container for OpenTofu remote state.
# Requires Azure CLI login with rights to create resource groups and storage resources.

set -euo pipefail

RESOURCE_GROUP=${RESOURCE_GROUP:-rg-vibecode-tofu-state}
LOCATION=${LOCATION:-eastus2}
STORAGE_ACCOUNT_NAME=${STORAGE_ACCOUNT_NAME:-vibecodetofustate$(openssl rand -hex 3)}
CONTAINER_NAME=${CONTAINER_NAME:-opentofu-state}
SKU=${SKU:-Standard_LRS}

log() {
  printf '\033[0;32m%s\033[0m\n' "$1"
}

warn() {
  printf '\033[0;33m%s\033[0m\n' "$1"
}

err() {
  printf '\033[0;31m%s\033[0m\n' "$1" >&2
}

log "Checking Azure CLI authentication..."
if ! az account show >/dev/null 2>&1; then
  err "Azure CLI is not logged in. Run 'az login' (or 'az login --use-device-code') and retry."
  exit 1
fi

log "Ensuring resource group '${RESOURCE_GROUP}' exists..."
az group create --name "${RESOURCE_GROUP}" --location "${LOCATION}" >/dev/null

if az storage account show --name "${STORAGE_ACCOUNT_NAME}" --resource-group "${RESOURCE_GROUP}" >/dev/null 2>&1; then
  warn "Storage account ${STORAGE_ACCOUNT_NAME} already exists; reusing."
else
  log "Creating storage account '${STORAGE_ACCOUNT_NAME}' (${SKU})..."
  az storage account create \
    --name "${STORAGE_ACCOUNT_NAME}" \
    --resource-group "${RESOURCE_GROUP}" \
    --location "${LOCATION}" \
    --sku "${SKU}" \
    --kind StorageV2 \
    --allow-blob-public-access false \
    --min-tls-version TLS1_2 \
    --https-only true >/dev/null
fi

ACCOUNT_KEY=$(az storage account keys list --account-name "${STORAGE_ACCOUNT_NAME}" --resource-group "${RESOURCE_GROUP}" --query '[0].value' -o tsv)

if az storage container show --name "${CONTAINER_NAME}" --account-name "${STORAGE_ACCOUNT_NAME}" --auth-mode key --account-key "${ACCOUNT_KEY}" >/dev/null 2>&1; then
  warn "Blob container ${CONTAINER_NAME} already exists; reusing."
else
  log "Creating blob container '${CONTAINER_NAME}'..."
  az storage container create \
    --name "${CONTAINER_NAME}" \
    --account-name "${STORAGE_ACCOUNT_NAME}" \
    --account-key "${ACCOUNT_KEY}" \
    --public-access off >/dev/null
fi

cat <<INFO

Remote state storage ready.
Export these variables before running 'tofu init -migrate-state':
  export TF_VAR_state_resource_group=${RESOURCE_GROUP}
  export TF_VAR_state_storage_account=${STORAGE_ACCOUNT_NAME}
  export TF_VAR_state_container=${CONTAINER_NAME}

Or pass explicit backend config flags:
  tofu init \
    -backend-config="resource_group_name=${RESOURCE_GROUP}" \
    -backend-config="storage_account_name=${STORAGE_ACCOUNT_NAME}" \
    -backend-config="container_name=${CONTAINER_NAME}" \
    -backend-config="key=opentofu/terraform.tfstate"

Store the storage account key securely (Key Vault / secret store) and enable soft-delete + versioning for production.
INFO
