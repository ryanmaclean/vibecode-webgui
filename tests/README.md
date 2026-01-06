# AKS Infrastructure Testing Suite

Comprehensive testing framework for Azure Kubernetes Service (AKS) infrastructure deployment using OpenTofu/Terraform.

## Overview

This testing suite provides three levels of validation:

1. **Unit Tests** - Validate Terraform configuration syntax, structure, and compliance
2. **Integration Tests** - Test deployment script functionality including error handling and rollback
3. **End-to-End Tests** - Validate complete deployment pipeline from infrastructure to application

## Test Structure

```
tests/
├── README.md                           # This file
├── tofu/                              # Unit tests for Terraform configurations
│   └── test_aks_configuration.py     # Configuration validation tests
├── integration/                       # Integration tests for deployment scripts
│   └── test_aks_deployment.py       # Deployment manager tests
└── e2e/                              # End-to-end deployment tests
    └── test_aks_e2e_deployment.py   # Full pipeline tests
```

## Prerequisites

### Required Tools

- **Python 3.11+** - Test runner and deployment scripts
- **OpenTofu 1.6+** or **Terraform 1.6+** - Infrastructure as code
- **Azure CLI 2.53+** - Azure resource management
- **kubectl** - Kubernetes cluster interaction

### Installation

```bash
# Install Python dependencies
pip install -r requirements-test.txt

# Install OpenTofu (recommended)
curl -L https://github.com/opentofu/opentofu/releases/download/v1.6.0/tofu_1.6.0_linux_amd64.tar.gz | tar -xz
sudo mv tofu /usr/local/bin/

# Or install Terraform
wget https://releases.hashicorp.com/terraform/1.6.0/terraform_1.6.0_linux_amd64.zip
unzip terraform_1.6.0_linux_amd64.zip
sudo mv terraform /usr/local/bin/

# Install Azure CLI
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# Install kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl
sudo mv kubectl /usr/local/bin/
```

### Environment Setup

```bash
# Azure authentication
az login

# Set required environment variables for E2E tests (optional)
export DATADOG_API_KEY="your-datadog-api-key"
export DATADOG_APP_KEY="your-datadog-app-key"

# Enable specific test types (optional)
export ENABLE_AKS_E2E_TESTS="true"
export ENABLE_REAL_DEPLOYMENT="true"  # For actual Azure deployments
```

## Running Tests

### Quick Start

```bash
# Run all tests (unit + integration + E2E validation only)
python scripts/run-infrastructure-tests.py

# Run with test report generation
python scripts/run-infrastructure-tests.py --report test-report.json
```

### Individual Test Types

```bash
# Unit tests only
python scripts/run-infrastructure-tests.py --unit

# Integration tests only
python scripts/run-infrastructure-tests.py --integration

# E2E validation tests only
python scripts/run-infrastructure-tests.py --e2e
```

### Real Deployment Testing

⚠️ **Warning**: These tests create actual Azure resources and incur costs.

```bash
# Enable real Azure deployment in tests
python scripts/run-infrastructure-tests.py --e2e --enable-deployment

# Prevent automatic cleanup (for debugging)
python scripts/run-infrastructure-tests.py --e2e --enable-deployment --no-cleanup
```

## Test Types Explained

### Unit Tests (`tests/tofu/`)

Validates Terraform configuration without actual deployment:

- **Syntax Validation** - Terraform/OpenTofu configuration syntax
- **Structure Validation** - Required variables, outputs, and resources
- **Security Configuration** - RBAC, network policies, security contexts
- **Resource Constraints** - CPU/memory limits, health checks
- **Integration Points** - Datadog annotations, PostgreSQL setup

**Example:**
```bash
cd tests/tofu
python -m unittest test_aks_configuration.TofuConfigurationTests.test_terraform_syntax_validation
```

### Integration Tests (`tests/integration/`)

Tests deployment script functionality with mocked Azure responses:

- **Authentication Validation** - Azure CLI authentication checks
- **Configuration Validation** - Deployment configuration validation
- **Error Handling** - Retry logic, rollback mechanisms
- **State Management** - Backup/restore functionality
- **Resource Naming** - Collision detection and resolution

