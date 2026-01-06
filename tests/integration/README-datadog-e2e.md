# Datadog E2E Infrastructure Integration Test

## Overview

The `datadog-e2e-infrastructure.test.ts` file provides comprehensive end-to-end testing of Datadog monitoring infrastructure by:

1. Running Docker containers and submitting metrics
2. Deploying Kubernetes pods and submitting metrics
3. Querying Datadog API to verify metric ingestion
4. Validating metric values are reasonable
5. Testing metric aggregation across tags
6. Cleaning up all resources after test completion

## Prerequisites

### Required

- **Node.js**: >=18.18.0
- **Docker**: Docker daemon must be running
- **kubectl**: Configured with access to a Kubernetes cluster (kind/minikube/etc)
- **DD_API_KEY**: Datadog API key (set in environment or `.env.local`)

### Optional

- **DD_APP_KEY**: Datadog Application key (required for querying metrics)
- **DD_SITE**: Datadog site (defaults to `datadoghq.com`)

## Configuration

### Environment Variables

```bash
# Required for metric submission
DD_API_KEY=your-datadog-api-key-here

# Optional - required for metric verification via API queries
DD_APP_KEY=your-datadog-app-key-here

# Optional - specify Datadog site
DD_SITE=datadoghq.com  # or datadoghq.eu, us3.datadoghq.com, etc
```

### Getting Datadog API Keys

1. **API Key**:
   - Log into Datadog
   - Navigate to Organization Settings → API Keys
   - Create a new API key or copy an existing one

2. **Application Key** (optional):
   - Navigate to Organization Settings → Application Keys
   - Create a new application key
   - This is only needed if you want to verify metrics via API queries

## Running the Test

### Run the full E2E test suite

```bash
npm run test:integration -- datadog-e2e-infrastructure.test.ts
```

### Run with extended timeout (recommended)

```bash
npm run test:integration -- datadog-e2e-infrastructure.test.ts --testTimeout=180000
```

### Run specific test groups

```bash
# Docker tests only
npm run test:integration -- datadog-e2e-infrastructure.test.ts --testNamePattern="Docker Container"

# Kubernetes tests only
npm run test:integration -- datadog-e2e-infrastructure.test.ts --testNamePattern="Kubernetes Pod"

# Metric validation only
npm run test:integration -- datadog-e2e-infrastructure.test.ts --testNamePattern="Metric"
```

### Run with verbose output

```bash
npm run test:integration -- datadog-e2e-infrastructure.test.ts --verbose
```

## Test Structure

### 1. Docker Container Metrics

- Launches an Alpine Linux container with Datadog environment configuration
- Submits 5 gauge metrics with Docker-specific tags:
  - `source:docker`
  - `container:test`
  - `container_id:<id>`
- Verifies container is running
- Cleans up container after test

**Metrics submitted**: `vibecode.e2e.docker.test_metric`

### 2. Kubernetes Pod Metrics

- Creates a Kubernetes pod in the default namespace
- Waits for pod to be ready (up to 60 seconds)
- Submits 5 gauge metrics with K8s-specific tags:
  - `source:kubernetes`
  - `pod:test`
  - `namespace:default`
  - `cluster:test-cluster`
- Cleans up pod after test

**Metrics submitted**: `vibecode.e2e.k8s.test_metric`

### 3. Metric Verification

- Waits 30-60 seconds for Datadog to ingest metrics
- Queries Datadog API to verify metrics exist
- Validates metric count and data points
- **Requires DD_APP_KEY** to be set

### 4. Metric Value Validation

- Checks all submitted metric values are reasonable (0 < value < 1000)
- Validates timestamps are correct
- Calculates min/max ranges
- Outputs statistics for review

### 5. Metric Aggregation Across Tags

- Submits metrics with multiple tag combinations:
  - 3 environments: `dev`, `staging`, `prod`
  - 3 regions: `us-east-1`, `us-west-2`, `eu-west-1`
- Total of 9 metrics (3 x 3 combinations)
- Validates tag uniqueness and grouping
- Tests Datadog's tag-based aggregation capabilities

**Metrics submitted**: `vibecode.e2e.aggregation.test`

### 6. Resource Cleanup

- Forcefully removes Docker containers
- Deletes Kubernetes pods with grace period
- Verifies cleanup success
- Runs automatically in `afterAll()` hook

### 7. Test Summary

- Provides comprehensive summary of test execution
- Shows infrastructure availability
- Displays metric submission counts
- Includes configuration status
- Reports time range of test run

## Test Metrics

All metrics are tagged with:
- `test_run:<timestamp>` - Unique identifier per test run
- Additional infrastructure-specific tags

This allows easy filtering in Datadog to find test data.

