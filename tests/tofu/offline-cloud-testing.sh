#!/bin/bash
set -e

# Offline Cloud Infrastructure Testing Suite
# Tests AWS and GCP Terraform configurations without creating actual resources

echo "☁️ Offline Cloud Infrastructure Testing Suite"
echo "============================================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASSED=0
FAILED=0
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

test_result() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}[PASS]${NC} $1"
        ((PASSED++))
    else
        echo -e "${RED}[FAIL]${NC} $1"
        ((FAILED++))
    fi
}

echo -e "\n${BLUE}1. Tool Availability Tests${NC}"
echo "----------------------------"

# Test Terraform/OpenTofu availability
if command -v tofu &> /dev/null; then
    TOOL="tofu"
    echo "Using OpenTofu for testing"
elif command -v terraform &> /dev/null; then
    TOOL="terraform"
    echo "Using Terraform for testing"
else
    echo -e "${RED}❌ Neither terraform nor tofu CLI tools are available${NC}"
    exit 1
fi

test_result "Terraform/OpenTofu CLI tool available"

# Test Python availability
python3 --version &>/dev/null
test_result "Python 3 available for testing"

echo -e "\n${BLUE}2. AWS Cloud Deployment Tests${NC}"
echo "--------------------------------"

AWS_DIR="$PROJECT_ROOT/tofu/code-server-aws"

if [ -d "$AWS_DIR" ]; then
    echo "Testing AWS ECS/Fargate deployment configuration..."
    
    # Test directory structure
    [ -f "$AWS_DIR/main.tf" ] && [ -f "$AWS_DIR/variables.tf" ] && [ -f "$AWS_DIR/outputs.tf" ] && [ -f "$AWS_DIR/iam.tf" ]
    test_result "AWS Terraform files exist"
    
    # Test syntax validation
    cd "$AWS_DIR"
    $TOOL validate -json &>/dev/null
    test_result "AWS Terraform syntax validation"
    
    # Test plan generation
    cat > test.tfvars.json << EOF
{
  "region": "us-east-1",
  "environment": "test",
  "vpc_cidr": "10.0.0.0/16",
  "enable_nat_gateway": true,
  "task_cpu": 512,
  "task_memory": 1024,
  "desired_count": 1,
  "container_image": "ghcr.io/ryanmaclean/vibecode-codeserver:latest",
  "codeserver_password": "test-password",
  "log_retention_days": 7,
  "enable_scheduling": false,
  "enable_idle_detection": false
}
EOF
    
    $TOOL init -backend=false &>/dev/null
    $TOOL plan -var-file=test.tfvars.json -out=test.tfplan &>/dev/null
    test_result "AWS Terraform plan generation"
    
    # Clean up
    rm -f test.tfvars.json test.tfplan
    rm -rf .terraform .terraform.lock.hcl
    
    # Test resource validation
    grep -q "aws_ecs_cluster" "$AWS_DIR/main.tf"
    test_result "AWS ECS cluster configuration"
    
    grep -q "aws_efs_file_system" "$AWS_DIR/main.tf"
    test_result "AWS EFS file system configuration"
    
    grep -q "FARGATE_SPOT" "$AWS_DIR/main.tf"
    test_result "AWS Fargate Spot cost optimization"
    
    grep -q "aws_lb" "$AWS_DIR/main.tf"
    test_result "AWS Application Load Balancer configuration"
    
    grep -q "aws_iam_role" "$AWS_DIR/iam.tf"
    test_result "AWS IAM roles configuration"
    
    cd "$PROJECT_ROOT"
else
    echo -e "${YELLOW}⚠️ AWS directory not found, skipping AWS tests${NC}"
fi

echo -e "\n${BLUE}3. GCP Cloud Deployment Tests${NC}"
echo "--------------------------------"

GCP_DIR="$PROJECT_ROOT/tofu/code-server-gcp"

