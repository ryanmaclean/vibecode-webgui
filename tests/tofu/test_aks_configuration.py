#!/usr/bin/env python3
"""
Unit tests for AKS OpenTofu configuration validation.
Tests Terraform configuration files for syntax, structure, and compliance.
"""

import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path
from typing import Dict, List, Any
import yaml


class TofuConfigurationTests(unittest.TestCase):
    """Test suite for OpenTofu/Terraform configuration validation."""

    @classmethod
    def setUpClass(cls):
        """Set up test environment."""
        cls.tofu_dir = Path(__file__).parent.parent.parent / "tofu"
        cls.test_vars = {
            "project_name": "vibecode-test",
            "environment": "dev",
            "location": "East US 2",
            "datadog_api_key": "test-key-123",
            "datadog_app_key": "test-app-key-456",
            "postgres_storage_size_gb": 20
        }

    def test_tofu_directory_exists(self):
        """Test that the tofu directory exists and contains expected files."""
        self.assertTrue(self.tofu_dir.exists(), "tofu directory should exist")

        expected_files = [
            "aks-main.tf",
            "aks-variables.tf",
            "aks-outputs.tf",
            "k8s-postgresql.tf",
            "k8s-datadog.tf"
        ]

        for file_name in expected_files:
            file_path = self.tofu_dir / file_name
            self.assertTrue(file_path.exists(), f"{file_name} should exist")

    def test_terraform_syntax_validation(self):
        """Test that all Terraform files have valid syntax."""
        try:
            # Check if tofu/terraform is available
            result = subprocess.run(
                ["tofu", "version"],
                capture_output=True,
                text=True,
                cwd=self.tofu_dir
            )
            if result.returncode != 0:
                # Fallback to terraform
                subprocess.run(
                    ["terraform", "version"],
                    capture_output=True,
                    text=True,
                    check=True
                )
                tool = "terraform"
            else:
                tool = "tofu"
        except (subprocess.CalledProcessError, FileNotFoundError):
            self.skipTest("Neither tofu nor terraform CLI tools are available")

        # Validate syntax
        result = subprocess.run(
            [tool, "validate", "-json"],
            capture_output=True,
            text=True,
            cwd=self.tofu_dir
        )

        if result.returncode != 0:
            self.fail(f"Terraform validation failed: {result.stderr}")

        # Parse validation result
        validation_result = json.loads(result.stdout)
        self.assertTrue(validation_result.get("valid", False),
                       f"Configuration is not valid: {validation_result}")

    def test_variable_definitions(self):
        """Test that required variables are defined with proper validation."""
        variables_file = self.tofu_dir / "aks-variables.tf"
        content = variables_file.read_text()

        required_variables = [
            "project_name",
            "environment",
            "location",
            "datadog_api_key",
            "datadog_app_key",
            "postgres_storage_size_gb"
        ]

        for var in required_variables:
            self.assertIn(f'variable "{var}"', content,
                         f"Variable {var} should be defined")

        # Test validation blocks exist for critical variables
        validation_vars = ["environment", "system_node_count", "user_node_count"]
        for var in validation_vars:
            self.assertIn(f'variable "{var}"', content)
            # Find the variable block and check for validation
            var_start = content.find(f'variable "{var}"')
            var_block = content[var_start:content.find('}', var_start) + 1]
            self.assertIn("validation", var_block,
                         f"Variable {var} should have validation rules")

    def test_output_definitions(self):
        """Test that critical outputs are defined."""
        outputs_file = self.tofu_dir / "aks-outputs.tf"
        content = outputs_file.read_text()

        required_outputs = [
            "aks_cluster_name",
            "aks_cluster_endpoint",
            "resource_group_name",
            "kubernetes_namespace",
            "postgres_connection_info",
            "kubectl_config_command"
        ]

        for output in required_outputs:
            self.assertIn(f'output "{output}"', content,
                         f"Output {output} should be defined")

    def test_resource_naming_consistency(self):
        """Test that resource naming follows consistent patterns."""
        main_file = self.tofu_dir / "aks-main.tf"
        content = main_file.read_text()

        # Check for consistent use of local.resource_prefix
        self.assertIn("local.resource_prefix", content,
                     "Should use local.resource_prefix for consistent naming")

        # Check for unique suffix usage
        self.assertIn("local.unique_suffix", content,
                     "Should use local.unique_suffix to avoid naming conflicts")

    def test_security_configurations(self):
        """Test that security configurations are properly set."""
        main_file = self.tofu_dir / "aks-main.tf"
        content = main_file.read_text()

        # Check for RBAC enablement
        self.assertIn("role_based_access_control", content,
                     "RBAC should be configured")

        # Check for Azure AD integration
        self.assertIn("azure_active_directory", content,
                     "Azure AD integration should be configured")

        # Check for network policy
        self.assertIn("network_policy", content,
                     "Network policy should be enabled")

    def test_postgresql_datadog_integration(self):
        """Test PostgreSQL and Datadog integration configuration."""
        postgres_file = self.tofu_dir / "k8s-postgresql.tf"
        datadog_file = self.tofu_dir / "k8s-datadog.tf"

        postgres_content = postgres_file.read_text()
        datadog_content = datadog_file.read_text()

        # Check PostgreSQL Datadog annotations
        self.assertIn("ad.datadoghq.com", postgres_content,
                     "PostgreSQL should have Datadog autodiscovery annotations")

        # Check Datadog agent has PostgreSQL configuration
        self.assertIn("postgres.yaml", datadog_content,
                     "Datadog agent should have PostgreSQL monitoring config")

        # Check for Datadog monitoring user creation
        self.assertIn("datadog", postgres_content,
                     "PostgreSQL should create Datadog monitoring user")

    def test_resource_constraints(self):
        """Test that resource constraints are properly defined."""
        postgres_file = self.tofu_dir / "k8s-postgresql.tf"
        datadog_file = self.tofu_dir / "k8s-datadog.tf"

        postgres_content = postgres_file.read_text()
        datadog_content = datadog_file.read_text()

        # Check for resource requests and limits
        for content in [postgres_content, datadog_content]:
            self.assertIn("resources", content,
                         "Resource constraints should be defined")
            self.assertIn("requests", content,
                         "Resource requests should be specified")
            self.assertIn("limits", content,
                         "Resource limits should be specified")

    def test_health_checks(self):
        """Test that health checks are configured."""
        postgres_file = self.tofu_dir / "k8s-postgresql.tf"
        datadog_file = self.tofu_dir / "k8s-datadog.tf"

        postgres_content = postgres_file.read_text()
        datadog_content = datadog_file.read_text()

        # Check for readiness and liveness probes
        for content in [postgres_content, datadog_content]:
            self.assertIn("readiness_probe", content,
                         "Readiness probes should be configured")
            self.assertIn("liveness_probe", content,
                         "Liveness probes should be configured")

    def test_network_security(self):
        """Test network security configurations."""
        postgres_file = self.tofu_dir / "k8s-postgresql.tf"
        content = postgres_file.read_text()

        # Check for NetworkPolicy
        self.assertIn("kubernetes_network_policy", content,
                     "NetworkPolicy should be defined for PostgreSQL")

        # Check for proper ingress rules
        self.assertIn("ingress", content,
                     "Ingress rules should be defined")

        # Check for egress restrictions
        self.assertIn("egress", content,
                     "Egress rules should be defined")