**Example:**
```bash
cd tests/integration
python -m unittest test_aks_deployment.AKSDeploymentIntegrationTests.test_rollback_functionality
```

### End-to-End Tests (`tests/e2e/`)

Validates complete deployment pipeline (can use real Azure resources):

- **Environment Validation** - Tool availability, authentication
- **Infrastructure Deployment** - Full AKS cluster creation
- **Application Deployment** - PostgreSQL and Datadog agent setup
- **Connectivity Testing** - Cluster access, service communication
- **Monitoring Validation** - Datadog integration verification

**Example:**
```bash
# Validation only (no real deployment)
cd tests/e2e
python test_aks_e2e_deployment.py

# With real deployment
ENABLE_REAL_DEPLOYMENT=true python test_aks_e2e_deployment.py --enable-deployment
```

## Test Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ENABLE_AKS_E2E_TESTS` | Enable E2E test execution | `false` |
| `ENABLE_REAL_DEPLOYMENT` | Enable actual Azure deployment | `false` |
| `AKS_TEST_CLEANUP` | Clean up resources after tests | `true` |
| `AKS_TEST_ENVIRONMENT` | Test environment name | `test` |
| `DATADOG_API_KEY` | Datadog API key for monitoring | Required for E2E |
| `DATADOG_APP_KEY` | Datadog application key | Required for E2E |

### Test Configuration Files

Test configurations are generated dynamically but can be customized:

```json
{
  "project_name": "vibecode-test",
  "environment": "dev",
  "location": "East US 2",
  "datadog_api_key": "test-key-123",
  "datadog_app_key": "test-app-key-456",
  "postgres_storage_size_gb": 20,
  "system_node_count": 1,
  "user_node_count": 1,
  "enable_datadog_monitoring": true
}
```

## Continuous Integration

### GitHub Actions

The project includes comprehensive CI/CD workflows:

```yaml
# .github/workflows/infrastructure-tests.yml
- Unit Tests (always run)
- Integration Tests (PR and main branch)
- E2E Validation Tests (PR and main branch)
- Security Scanning (Trivy, Checkov)
- Manual E2E Deployment Tests (workflow_dispatch)
```

### Local CI Simulation

```bash
# Simulate CI environment
export CI=true
export GITHUB_ACTIONS=true

# Run tests as they would run in CI
python scripts/run-infrastructure-tests.py --all --report ci-report.json
```

## Troubleshooting

### Common Issues

#### 1. Authentication Errors
```bash
# Ensure Azure CLI is authenticated
az account show

# Re-authenticate if needed
az login
```

#### 2. Tool Version Mismatches
```bash
# Check tool versions
tofu version    # or terraform version
az --version
kubectl version --client
python --version
```

#### 3. Permission Issues
```bash
# Ensure Azure subscription has necessary permissions
az account list-locations
az provider list --query "[?registrationState=='Registered']"
```

#### 4. Resource Quota Limits
```bash
# Check Azure quotas
az vm list-usage --location "East US 2" --query "[?name.value=='cores']"
```

### Test Debugging

#### Enable Verbose Output
```bash
# Run with maximum verbosity
python scripts/run-infrastructure-tests.py --all -v

# Individual test debugging
python -m unittest tests.tofu.test_aks_configuration.TofuConfigurationTests.test_terraform_syntax_validation -v
```

#### Preserve Test Resources
```bash
# Keep resources for debugging
python scripts/run-infrastructure-tests.py --e2e --enable-deployment --no-cleanup

# Manually clean up later
cd tofu
tofu destroy -auto-approve
```

#### State File Investigation
```bash
# Check Terraform state
cd tofu
tofu show

# Examine specific resources
tofu state list
tofu state show azurerm_kubernetes_cluster.main
```

## Test Development

### Adding New Tests

#### Unit Test Structure
```python
class NewFeatureTests(unittest.TestCase):
    def setUp(self):
        self.tofu_dir = Path(__file__).parent.parent.parent / "tofu"

    def test_new_feature_configuration(self):
        # Test implementation
        pass
```

#### Integration Test Structure
```python
@patch('subprocess.run')
def test_new_deployment_feature(self, mock_run):
    # Mock Azure API responses
    mock_run.return_value = Mock(returncode=0, stdout="", stderr="")

    # Test implementation
    pass
```