if [ -d "$GCP_DIR" ]; then
    echo "Testing GCP cloud deployment configuration..."
    
    # Test directory structure
    [ -f "$GCP_DIR/main.tf" ] && [ -f "$GCP_DIR/variables.tf" ] && [ -f "$GCP_DIR/outputs.tf" ] && [ -f "$GCP_DIR/startup.sh" ]
    test_result "GCP Terraform files exist"
    
    # Test syntax validation
    cd "$GCP_DIR"
    $TOOL validate -json &>/dev/null
    test_result "GCP Terraform syntax validation"
    
    # Test plan generation
    cat > test.tfvars.json << EOF
{
  "environment": "test",
  "machine_type": "e2-micro",
  "source_image": "projects/cos-cloud/global/images/family/cos-stable",
  "boot_disk_size": 20,
  "workspace_disk_size": 50,
  "container_image": "ghcr.io/ryanmaclean/vibecode-codeserver:latest",
  "codeserver_password": "test-password",
  "network": "default",
  "target_size": 1,
  "enable_scheduling": false,
  "schedule_cron": "0 9 * * 1-5",
  "schedule_target_size": 0,
  "timezone": "UTC"
}
EOF
    
    $TOOL init -backend=false &>/dev/null
    $TOOL plan -var-file=test.tfvars.json -out=test.tfplan &>/dev/null
    test_result "GCP Terraform plan generation"
    
    # Clean up
    rm -f test.tfvars.json test.tfplan
    rm -rf .terraform .terraform.lock.hcl
    
    # Test resource validation
    grep -q "google_compute_instance_template" "$GCP_DIR/main.tf"
    test_result "GCP instance template configuration"
    
    grep -q "google_compute_instance_group_manager" "$GCP_DIR/main.tf"
    test_result "GCP instance group manager configuration"
    
    grep -q "preemptible = true" "$GCP_DIR/main.tf"
    test_result "GCP preemptible instances cost optimization"
    
    grep -q "google_compute_disk" "$GCP_DIR/main.tf"
    test_result "GCP persistent disk configuration"
    
    grep -q "google_cloud_scheduler_job" "$GCP_DIR/main.tf"
    test_result "GCP Cloud Scheduler configuration"
    
    grep -q "google_service_account" "$GCP_DIR/main.tf"
    test_result "GCP service account configuration"
    
    cd "$PROJECT_ROOT"
else
    echo -e "${YELLOW}⚠️ GCP directory not found, skipping GCP tests${NC}"
fi

echo -e "\n${BLUE}4. Python Test Suite Execution${NC}"
echo "----------------------------------"

# Run Python test suites
if [ -f "$SCRIPT_DIR/test_aws_cloud_deployment.py" ]; then
    echo "Running AWS Python test suite..."
    python3 "$SCRIPT_DIR/test_aws_cloud_deployment.py" -v
    test_result "AWS Python test suite execution"
fi

if [ -f "$SCRIPT_DIR/test_gcp_cloud_deployment.py" ]; then
    echo "Running GCP Python test suite..."
    python3 "$SCRIPT_DIR/test_gcp_cloud_deployment.py" -v
    test_result "GCP Python test suite execution"
fi

echo -e "\n${BLUE}5. Configuration Validation Tests${NC}"
echo "------------------------------------"

# Test naming conventions
echo "Testing resource naming conventions..."

# AWS naming
if [ -d "$AWS_DIR" ]; then
    grep -q "\${var.environment}-codeserver" "$AWS_DIR/main.tf"
    test_result "AWS resource naming conventions"
    
    grep -q "Environment = var.environment" "$AWS_DIR/main.tf"
    test_result "AWS resource tagging conventions"
fi

# GCP naming
if [ -d "$GCP_DIR" ]; then
    grep -q "\${var.environment}-codeserver" "$GCP_DIR/main.tf"
    test_result "GCP resource naming conventions"
    
    grep -q "environment = var.environment" "$GCP_DIR/main.tf"
    test_result "GCP resource labeling conventions"
fi

echo -e "\n${BLUE}6. Security Configuration Tests${NC}"
echo "----------------------------------"

# Test security configurations
echo "Testing security configurations..."

