# Automated Regression Tests Documentation

## Overview

The automated regression testing infrastructure wraps existing demo scripts into CI-backed regression suites. These tests validate core functionality including Azure OpenAI integrations, GenAI database operations, and deployment scenarios.

## npm Scripts

### Core Regression Tests
```bash
# Individual test suites
npm run test:regression:azure-embedding  # Azure OpenAI embedding service tests
npm run test:regression:genai           # GenAI database and vector operations
npm run test:regression:deployment      # Deployment pipeline tests

# Combined test suites
npm run test:regression:ci              # CI-friendly tests (azure-embedding + genai)
npm run test:regression                 # Master test suite with all components
npm run test:regression:all             # Complete test matrix
```

### Test Characteristics

| Script | Environment Support | Datadog Metrics | Graceful Degradation |
|--------|-------------------|-----------------|---------------------|
| `azure-embedding` | CI + Production | ✅ | Skips on missing credentials |
| `genai` | CI + Production | ✅ | Skips on missing database |
| `deployment` | Local + CI | ✅ | Continues on component failures |

## GitHub Actions Workflow

### Automated Regression Tests Workflow
**File**: `.github/workflows/automated-regression-tests.yml`

**Triggers**:
- **Scheduled**: Daily at 2:00 AM UTC
- **Manual**: Workflow dispatch with configurable options

**Configuration Options**:
- `test_suite`: all, azure-embedding, genai, deployment, ci-only
- `environment`: development, staging, production

**Features**:
- Matrix-based parallel execution
- Proper service isolation (PostgreSQL + Redis per test)
- Artifact collection and sanitization
- Datadog metrics integration
- Slack notifications
- Comprehensive reporting

### Workflow Jobs

1. **setup-infrastructure**: Initializes test services and determines test matrix
2. **regression-tests**: Executes tests in parallel with proper isolation
3. **generate-regression-report**: Creates comprehensive test reports
4. **notify-results**: Sends notifications via Slack

## Enhanced Demo Scripts

### Azure Embedding Script (`scripts/run-azure-embedding-e2e-tests.js`)

**Enhancements**:
- Datadog metric reporting for test lifecycle
- Uses existing `test:root:azure-embedding` infrastructure
- Graceful handling of missing credentials
- Proper exit codes for CI integration

**Required Environment Variables**:
```bash
AZURE_OPENAI_API_KEY=your_api_key
AZURE_OPENAI_ENDPOINT=https://your-endpoint.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT_NAME=your_deployment
```

**Datadog Metrics**:
- `regression_test.azure_embedding.test_started`
- `regression_test.azure_embedding.test_completed`
- `regression_test.azure_embedding.test_duration_ms`
- `regression_test.azure_embedding.test_skipped`

### GenAI Script (`scripts/test-genai-azure-complete.cjs`)

**Enhancements**:
- Automatic CI vs production database detection
- Datadog metric reporting
- Connection failure handling
- Vector database operations with pgvector

**Database Configuration**:
- **CI/Test**: `localhost:5432/testdb` (test/test credentials)
- **Production**: Azure PostgreSQL (uses `POSTGRES_PASSWORD` env var)

**Datadog Metrics**:
- `regression_test.genai.test_started`
- `regression_test.genai.connection_success`
- `regression_test.genai.test_completed`
- `regression_test.genai.test_duration_ms`

### CI Wrapper (`scripts/ci-regression-runner.js`)

**Features**:
- JSON test result output
- Timeout handling (30 minutes default)
- Datadog integration
- Exit code management
- Test result parsing from shell output

**Output File**: `test-results/regression-test-results.json`

## Datadog Integration

### CI Visibility
The regression tests integrate with Datadog CI Visibility for monitoring:

```bash
DD_CI_VISIBILITY_ENABLED=true
DD_SERVICE=vibecode-webgui-regression
DD_ENV=staging
DD_API_KEY=your_datadog_api_key
```

### Custom Metrics
All regression tests send custom metrics to Datadog:
- Test execution status
- Duration metrics
- Error categorization
- Environment tagging

## Artifact Management

### Test Artifacts
- **Logs**: Application and test execution logs
- **Screenshots**: UI test screenshots (when applicable)
- **Reports**: JSON test results and summaries
- **Benchmark Data**: Performance metrics

### Sanitization
The `scripts/sanitize-test-artifacts.js` script automatically:
- Redacts API keys and secrets
- Masks sensitive URLs and tokens
- Preserves test result data
- Generates security-compliant reports

## Usage Examples

### Local Development
```bash
# Run CI-friendly tests locally
npm run test:regression:ci

# Test specific component
npm run test:regression:azure-embedding

# Full regression suite (may require external services)
npm run test:regression:all
```

### CI Environment
```bash
# Set CI environment
export CI=true
export NODE_ENV=test

# Run with Datadog integration
export DD_API_KEY=your_key
export DD_CI_VISIBILITY_ENABLED=true
npm run test:regression:ci
```

### Production Validation
```bash
# Set production environment
export NODE_ENV=production
export POSTGRES_PASSWORD=your_production_password

# Run full suite against production services
npm run test:regression:genai
```

## Error Handling and Rollback

### Graceful Degradation
- Missing credentials → Test skipped (exit 0)
- Network failures → Test marked as failed but CI continues
- Database unavailable → Graceful skip in CI environment
- Service timeout → Test marked as failed with proper cleanup

### Rollback Process
If regression tests detect issues:
1. Review test artifacts in GitHub Actions
2. Check Datadog metrics for failure patterns
3. Use sanitized logs for debugging
4. Disable scheduled runs if needed via workflow dispatch

### Manual Trigger for Debugging
```bash
# Trigger via GitHub Actions UI:
# 1. Go to Actions tab
# 2. Select "Automated Regression Tests"
# 3. Click "Run workflow"
# 4. Choose test_suite: "ci-only" for quick debugging
# 5. Set environment: "development"
```

## Monitoring and Observability

### Datadog Dashboards
Monitor regression test health via:
- Test execution frequency
- Success/failure rates
- Duration trends
- Error categorization

### Slack Notifications
Automated notifications include:
- Test suite completion status
- Environment and trigger information
- Links to detailed GitHub Actions logs
- Success/failure indicators

## Security Considerations

### Credential Management
- All API keys stored as GitHub Secrets
- Environment variables properly scoped
- Automatic credential redaction in logs
- No secrets committed to repository

### Artifact Security
- Test artifacts automatically sanitized
- Sensitive data masked before storage
- Limited retention period (7 days)
- Access controlled via GitHub permissions

## Future Enhancements

### Planned Improvements
- [ ] Database performance benchmarking
- [ ] API response time monitoring
- [ ] Cross-environment test comparison
- [ ] Automated rollback on regression detection
- [ ] Integration with deployment pipelines

### Cost Optimization
- Scheduled runs limited to necessary frequency
- Matrix execution for efficiency
- Resource cleanup after test completion
- Expensive tests behind manual triggers

## Troubleshooting

### Common Issues

**Tests skipped due to missing credentials**
- Solution: Verify GitHub Secrets are properly configured
- Check: Repository settings → Secrets → Actions

**Database connection failures**
- Solution: Ensure PostgreSQL service is running in CI
- Check: Workflow logs for service startup messages

**Timeout errors**
- Solution: Adjust timeout values in workflow configuration
- Check: Network connectivity to external services

**Datadog metrics not appearing**
- Solution: Verify DD_API_KEY is set and valid
- Check: Datadog validation endpoint in workflow logs