#### E2E Test Structure
```python
@unittest.skipUnless(os.getenv("ENABLE_REAL_DEPLOYMENT"), "Real deployment disabled")
def test_new_deployment_validation(self):
    # Real deployment test
    pass
```

### Test Utilities

#### Configuration Generation
```python
from tests.utils import generate_test_config

config = generate_test_config(
    environment="test",
    enable_datadog=True,
    postgres_size=20
)
```

#### Resource Cleanup
```python
from tests.utils import cleanup_test_resources

cleanup_test_resources(resource_group="test-rg-123")
```

## Performance Testing

### Metrics Collection

The test suite collects performance metrics:

- **Deployment Time** - Total infrastructure creation time
- **Resource Provisioning** - Individual resource creation duration
- **Validation Time** - Test execution duration
- **Rollback Time** - Recovery operation duration

### Performance Thresholds

| Operation | Threshold | Action |
|-----------|-----------|---------|
| Full Deployment | < 15 minutes | Pass |
| Rollback | < 5 minutes | Pass |
| Health Checks | < 30 seconds | Pass |
| Test Suite | < 10 minutes | Pass |

## Security Testing

### Automated Scans

- **Trivy** - Vulnerability scanning for infrastructure code
- **Checkov** - Security and compliance policy validation
- **Custom Rules** - Project-specific security requirements

### Manual Security Review

- Network security group rules
- Kubernetes RBAC configuration
- Secret management practices
- Container security contexts

## Cost Management

### Resource Optimization

Tests use minimal resource configurations:

- **System Node Pool**: 1 × Standard_D2s_v3
- **User Node Pool**: 1 × Standard_D4s_v3
- **PostgreSQL Storage**: 20GB
- **Log Retention**: 30 days

### Cost Monitoring

```bash
# Estimate deployment costs
az consumption budget list
az advisor recommendation list --category Cost
```

## Datadog Integration

The test suite integrates with Datadog to submit performance and operational metrics during test execution.

### Running Tests with Datadog Metrics

**Development (Local Testing):**
```bash
# Tests run with console logging only
npm test

# Or with Jest directly
jest --config=jest.config.js
```

**Production (CI/CD):**
```bash
# Set DD_API_KEY to enable real metric submission
DD_API_KEY=your-api-key npm test

# With additional Datadog configuration
DD_API_KEY=your-api-key DD_SITE=datadoghq.com DD_ENV=ci npm test
```

### Environment Variables

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `DD_API_KEY` | Yes (prod) | Datadog API key for metric submission | None (logs to console) |
| `DATADOG_API_KEY` | No | Legacy fallback for DD_API_KEY | None |
| `DD_SITE` | No | Datadog site (e.g., datadoghq.com, datadoghq.eu) | datadoghq.com |
| `DD_ENV` | No | Environment tag for metrics | `production` or `development` |
| `DD_SERVICE` | No | Service name tag | vibecode-webgui |
| `DD_VERSION` | No | Application version tag | package.json version |

**Priority:** `DD_*` variables take precedence over `DATADOG_*` variables.

### Metrics Submitted

All metrics are prefixed with `vibecode.` and include standard tags (env, service, version, team, component).

**API Metrics:**
- `vibecode.api.response_time` - API endpoint response duration (ms)
  - Tags: endpoint, method, status_code
- `vibecode.api.errors` - API error count
  - Tags: error_type, endpoint

**Frontend Metrics:**
- `vibecode.frontend.page_load_time` - Page load duration (ms)
  - Tags: page

**Database Metrics:**
- `vibecode.backend.database_query_duration` - Database query duration (ms)
  - Tags: operation, collection

**Chat/AI Metrics:**
- `vibecode.chat.message_processing_time` - Chat message processing duration (ms)
  - Tags: model, message_size (small/medium/large/xlarge)
- `vibecode.huggingface.inference_time` - HuggingFace model inference duration (ms)
  - Tags: model, input_size, output_size

**Upload Metrics:**
- `vibecode.upload.file_processing_duration` - File upload processing time (ms)
  - Tags: file_type, size_category

