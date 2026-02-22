# Container Resource Monitoring Dashboard

## Overview

The Container Resource Monitoring Dashboard provides real-time visibility into Docker and Kubernetes container performance, helping developers and operations teams monitor CPU, memory, network, and storage usage across all running containers. This feature integrates with cAdvisor and Prometheus to deliver actionable insights for optimizing resource allocation and preventing performance issues.

**Key Benefits:**
- **Real-time Monitoring**: Live resource usage tracking with automatic 30-second refresh
- **Proactive Alerting**: Immediate notifications when containers approach resource limits
- **Historical Analysis**: Time-series data for capacity planning and trend analysis
- **Unified Dashboard**: Integrated view with Datadog for holistic infrastructure monitoring

## Features

### 📊 Comprehensive Metrics

#### CPU Monitoring
- **CPU Usage**: Percentage of CPU cores consumed (0-100% per core)
- **CPU Cores**: Actual core usage (e.g., 0.5 = 50% of one core)
- **Rate Calculation**: 5-minute rolling average for stable readings
- **Alerts**: Warning at >80%, Critical at >95%

#### Memory Monitoring
- **Working Set Memory**: Active memory currently in use
- **Memory Limit**: Container's configured memory limit
- **Memory Percentage**: Usage as percentage of limit (0-100%)
- **Alerts**: Warning at >85%, Critical at >95% (OOM risk)

#### Network Monitoring
- **Network RX (Receive)**: Bytes received per second
- **Network TX (Transmit)**: Bytes transmitted per second
- **Rate Calculation**: 5-minute rolling average
- **Traffic Patterns**: Identify bandwidth-intensive containers

#### Storage Monitoring
- **Disk Usage**: Filesystem usage in bytes
- **Disk Limit**: Container's storage quota
- **Usage Percentage**: Storage consumption relative to limit
- **Alerts**: Critical at >90%, Warning at >80%

### 🎯 Dashboard Components

#### System Overview Cards
Quick summary of overall container health:
- **Total Containers**: Count of all containers being monitored
- **Running Containers**: Number of active containers
- **Total CPU Usage**: Aggregate CPU consumption across all containers
- **Total Memory Usage**: Aggregate memory consumption across all containers

#### Active Alerts Section
Real-time alerts with severity indicators:
- **Critical Alerts** (Red): Immediate action required (>95% CPU/memory, OOM events)
- **Warning Alerts** (Yellow): Attention needed (>80% CPU, >85% memory)
- **Alert Details**: Container name, resource type, current threshold, timestamp

#### Container Selection & Metrics
- **Container List**: All monitored containers with status indicators
- **Resource Gauges**: Real-time circular progress indicators for CPU, memory, network, storage
- **Status Badges**: Running (green), Stopped (red), Paused (yellow)
- **Quick Stats**: CPU and memory percentages at a glance

#### Time-Series Charts
Historical performance visualization:
- **CPU Usage Chart**: Track CPU trends over time
- **Memory Usage Chart**: Monitor memory consumption patterns
- **Network I/O Chart**: Visualize network traffic (RX/TX)
- **Storage Usage Chart**: Track disk usage growth
- **Configurable Timeframes**: 1h, 6h, 24h, 7d

## Accessing the Dashboard

### Web Interface

1. **Navigate to the Dashboard**
   ```
   https://your-platform.com/monitoring/containers
   ```

2. **Authentication**
   - Requires admin or operations team access
   - Standard platform authentication applies

3. **Navigation**
   - Click **"Containers"** in the monitoring sidebar
   - Located under the **Monitoring** section in the main navigation

### Direct URL Access
```bash
# Production
https://vibecode.app/monitoring/containers

# Development
http://localhost:3000/monitoring/containers
```

## Interpreting Metrics

### Understanding CPU Usage

**What It Means:**
- CPU usage shows how much processing power a container is consuming
- Measured in CPU cores (e.g., 0.5 cores = 50% of one CPU core)
- Displayed as percentage for easier interpretation

