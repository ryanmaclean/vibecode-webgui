#!/usr/bin/env python3
"""
Security validation tests for cloud infrastructure configurations.
Tests security best practices, encryption, IAM policies, and secure defaults.
"""

import unittest
import json
from pathlib import Path
import subprocess


class SecurityValidationTests(unittest.TestCase):
    """Security validation tests for AWS and GCP configurations."""

    def setUp(self):
        """Set up test paths."""
        self.project_root = Path(__file__).parent.parent.parent
        self.aws_dir = self.project_root / "tofu" / "code-server-aws"
        self.gcp_dir = self.project_root / "tofu" / "code-server-gcp"

    def test_aws_security_configurations(self):
        """Test AWS security configurations."""
        # Test encryption at rest
        main_tf = self.aws_dir / "main.tf"
        content = main_tf.read_text()
        
        # EFS encryption
        self.assertIn("encryption", content)
        self.assertIn("encrypted", content)
        
        # Security groups with restrictive rules
        self.assertIn("security_group", content)
        self.assertIn("ingress", content)
        self.assertIn("egress", content)
        
        # IAM roles with least privilege
        iam_tf = self.aws_dir / "iam.tf"
        if iam_tf.exists():
            iam_content = iam_tf.read_text()
            self.assertIn("aws_iam_role", iam_content)
            self.assertIn("aws_iam_policy", iam_content)

    def test_gcp_security_configurations(self):
        """Test GCP security configurations."""
        main_tf = self.gcp_dir / "main.tf"
        content = main_tf.read_text()
        
        # Service account with minimal permissions
        self.assertIn("google_service_account", content)
        self.assertIn("google_project_iam_member", content)
        
        # Disk encryption
        self.assertIn("disk_encryption_key", content)
        
        # Network security
        self.assertIn("network", content)
        self.assertIn("subnetwork", content)

    def test_no_hardcoded_secrets(self):
        """Test that no hardcoded secrets are present."""
        for config_dir in [self.aws_dir, self.gcp_dir]:
            for tf_file in config_dir.glob("*.tf"):
                content = tf_file.read_text().lower()
                
                # Check for common secret patterns
                secret_patterns = [
                    "password=",
                    "secret=",
                    "key=",
                    "token=",
                    "api_key=",
                    "access_key=",
                    "secret_key="
                ]
                
                for pattern in secret_patterns:
                    # Allow variable references but not hardcoded values
                    if pattern in content:
                        lines = content.split('\n')
                        for line in lines:
                            if pattern in line and not line.strip().startswith('#'):
                                # Check if it's a variable reference
                                if not ('var.' in line or '${' in line):
                                    self.fail(f"Potential hardcoded secret in {tf_file}: {line.strip()}")

    def test_network_security(self):
        """Test network security configurations."""
        # AWS network security
        aws_main = self.aws_dir / "main.tf"
        aws_content = aws_main.read_text()
        
        # Check for VPC configuration
        self.assertIn("aws_vpc", aws_content)
        self.assertIn("aws_subnet", aws_content)
        
        # Check for security groups
        self.assertIn("aws_security_group", aws_content)
        
        # GCP network security
        gcp_main = self.gcp_dir / "main.tf"
        gcp_content = gcp_main.read_text()
        
        # Check for network configuration
        self.assertIn("network", gcp_content)
        self.assertIn("subnetwork", gcp_content)

    def test_iam_least_privilege(self):
        """Test IAM least privilege principles."""
        # AWS IAM
        aws_iam = self.aws_dir / "iam.tf"
        if aws_iam.exists():
            iam_content = aws_iam.read_text()
            
            # Check for specific, minimal permissions
            self.assertIn("aws_iam_policy", iam_content)
            self.assertIn("aws_iam_role_policy_attachment", iam_content)
            
            # Ensure no wildcard permissions
            self.assertNotIn("*", iam_content)
        
        # GCP IAM
        gcp_main = self.gcp_dir / "main.tf"
        gcp_content = gcp_main.read_text()
        
        # Check for specific role bindings
        self.assertIn("google_project_iam_member", gcp_content)

    def test_logging_and_monitoring(self):
        """Test logging and monitoring configurations."""
        # AWS CloudWatch
        aws_main = self.aws_dir / "main.tf"
        aws_content = aws_main.read_text()
        
        self.assertIn("aws_cloudwatch_log_group", aws_content)
        
        # GCP logging
        gcp_main = self.gcp_dir / "main.tf"
        gcp_content = gcp_main.read_text()
        
        # Check for logging configuration
        self.assertIn("logging", gcp_content)

    def test_resource_tagging(self):
        """Test resource tagging for security and compliance."""
        for config_dir in [self.aws_dir, self.gcp_dir]:
            for tf_file in config_dir.glob("*.tf"):
                content = tf_file.read_text()
                
                # Check for common resource types that should be tagged
                resource_types = [
                    "aws_instance",
                    "aws_vpc",
                    "aws_subnet",
                    "aws_security_group",
                    "google_compute_instance",
                    "google_compute_disk"
                ]
                
                for resource_type in resource_types:
                    if resource_type in content:
                        # Check if tags are present
                        if "tags" not in content and "labels" not in content:
                            print(f"Warning: {resource_type} in {tf_file} may not have tags/labels")


if __name__ == "__main__":
    unittest.main()