#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Script to deploy Datadog Database Monitoring configuration
# Usage: ./scripts/deploy-datadog-dbm.sh [DB_PASSWORD]

# Initialize log aggregation
init_log_aggregation


set -euo pipefail

# Check if DB_PASSWORD is provided as an argument
if [ $# -eq 0 ]; then
  echo "Error: Database password is required"
  echo "Usage: $0 <database_password>"
  exit 1
fi

DB_PASSWORD="$1"
NAMESPACE="vibecode"

# Create the Kubernetes directory if it doesn't exist
mkdir -p kubernetes/datadog

# Generate base64 encoded password
ENCODED_PASSWORD=$(echo -n "$DB_PASSWORD" | base64)

# Update the secret with the provided password
sed -i.bak "s/password: \"\"/password: \"$ENCODED_PASSWORD\"/" kubernetes/datadog/datadog-db-secret.yaml

# Apply the ConfigMap and Secret
echo "🔧 Applying Datadog DBM configuration..."
kubectl apply -f kubernetes/datadog/datadog-dbm-config.yaml -n $NAMESPACE
kubectl apply -f kubernetes/datadog/datadog-db-secret.yaml -n $NAMESPACE

# Restart Datadog agent to apply configuration changes
echo "🔄 Restarting Datadog agent..."
kubectl rollout restart deployment/datadog-cluster-agent -n $NAMESPACE
kubectl rollout restart daemonset/datadog -n $NAMESPACE

echo "✅ Datadog DBM configuration deployed successfully!"
echo "📊 Monitor your database in the Datadog dashboard: https://app.datadoghq.com/databases"
