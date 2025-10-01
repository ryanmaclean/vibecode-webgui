# Offline Cloud Infrastructure Testing

This directory contains comprehensive offline testing tools for validating AWS and GCP cloud infrastructure configurations without creating actual cloud resources.

## 🎯 Testing Philosophy

**Offline First**: Test everything possible without cloud resources to catch issues early and reduce costs.

**Multi-Layer Validation**: 
1. **Syntax Validation** - Terraform/OpenTofu configuration syntax
2. **Plan Validation** - Resource planning without creation
3. **Configuration Validation** - Security, naming, and best practices
4. **Integration Validation** - Cross-resource dependencies

## 🛠️ Available Testing Tools

### 1. **Comprehensive Test Suite**
```bash
# Run all offline tests
./tests/tofu/offline-cloud-testing.sh
```

**What it tests:**
- ✅ Tool availability (Terraform/OpenTofu, Python)
- ✅ AWS ECS/Fargate configuration validation
- ✅ GCP Compute Engine configuration validation
- ✅ Syntax validation for all Terraform files
- ✅ Plan generation without resource creation
- ✅ Resource naming conventions
- ✅ Security configurations
- ✅ Cost optimization features
- ✅ Monitoring configurations
- ✅ Documentation completeness

### 2. **AWS-Specific Tests**
```bash
# Run AWS Python test suite
python3 tests/tofu/test_aws_cloud_deployment.py -v

# Manual AWS validation
cd tofu/code-server-aws
terraform validate
terraform plan -var-file=terraform.tfvars.example
```

**AWS Test Coverage:**
- ✅ VPC and networking configuration
- ✅ ECS Fargate Spot cluster setup
- ✅ EFS file system configuration
- ✅ Application Load Balancer setup
- ✅ IAM roles and security groups
- ✅ CloudWatch logging
- ✅ EventBridge Scheduler
- ✅ Cost optimization (Fargate Spot, EFS encryption)

### 3. **GCP-Specific Tests**
```bash
# Run GCP Python test suite
python3 tests/tofu/test_gcp_cloud_deployment.py -v

# Manual GCP validation
cd tofu/code-server-gcp
terraform validate
terraform plan -var-file=terraform.tfvars.example
```

**GCP Test Coverage:**
- ✅ Compute Engine instance templates
- ✅ Managed Instance Groups
- ✅ Persistent disk configuration
- ✅ Preemptible instances
- ✅ Cloud Scheduler automation
- ✅ Service accounts and IAM
- ✅ Health checks and monitoring
- ✅ Startup script validation

### 4. **Existing AKS Tests**
```bash
# Run existing AKS tests
python3 tests/tofu/test_aks_configuration.py -v
```

## 🔧 Testing Tools Used

### **Terraform/OpenTofu Built-in Tools**
- `terraform validate` - Syntax and configuration validation
- `terraform plan` - Dry-run execution without creating resources
- `terraform fmt` - Code formatting validation

### **Custom Python Test Suites**
- **unittest framework** - Structured test organization
- **subprocess integration** - Terraform CLI tool integration
- **JSON parsing** - Plan output validation
- **File system validation** - Configuration file structure

### **Shell Script Validation**
- **Bash scripting** - Comprehensive test orchestration
- **Tool availability checks** - Environment validation
- **Configuration parsing** - Resource validation
- **Error handling** - Robust test execution

## 📋 Test Categories

### **1. Infrastructure Validation**
- Resource configuration completeness
- Resource type validation
- Resource count validation
- Cross-resource dependencies

### **2. Security Validation**
- IAM roles and policies
- Security groups and network policies
- Encryption configurations
- Access control validation

### **3. Cost Optimization Validation**
- **AWS**: Fargate Spot, EFS encryption, CloudWatch retention
- **GCP**: Preemptible instances, Cloud Scheduler, automated scaling
- Resource sizing validation
- Scheduling configuration

### **4. Monitoring Validation**
- Health check configurations
- Logging setup
- Metrics collection
- Alerting configuration