**RAG Metrics:**
- `vibecode.rag.context_build_time` - RAG context building duration (ms)
  - Tags: sources_count, relevance_tier
- `vibecode.websearch.query_duration` - Web search query duration (ms)
  - Tags: search_engine, results_tier

**Function Metrics:**
- `vibecode.functions.execution_time` - Function execution duration (ms)
  - Tags: function_name, success

**User Metrics:**
- `vibecode.user.actions` - User action count
  - Tags: action, user_type, workspace_type

### Troubleshooting

**Metrics Not Appearing in Datadog:**

1. **Verify API Key:**
   ```bash
   # Test API authentication
   node tests/scripts/test-datadog-api.js
   ```
   Expected output: "✅ API authentication successful"

2. **Check Environment:**
   - Metrics only send to Datadog API in production (NODE_ENV=production)
   - In development, metrics log to console with "📊 Datadog Metric:" prefix
   - Tests run with NODE_ENV=test by default

3. **Enable Production Mode for Testing:**
   ```bash
   NODE_ENV=production DD_API_KEY=your-key npm test
   ```

4. **Verify API Response:**
   - Failed submissions log: "Failed to send metric to Datadog: [status]"
   - Check console for error messages
   - Verify network connectivity to api.datadoghq.com

5. **Check Metric Format:**
   - Metrics must have valid names (lowercase, no special chars except dots/underscores)
   - Tags must be in format "key:value"
   - Timestamps must be Unix epoch seconds

**Common Issues:**

| Issue | Solution |
|-------|----------|
| "API authentication failed" | Verify DD_API_KEY is correct and has permissions |
| "No metrics in Datadog UI" | Wait 2-5 minutes for ingestion; check time range |
| "Metrics logged but not sent" | Set NODE_ENV=production to enable API submission |
| "Network timeout" | Check firewall/proxy settings for api.datadoghq.com |
| "Invalid metric name" | Check for special characters or spaces in metric names |

### Querying Metrics in Datadog UI

**1. Metrics Explorer:**
   - Navigate to: Metrics → Explorer
   - Search for: `vibecode.*`
   - Filter by tags: `env:production`, `service:vibecode-webgui`

**2. Create a Dashboard:**
   ```
   1. Go to Dashboards → New Dashboard
   2. Add widget → Timeseries
   3. Metric: vibecode.api.response_time
   4. Group by: endpoint, method
   5. Add filters: env:production
   ```

**3. Common Queries:**
   ```
   # Average API response time by endpoint
   avg:vibecode.api.response_time{env:production} by {endpoint}

   # Chat processing time for GPT-4
   avg:vibecode.chat.message_processing_time{model:gpt-4}

   # Database query duration by operation
   avg:vibecode.backend.database_query_duration{*} by {operation}

   # Error rate by component
   sum:vibecode.*.errors{*} by {component}.as_rate()
   ```

**4. Set Up Alerts:**
   - Monitors → New Monitor → Metric
   - Alert when: `avg(last_5m):avg:vibecode.api.response_time{*} > 2000`
   - Notify: Your team channel

**5. View in Notebooks:**
   - Notebooks → New Notebook
   - Add cells with metric queries for analysis
   - Share with team for collaboration

## Contributing

### Test Development Guidelines

1. **Test Isolation** - Each test should be independent
2. **Resource Cleanup** - Always clean up test resources
3. **Error Handling** - Test both success and failure scenarios
4. **Documentation** - Document test purpose and expectations
5. **Performance** - Keep test execution time reasonable

### Pull Request Process

1. Run full test suite locally
2. Ensure all tests pass
3. Add tests for new functionality
4. Update documentation as needed
5. Submit PR with test results

## References

- [OpenTofu Documentation](https://opentofu.org/docs/)
- [Azure AKS Documentation](https://docs.microsoft.com/en-us/azure/aks/)
- [Datadog Kubernetes Integration](https://docs.datadoghq.com/containers/kubernetes/)
- [Datadog Metrics API](https://docs.datadoghq.com/api/latest/metrics/)
- [PostgreSQL on Kubernetes](https://kubernetes.io/docs/tutorials/stateful-application/postgresql/)