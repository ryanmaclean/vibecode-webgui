#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<USAGE
Usage: $0 --resource-group <rg> --app-name <app> --service <service-name> [--env demo] [--version 1.0.0] \
          [--site datadoghq.com] [--tags extra:key=value] [--dry-run]

Sets the Datadog environment variables required for APM + AppSec/IAST + DBM on an Azure App Service.
Requires the Azure CLI to be logged in and authorized on the target subscription.

Flags:
  --resource-group   Azure resource group containing the App Service (required)
  --app-name         Azure App Service name (required)
  --service          Value for DD_SERVICE (required)
  --env              Value for DD_ENV                (default: demo)
  --version          Value for DD_VERSION            (default: 1.0.0)
  --site             Datadog site (default: datadoghq.com)
  --tags             Additional comma-separated tags appended to DD_TAGS
  --dry-run          Print commands instead of executing az CLI
  -h, --help         Show this help message
USAGE
}

RESOURCE_GROUP=""
APP_NAME=""
SERVICE_NAME=""
DD_ENVIRONMENT="demo"
DD_VERSION="1.0.0"
DD_SITE="datadoghq.com"
EXTRA_TAGS=""
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --resource-group)
      RESOURCE_GROUP="$2"; shift 2;;
    --app-name)
      APP_NAME="$2"; shift 2;;
    --service)
      SERVICE_NAME="$2"; shift 2;;
    --env)
      DD_ENVIRONMENT="$2"; shift 2;;
    --version)
      DD_VERSION="$2"; shift 2;;
    --site)
      DD_SITE="$2"; shift 2;;
    --tags)
      EXTRA_TAGS="$2"; shift 2;;
    --dry-run)
      DRY_RUN=true; shift;;
    -h|--help)
      usage; exit 0;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$RESOURCE_GROUP" || -z "$APP_NAME" || -z "$SERVICE_NAME" ]]; then
  echo "Missing required arguments." >&2
  usage
  exit 1
fi

TAG_STRING="env:${DD_ENVIRONMENT},service:${SERVICE_NAME},version:${DD_VERSION},team:core-llm,component:web"
if [[ -n "$EXTRA_TAGS" ]]; then
  TAG_STRING+=",$EXTRA_TAGS"
fi

settings=(
  "DD_SERVICE=${SERVICE_NAME}"
  "DD_ENV=${DD_ENVIRONMENT}"
  "DD_VERSION=${DD_VERSION}"
  "DD_SITE=${DD_SITE}"
  "DD_LOGS_INJECTION=true"
  "DD_APM_ENABLED=true"
  "DD_PROFILING_ENABLED=true"
  "DD_RUNTIME_METRICS_ENABLED=true"
  "DD_DATABASE_MONITORING_ENABLED=true"
  "DD_APPSEC_ENABLED=true"
  "DD_IAST_ENABLED=true"
  "DD_TAGS=${TAG_STRING}"
)

for setting in "${settings[@]}"; do
  if $DRY_RUN; then
    echo "az webapp config appsettings set --resource-group '$RESOURCE_GROUP' --name '$APP_NAME' --settings $setting"
  else
    az webapp config appsettings set \
      --resource-group "$RESOURCE_GROUP" \
      --name "$APP_NAME" \
      --settings "$setting" >/dev/null
  fi
done

echo
cat <<'PG'
# Datadog Postgres DBM integration (add to your agent config)
instances:
  - host: <postgres-host>
    port: 5432
    username: datadog
    password: <DD_POSTGRES_PASSWORD>
    dbname: postgres
    dbm: true
    tags:
      - team:core-llm
      - component:database
PG
