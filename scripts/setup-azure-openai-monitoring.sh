#!/bin/bash

# Setup Azure OpenAI Monitoring with Datadog
# This script configures Datadog to monitor Azure OpenAI services

set -e

# Check for required environment variables
for var in AZURE_CLIENT_ID AZURE_CLIENT_SECRET AZURE_TENANT_ID AZURE_SUBSCRIPTION_ID AZURE_OPENAI_RESOURCE_GROUP DEPLOYMENT_NAME MODEL_NAME AZURE_REGION; do
    if [ -z "${!var}" ]; then
        echo "Error: $var is not set. Please set all required environment variables."
        exit 1
    fi
done

# Apply the Datadog Azure integration configuration
kubectl apply -f kubernetes/datadog/azure-integration-config.yaml -n vibecode

# Apply the Azure OpenAI monitoring configuration
kubectl apply -f kubernetes/datadog/azure-openai-monitoring.yaml -n vibecode

# Restart Datadog agent to apply new configuration
echo "Restarting Datadog agent to apply new configuration..."
kubectl rollout restart deployment/datadog-cluster-agent -n datadog
kubectl rollout status deployment/datadog-cluster-agent -n datadog --timeout=5m

echo "✅ Azure OpenAI monitoring setup complete!"
echo "To verify the integration, run: kubectl logs -l app=datadog-agent -n datadog | grep 'Azure'"

# Verify metrics are being collected
echo -e "\nVerifying metrics collection..."
kubectl exec -it deployment/datadog-cluster-agent -n datadog -- agent status | grep -A 20 "Azure"

# Create a port-forward to access Datadog UI locally
echo -e "\nTo access Datadog UI locally, run:"
echo "kubectl port-forward svc/datadog-cluster-agent -n datadog 5000:5000"
echo "Then open http://localhost:5000 in your browser"
