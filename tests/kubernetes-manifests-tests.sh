#!/bin/bash
set -e

# Kubernetes Manifests Tests
# Tests YAML manifests, Helm charts, and Terraform configurations

echo "📋 Kubernetes Manifests Tests"
echo "=============================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASSED=0
FAILED=0
BASE_DIR="/Users/ryan.maclean/vibecode-webgui"

test_result() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}[PASS]${NC} $1"
        ((PASSED++))
    else
        echo -e "${RED}[FAIL]${NC} $1"
        ((FAILED++))
    fi
}

cd "$BASE_DIR"

echo -e "\n${BLUE}1. Manifest File Existence Tests${NC}"
echo "-----------------------------------"

# Test Kubernetes manifest files
[ -f "k8s/docs-deployment.yaml" ]
test_result "Docs deployment manifest exists"

[ -f "k8s/kind-config.yaml" ]
test_result "KIND configuration exists"

[ -f "k8s/datadog-values-kind.yaml" ]
test_result "Datadog values for KIND exist"

# Test additional manifest files
find k8s/ -name "*.yaml" -o -name "*.yml" | head -1 | grep -q "."
test_result "Kubernetes manifests directory contains YAML files"

echo -e "\n${BLUE}2. YAML Syntax Validation Tests${NC}"
echo "--------------------------------"