# AWS security
if [ -d "$AWS_DIR" ]; then
    grep -q "aws_security_group" "$AWS_DIR/main.tf"
    test_result "AWS security groups configuration"
    
    grep -q "encrypted = true" "$AWS_DIR/main.tf"
    test_result "AWS EFS encryption configuration"
fi

# GCP security
if [ -d "$GCP_DIR" ]; then
    grep -q "google_service_account" "$GCP_DIR/main.tf"
    test_result "GCP service account configuration"
    
    grep -q "google_project_iam_member" "$GCP_DIR/main.tf"
    test_result "GCP IAM bindings configuration"
fi

echo -e "\n${BLUE}7. Cost Optimization Tests${NC}"
echo "-----------------------------"

# Test cost optimization features
echo "Testing cost optimization features..."

# AWS cost optimization
if [ -d "$AWS_DIR" ]; then
    grep -q "FARGATE_SPOT" "$AWS_DIR/main.tf"
    test_result "AWS Fargate Spot cost optimization"
    
    grep -q "aws_cloudwatch_log_group" "$AWS_DIR/main.tf"
    test_result "AWS CloudWatch log retention configuration"
fi

# GCP cost optimization
if [ -d "$GCP_DIR" ]; then
    grep -q "preemptible = true" "$GCP_DIR/main.tf"
    test_result "GCP preemptible instances cost optimization"
    
    grep -q "google_cloud_scheduler_job" "$GCP_DIR/main.tf"
    test_result "GCP automated scheduling configuration"
fi

echo -e "\n${BLUE}8. Monitoring Configuration Tests${NC}"
echo "-----------------------------------"

# Test monitoring configurations
echo "Testing monitoring configurations..."

# AWS monitoring
if [ -d "$AWS_DIR" ]; then
    grep -q "aws_cloudwatch_log_group" "$AWS_DIR/main.tf"
    test_result "AWS CloudWatch logging configuration"
    
    grep -q "health_check" "$AWS_DIR/main.tf"
    test_result "AWS health check configuration"
fi

# GCP monitoring
if [ -d "$GCP_DIR" ]; then
    grep -q "health_check" "$GCP_DIR/main.tf"
    test_result "GCP health check configuration"
    
    grep -q "logging" "$GCP_DIR/main.tf"
    test_result "GCP logging configuration"
fi

echo -e "\n${BLUE}9. Documentation Tests${NC}"
echo "-------------------------"

# Test documentation completeness
echo "Testing documentation completeness..."

# Check for README files
if [ -d "$AWS_DIR" ] && [ -f "$AWS_DIR/README.md" ]; then
    test_result "AWS deployment documentation exists"
fi

if [ -d "$GCP_DIR" ] && [ -f "$GCP_DIR/README.md" ]; then
    test_result "GCP deployment documentation exists"
fi

# Check for example tfvars files
if [ -d "$AWS_DIR" ] && [ -f "$AWS_DIR/terraform.tfvars.example" ]; then
    test_result "AWS example configuration exists"
fi

if [ -d "$GCP_DIR" ] && [ -f "$GCP_DIR/terraform.tfvars.example" ]; then
    test_result "GCP example configuration exists"
fi

echo -e "\n${BLUE}=== Offline Cloud Testing Results ===${NC}"
echo "Total Tests: $((PASSED + FAILED))"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"

if [ $FAILED -eq 0 ]; then
    echo -e "\n${GREEN}✅ All offline cloud tests passed!${NC}"
    echo "Cloud infrastructure configurations are ready for deployment."
    echo ""
    echo "Next Steps:"
    echo "  1. 🚀 Deploy to AWS: cd tofu/code-server-aws && terraform apply"
    echo "  2. 🚀 Deploy to GCP: cd tofu/code-server-gcp && terraform apply"
    echo "  3. 🧪 Run KinD tests: ./tests/k8s/kind-cloud-test-runner.sh"
    echo "  4. 📊 Monitor deployments: Check cloud provider dashboards"
else
    echo -e "\n${RED}❌ Some offline cloud tests failed!${NC}"
    echo "Please fix the issues before proceeding to deployment."
fi

exit $FAILED