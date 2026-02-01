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
Offline testing suite for GCP cloud deployment.
Tests Terraform configuration without creating actual GCP resources.
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
import unittest
from pathlib import Path
from typing import Dict, List, Any
import yaml


class GCPCloudDeploymentTests(unittest.TestCase):
    """Test suite for GCP cloud deployment validation."""

    @classmethod
    def setUpClass(cls):
        """Set up test environment."""
        cls.tofu_dir = Path(__file__).parent.parent.parent / "tofu" / "code-server-gcp"
        cls.test_vars = {
            "environment": "test",
            "machine_type": "e2-micro",
            "source_image": "projects/cos-cloud/global/images/family/cos-stable",
            "boot_disk_size": 20,
            "workspace_disk_size": 50,
            "container_image": "ghcr.io/ryanmaclean/vibecode-codeserver:latest",
            "codeserver_password": "test-password",
            "network": "default",
            "target_size": 1,
            "enable_scheduling": False,
            "schedule_cron": "0 9 * * 1-5",
            "schedule_target_size": 0,
            "timezone": "UTC"
        }

    def test_gcp_directory_structure(self):
        """Test that GCP Terraform directory has expected structure."""
        self.assertTrue(self.tofu_dir.exists(), "GCP tofu directory should exist")
        
        expected_files = [
            "main.tf",
            "variables.tf", 
            "outputs.tf",
            "startup.sh"
        ]
        
        for file_name in expected_files:
            file_path = self.tofu_dir / file_name
            self.assertTrue(file_path.exists(), f"{file_name} should exist")

    def test_terraform_syntax_validation(self):
        """Test that all GCP Terraform files have valid syntax."""
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

        try:
            # Initialize first
            init_result = subprocess.run(
                [tool, "init", "-backend=false"],
                capture_output=True,
                text=True,
                cwd=self.tofu_dir
            )

            if init_result.returncode != 0:
                self.fail(f"GCP Terraform init failed: {init_result.stderr}")

            # Validate syntax
            result = subprocess.run(
                [tool, "validate", "-json"],
                capture_output=True,
                text=True,
                cwd=self.tofu_dir
            )

            if result.returncode != 0:
                self.fail(f"GCP Terraform validation failed: {result.stderr}")

            # Parse validation result
            validation_result = json.loads(result.stdout)
            self.assertTrue(validation_result.get("valid", False),
                           f"GCP configuration is not valid: {validation_result}")
        finally:
            # Clean up
            import shutil
            terraform_dir = self.tofu_dir / ".terraform"
            if terraform_dir.exists():
                shutil.rmtree(terraform_dir)
            lock_file = self.tofu_dir / ".terraform.lock.hcl"
            if lock_file.exists():
                lock_file.unlink()

    def test_gcp_variable_definitions(self):
        """Test that required GCP variables are defined."""
        variables_file = self.tofu_dir / "variables.tf"
        content = variables_file.read_text()

        required_variables = [
            "environment",
            "machine_type",
            "source_image",
            "boot_disk_size",
            "workspace_disk_size",
            "container_image",
            "codeserver_password",
            "target_size"
        ]

        for var in required_variables:
            self.assertIn(f'variable "{var}"', content,
                         f"GCP variable {var} should be defined")

    def test_gcp_output_definitions(self):
        """Test that critical GCP outputs are defined."""
        outputs_file = self.tofu_dir / "outputs.tf"
        content = outputs_file.read_text()

        required_outputs = [
            "instance_group_manager_name",
            "instance_group_manager_url",
            "service_account_email",
            "health_check_url",
            "access_instructions"
        ]

        for output in required_outputs:
            self.assertIn(f'output "{output}"', content,
                         f"GCP output {output} should be defined")

    def test_gcp_resource_configuration(self):
        """Test GCP resource configuration."""
        main_file = self.tofu_dir / "main.tf"
        content = main_file.read_text()

        # Check for Compute Engine configuration
        self.assertIn("google_compute_instance_template", content, "Instance template should be configured")
        self.assertIn("google_compute_instance_group_manager", content, "Instance group manager should be configured")
        
        # Check for persistent disk
        self.assertIn("google_compute_disk", content, "Persistent disk should be configured")
        
        # Check for health check
        self.assertIn("google_compute_health_check", content, "Health check should be configured")

    def test_gcp_cost_optimization(self):
        """Test GCP cost optimization features."""
        main_file = self.tofu_dir / "main.tf"
        content = main_file.read_text()

        # Check for preemptible instances
        self.assertIn("preemptible = true", content, "Preemptible instances should be configured for cost optimization")
        
        # Check for Cloud Scheduler
        self.assertIn("google_cloud_scheduler_job", content, "Cloud Scheduler should be configured for automation")

    def test_gcp_security_configuration(self):
        """Test GCP security configurations."""
        main_file = self.tofu_dir / "main.tf"
        content = main_file.read_text()

        # Check for service account
        self.assertIn("google_service_account", content, "Service account should be configured")
        
        # Check for IAM bindings
        self.assertIn("google_project_iam_member", content, "IAM bindings should be configured")

    def test_gcp_startup_script(self):
        """Test GCP startup script configuration."""
        main_file = self.tofu_dir / "main.tf"
        startup_file = self.tofu_dir / "startup.sh"
        
        main_content = main_file.read_text()
        startup_content = startup_file.read_text()

        # Check for startup script reference
        self.assertIn("startup.sh", main_content, "Startup script should be referenced")
        
        # Check startup script content
        self.assertIn("docker", startup_content, "Startup script should install Docker")
        self.assertIn("code-server", startup_content, "Startup script should start code-server")

    def test_gcp_terraform_plan_generation(self):
        """Test that GCP terraform plan can be generated without errors."""
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

        # Create temporary tfvars file
        test_vars_file = tempfile.NamedTemporaryFile(
            mode='w',
            suffix='.tfvars.json',
            delete=False
        )
        json.dump(self.test_vars, test_vars_file)
        test_vars_file.close()

        try:
            # Initialize
            init_result = subprocess.run(
                [tool, "init", "-backend=false"],
                capture_output=True,
                text=True,
                cwd=self.tofu_dir
            )

            if init_result.returncode != 0:
                self.fail(f"GCP Terraform init failed: {init_result.stderr}")

            # Generate plan
            plan_result = subprocess.run(
                [tool, "plan", f"-var-file={test_vars_file.name}", "-out=test.tfplan"],
                capture_output=True,
                text=True,
                cwd=self.tofu_dir
            )

            # Clean up plan file
            plan_file = self.tofu_dir / "test.tfplan"
            if plan_file.exists():
                plan_file.unlink()

            if plan_result.returncode != 0:
                self.fail(f"GCP Terraform plan failed: {plan_result.stderr}")

        finally:
            os.unlink(test_vars_file.name)

    def test_gcp_resource_count_validation(self):
        """Test that expected number of GCP resources will be created."""
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

        # Create temporary tfvars file
        test_vars_file = tempfile.NamedTemporaryFile(
            mode='w',
            suffix='.tfvars.json',
            delete=False
        )
        json.dump(self.test_vars, test_vars_file)
        test_vars_file.close()

        try:
            # Initialize and plan
            subprocess.run([tool, "init", "-backend=false"],
                          capture_output=True, cwd=self.tofu_dir)

            plan_result = subprocess.run(
                [tool, "plan", f"-var-file={test_vars_file.name}", "-json"],
                capture_output=True,
                text=True,
                cwd=self.tofu_dir
            )

            if plan_result.returncode != 0:
                self.skipTest(f"Could not generate GCP plan: {plan_result.stderr}")

            # Count expected GCP resources
            expected_resource_types = [
                "google_service_account",
                "google_compute_instance_template",
                "google_compute_instance_group_manager",
                "google_compute_disk",
                "google_compute_health_check",
                "google_cloud_scheduler_job"
            ]

            plan_output = plan_result.stdout
            for resource_type in expected_resource_types:
                self.assertIn(resource_type, plan_output,
                             f"GCP plan should include {resource_type}")

        finally:
            os.unlink(test_vars_file.name)

    def test_gcp_naming_conventions(self):
        """Test GCP resource naming conventions."""
        main_file = self.tofu_dir / "main.tf"
        content = main_file.read_text()

        # Check for consistent naming patterns
        self.assertIn("${var.environment}-codeserver", content,
                     "Should use environment-based naming")
        
        # Check for proper labels
        self.assertIn("environment = var.environment", content,
                     "Should have environment labels")

    def test_gcp_monitoring_configuration(self):
        """Test GCP monitoring configuration."""
        main_file = self.tofu_dir / "main.tf"
        content = main_file.read_text()

        # Check for health checks
        self.assertIn("health_check", content, "Health checks should be configured")
        
        # Check for logging configuration
        self.assertIn("logging", content, "Logging should be configured")


if __name__ == "__main__":
    unittest.main()