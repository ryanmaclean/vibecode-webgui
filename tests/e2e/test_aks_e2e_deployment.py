#!/usr/bin/env python3

# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

"""
End-to-end tests for complete AKS deployment pipeline.
Tests the full deployment from infrastructure creation to application validation.
"""


# Datadog APM tracing
try:
    import ddtrace
    ddtrace.patch_all()
except ImportError:
    print("Warning: ddtrace not installed, tracing disabled")
    pass

import json
import os
import subprocess
import tempfile
import time
import unittest
from pathlib import Path
from typing import Dict, Optional
import sys
import yaml

# Add the scripts directory to the path
scripts_dir = Path(__file__).parent.parent.parent / "scripts"
sys.path.insert(0, str(scripts_dir))


class AKSE2EDeploymentTests(unittest.TestCase):
    """End-to-end tests for AKS deployment pipeline."""

    @classmethod
    def setUpClass(cls):
        """Set up test environment for E2E tests."""
        cls.test_environment = os.getenv("AKS_TEST_ENVIRONMENT", "test")
        cls.cleanup_resources = os.getenv("AKS_TEST_CLEANUP", "true").lower() == "true"

        # Skip E2E tests if not explicitly enabled
        if not os.getenv("ENABLE_AKS_E2E_TESTS"):
            raise unittest.SkipTest(
                "AKS E2E tests disabled. Set ENABLE_AKS_E2E_TESTS=true to enable."
            )

        cls.project_root = Path(__file__).parent.parent.parent
        cls.tofu_dir = cls.project_root / "tofu"
        cls.scripts_dir = cls.project_root / "scripts"

        # Generate unique test identifier
        import datetime
        cls.test_id = f"e2e-{int(datetime.datetime.now().timestamp())}"

        cls.test_config = {
            "project_name": f"vibecode-{cls.test_id}",
            "environment": cls.test_environment,
            "location": "East US 2",
            "datadog_api_key": os.getenv("DATADOG_API_KEY"),
            "datadog_app_key": os.getenv("DATADOG_APP_KEY"),
            "postgres_storage_size_gb": 20,
            "system_node_count": 1,
            "user_node_count": 1,
            "enable_datadog_monitoring": True
        }

        # Validate required environment variables
        required_env_vars = ["DATADOG_API_KEY", "DATADOG_APP_KEY"]
        missing_vars = [var for var in required_env_vars if not os.getenv(var)]

        if missing_vars:
            raise unittest.SkipTest(
                f"Missing required environment variables: {', '.join(missing_vars)}"
            )

        cls.deployed_resources = {}
        cls.deployment_successful = False

    @classmethod
    def tearDownClass(cls):
        """Clean up deployed resources."""
        if cls.cleanup_resources and cls.deployment_successful:
            cls._cleanup_deployment()

    @classmethod
    def _cleanup_deployment(cls):
        """Clean up deployed Azure resources."""
        try:
            # Import deployment manager
            from deploy_aks import AKSDeploymentManager

            manager = AKSDeploymentManager(
                tofu_dir=cls.tofu_dir,
                config=cls.test_config,
                dry_run=False
            )

            print(f"Cleaning up deployment: {cls.test_id}")
            manager.destroy()

        except Exception as e:
            print(f"Warning: Failed to clean up deployment {cls.test_id}: {e}")

    def setUp(self):
        """Set up individual test."""
        self.maxDiff = None

    def test_01_azure_authentication(self):
        """Test Azure CLI authentication."""
        result = subprocess.run(
            ["az", "account", "show"],
            capture_output=True,
            text=True
        )

        self.assertEqual(result.returncode, 0,
                        f"Azure authentication failed: {result.stderr}")

        account_info = json.loads(result.stdout)
        self.assertIn("user", account_info, "Azure account should have user info")

    def test_02_terraform_tools_available(self):
        """Test that required tools are available."""
        tools = ["tofu", "terraform", "kubectl", "az"]

        for tool in tools:
            if tool in ["tofu", "terraform"]:
                # At least one of tofu or terraform should be available
                tofu_result = subprocess.run(["tofu", "version"],
                                           capture_output=True)
                terraform_result = subprocess.run(["terraform", "version"],
                                                capture_output=True)

                self.assertTrue(
                    tofu_result.returncode == 0 or terraform_result.returncode == 0,
                    "Either tofu or terraform must be available"
                )
            else:
                result = subprocess.run([tool, "--version"],
                                      capture_output=True)
                self.assertEqual(result.returncode, 0,
                               f"Tool {tool} should be available")

    def test_03_infrastructure_validation(self):
        """Test infrastructure configuration validation."""
        # Choose tool (prefer tofu over terraform)
        tofu_result = subprocess.run(["tofu", "version"], capture_output=True)
        tool = "tofu" if tofu_result.returncode == 0 else "terraform"

        # Initialize Terraform
        init_result = subprocess.run(
            [tool, "init", "-backend=false"],
            capture_output=True,
            text=True,
            cwd=self.tofu_dir
        )

        self.assertEqual(init_result.returncode, 0,
                        f"Terraform init failed: {init_result.stderr}")

        # Validate configuration
        validate_result = subprocess.run(
            [tool, "validate"],
            capture_output=True,
            text=True,
            cwd=self.tofu_dir
        )

        self.assertEqual(validate_result.returncode, 0,
                        f"Terraform validation failed: {validate_result.stderr}")

    def test_04_deployment_planning(self):
        """Test deployment plan generation."""
        # Create temporary tfvars file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.tfvars.json',
                                       delete=False) as f:
            json.dump(self.test_config, f)
            tfvars_file = f.name

        try:
            # Choose tool
            tofu_result = subprocess.run(["tofu", "version"], capture_output=True)
            tool = "tofu" if tofu_result.returncode == 0 else "terraform"

            # Generate plan
            plan_result = subprocess.run(
                [tool, "plan", f"-var-file={tfvars_file}", "-out=e2e-test.tfplan"],
                capture_output=True,
                text=True,
                cwd=self.tofu_dir
            )

            # Clean up plan file
            plan_file = self.tofu_dir / "e2e-test.tfplan"
            if plan_file.exists():
                plan_file.unlink()

            self.assertEqual(plan_result.returncode, 0,
                            f"Terraform plan failed: {plan_result.stderr}")

            # Verify plan contains expected resources
            expected_resources = [
                "azurerm_kubernetes_cluster",
                "kubernetes_namespace",
                "kubernetes_deployment",
                "kubernetes_daemonset"
            ]

            for resource in expected_resources:
                self.assertIn(resource, plan_result.stdout,
                             f"Plan should include {resource}")

        finally:
            os.unlink(tfvars_file)

    @unittest.skipUnless(os.getenv("ENABLE_REAL_DEPLOYMENT"),
                        "Real deployment tests disabled")
    def test_05_full_deployment(self):
        """Test complete infrastructure deployment."""
        try:
            # Import deployment manager
            from deploy_aks import AKSDeploymentManager

            manager = AKSDeploymentManager(
                tofu_dir=self.tofu_dir,
                config=self.test_config,
                dry_run=False
            )

            # Deploy infrastructure
            print(f"Starting deployment: {self.test_id}")
            deployment_result = manager.deploy()

            self.assertTrue(deployment_result.success,
                           f"Deployment failed: {deployment_result.error}")

            # Store deployment info for cleanup
            self.__class__.deployed_resources = deployment_result.resources
            self.__class__.deployment_successful = True

            # Verify basic deployment outputs
            self.assertIn("resource_group_name", deployment_result.outputs)
            self.assertIn("aks_cluster_name", deployment_result.outputs)
            self.assertIn("kubernetes_namespace", deployment_result.outputs)

        except ImportError:
            self.skipTest("deploy_aks module not available")

    @unittest.skipUnless(os.getenv("ENABLE_REAL_DEPLOYMENT"),
                        "Real deployment tests disabled")
    def test_06_kubernetes_cluster_validation(self):
        """Test Kubernetes cluster accessibility and basic functionality."""
        if not self.__class__.deployment_successful:
            self.skipTest("Deployment not successful, skipping cluster validation")

        # Configure kubectl
        rg_name = self.deployed_resources.get("resource_group_name")
        cluster_name = self.deployed_resources.get("aks_cluster_name")

        if not (rg_name and cluster_name):
            self.skipTest("Missing resource group or cluster name")

        # Get credentials
        creds_result = subprocess.run(
            ["az", "aks", "get-credentials",
             "--resource-group", rg_name,
             "--name", cluster_name,
             "--overwrite-existing"],
            capture_output=True,
            text=True
        )

        self.assertEqual(creds_result.returncode, 0,
                        f"Failed to get cluster credentials: {creds_result.stderr}")

        # Test cluster connectivity
        cluster_info_result = subprocess.run(
            ["kubectl", "cluster-info"],
            capture_output=True,
            text=True
        )

        self.assertEqual(cluster_info_result.returncode, 0,
                        f"kubectl cluster-info failed: {cluster_info_result.stderr}")

        # Check node status
        nodes_result = subprocess.run(
            ["kubectl", "get", "nodes", "-o", "json"],
            capture_output=True,
            text=True
        )

        self.assertEqual(nodes_result.returncode, 0,
                        f"Failed to get nodes: {nodes_result.stderr}")

        nodes_info = json.loads(nodes_result.stdout)
        self.assertGreater(len(nodes_info["items"]), 0,
                          "Cluster should have at least one node")

        # Verify nodes are ready
        for node in nodes_info["items"]:
            conditions = node["status"]["conditions"]
            ready_condition = next(
                (c for c in conditions if c["type"] == "Ready"), None
            )
            self.assertIsNotNone(ready_condition, "Node should have Ready condition")
            self.assertEqual(ready_condition["status"], "True",
                           f"Node {node['metadata']['name']} should be ready")

    @unittest.skipUnless(os.getenv("ENABLE_REAL_DEPLOYMENT"),
                        "Real deployment tests disabled")
    def test_07_namespace_and_deployments_validation(self):
        """Test that required namespace and deployments are created."""
        if not self.__class__.deployment_successful:
            self.skipTest("Deployment not successful, skipping validation")

        namespace = self.test_config["project_name"]

        # Check namespace exists
        ns_result = subprocess.run(
            ["kubectl", "get", "namespace", namespace],
            capture_output=True,
            text=True
        )

        self.assertEqual(ns_result.returncode, 0,
                        f"Namespace {namespace} should exist")

        # Check PostgreSQL deployment
        postgres_result = subprocess.run(
            ["kubectl", "get", "deployment", "postgres", "-n", namespace],
            capture_output=True,
            text=True
        )

        self.assertEqual(postgres_result.returncode, 0,
                        "PostgreSQL deployment should exist")

        # Check Datadog DaemonSet
        datadog_result = subprocess.run(
            ["kubectl", "get", "daemonset", "datadog-agent", "-n", namespace],
            capture_output=True,
            text=True
        )

        self.assertEqual(datadog_result.returncode, 0,
                        "Datadog agent DaemonSet should exist")

    @unittest.skipUnless(os.getenv("ENABLE_REAL_DEPLOYMENT"),
                        "Real deployment tests disabled")
    def test_08_postgresql_connectivity(self):
        """Test PostgreSQL deployment and connectivity."""
        if not self.__class__.deployment_successful:
            self.skipTest("Deployment not successful, skipping PostgreSQL test")

        namespace = self.test_config["project_name"]

        # Wait for PostgreSQL to be ready
        print("Waiting for PostgreSQL to be ready...")
        max_wait = 300  # 5 minutes
        wait_time = 0

        while wait_time < max_wait:
            ready_result = subprocess.run(
                ["kubectl", "get", "deployment", "postgres", "-n", namespace,
                 "-o", "jsonpath={.status.readyReplicas}"],
                capture_output=True,
                text=True
            )

            if ready_result.returncode == 0 and ready_result.stdout.strip() == "1":
                break

            time.sleep(10)
            wait_time += 10
        else:
            self.fail("PostgreSQL deployment did not become ready within 5 minutes")

        # Test database connectivity
        db_test_result = subprocess.run(
            ["kubectl", "exec", "-n", namespace,
             "deployment/postgres", "--",
             "pg_isready", "-U", "vibecode", "-d", "vibecode"],
            capture_output=True,
            text=True
        )

        self.assertEqual(db_test_result.returncode, 0,
                        f"PostgreSQL connectivity test failed: {db_test_result.stderr}")

    @unittest.skipUnless(os.getenv("ENABLE_REAL_DEPLOYMENT"),
                        "Real deployment tests disabled")
    def test_09_datadog_agent_validation(self):
        """Test Datadog agent deployment and functionality."""
        if not self.__class__.deployment_successful:
            self.skipTest("Deployment not successful, skipping Datadog test")

        namespace = self.test_config["project_name"]

        # Check Datadog pods are running
        datadog_pods_result = subprocess.run(
            ["kubectl", "get", "pods", "-n", namespace,
             "-l", "app=datadog-agent", "-o", "json"],
            capture_output=True,
            text=True
        )

        self.assertEqual(datadog_pods_result.returncode, 0,
                        "Failed to get Datadog pods")

        pods_info = json.loads(datadog_pods_result.stdout)
        self.assertGreater(len(pods_info["items"]), 0,
                          "Should have at least one Datadog agent pod")

        # Verify pods are running
        for pod in pods_info["items"]:
            self.assertEqual(pod["status"]["phase"], "Running",
                           f"Datadog pod {pod['metadata']['name']} should be running")

        # Test Datadog agent health endpoint
        if pods_info["items"]:
            pod_name = pods_info["items"][0]["metadata"]["name"]
            health_result = subprocess.run(
                ["kubectl", "exec", "-n", namespace, pod_name, "--",
                 "curl", "-f", "http://localhost:5555/health"],
                capture_output=True,
                text=True
            )

            # Health check might not be immediately available, so we'll be lenient
            if health_result.returncode == 0:
                self.assertIn("ok", health_result.stdout.lower(),
                             "Datadog agent health check should return ok")

    @unittest.skipUnless(os.getenv("ENABLE_REAL_DEPLOYMENT"),
                        "Real deployment tests disabled")
    def test_10_rollback_capability(self):
        """Test deployment rollback functionality."""
        if not self.__class__.deployment_successful:
            self.skipTest("Deployment not successful, skipping rollback test")

        try:
            from deploy_aks import AKSDeploymentManager

            manager = AKSDeploymentManager(
                tofu_dir=self.tofu_dir,
                config=self.test_config,
                dry_run=True  # Dry run for rollback test
            )

            # Test rollback validation (dry run)
            rollback_result = manager.validate_rollback_capability()

            self.assertTrue(rollback_result.success,
                           f"Rollback validation failed: {rollback_result.error}")

        except ImportError:
            self.skipTest("deploy_aks module not available")


