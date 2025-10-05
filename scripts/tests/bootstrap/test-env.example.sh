#!/usr/bin/env bash
# Example environment configuration for bootstrap validation scripts.

export CLUSTER_NAME="${CLUSTER_NAME:-vibecode-test}"
export RESOURCE_GROUP="${RESOURCE_GROUP:-vibecode-rg}"
export ACR_NAME="${ACR_NAME:-vibecodeacr}"
export NAMESPACE="${NAMESPACE:-vibecode}"
export LOCATION="${LOCATION:-eastus2}"
export STORAGE_CLASS="${STORAGE_CLASS:-default}"
export DD_API_KEY="${DD_API_KEY:-test_datadog_api_key}"  # placeholder for local validation
export DD_SITE="${DD_SITE:-datadoghq.com}"
