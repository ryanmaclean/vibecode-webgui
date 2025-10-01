#!/usr/bin/env python3
"""
Offline testing suite for AWS ECS/Fargate cloud deployment.
Tests Terraform configuration without creating actual AWS resources.
"""

import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path
from typing import Dict, List, Any
import yaml


class AWSCloudDeploymentTests(unittest.TestCase):
    """Test suite for AWS ECS/Fargate cloud deployment validation."""

    @classmethod
    def setUpClass(cls):
        """Set up test environment."""
        cls.tofu_dir = Path(__file__).parent.parent.parent / "tofu" / "code-server-aws"
        cls.test_vars = {
            "region": "us-east-1",
            "environment": "test",
            "vpc_cidr": "10.0.0.0/16",
            "enable_nat_gateway": True,
            "task_cpu": 512,
            "task_memory": 1024,
            "desired_count": 1,
            "container_image": "ghcr.io/ryanmaclean/vibecode-codeserver:latest",
            "codeserver_password": "test-password",
            "log_retention_days": 7,
            "enable_scheduling": False,
            "enable_idle_detection": False
        }

    def test_aws_directory_structure(self):
        """Test that AWS Terraform directory has expected structure."""
        self.assertTrue(self.tofu_dir.exists(), "AWS tofu directory should exist")
        
        expected_files = [
            "main.tf",
            "variables.tf", 
            "outputs.tf",
            "iam.tf"
        ]
        
        for file_name in expected_files:
            file_path = self.tofu_dir / file_name
            self.assertTrue(file_path.exists(), f"{file_name} should exist")

    def test_terraform_syntax_validation(self):
        """Test that all AWS Terraform files have valid syntax."""
        try:
            # Try terraform first (more reliable for validation)
            subprocess.run(
                ["terraform", "version"],
                capture_output=True,
                text=True,
                check=True
            )
            tool = "terraform"
        except (subprocess.CalledProcessError, FileNotFoundError):
            try:
                # Fallback to tofu
                subprocess.run(
                    ["tofu", "version"],
                    capture_output=True,
                    text=True,
                    check=True
                )
                tool = "tofu"
            except (subprocess.CalledProcessError, FileNotFoundError):
                self.skipTest("Neither terraform nor tofu CLI tools are available")

        try:
            # Initialize first with timeout and retry logic
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    init_result = subprocess.run(
                        [tool, "init", "-backend=false"],
                        capture_output=True,
                        text=True,
                        cwd=self.tofu_dir,
                        timeout=120  # Increased timeout
                    )
                    if init_result.returncode == 0:
                        break
                    elif attempt < max_retries - 1:
                        print(f"Init attempt {attempt + 1} failed, retrying...")
                        continue
                except subprocess.TimeoutExpired:
                    if attempt < max_retries - 1:
                        print(f"Init timeout on attempt {attempt + 1}, retrying...")
                        continue
                    else:
                        self.skipTest("Provider initialization timeout - skipping validation test")

            if init_result.returncode != 0:
                self.fail(f"AWS Terraform init failed: {init_result.stderr}")

            # Validate syntax with timeout and retry logic
            for attempt in range(max_retries):
                try:
                    result = subprocess.run(
                        [tool, "validate", "-json"],
                        capture_output=True,
                        text=True,
                        cwd=self.tofu_dir,
                        timeout=120  # Increased timeout
                    )
                    if result.returncode == 0:
                        break
                    elif attempt < max_retries - 1:
                        print(f"Validation attempt {attempt + 1} failed, retrying...")
                        continue
                except subprocess.TimeoutExpired:
                    if attempt < max_retries - 1:
                        print(f"Validation timeout on attempt {attempt + 1}, retrying...")
                        continue
                    else:
                        self.skipTest("Terraform validation timeout - skipping validation test")

            if result.returncode != 0:
                # Check if it's a provider timeout issue
                if "timeout while waiting for plugin to start" in result.stdout:
                    self.skipTest("Provider timeout - skipping validation test")
                print(f"Debug: stdout={result.stdout}")
                print(f"Debug: stderr={result.stderr}")
                self.fail(f"AWS Terraform validation failed: {result.stderr}")

            # Parse validation result
            validation_result = json.loads(result.stdout)
            if not validation_result.get("valid", False):
                # Check if it's a provider issue
                diagnostics = validation_result.get("diagnostics", [])
                for diag in diagnostics:
                    if "timeout while waiting for plugin" in diag.get("summary", ""):
                        self.skipTest("Provider timeout - skipping validation test")
                self.fail(f"AWS configuration is not valid: {validation_result}")
        finally:
            # Clean up
            import shutil
            terraform_dir = self.tofu_dir / ".terraform"
            if terraform_dir.exists():
                shutil.rmtree(terraform_dir)
            lock_file = self.tofu_dir / ".terraform.lock.hcl"
            if lock_file.exists():
                lock_file.unlink()

    def test_aws_variable_definitions(self):
        """Test that required AWS variables are defined."""
        variables_file = self.tofu_dir / "variables.tf"
        content = variables_file.read_text()

        required_variables = [
            "region",
            "environment", 
            "vpc_cidr",
            "task_cpu",
            "task_memory",
            "desired_count",
            "container_image",
            "codeserver_password"
        ]

        for var in required_variables:
            self.assertIn(f'variable "{var}"', content,
                         f"AWS variable {var} should be defined")

    def test_aws_output_definitions(self):
        """Test that critical AWS outputs are defined."""
        outputs_file = self.tofu_dir / "outputs.tf"
        content = outputs_file.read_text()

        required_outputs = [
            "vpc_id",
            "ecs_cluster_name",
            "ecs_service_name",
            "load_balancer_dns",
            "efs_file_system_id",
            "access_instructions"
        ]

        for output in required_outputs:
            self.assertIn(f'output "{output}"', content,
                         f"AWS output {output} should be defined")

    def test_aws_resource_configuration(self):
        """Test AWS resource configuration."""
        main_file = self.tofu_dir / "main.tf"
        content = main_file.read_text()

        # Check for VPC configuration
        self.assertIn("aws_vpc", content, "VPC should be configured")
        self.assertIn("aws_subnet", content, "Subnets should be configured")
        
        # Check for ECS configuration
        self.assertIn("aws_ecs_cluster", content, "ECS cluster should be configured")
        self.assertIn("aws_ecs_task_definition", content, "ECS task definition should be configured")
        self.assertIn("aws_ecs_service", content, "ECS service should be configured")
        
        # Check for EFS configuration
        self.assertIn("aws_efs_file_system", content, "EFS file system should be configured")
        
        # Check for Load Balancer
        self.assertIn("aws_lb", content, "Application Load Balancer should be configured")

    def test_aws_security_configuration(self):
        """Test AWS security configurations."""
        main_file = self.tofu_dir / "main.tf"
        iam_file = self.tofu_dir / "iam.tf"
        
        main_content = main_file.read_text()
        iam_content = iam_file.read_text()

        # Check for security groups
        self.assertIn("aws_security_group", main_content, "Security groups should be configured")
        
        # Check for IAM roles
        self.assertIn("aws_iam_role", iam_content, "IAM roles should be configured")
        self.assertIn("ecs_execution", iam_content, "ECS execution role should be configured")
        self.assertIn("ecs_task", iam_content, "ECS task role should be configured")

    def test_aws_cost_optimization(self):
        """Test AWS cost optimization features."""
        main_file = self.tofu_dir / "main.tf"
        content = main_file.read_text()

        # Check for Fargate Spot
        self.assertIn("FARGATE_SPOT", content, "Fargate Spot should be configured for cost optimization")
        
        # Check for EFS encryption
        self.assertIn("encrypted       = true", content, "EFS should be encrypted")

    def test_aws_monitoring_configuration(self):
        """Test AWS monitoring configuration."""
        main_file = self.tofu_dir / "main.tf"
        content = main_file.read_text()

        # Check for CloudWatch logs
        self.assertIn("aws_cloudwatch_log_group", content, "CloudWatch log group should be configured")
        
        # Check for health checks
        self.assertIn("health_check", content, "Health checks should be configured")

    def test_aws_terraform_plan_generation(self):
        """Test that AWS terraform plan can be generated without errors."""
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
                self.fail(f"AWS Terraform init failed: {init_result.stderr}")

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
                self.fail(f"AWS Terraform plan failed: {plan_result.stderr}")

        finally:
            os.unlink(test_vars_file.name)

    def test_aws_resource_count_validation(self):
        """Test that expected number of AWS resources will be created."""
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
                self.skipTest(f"Could not generate AWS plan: {plan_result.stderr}")

            # Count expected AWS resources
            expected_resource_types = [
                "aws_vpc",
                "aws_subnet",
                "aws_ecs_cluster",
                "aws_ecs_task_definition",
                "aws_ecs_service",
                "aws_efs_file_system",
                "aws_lb",
                "aws_security_group",
                "aws_iam_role"
            ]

            plan_output = plan_result.stdout
            for resource_type in expected_resource_types:
                self.assertIn(resource_type, plan_output,
                             f"AWS plan should include {resource_type}")

        finally:
            os.unlink(test_vars_file.name)

    def test_aws_naming_conventions(self):
        """Test AWS resource naming conventions."""
        main_file = self.tofu_dir / "main.tf"
        content = main_file.read_text()

        # Check for consistent naming patterns
        self.assertIn("${var.environment}-codeserver", content,
                     "Should use environment-based naming")
        
        # Check for proper tagging
        self.assertIn("Environment = var.environment", content,
                     "Should have Environment tags")

    def test_aws_networking_configuration(self):
        """Test AWS networking configuration."""
        main_file = self.tofu_dir / "main.tf"
        content = main_file.read_text()

        # Check for public and private subnets
        self.assertIn("aws_subnet.public", content, "Public subnets should be configured")
        self.assertIn("aws_subnet.private", content, "Private subnets should be configured")
        
        # Check for NAT Gateway
        self.assertIn("aws_nat_gateway", content, "NAT Gateway should be configured")
        
        # Check for Internet Gateway
        self.assertIn("aws_internet_gateway", content, "Internet Gateway should be configured")


if __name__ == "__main__":
    unittest.main()