**Healthy Ranges:**
- **< 70%**: Normal operation
- **70-80%**: Moderate usage, monitor for sustained periods
- **80-95%**: High usage, investigate workload
- **> 95%**: Critical, container is CPU-bound

**Example Interpretation:**
```
Container: vibecode-app
CPU Usage: 1.2 cores (120%)
```
This means the container is using 120% of a single CPU core, equivalent to 1.2 full cores. On a multi-core system, this is normal, but if it approaches the container's CPU limit, performance degradation may occur.

### Understanding Memory Usage

**What It Means:**
- Memory usage shows RAM consumption by the container
- Working set memory excludes cached/buffered data
- Percentage is relative to the container's memory limit

**Healthy Ranges:**
- **< 70%**: Normal operation
- **70-85%**: Elevated usage, acceptable for caching workloads
- **85-95%**: High usage, risk of performance impact
- **> 95%**: Critical, OOM (Out of Memory) risk

**Example Interpretation:**
```
Container: postgres-db
Memory: 3.2 GB / 4 GB (80%)
```
The database container is using 3.2 GB out of its 4 GB limit. This is acceptable for a database with active queries and caching, but watch for upward trends.

**OOM Kill Risk:**
When memory reaches 100%, Linux kernel may kill the container with an OOM (Out of Memory) error, causing service disruption.

### Understanding Network Metrics

**What It Means:**
- Network RX/TX shows data transfer rates in bytes per second
- Calculated as 5-minute rate to smooth out spikes
- Helps identify bandwidth-intensive services

**Interpretation:**
```
Network RX: 5.2 MB/s
Network TX: 1.8 MB/s
```
This container is receiving 5.2 MB/s (likely serving content or receiving uploads) and transmitting 1.8 MB/s. High RX with low TX suggests a data ingestion service; high TX with low RX suggests a web server or API.

**Alert Threshold:**
- Network saturation alert triggers at >100 MB/s sustained for 5 minutes
- Indicates potential network bottleneck or unusual traffic patterns

### Understanding Storage Metrics

**What It Means:**
- Storage usage shows filesystem consumption
- Includes application data, logs, temporary files
- Percentage relative to container's disk quota

**Healthy Ranges:**
- **< 70%**: Normal operation
- **70-80%**: Moderate usage, plan for cleanup or expansion
- **80-90%**: High usage, warning alert triggered
- **> 90%**: Critical alert, immediate action required

**Example Interpretation:**
```
Container: app-server
Storage: 7.8 GB / 10 GB (78%)
```
The container is using 78% of its 10 GB storage quota. This warrants investigation - check for large log files, temporary data, or unexpected data growth.

## Understanding Alerts

### Alert Severity Levels

#### Critical Alerts (P1 - Priority 1)
**Characteristics:**
- Red badge/indicator
- Requires immediate action
- Service disruption risk

**Trigger Conditions:**
- CPU > 95% for 3 minutes
- Memory > 95% for 2 minutes
- Disk usage > 90% for 5 minutes
- OOM kill events
- Container restarts > 3 in 10 minutes
- Container not running (crashed/stopped)

**Response Time:** 15 minutes or less

#### Warning Alerts (P2 - Priority 2)
**Characteristics:**
- Yellow badge/indicator
- Attention needed, plan remediation
- Performance degradation possible

**Trigger Conditions:**
- CPU > 80% for 5 minutes
- Memory > 85% for 3 minutes
- Disk usage > 80% for 10 minutes
- CPU throttling > 25%
- Network saturation > 100 MB/s

**Response Time:** 1 hour

### Alert Examples

**Example 1: High CPU Alert**
```
Alert: ContainerHighCPUUsage
Container: vibecode-app
Severity: Warning (P2)
Value: 87% CPU
Duration: 5m
```

**What This Means:**
The `vibecode-app` container has been using 87% CPU for 5 minutes, exceeding the 80% warning threshold.

