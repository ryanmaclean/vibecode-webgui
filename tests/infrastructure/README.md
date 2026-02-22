# Infrastructure Tests

## Prometheus Alert Rule Tests

### Overview
This directory contains Prometheus alert rule tests that validate the container resource monitoring alerts defined in `infrastructure/monitoring/alerts/container-resource-alerts.yml`.

### Test File
- **File**: `prometheus-container-alerts.test.yml`
- **Alert Rules Tested**: 26 test cases covering all container resource alerts
- **Test Coverage**:
  - Container CPU alerts (high and critical)
  - Container memory alerts (high, critical, near limit)
  - Container disk/storage alerts
  - Container network saturation alerts
  - Container restart and OOM kill alerts
  - Container state alerts (not running, waiting)
  - Container performance alerts (throttling, I/O, network errors)
  - Negative tests (verifying alerts don't fire under normal conditions)

### Running Tests

#### Prerequisites
Install Prometheus tools:
```bash
# macOS
brew install prometheus

# Linux
wget https://github.com/prometheus/prometheus/releases/download/v2.48.0/prometheus-2.48.0.linux-amd64.tar.gz
tar xzf prometheus-2.48.0.linux-amd64.tar.gz
sudo cp prometheus-2.48.0.linux-amd64/promtool /usr/local/bin/
```

#### Execute Tests
```bash
promtool test rules tests/infrastructure/prometheus-container-alerts.test.yml
```

#### Expected Output
```
Unit Testing: tests/infrastructure/prometheus-container-alerts.test.yml
  SUCCESS
```

### Test Structure

Each test follows this pattern:
1. **Input Series**: Simulates metric data over time using Prometheus test format
2. **Alert Rule Tests**: Validates that alerts fire at the correct thresholds and times
3. **Expected Results**: Verifies alert labels, annotations, and metadata

### Alert Coverage

The tests validate all alerts from the `vibecode.container.resources` and `vibecode.container.performance` alert groups:

#### Resource Alerts
- `ContainerHighCPUUsage` (80% threshold, 5m duration)
- `ContainerCriticalCPUUsage` (95% threshold, 3m duration)
- `ContainerHighMemoryUsage` (85% threshold, 3m duration)
- `ContainerCriticalMemoryUsage` (95% threshold, 2m duration)
- `ContainerMemoryNearLimit` (90% threshold, 5m duration)
- `ContainerDiskUsageHigh` (90% threshold, 5m duration)
- `ContainerDiskUsageWarning` (80% threshold, 10m duration)

#### Network Alerts
- `ContainerNetworkSaturation` (receive >100MB/s, 5m duration)
- `ContainerNetworkTransmitSaturation` (transmit >100MB/s, 5m duration)

#### Restart and OOM Alerts
- `ContainerRestartingFrequently` (>3 restarts in 10m, 2m duration)
- `ContainerOOMKilled` (OOM events detected, 1m duration)

#### State Alerts
- `ContainerNotRunning` (container not in running state, 3m duration)
- `ContainerWaitingTooLong` (container waiting >5m)

#### Performance Alerts
- `ContainerCPUThrottling` (>25% throttle rate, 5m duration)
- `ContainerHighIOWait` (>0.8 I/O time ratio, 5m duration)
- `ContainerNetworkErrors` (receive errors >10/s, 3m duration)
- `ContainerNetworkTransmitErrors` (transmit errors >10/s, 3m duration)

### Troubleshooting

If tests fail:
1. Check alert rule syntax in `infrastructure/monitoring/alerts/container-resource-alerts.yml`
2. Verify metric names match Kubernetes/Prometheus conventions
3. Ensure timing thresholds are correct
4. Review label and annotation formatting

### Maintenance

When updating alert rules:
1. Update the corresponding test cases in this file
2. Ensure test coverage for new alerts
3. Validate with `promtool test rules`
4. Update this README with new alert documentation
