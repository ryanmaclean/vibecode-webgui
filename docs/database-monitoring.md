# Database Monitoring with Datadog

This document outlines the setup and configuration of Datadog Database Monitoring (DBM) for the VibeCode platform.

## Overview

Datadog Database Monitoring provides deep visibility into your PostgreSQL database performance, including:

- Query performance metrics
- Query samples and execution plans
- Database health metrics
- Connection pool metrics
- Table and index statistics

## Prerequisites

- Kubernetes cluster with Datadog agent installed
- PostgreSQL database with required extensions
- Datadog API key configured

## Setup Instructions

### 1. Enable PostgreSQL Extensions

Run the setup script to enable required PostgreSQL extensions:

```bash
# Install dependencies if needed
npm install --save-dev ts-node typescript @types/node dotenv

# Run the setup script
npm run db:setup-datadog
```

### 2. Deploy DBM Configuration

Deploy the Datadog DBM configuration to your Kubernetes cluster:

```bash
# Make the script executable
chmod +x scripts/deploy-datadog-dbm.sh

# Deploy with your database password
./scripts/deploy-datadog-dbm.sh "your-database-password"
```

### 3. Verify Installation

1. Log in to your Datadog dashboard
2. Navigate to "Database" > "Monitoring"
3. Select your PostgreSQL database from the list

## Configuration Details

### Kubernetes Resources

- **ConfigMap**: `datadog-dbm-config`
  - Contains DBM configuration for PostgreSQL
  - Includes custom metrics queries for database statistics

- **Secret**: `datadog-db-credentials`
  - Stores database credentials securely
  - Used by the Datadog agent to connect to the database

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `DD_DBM_PROPAGATION_MODE` | Controls how DBM traces are propagated | Yes | `full` |
| `DD_SERVICE` | Service name for Datadog | Yes | `vibecode-webgui` |
| `DD_ENV` | Environment name | Yes | `production` |
| `DD_VERSION` | Application version | Yes | `1.0.0` |
| `DD_DBM_TRACE_INJECTION` | Enable DBM trace injection | Yes | `true` |

## Monitoring and Alerts

### Key Metrics to Monitor

- `postgresql.queries.query_time.avg` - Average query execution time
- `postgresql.connections.active` - Number of active connections
- `postgresql.table.size` - Table sizes and growth
- `postgresql.index.size` - Index sizes and usage

### Recommended Alerts

1. **Slow Queries**
   - Alert when query execution time exceeds threshold
   - Example: `avg:postgresql.queries.query_time.avg{env:production} > 1`

2. **Connection Pool Saturation**
   - Alert when connection pool approaches maximum
   - Example: `avg:postgresql.connections.active / avg:postgresql.settings.max_connections{*} > 0.8`

3. **Database Size**
   - Alert when database approaches storage limit
   - Example: `avg:postgresql.disk.used{*}`

## Troubleshooting

### Common Issues

1. **Missing Metrics**
   - Verify PostgreSQL extensions are enabled
   - Check Datadog agent logs for connection errors
   - Ensure the Datadog agent has proper permissions

2. **Permission Denied**
   - Verify the database user has required permissions
   - Check the Secret contains the correct credentials

3. **High CPU Usage**
   - Review query samples for inefficient queries
   - Check for missing indexes

## Maintenance

### Updating Configuration

1. Update the ConfigMap in `kubernetes/datadog/datadog-dbm-config.yaml`
2. Apply changes: `kubectl apply -f kubernetes/datadog/datadog-dbm-config.yaml`
3. Restart the Datadog agent:

   ```bash
   kubectl rollout restart deployment/datadog-cluster-agent -n vibecode
   kubectl rollout restart daemonset/datadog -n vibecode
   ```

### Rotating Credentials

1. Update the Secret with new credentials
2. Restart the Datadog agent to apply changes

## Additional Resources

- [Datadog Database Monitoring Documentation](https://docs.datadoghq.com/database_monitoring/)
- [PostgreSQL Monitoring with Datadog](https://docs.datadoghq.com/integrations/postgres/)
- [Troubleshooting DBM](https://docs.datadoghq.com/database_monitoring/troubleshooting/)