**Recommended Actions:**
1. Check container logs for unusual activity
2. Review application metrics for increased traffic or slow queries
3. Consider horizontal scaling (add more containers)
4. Profile the application for CPU-intensive operations

**Example 2: Critical Memory Alert**
```
Alert: ContainerCriticalMemoryUsage
Container: postgres-db
Severity: Critical (P1)
Value: 96% Memory
Duration: 2m
OOM Risk: High
```

**What This Means:**
The database container is using 96% of its memory limit, risking an OOM kill that would crash the database.

**Immediate Actions:**
1. Increase container memory limit if resources available
2. Restart container if memory leak suspected
3. Check for long-running queries or memory-intensive operations
4. Review recent deployments for memory regressions

### Alert Channels

Alerts are routed through multiple channels:
- **Dashboard**: Real-time display in the Active Alerts section
- **Slack**: Notifications to `#infrastructure` channel (production)
- **Datadog**: Integrated with Datadog monitors for unified alerting
- **Prometheus AlertManager**: Configurable routing to PagerDuty, email, webhooks

## Troubleshooting High Resource Usage

### High CPU Usage

#### Diagnosis Steps

1. **Check Container Logs**
   ```bash
   kubectl logs -n vibecode-platform <container-name> --tail=100
   ```
   Look for error loops, excessive logging, or unusual activity.

2. **Review Application Metrics**
   - Check request rates: Has traffic increased?
   - Inspect slow endpoints: Are specific APIs CPU-intensive?
   - Profile the application: Use APM tools to identify hot spots

3. **Check for CPU Throttling**
   - If CPU throttling alert is active, container is being limited
   - CPU requests/limits may be too restrictive
   - Consider increasing CPU limit or optimizing code

4. **Inspect Database Queries**
   - For database containers, check for missing indexes
   - Review query execution plans for inefficient operations
   - Look for table scans on large datasets

#### Remediation Actions

**Short-term:**
- **Scale horizontally**: Add more container replicas
  ```bash
  kubectl scale deployment <name> --replicas=5 -n vibecode-platform
  ```
- **Increase CPU limit**: Adjust container CPU allocation
  ```yaml
  resources:
    limits:
      cpu: "2000m"  # Increase from 1000m to 2000m
  ```

**Long-term:**
- Optimize code: Profile and fix CPU-intensive operations
- Implement caching: Reduce redundant computations
- Use async processing: Offload heavy tasks to background workers
- Database optimization: Add indexes, optimize queries

### High Memory Usage

#### Diagnosis Steps

1. **Check for Memory Leaks**
   ```bash
   # Monitor memory over time
   kubectl top pod <pod-name> -n vibecode-platform
   ```
   If memory steadily increases without plateau, suspect a memory leak.

2. **Analyze Memory Breakdown**
   - Heap usage: Application objects and data structures
   - Cache size: Is caching too aggressive?
   - Connection pools: Are connections properly released?

3. **Review Recent Deployments**
   - Did memory usage spike after a deployment?
   - Check code changes for memory-intensive operations
   - Review dependency updates for regressions

4. **Check Application Logs**
   - Look for OutOfMemoryError exceptions
   - Check for large data loads or processing jobs
   - Identify memory-intensive features being used

#### Remediation Actions

**Immediate:**
- **Increase memory limit** (if resources available)
  ```yaml
  resources:
    limits:
      memory: "8Gi"  # Increase from 4Gi to 8Gi
  ```
- **Restart container** (if memory leak suspected)
  ```bash
  kubectl rollout restart deployment/<name> -n vibecode-platform
  ```

**Short-term:**
- Clear caches: Flush application caches if safe
- Reduce cache size: Lower cache TTL or max size
- Limit concurrent operations: Reduce parallelism

**Long-term:**
- Fix memory leaks: Use heap profilers to identify leaks
- Optimize data structures: Use more efficient representations
- Implement pagination: Process large datasets in chunks
- Review garbage collection: Tune GC settings for your runtime

### High Network Usage

#### Diagnosis Steps

