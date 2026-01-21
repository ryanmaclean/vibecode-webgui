---
title: Deploying Azure OpenAI Monitoring
description: Step-by-step guide for deploying and configuring Azure OpenAI monitoring using Datadog with Terraform automation
sidebar:
  order: 62
---

# Deploying Azure OpenAI Monitoring

This guide explains how to deploy and configure Azure OpenAI monitoring using Datadog.

## Prerequisites

1. Terraform >= 1.0
2. Datadog API and App keys with appropriate permissions
3. Azure CLI installed and configured
4. Access to the Azure subscription with OpenAI service

## Deployment Steps

### 1. Initialize Terraform

```bash
cd infrastructure
terraform init
```

### 2. Configure Environment Variables

Create a `terraform.tfvars` file with your configuration:

```hcl
environment = "production"
datadog_api_key = "your-datadog-api-key"
datadog_app_key = "your-datadog-app-key"

# Optional: Customize alert thresholds
error_rate_threshold = 5.0    # percentage
latency_threshold_ms = 1000  # milliseconds
```

### 3. Review the Plan

```bash
terraform plan -target=module.azure_openai_monitoring
```

### 4. Apply the Configuration

```bash
terraform apply -target=module.azure_openai_monitoring
```

### 5. Verify Deployment

1. Log in to your Datadog dashboard
2. Navigate to "Dashboards" and look for "[ENV] Azure OpenAI - Vibecode-AI - Overview"
3. Check the "Monitors" section for the newly created alerts

## Configuration Options

### Alert Thresholds

Customize alert thresholds in `infrastructure/monitoring/azure_openai.tf`:

```hcl
module "azure_openai_monitoring" {
  # ... existing configuration ...
  
  # Alert thresholds
  error_rate_threshold = 5.0   # 5% error rate
  latency_threshold_ms = 1000  # 1 second
  
  # ... rest of the configuration ...
}
```

### Notification Channels

Update the Slack channel in `infrastructure/monitoring/azure_openai.tf`:

```hcl
slack_channel = var.environment == "production" ? "#alerts-ai" : "#alerts-dev"
```

## Monitoring Dashboard

The dashboard includes the following widgets:

1. **API Requests**: Shows request volume by status code
2. **Error Rate**: Displays the percentage of failed requests
3. **Token Usage**: Tracks token consumption by type

## Alerts

Two main alerts are configured:

1. **High Error Rate**: Triggers when error rate exceeds the threshold
2. **High Latency**: Triggers when response time exceeds the threshold

## Troubleshooting

### Missing Metrics

If metrics are not appearing in Datadog:

1. Verify the Azure integration is properly configured in Datadog
2. Check the Datadog agent logs for connection issues:
   ```bash
   kubectl logs -l app=datadog-agent -n datadog
   ```
3. Ensure the service name matches in both the module and your application

### False Positives

If you're getting false positive alerts:

1. Adjust the threshold values in the module configuration
2. Modify the evaluation window for alerts
3. Add additional filters to the alert queries

## Maintenance

### Updating the Module

To update the monitoring configuration:

1. Make your changes in the module
2. Run `terraform plan` to review changes
3. Apply with `terraform apply`

### Removing the Monitoring

To completely remove the monitoring:

```bash
terraform destroy -target=module.azure_openai_monitoring
```

## Support

For issues with the monitoring setup, contact the AI Engineering team or open an issue in the repository.

## Related Documentation

- [Azure OpenAI Monitoring Overview](./azure-openai-monitoring/)
- [Production Deployment Guide](./production-deployment-guide/)
- [Kubernetes Secrets Automation](./kubernetes-secrets-automation/)