### **5. Naming and Tagging Validation**
- Consistent naming conventions
- Proper resource tagging
- Environment-based naming
- Label consistency

## 🚀 Usage Examples

### **Quick Validation**
```bash
# Validate all cloud configurations
./tests/tofu/offline-cloud-testing.sh
```

### **AWS-Specific Testing**
```bash
# Test AWS ECS/Fargate configuration
cd tofu/code-server-aws
terraform validate
terraform plan -var-file=terraform.tfvars.example

# Run comprehensive AWS tests
python3 tests/tofu/test_aws_cloud_deployment.py -v
```

### **GCP-Specific Testing**
```bash
# Test GCP Compute Engine configuration
cd tofu/code-server-gcp
terraform validate
terraform plan -var-file=terraform.tfvars.example

# Run comprehensive GCP tests
python3 tests/tofu/test_gcp_cloud_deployment.py -v
```

### **CI/CD Integration**
```bash
# Add to GitHub Actions workflow
- name: Run offline cloud tests
  run: ./tests/tofu/offline-cloud-testing.sh
```

## 📊 Test Results Interpretation

### **✅ Pass Results**
- Configuration syntax is valid
- Resources can be planned successfully
- Security configurations are proper
- Cost optimization features are enabled
- Naming conventions are followed

### **❌ Fail Results**
- Syntax errors in Terraform files
- Missing required resources
- Security misconfigurations
- Missing cost optimization features
- Naming convention violations

## 🔍 Troubleshooting

### **Common Issues**

1. **Tool Not Found**
   ```bash
   # Install Terraform
   brew install terraform
   
   # Or install OpenTofu
   brew install opentofu
   ```

2. **Permission Denied**
   ```bash
   # Make scripts executable
   chmod +x tests/tofu/offline-cloud-testing.sh
   ```

3. **Python Dependencies**
   ```bash
   # Install required packages
   pip install pyyaml
   ```

### **Debug Mode**
```bash
# Run with verbose output
bash -x tests/tofu/offline-cloud-testing.sh
```

## 📈 Benefits

### **Cost Savings**
- **No cloud resources created** during testing
- **Early issue detection** prevents expensive mistakes
- **Validation before deployment** reduces rollback costs

### **Time Savings**
- **Fast feedback loop** - tests run in seconds
- **Parallel testing** - multiple configurations tested simultaneously
- **Automated validation** - no manual configuration checking

### **Quality Assurance**
- **Comprehensive coverage** - all aspects of infrastructure tested
- **Consistent validation** - same tests run every time
- **Best practices enforcement** - security and cost optimization validated

## 🔄 Integration with Other Tests

### **KinD Cloud Tests**
```bash
# Run KinD tests after offline validation
./tests/k8s/kind-cloud-test-runner.sh
```

### **CI/CD Pipeline**
```yaml
# Add to GitHub Actions
- name: Offline Cloud Testing
  run: ./tests/tofu/offline-cloud-testing.sh
  
- name: KinD Cloud Testing
  run: ./tests/k8s/kind-cloud-test-runner.sh
```

## 📚 Additional Resources

- [Terraform Testing Best Practices](https://www.terraform.io/docs/testing/index.html)
- [AWS ECS Best Practices](https://docs.aws.amazon.com/AmazonECS/latest/bestpracticesguide/)
- [GCP Compute Engine Best Practices](https://cloud.google.com/compute/docs/best-practices)
- [Infrastructure as Code Testing](https://www.thoughtworks.com/radar/techniques/infrastructure-as-code-testing)

## 🤝 Contributing

To add new tests:

1. **Create test file**: `test_[platform]_[feature].py`
2. **Add to main script**: Update `offline-cloud-testing.sh`
3. **Document test purpose**: Add to this README
4. **Test your tests**: Run the full suite

---

**Remember**: These offline tests validate configuration without creating cloud resources, making them fast, cost-effective, and safe to run frequently.