1. **Identify Traffic Patterns**
   - Is it incoming (RX) or outgoing (TX)?
   - Is traffic steady or spiking?
   - Check for unusual traffic sources

2. **Review Application Logs**
   - Large file uploads/downloads?
   - Excessive API calls to external services?
   - Data synchronization jobs?

3. **Check for Network Loops**
   - Container communicating with itself?
   - Retry storms to failing services?

#### Remediation Actions

- **Implement rate limiting**: Prevent excessive API calls
- **Use CDN**: Offload static asset delivery
- **Optimize payloads**: Compress responses, reduce payload size
- **Batch operations**: Combine multiple small requests

### High Storage Usage

#### Diagnosis Steps

1. **Identify Large Files**
   ```bash
   kubectl exec -n vibecode-platform <pod-name> -- du -sh /* | sort -h
   ```

2. **Check Log Files**
   ```bash
   kubectl exec -n vibecode-platform <pod-name> -- du -sh /var/log/*
   ```
   Logs often consume unexpected storage.

3. **Review Temporary Files**
   - Check `/tmp` for orphaned temporary files
   - Look for large upload buffers or processing artifacts

#### Remediation Actions

**Immediate:**
- **Clean up logs**: Implement log rotation
  ```bash
  kubectl exec -n vibecode-platform <pod-name> -- sh -c 'truncate -s 0 /var/log/*.log'
  ```
- **Delete temporary files**:
  ```bash
  kubectl exec -n vibecode-platform <pod-name> -- rm -rf /tmp/*
  ```

**Long-term:**
- **Implement log rotation**: Use logrotate or application-level rotation
- **Ship logs externally**: Send logs to centralized logging (Datadog, ELK)
- **Increase storage quota**: Adjust container disk limits
- **Data archival**: Archive old data to object storage (S3, GCS)

## Capacity Planning with Historical Data

### Using Time-Series Charts

The container monitoring dashboard provides historical data for trend analysis and capacity planning.

#### Accessing Historical Data

1. **Dashboard Charts**
   - View CPU, memory, network, and storage trends directly on the dashboard
   - Select timeframe: 1h, 6h, 24h, 7d
   - Hover over charts for specific values at any time point

2. **API Access**
   ```bash
   # Fetch historical CPU data
   curl -H "Authorization: Bearer $TOKEN" \
     "https://api.vibecode.app/api/monitoring/containers/history?container=vibecode-app&metric=cpu&duration=7d"
   ```

3. **Datadog Dashboards**
   - Access unified dashboards with extended retention (13 months)
   - Dashboard: `https://app.datadoghq.com/dashboard/container-metrics`

### Identifying Trends

#### Growth Patterns

**Linear Growth** - Steady increase over time
```
Example: Memory usage increasing 100 MB per day
Action: Project when limit will be reached, plan capacity increase
Formula: Days to limit = (Limit - Current) / Daily Growth
```

**Step Changes** - Sudden jumps after deployments
```
Example: Memory usage jumped from 2 GB to 3.5 GB after deployment
Action: Review deployment changes, optimize or increase limit
```

**Cyclical Patterns** - Regular peaks and valleys
```
Example: CPU spikes every day at 2 AM (scheduled jobs)
Action: Optimize scheduled jobs or schedule during low-traffic periods
```

**Exponential Growth** - Accelerating increase (often memory leaks)
```
Example: Memory usage doubling every 3 days
Action: Immediate investigation required, likely memory leak
```

#### Seasonal Analysis

Use historical data to identify seasonal patterns:
- **Daily Patterns**: Peak usage during business hours
- **Weekly Patterns**: Lower usage on weekends
- **Monthly Patterns**: End-of-month batch processing
- **Annual Patterns**: Holiday traffic spikes

**Example:**
```
Observation: CPU usage increases 40% every Monday morning
Interpretation: Users returning from weekend, syncing workspaces
Action: Pre-scale containers on Monday mornings
```

### Capacity Planning Scenarios

#### Scenario 1: Projected Resource Exhaustion

