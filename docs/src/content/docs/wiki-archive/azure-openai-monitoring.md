---
title: Azure OpenAI Monitoring with Datadog
description: Comprehensive monitoring setup for Azure OpenAI services using Datadog with real-time metrics, error tracking, and performance dashboards
sidebar:
  order: 61
---

# Azure OpenAI Monitoring with Datadog

This document outlines the monitoring setup for Azure OpenAI services using Datadog.

## Features

- **Real-time Metrics**: Track API calls, latency, and token usage
- **Error Tracking**: Monitor error rates and types
- **Rate Limiting**: Get alerts for rate limit thresholds
- **Cost Monitoring**: Track token usage and estimated costs
- **Performance Dashboards**: Pre-built dashboards for AI operations

## Prerequisites

- Datadog Agent v7.27.0+
- Azure CLI access
- Kubernetes cluster with Datadog operator installed

## Setup

1. **Configure Azure AD Application**
   ```bash
   # Create Azure AD application for Datadog
   az ad app create --display-name "Datadog Monitoring"
   
   # Assign Monitoring Reader role to the application
   az role assignment create \
     --assignee <app-id> \
     --role "Monitoring Reader" \
     --scope /subscriptions/<subscription-id>/resourceGroups/<resource-group>
   ```

2. **Deploy Monitoring Configuration**
   ```bash
   # Make the script executable
   chmod +x scripts/setup-azure-openai-monitoring.sh
   
   # Run the setup script
   AZURE_CLIENT_ID="your-client-id" \
   AZURE_CLIENT_SECRET="your-client-secret" \
   AZURE_TENANT_ID="your-tenant-id" \
   AZURE_SUBSCRIPTION_ID="your-subscription-id" \
   AZURE_OPENAI_RESOURCE_GROUP="your-resource-group" \
   DEPLOYMENT_NAME="your-deployment-name" \
   MODEL_NAME="your-model-name" \
   AZURE_REGION="your-region" \
   ./scripts/setup-azure-openai-monitoring.sh
   ```

## Dashboards

### 1. Azure OpenAI Overview
- API request volume
- Error rates and types
- Token usage and costs
- Latency percentiles

### 2. Embedding Operations
- Embedding generation latency
- Vector search performance
- Batch processing metrics

### 3. Rate Limiting
- Requests by status code
- Rate limit utilization
- Throttling events

## Alerts

| Alert Name | Condition | Severity | Notification Channel |
|------------|-----------|----------|----------------------|
| High Error Rate | `avg(last_5m):sum:azure.openai_service.api_errors{*}.as_rate() / sum:azure.openai_service.api_requests{*}.as_rate() > 0.1` | Critical | Slack, PagerDuty |
| High Latency | `avg(last_15m):avg:azure.openai_service.latency{*} > 1000` | Warning | Slack |
| Rate Limited | `sum(last_5m):sum:azure.openai_service.rate_limited_requests{*} > 0` | Critical | PagerDuty |
| High Token Usage | `sum(last_1h):sum:azure.openai_service.tokens_used{*}.as_count() > 1000000` | Warning | Slack |

## Custom Metrics

| Metric Name | Type | Description | Tags |
|-------------|------|-------------|------|
| `azure.openai.embedding.latency` | Gauge | Latency of embedding generation | deployment, model |
| `azure.openai.embedding.tokens` | Count | Tokens used for embeddings | deployment, model |
| `azure.openai.rate_limit.remaining` | Gauge | Remaining rate limit | deployment |
| `azure.openai.vector_search.duration` | Histogram | Vector search duration | index, dimensions |

## Troubleshooting

### Common Issues

1. **Missing Metrics**
   - Verify Azure AD application has correct permissions
   - Check Datadog agent logs for connection errors
   - Ensure resource tags match in Azure and Datadog

2. **Authentication Failures**
   ```bash
   # Check Datadog agent logs
   kubectl logs -l app=datadog-agent -n datadog | grep -i error
   
   # Verify Azure AD application credentials
   az ad app show --id <app-id>
   ```

3. **High Latency**
   - Check Azure OpenAI service health
   - Review Datadog network metrics
   - Verify region alignment between client and service

## Best Practices

1. **Tagging Strategy**
   - Use consistent tags across resources
   - Include environment, team, and service information
   - Add model version and deployment details

2. **Alert Thresholds**
   - Set appropriate thresholds for your workload
   - Use multi-notify for critical alerts
   - Implement alert fatigue prevention

3. **Cost Control**
   - Set up budget alerts in Azure
   - Monitor token usage patterns
   - Implement rate limiting in your application

## Related Documentation

- [Datadog Azure Integration](https://docs.datadoghq.com/integrations/azure/)
- [Azure OpenAI Monitoring](https://learn.microsoft.com/en-us/azure/cognitive-services/openai/how-to/monitoring)
- [Datadog Custom Metrics](https://docs.datadoghq.com/metrics/custom_metrics/)
- [Azure OpenAI Deployment Guide](./deploy-azure-openai-monitoring/)