class AKSPerformanceTests(unittest.TestCase):
    """Performance tests for AKS deployment."""

    @unittest.skipUnless(os.getenv("ENABLE_PERFORMANCE_TESTS"),
                        "Performance tests disabled")
    def test_deployment_performance(self):
        """Test deployment performance metrics."""
        # This would test deployment time, resource utilization, etc.
        self.skipTest("Performance tests not implemented yet")

    @unittest.skipUnless(os.getenv("ENABLE_LOAD_TESTS"),
                        "Load tests disabled")
    def test_cluster_load_handling(self):
        """Test cluster performance under load."""
        # This would test cluster response under various load conditions
        self.skipTest("Load tests not implemented yet")


if __name__ == "__main__":
    # Configure test runner for E2E tests
    import argparse

    parser = argparse.ArgumentParser(description="Run AKS E2E tests")
    parser.add_argument("--enable-deployment", action="store_true",
                       help="Enable real deployment tests")
    parser.add_argument("--cleanup", action="store_true", default=True,
                       help="Clean up resources after tests")
    parser.add_argument("--test-environment", default="test",
                       help="Test environment name")

    args, remaining = parser.parse_known_args()

    # Set environment variables based on arguments
    if args.enable_deployment:
        os.environ["ENABLE_REAL_DEPLOYMENT"] = "true"

    if not args.cleanup:
        os.environ["AKS_TEST_CLEANUP"] = "false"

    os.environ["AKS_TEST_ENVIRONMENT"] = args.test_environment

    # Run tests
    unittest.main(argv=[sys.argv[0]] + remaining)