**Data:**
```
Current Memory: 6 GB / 8 GB (75%)
Growth Rate: +200 MB/day
Time to Limit: (8000 MB - 6000 MB) / 200 MB = 10 days
```

**Action Plan:**
1. **Immediate**: Monitor daily for acceleration
2. **Within 5 days**: Investigate growth cause, optimize if possible
3. **Within 7 days**: Plan memory limit increase or horizontal scaling
4. **Within 9 days**: Deploy capacity increase to production

#### Scenario 2: Right-Sizing Containers

**Data:**
```
Container: background-worker
CPU Limit: 2 cores
Actual CPU Usage: P95 = 0.3 cores, P99 = 0.5 cores
```

**Analysis:**
- Container is over-provisioned by 4x
- Wasting resources that could be allocated elsewhere

**Action:**
- Reduce CPU limit to 0.75 cores (50% headroom above P99)
- Monitor for 1 week to ensure no performance degradation
- Reallocate freed resources to other containers

#### Scenario 3: Horizontal Scaling Decision

**Data:**
```
API Container:
CPU: 85% average, 95% peak
Memory: 70% average, 80% peak
Request Rate: 1000 req/s
Target: 60% average resource usage
```

**Calculation:**
```
Current Containers: 3
Current Usage per Container: 85% CPU
Target Usage: 60% CPU
Required Containers: 3 * (85 / 60) = 4.25 → 5 containers
```

**Action:**
- Scale from 3 to 5 containers
- Expected CPU usage per container: ~51%
- Improved headroom for traffic spikes

### Best Practices

1. **Regular Review**: Review capacity trends weekly
2. **Set Baselines**: Establish normal operating ranges for each container
3. **Alert Tuning**: Adjust alert thresholds based on historical patterns
4. **Predictive Scaling**: Use trends to proactively scale before issues occur
5. **Document Changes**: Track deployment impact on resource usage
6. **Cost Optimization**: Right-size containers to balance performance and cost

## Configuration

### Environment Variables

Container monitoring integrates with Prometheus and Datadog:

```bash
# Prometheus Configuration
PROMETHEUS_URL=http://localhost:9090
PROMETHEUS_TIMEOUT=10000

# Datadog Integration (optional)
DD_API_KEY=your_datadog_api_key
DD_APP_KEY=your_datadog_app_key
DD_SITE=datadoghq.com

# Monitoring Configuration
MONITORING_ENABLED=true
CONTAINER_METRICS_CACHE_TTL=30000  # 30 seconds
```

### Alert Configuration

Alert rules are configured in `infrastructure/monitoring/alerts/container-resource-alerts.yml`:

```yaml
# Example: Customize CPU alert threshold
- alert: ContainerHighCPUUsage
  expr: rate(container_cpu_usage_seconds_total[5m]) * 100 > 80  # Adjust threshold
  for: 5m  # Adjust duration
  labels:
    severity: warning
```

### Datadog Monitors

Deploy custom monitors using the included configuration:

```bash
# Deploy Datadog container monitors
export DD_API_KEY=your_api_key
export DD_APP_KEY=your_app_key
./scripts/deploy-datadog-container-dashboard.sh
```

## API Reference

### Get Container Metrics

**Endpoint:** `GET /api/monitoring/containers`

**Description:** Retrieve real-time metrics for all containers

**Authentication:** Required (admin role)

**Query Parameters:**
- `container` (optional): Filter by container name
- `skip_cache` (optional): Bypass cache, fetch fresh data

