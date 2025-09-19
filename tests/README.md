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
- [PostgreSQL on Kubernetes](https://kubernetes.io/docs/tutorials/stateful-application/postgresql/)