## Expected Test Duration

- **Without Kubernetes**: ~60 seconds
- **With Kubernetes**: ~120 seconds
- **With metric verification**: +30 seconds per verification

Total expected time: 2-3 minutes

## Troubleshooting

### Docker not available

```
Infrastructure availability:
  Docker: false
  Kubernetes: false
```

**Solution**: Start Docker daemon:
```bash
# macOS/Linux
docker info

# If not running, start Docker Desktop or daemon
```

### Kubernetes not available

```
Infrastructure availability:
  Docker: true
  Kubernetes: false
```

**Solution**: Ensure kubectl is configured and cluster is running:
```bash
# Check kubectl
kubectl version

# Check cluster connectivity
kubectl cluster-info

# For kind clusters
kind get clusters

# For minikube
minikube status
```

### API Key Invalid

```
⚠️  Warning: Datadog API key is not valid
```

**Solution**: Set valid DD_API_KEY:
```bash
# Check your API key in Datadog UI
# Set it in .env.local
echo "DD_API_KEY=your-real-key-here" >> .env.local
```

### Metrics not appearing in Datadog

```
Metric query skipped (DD_APP_KEY not set)
```

**Solution**:
1. Set DD_APP_KEY environment variable
2. Wait longer (metrics can take up to 60 seconds to appear)
3. Check Datadog UI manually: Metrics Explorer → Search for `vibecode.e2e.*`

### Container/Pod cleanup failed

The test attempts forceful cleanup but may leave resources if interrupted.

**Manual cleanup**:
```bash
# Clean up Docker containers
docker ps -a | grep "datadog-test" | awk '{print $1}' | xargs docker rm -f

# Clean up Kubernetes pods
kubectl get pods | grep "datadog-test-pod" | awk '{print $1}' | xargs kubectl delete pod --force --grace-period=0
```

## Metric Verification in Datadog

To manually verify metrics were submitted:

1. Log into Datadog
2. Navigate to Metrics → Explorer
3. Search for:
   - `vibecode.e2e.docker.test_metric`
   - `vibecode.e2e.k8s.test_metric`
   - `vibecode.e2e.aggregation.test`
4. Add tag filter: `test_run:e2e-*`
5. View data points and verify values

## CI/CD Integration

### GitHub Actions Example

```yaml
- name: Run Datadog E2E Tests
  env:
    DD_API_KEY: ${{ secrets.DD_API_KEY }}
    DD_APP_KEY: ${{ secrets.DD_APP_KEY }}
  run: |
    npm run test:integration -- datadog-e2e-infrastructure.test.ts --testTimeout=180000
```

### Expected Behavior in CI

- If Docker is unavailable: Tests will skip Docker-specific tests
- If K8s is unavailable: Tests will skip K8s-specific tests
- If API key is invalid: Tests will verify infrastructure but skip metric submission
- Test will pass if infrastructure is verified OR metrics are submitted

## Extending the Test

### Add new infrastructure types

```typescript
describe('New Infrastructure Metrics', () => {
  test('should submit metrics from <infrastructure>', async () => {
    // 1. Set up infrastructure
    // 2. Submit metrics with submitMetricToDatadog()
    // 3. Track in metricSubmissions object
    // 4. Clean up resources
  })
})
```

### Add new metric types

```typescript
// Counter metric
const payload = {
  series: [{
    metric: 'your.metric.name',
    points: [[timestamp, value]],
    type: 'count',  // Change from 'gauge'
    tags: ['your:tags']
  }]
}

// Rate metric
const payload = {
  series: [{
    metric: 'your.metric.name',
    points: [[timestamp, value]],
    type: 'rate',
    tags: ['your:tags'],
    interval: 10  // 10 second interval
  }]
}
```

### Test custom tag aggregations

```typescript
const customTags = {
  services: ['web', 'api', 'worker'],
  teams: ['platform', 'product', 'data']
}

for (const service of customTags.services) {
  for (const team of customTags.teams) {
    await submitMetricToDatadog(
      'your.custom.metric',
      Math.random() * 100,
      [`service:${service}`, `team:${team}`]
    )
  }
}
```

## Related Documentation

- [Datadog API Documentation](https://docs.datadoghq.com/api/)
- [Datadog Metrics Guide](https://docs.datadoghq.com/metrics/)
- [Docker Integration Tests](./docker-api.test.ts)
- [Kubernetes Tests](../k8s/)

## Support

For issues or questions:
1. Check test output for specific error messages
2. Review Datadog API documentation
3. Verify infrastructure (Docker/K8s) is running
4. Check API keys are valid in Datadog UI
5. Review logs in verbose mode

## License

MIT - See project root LICENSE file