**Response:**
```json
{
  "containers": [
    {
      "name": "vibecode-app",
      "image": "vibecode/app:v1.2.3",
      "cpuUsage": 0.85,
      "cpuPercent": 85,
      "memoryUsage": 3221225472,
      "memoryLimit": 4294967296,
      "memoryPercent": 75,
      "networkRxBytes": 1048576,
      "networkTxBytes": 524288,
      "storageUsage": 2147483648,
      "state": "running",
      "timestamp": 1645564800
    }
  ],
  "summary": {
    "total_containers": 12,
    "running_containers": 10,
    "total_cpu_percent": 340,
    "total_memory_percent": 65
  },
  "alerts": [
    {
      "container": "postgres-db",
      "severity": "warning",
      "resource": "memory",
      "threshold": 85,
      "current": 88,
      "message": "High memory usage detected"
    }
  ],
  "timestamp": "2024-02-22T15:30:00Z"
}
```

### Get Container History

**Endpoint:** `GET /api/monitoring/containers/history`

**Description:** Retrieve historical time-series data for a container

**Authentication:** Required (admin role)

**Query Parameters:**
- `container` (required): Container name
- `metric` (required): Metric type (`cpu`, `memory`, `network_rx`, `network_tx`, `storage`)
- `duration` (optional): Time range (default: `1h`, supports `30m`, `1h`, `6h`, `24h`, `7d`)
- `step` (optional): Data point interval (default: `1m`)

**Response:**
```json
{
  "container": "vibecode-app",
  "metric": "cpu",
  "datapoints": [
    {
      "timestamp": 1645564800,
      "value": 0.85
    },
    {
      "timestamp": 1645564860,
      "value": 0.92
    }
  ],
  "startTime": 1645561200,
  "endTime": 1645564800
}
```

## Security Considerations

### Access Control

- **Dashboard Access**: Requires authenticated user with admin or operations role
- **API Endpoints**: Protected by JWT authentication and role-based access control
- **Rate Limiting**: API requests limited to prevent abuse

### Data Privacy

- **No Application Data**: Container metrics do not expose application data
- **Metadata Only**: Monitors system resources, not business data
- **Secure Transmission**: All data transmitted over HTTPS
- **Audit Logging**: Access to monitoring data is logged for compliance

### Network Security

- **Internal Only**: Prometheus endpoint accessible within cluster only
- **Firewall Rules**: cAdvisor metrics endpoints not exposed externally
- **Service Mesh**: Optional service mesh integration for encrypted metrics collection

## Performance Impact

The container monitoring system has minimal impact on monitored containers:

- **CPU Overhead**: < 2% additional CPU per container
- **Memory Overhead**: ~10-20 MB per container for metrics collection
- **Network Overhead**: ~1-5 KB/s per container for metrics scraping
- **Storage Impact**: Metrics stored in Prometheus with configurable retention (default: 15 days)

## Integration with Existing Tools

### Datadog Integration

Container metrics are automatically forwarded to Datadog:
- **Dashboard**: Pre-built container monitoring dashboard
- **Monitors**: Automated alert monitors with anomaly detection
- **APM Correlation**: Link container metrics to application traces
- **Log Correlation**: Correlate metrics with container logs

### Prometheus/Grafana

For teams using Prometheus and Grafana:
- **Metrics Source**: cAdvisor exposes metrics in Prometheus format
- **Scrape Config**: Pre-configured Prometheus scrape jobs
- **Grafana Dashboards**: Import dashboard JSON from `infrastructure/datadog/dashboards/`

### Kubernetes Integration

For Kubernetes deployments:
- **HPA (Horizontal Pod Autoscaler)**: Use metrics for auto-scaling decisions
- **VPA (Vertical Pod Autoscaler)**: Automatic resource limit recommendations
- **Resource Quotas**: Enforce namespace-level resource limits

## Troubleshooting Common Issues

### Dashboard Shows No Data

**Symptoms:** Dashboard loads but shows "No containers found" or empty metrics

**Possible Causes:**
1. Prometheus is not running or unreachable
2. cAdvisor is not collecting metrics
3. Containers are not labeled for monitoring

**Solutions:**

1. **Check Prometheus Health**
   ```bash
   curl http://localhost:9090/-/healthy
   # Expected: Prometheus is Healthy.
   ```

2. **Verify cAdvisor Metrics**
   ```bash
   curl http://localhost:9090/api/v1/query?query=container_cpu_usage_seconds_total
   # Should return container metrics
   ```

