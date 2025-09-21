# VibeCode AKS Datadog Monitoring Guide

This document provides detailed information on setting up and verifying Datadog monitoring for the VibeCode AKS deployment, including Database Monitoring (DBM) for PostgreSQL with pgvector.

## Overview

The VibeCode platform uses Datadog for comprehensive monitoring of:
- AKS cluster infrastructure
- Kubernetes workloads and resources
- PostgreSQL database with pgvector extension
- Application performance metrics and logs

## Prerequisites

- AKS cluster deployed and running
- Kubectl configured to access the AKS cluster
- Datadog account with API key
- Helm installed locally

## Setup Process

### 1. Deploy AKS Cluster

The AKS cluster is deployed using the deployment scripts:

```bash
# Create AKS cluster
./scripts/create-aks-cluster.sh

# Deploy ingress controller 
./scripts/deploy-ingress-controller.sh

# Deploy full application stack
./scripts/deploy-vibecode.sh
```

### 2. Deploy Datadog Monitoring

Datadog is deployed using the Helm chart with AKS-specific optimizations:

```bash
# Set your Datadog API key
export DD_API_KEY=your_datadog_api_key

# Optional: Set Datadog App key if using API features
export DD_APP_KEY=your_datadog_app_key

# Run the Datadog setup script
./scripts/setup-aks-datadog-monitoring.sh --cluster-name vibecode-prod-aks-6c3db0e6
```

This script:
1. Creates the Datadog namespace
2. Sets up Datadog secrets with API keys
3. Configures the Datadog Helm values for AKS
4. Installs Datadog agents and cluster agent
5. Configures PostgreSQL Database Monitoring

### 3. Validate PostgreSQL Database Monitoring

After the PostgreSQL database is deployed, validate the DBM configuration:

```bash
# Run the validation script
./scripts/verify-datadog-dbm.sh
```

This validation script:
1. Verifies PostgreSQL deployment
2. Checks Datadog agent deployment
3. Ensures required PostgreSQL extensions are installed
4. Creates and configures monitoring user
5. Annotates PostgreSQL workload for Datadog autodiscovery
6. Creates sample vector data for monitoring
7. Configures Datadog PostgreSQL integration
8. Tests vector search operations to generate metrics
9. Validates metrics collection
10. Creates a monitoring dashboard configuration

## Key Components

### Datadog Agent Components

The Datadog deployment includes:

- **Node Agent**: Runs on each node as a DaemonSet
- **Cluster Agent**: Runs as a Deployment for cluster-level metrics
- **System Probe**: Enhanced metrics collection for network monitoring
- **Security Agent**: Runtime security monitoring

### PostgreSQL Monitoring Configuration

PostgreSQL is monitored with:

- A dedicated monitoring user with appropriate permissions
- pg_stat_statements extension for query monitoring
- pgvector-specific monitoring for vector operations
- Autodiscovery annotations for automatic configuration

### LLM Observability for OpenAI

VibeCode's AKS deployment now enables Datadog LLM Observability so every OpenAI chat/completion request is traced end-to-end.

- Application pods export the following environment variables via Terraform/Helm:
  - `DD_LLMOBS_ENABLED=1`
  - `DD_LLMOBS_AGENTLESS_ENABLED=1`
  - `DD_LLMOBS_ML_APP=vibecode-ai`
  - `DD_SITE=datadoghq.com`
- The `src/instrument.ts` bootstrap configures the Datadog OpenAI plugin so spans appear in APM with service name `vibecode-webgui-openai` and are tagged with `ml.app=vibecode-ai`.
- To validate in cluster, tail the application logs and confirm the startup banner `Datadog LLM Observability enabled for OpenAI spans` appears, then exercise `/api/ai/chat` to generate traces.
- In Datadog APM, inspect the `llm.workflow.*` and `llm.completion` spans under the `vibecode-webgui-openai` service to confirm prompt/token telemetry is flowing. If spans are missing, verify the above environment variables and that the Datadog agent is reachable from the pod.

### Key Metrics

Important metrics to monitor include:

1. **Infrastructure Metrics**:
   - Node CPU, memory, and disk usage
   - Kubernetes pod resource utilization

2. **PostgreSQL General Metrics**:
   - Connection count
   - Query throughput and latency
   - Database size and growth
   - Buffer cache hit ratio

3. **pgvector Specific Metrics**:
   - Vector table size
   - Vector count
   - Index tuples read/fetched
   - Vector query performance

## Troubleshooting

### Common Issues

1. **Datadog Agent Not Reporting**:
   - Check if API key is correctly set in the Datadog secret
   - Verify network connectivity from AKS to Datadog
   - Check agent logs: `kubectl logs -n datadog -l app=datadog`

2. **Missing PostgreSQL Metrics**:
   - Ensure PostgreSQL service is running
   - Verify monitoring user exists and has correct permissions
   - Check PostgreSQL integration configuration

3. **Missing pgvector Metrics**:
   - Verify pgvector extension is installed
   - Ensure sample vector data exists
   - Check that vector operations are being performed

### Viewing Logs

```bash
# View Datadog agent logs
kubectl logs -n datadog -l app=datadog

# View Datadog cluster agent logs
kubectl logs -n datadog -l app=datadog-cluster-agent

# View PostgreSQL logs
kubectl logs -n vibecode-platform -l app=postgres
```

## Useful Datadog Dashboards

1. **Kubernetes Overview**:
   - https://app.datadoghq.com/screen/integration/86/kubernetes-overview

2. **Database Monitoring**:
   - https://app.datadoghq.com/databases

3. **Log Management**:
   - https://app.datadoghq.com/logs

4. **APM Services**:
   - https://app.datadoghq.com/apm/services

## Additional Resources

- [Datadog Kubernetes Integration](https://docs.datadoghq.com/integrations/kubernetes/)
- [Datadog PostgreSQL Integration](https://docs.datadoghq.com/integrations/postgres/)
- [Datadog Database Monitoring](https://docs.datadoghq.com/database_monitoring/)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