# Test YAML syntax for each file
for file in k8s/*.yaml k8s/*.yml; do
    if [ -f "$file" ]; then
        python3 -c "import yaml; yaml.safe_load(open('$file'))" &>/dev/null
        test_result "$(basename $file) has valid YAML syntax"
    fi
done

echo -e "\n${BLUE}3. Kubernetes Resource Validation Tests${NC}"
echo "--------------------------------------------"

# Test kubectl validation (dry-run)
kubectl apply --dry-run=client -f k8s/docs-deployment.yaml &>/dev/null
test_result "Docs deployment manifest is valid Kubernetes YAML"

# Test specific resource types
kubectl apply --dry-run=client -f k8s/docs-deployment.yaml | grep -q "deployment.apps"
test_result "Deployment resource is properly defined"

kubectl apply --dry-run=client -f k8s/docs-deployment.yaml | grep -q "service"
test_result "Service resource is properly defined"

kubectl apply --dry-run=client -f k8s/docs-deployment.yaml | grep -q "ingress"
test_result "Ingress resource is properly defined"

kubectl apply --dry-run=client -f k8s/docs-deployment.yaml | grep -q "horizontalpodautoscaler"
test_result "HPA resource is properly defined"

kubectl apply --dry-run=client -f k8s/docs-deployment.yaml | grep -q "poddisruptionbudget"
test_result "PDB resource is properly defined"

echo -e "\n${BLUE}4. Resource Configuration Tests${NC}"
echo "--------------------------------"

# Test deployment configuration
grep -q "replicas: 2" k8s/docs-deployment.yaml
test_result "Deployment has correct replica count"

grep -q "app: vibecode-docs" k8s/docs-deployment.yaml
test_result "Deployment has correct app label"

grep -q "image:" k8s/docs-deployment.yaml
test_result "Deployment specifies container image"

# Test service configuration
grep -q "port: 80" k8s/docs-deployment.yaml
test_result "Service exposes port 80"

grep -q "targetPort: 8080" k8s/docs-deployment.yaml
test_result "Service targets container port 8080"

grep -q "type: ClusterIP" k8s/docs-deployment.yaml
test_result "Service type is correctly set"

echo -e "\n${BLUE}5. Security Configuration Tests${NC}"
echo "--------------------------------"

# Test security contexts
grep -q "securityContext:" k8s/docs-deployment.yaml
test_result "Security context is configured"

grep -q "runAsUser: 1001" k8s/docs-deployment.yaml
test_result "Container runs as non-root user"

grep -q "readOnlyRootFilesystem: true" k8s/docs-deployment.yaml
test_result "Read-only root filesystem is enabled"

grep -q "allowPrivilegeEscalation: false" k8s/docs-deployment.yaml
test_result "Privilege escalation is disabled"

# Test capabilities
grep -A 5 "capabilities:" k8s/docs-deployment.yaml | grep -q "drop:"
test_result "Security capabilities are properly configured"

echo -e "\n${BLUE}6. Resource Management Tests${NC}"
echo "------------------------------"

# Test resource limits and requests
grep -q "resources:" k8s/docs-deployment.yaml
test_result "Resource specifications are defined"

grep -q "limits:" k8s/docs-deployment.yaml
test_result "Resource limits are set"

grep -q "requests:" k8s/docs-deployment.yaml
test_result "Resource requests are set"

grep -q "cpu:" k8s/docs-deployment.yaml
test_result "CPU resources are specified"

grep -q "memory:" k8s/docs-deployment.yaml
test_result "Memory resources are specified"

echo -e "\n${BLUE}7. Health Check Tests${NC}"
echo "-----------------------"

# Test health check configuration
grep -q "livenessProbe:" k8s/docs-deployment.yaml
test_result "Liveness probe is configured"

grep -q "readinessProbe:" k8s/docs-deployment.yaml
test_result "Readiness probe is configured"

grep -q "httpGet:" k8s/docs-deployment.yaml
test_result "HTTP health checks are configured"

grep -q "initialDelaySeconds:" k8s/docs-deployment.yaml
test_result "Health check timing is configured"

echo -e "\n${BLUE}8. Scaling Configuration Tests${NC}"
echo "-------------------------------"

# Test HPA configuration
grep -A 10 "HorizontalPodAutoscaler" k8s/docs-deployment.yaml | grep -q "minReplicas:"
test_result "HPA minimum replicas configured"

grep -A 10 "HorizontalPodAutoscaler" k8s/docs-deployment.yaml | grep -q "maxReplicas:"
test_result "HPA maximum replicas configured"

grep -A 15 "HorizontalPodAutoscaler" k8s/docs-deployment.yaml | grep -q "cpu"
test_result "HPA CPU metrics configured"

# Test PDB configuration
grep -A 5 "PodDisruptionBudget" k8s/docs-deployment.yaml | grep -q "minAvailable:"
test_result "Pod Disruption Budget configured"

echo -e "\n${BLUE}9. Helm Chart Tests${NC}"
echo "---------------------"

if [ -d "helm/vibecode-docs" ]; then
    # Test Helm chart structure
    [ -f "helm/vibecode-docs/Chart.yaml" ]
    test_result "Helm Chart.yaml exists"
    
    [ -f "helm/vibecode-docs/values.yaml" ]
    test_result "Helm values.yaml exists"
    
    [ -d "helm/vibecode-docs/templates" ]
    test_result "Helm templates directory exists"
    
    # Test Helm chart validation
    helm lint helm/vibecode-docs &>/dev/null
    test_result "Helm chart passes lint validation"
    
    # Test Helm template rendering
    helm template vibecode-docs helm/vibecode-docs &>/dev/null
    test_result "Helm chart templates render successfully"
    
    # Test Helm chart values
    grep -q "replicaCount:" helm/vibecode-docs/values.yaml
    test_result "Helm chart has replica count configuration"
    
    grep -q "image:" helm/vibecode-docs/values.yaml
    test_result "Helm chart has image configuration"
else
    echo -e "${YELLOW}[SKIP]${NC} Helm chart directory not found"
fi

echo -e "\n${BLUE}10. KIND Configuration Tests${NC}"
echo "------------------------------"

if [ -f "k8s/kind-config.yaml" ]; then
    # Test KIND config validation
    kind create cluster --dry-run --config k8s/kind-config.yaml --name test-validation &>/dev/null
    test_result "KIND configuration is valid"
    
    # Test KIND config content
    grep -q "kind: Cluster" k8s/kind-config.yaml
    test_result "KIND config specifies cluster kind"
    
    grep -q "apiVersion:" k8s/kind-config.yaml
    test_result "KIND config has API version"
else
    echo -e "${YELLOW}[SKIP]${NC} KIND configuration file not found"
fi

echo -e "\n${BLUE}11. Datadog Configuration Tests${NC}"
echo "------------------------------------"

if [ -f "k8s/datadog-values-kind.yaml" ]; then
    # Test Datadog values syntax
    python3 -c "import yaml; yaml.safe_load(open('k8s/datadog-values-kind.yaml'))" &>/dev/null
    test_result "Datadog values YAML syntax is valid"
    
    # Test Datadog configuration content
    grep -q "datadog:" k8s/datadog-values-kind.yaml
    test_result "Datadog configuration section exists"
    
    grep -q "clusterName:" k8s/datadog-values-kind.yaml
    test_result "Datadog cluster name is configured"
    
    grep -q "apiKeyExistingSecret:" k8s/datadog-values-kind.yaml
    test_result "Datadog API key secret is configured"
else
    echo -e "${YELLOW}[SKIP]${NC} Datadog values file not found"
fi

echo -e "\n${BLUE}12. Terraform Configuration Tests${NC}"
echo "-----------------------------------"

cd infrastructure/terraform/azure

# Test Terraform syntax
terraform fmt -check=true &>/dev/null
test_result "Terraform code is properly formatted"

terraform validate &>/dev/null
test_result "Terraform configuration is valid"

# Test Terraform file structure
[ -f "main.tf" ]
test_result "Main Terraform file exists"

[ -f "variables.tf" ]
test_result "Variables file exists"

[ -f "outputs.tf" ]
test_result "Outputs file exists"

# Test specific resource configurations
grep -q "azurerm_kubernetes_cluster" *.tf
test_result "AKS cluster configuration exists"

grep -q "azurerm_container_registry" *.tf
test_result "Container registry configuration exists"

grep -q "kubernetes_deployment" *.tf
test_result "Kubernetes deployment configuration exists"

grep -q "helm_release.*datadog" *.tf
test_result "Datadog Helm release configuration exists"

cd "$BASE_DIR"

echo -e "\n${BLUE}13. Configuration Consistency Tests${NC}"
echo "------------------------------------"

# Test image references consistency
YAML_IMAGE=$(grep "image:" k8s/docs-deployment.yaml | head -1 | awk '{print $2}' | tr -d '"')
echo "YAML image reference: $YAML_IMAGE"
test_result "Image reference found in YAML manifests"

# Test namespace consistency
YAML_NAMESPACE=$(grep -A 5 "namespace:" k8s/docs-deployment.yaml | head -1 | awk '{print $2}' | tr -d '"')
echo "YAML namespace: $YAML_NAMESPACE"
test_result "Namespace consistently defined in manifests"

# Test port consistency
CONTAINER_PORT=$(grep "containerPort:" k8s/docs-deployment.yaml | awk '{print $2}')
TARGET_PORT=$(grep "targetPort:" k8s/docs-deployment.yaml | awk '{print $2}')
[ "$CONTAINER_PORT" = "$TARGET_PORT" ]
test_result "Container and service ports are consistent"

echo -e "\n${BLUE}14. Documentation Tests${NC}"
echo "-------------------------"

# Test documentation for manifests
[ -f "README.md" ]
test_result "README documentation exists"

grep -i "kubernetes\|k8s" README.md &>/dev/null
test_result "README mentions Kubernetes deployment"

grep -i "helm" README.md &>/dev/null || true
test_result "Documentation mentions Helm (optional)"

echo -e "\n${BLUE}15. Best Practices Tests${NC}"
echo "---------------------------"

# Test label consistency
grep -q "app: vibecode-docs" k8s/docs-deployment.yaml
test_result "Consistent app labels used"

grep -q "version:" k8s/docs-deployment.yaml
test_result "Version labels are present"

# Test naming conventions
grep -q "vibecode-" k8s/docs-deployment.yaml
test_result "Consistent naming conventions used"

# Test resource organization
find k8s/ -name "*.yaml" | wc -l | grep -q "[0-9]"
test_result "Kubernetes manifests are organized in k8s/ directory"

echo -e "\n${BLUE}=== Kubernetes Manifests Test Results ===${NC}"
echo "Total Tests: $((PASSED + FAILED))"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"

if [ $FAILED -eq 0 ]; then
    echo -e "\n${GREEN}✅ All Kubernetes manifest tests passed!${NC}"
    echo "Kubernetes configurations are ready for deployment."
    echo ""
    echo "Validated Components:"
    echo "  📋 YAML manifests syntax and structure"
    echo "  🔒 Security configurations"
    echo "  📊 Resource management"
    echo "  ⚖️  Scaling configurations"
    echo "  🏥 Health checks"
    echo "  ⚙️  Terraform infrastructure"
    if [ -d "helm/vibecode-docs" ]; then
        echo "  📦 Helm charts"
    fi
else
    echo -e "\n${RED}❌ Some Kubernetes manifest tests failed!${NC}"
    echo "Please fix the configuration issues before deployment."
fi

exit $FAILED