3. **Check Container Metrics Service**
   ```bash
   # Test the service health
   curl https://api.vibecode.app/api/monitoring/containers
   ```

### Metrics Are Stale

**Symptoms:** Metrics not updating, timestamp is old

**Possible Causes:**
1. Cache is enabled and not expiring
2. Prometheus scraping has stopped
3. API caching layer issues

**Solutions:**

1. **Force Cache Clear**
   ```bash
   # Use skip_cache parameter
   curl "https://api.vibecode.app/api/monitoring/containers?skip_cache=true"
   ```

2. **Check Prometheus Scraping**
   ```bash
   # Check Prometheus targets
   curl http://localhost:9090/api/v1/targets
   ```

3. **Restart Monitoring Services**
   ```bash
   kubectl rollout restart deployment/prometheus -n monitoring
   kubectl rollout restart daemonset/cadvisor -n monitoring
   ```

### Alerts Not Triggering

**Symptoms:** Container metrics exceed thresholds but no alerts appear

**Possible Causes:**
1. Prometheus AlertManager not configured
2. Alert rules not loaded
3. Alert routing misconfigured

**Solutions:**

1. **Verify Alert Rules**
   ```bash
   promtool check rules infrastructure/monitoring/alerts/container-resource-alerts.yml
   ```

2. **Check AlertManager Status**
   ```bash
   curl http://localhost:9093/-/healthy
   ```

3. **Test Alert Routing**
   ```bash
   # Check AlertManager configuration
   curl http://localhost:9093/api/v1/status
   ```

### High API Response Times

**Symptoms:** Dashboard loads slowly, API requests timeout

**Possible Causes:**
1. Prometheus query is slow (large dataset)
2. Too many concurrent requests
3. Cache is disabled

**Solutions:**

1. **Enable Caching**
   ```bash
   # Ensure CONTAINER_METRICS_CACHE_TTL is set
   export CONTAINER_METRICS_CACHE_TTL=30000
   ```

2. **Optimize Prometheus Queries**
   - Reduce query time range
   - Increase step interval for historical data
   - Add more specific filters to queries

3. **Scale API Backend**
   ```bash
   kubectl scale deployment/api-server --replicas=3
   ```

## Support and Further Reading

### Documentation

- [Monitoring Implementation Overview](./MONITORING-IMPLEMENTATION.md)
- [Infrastructure Monitoring README](../../infrastructure/monitoring/README.md)
- [Container Resource Alerts Runbook](../../infrastructure/monitoring/runbooks/container-resource-alerts.md)

### External Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [cAdvisor Documentation](https://github.com/google/cadvisor)
- [Kubernetes Resource Management](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/)
- [Datadog Container Monitoring](https://docs.datadoghq.com/containers/)

### Getting Help

For issues with container monitoring:

1. **Check System Health**: Review Prometheus, cAdvisor, and API health endpoints
2. **Review Logs**: Check application logs for errors or warnings
3. **Consult Runbooks**: See `infrastructure/monitoring/runbooks/` for alert-specific guidance
4. **Contact Team**: Reach out to the platform team via `#infrastructure` Slack channel

## Future Enhancements

Planned improvements for container monitoring:

- [ ] **Predictive Alerting**: Machine learning-based anomaly detection
- [ ] **Cost Tracking**: Correlate resource usage with infrastructure costs
- [ ] **Automated Remediation**: Auto-scaling based on resource trends
- [ ] **Multi-Cluster Support**: Unified view across multiple Kubernetes clusters
- [ ] **Container Profiling**: Deep-dive profiling for CPU and memory analysis
- [ ] **Recommendation Engine**: Automated right-sizing recommendations
- [ ] **Historical Comparison**: Compare current metrics with previous time periods
- [ ] **Custom Dashboards**: User-configurable dashboard layouts and widgets

---

**Last Updated:** 2026-02-19
**Version:** 1.0.0
**Maintained By:** Platform Team