class TofuPlanTests(unittest.TestCase):
    """Test suite for OpenTofu plan validation."""

    @classmethod
    def setUpClass(cls):
        """Set up test environment."""
        cls.tofu_dir = Path(__file__).parent.parent.parent / "tofu"
        cls.test_vars_file = None

    def setUp(self):
        """Set up individual test."""
        # Create temporary tfvars file for testing
        self.test_vars_file = tempfile.NamedTemporaryFile(
            mode='w',
            suffix='.tfvars.json',
            delete=False
        )

        test_vars = {
            "project_name": "vibecode-test",
            "environment": "dev",
            "location": "East US 2",
            "datadog_api_key": "test-key-123",
            "datadog_app_key": "test-app-key-456",
            "datadog_site": "datadoghq.com",
            "postgres_storage_size_gb": 20,
            "system_node_count": 1,
            "user_node_count": 1,
            "enable_datadog_monitoring": True,
            "postgresql_admin_password": "test-password-123",
            "nextauth_secret": "test-secret-key-for-validation",
            "app_image_tag": "test",
            "openrouter_api_key": "",
            "azure_openai_api_key": "",
            "azure_openai_endpoint": "",
            "ingress_hostname": "vibecode-test.eastus2.cloudapp.azure.com"
        }

        json.dump(test_vars, self.test_vars_file)
        self.test_vars_file.close()

    def tearDown(self):
        """Clean up individual test."""
        if self.test_vars_file:
            os.unlink(self.test_vars_file.name)

    def test_terraform_plan_generation(self):
        """Test that terraform plan can be generated without errors."""
        try:
            # Check if tofu/terraform is available
            result = subprocess.run(
                ["tofu", "version"],
                capture_output=True,
                text=True,
                cwd=self.tofu_dir
            )
            if result.returncode != 0:
                subprocess.run(
                    ["terraform", "version"],
                    capture_output=True,
                    text=True,
                    check=True
                )
                tool = "terraform"
            else:
                tool = "tofu"
        except (subprocess.CalledProcessError, FileNotFoundError):
            self.skipTest("Neither tofu nor terraform CLI tools are available")

        # Initialize
        init_result = subprocess.run(
            [tool, "init", "-backend=false"],
            capture_output=True,
            text=True,
            cwd=self.tofu_dir
        )

        if init_result.returncode != 0:
            self.fail(f"Terraform init failed: {init_result.stderr}")

        # Generate plan
        plan_result = subprocess.run(
            [tool, "plan", f"-var-file={self.test_vars_file.name}", "-out=test.tfplan"],
            capture_output=True,
            text=True,
            cwd=self.tofu_dir
        )

        # Clean up plan file
        plan_file = self.tofu_dir / "test.tfplan"
        if plan_file.exists():
            plan_file.unlink()

        if plan_result.returncode != 0:
            self.fail(f"Terraform plan failed: {plan_result.stderr}")

    def test_resource_count_validation(self):
        """Test that expected number of resources will be created."""
        try:
            result = subprocess.run(
                ["tofu", "version"],
                capture_output=True,
                text=True,
                cwd=self.tofu_dir
            )
            if result.returncode != 0:
                subprocess.run(
                    ["terraform", "version"],
                    capture_output=True,
                    text=True,
                    check=True
                )
                tool = "terraform"
            else:
                tool = "tofu"
        except (subprocess.CalledProcessError, FileNotFoundError):
            self.skipTest("Neither tofu nor terraform CLI tools are available")

        # Initialize and plan
        subprocess.run([tool, "init", "-backend=false"],
                      capture_output=True, cwd=self.tofu_dir)

        plan_result = subprocess.run(
            [tool, "plan", f"-var-file={self.test_vars_file.name}", "-json"],
            capture_output=True,
            text=True,
            cwd=self.tofu_dir
        )

        if plan_result.returncode != 0:
            self.skipTest(f"Could not generate plan: {plan_result.stderr}")

        # Count expected resources (minimum expected)
        expected_resource_types = [
            "azurerm_resource_group",
            "azurerm_kubernetes_cluster",
            "azurerm_virtual_network",
            "kubernetes_namespace",
            "kubernetes_deployment",  # PostgreSQL
            "kubernetes_service",     # PostgreSQL service
            "kubernetes_daemonset",   # Datadog agent
            "kubernetes_secret"       # Various secrets
        ]

        plan_output = plan_result.stdout
        for resource_type in expected_resource_types:
            self.assertIn(resource_type, plan_output,
                         f"Plan should include {resource_type}")


if __name__ == "__main__":
    unittest.main()