#!/usr/bin/env python3
"""
Deploy Datadog Database Monitoring configuration.

Usage:
    python deploy_datadog_dbm.py <database_password>
"""

import argparse
import base64
import subprocess
import sys
from pathlib import Path


class DatadogDBMDeployer:
    """Handles Datadog Database Monitoring deployment."""

    def __init__(self, db_password: str, namespace: str = "vibecode"):
        self.db_password = db_password
        self.namespace = namespace

    def run_cmd(self, cmd: list[str]) -> tuple[bool, str, str]:
        """Run command and return (success, stdout, stderr)."""
        try:
            result = subprocess.run(cmd, capture_output=True, text=True)
            return result.returncode == 0, result.stdout, result.stderr
        except Exception as e:
            return False, "", str(e)

    def setup_directories(self) -> None:
        """Create Kubernetes directory if it doesn't exist."""
        Path("kubernetes/datadog").mkdir(parents=True, exist_ok=True)

    def update_secret(self) -> None:
        """Update the secret with the provided password."""
        encoded_password = base64.b64encode(self.db_password.encode()).decode()
        secret_file = Path("kubernetes/datadog/datadog-db-secret.yaml")

        if secret_file.exists():
            content = secret_file.read_text()
            content = content.replace('password: ""', f'password: "{encoded_password}"')
            secret_file.write_text(content)

    def apply_configuration(self) -> bool:
        """Apply the ConfigMap and Secret."""
        print("🔧 Applying Datadog DBM configuration...")

        config_file = Path("kubernetes/datadog/datadog-dbm-config.yaml")
        secret_file = Path("kubernetes/datadog/datadog-db-secret.yaml")

        if config_file.exists():
            success, _, stderr = self.run_cmd([
                "kubectl", "apply", "-f", str(config_file),
                "-n", self.namespace,
            ])
            if not success:
                print(f"Failed to apply config: {stderr}")
                return False

        if secret_file.exists():
            success, _, stderr = self.run_cmd([
                "kubectl", "apply", "-f", str(secret_file),
                "-n", self.namespace,
            ])
            if not success:
                print(f"Failed to apply secret: {stderr}")
                return False

        return True

    def restart_agents(self) -> bool:
        """Restart Datadog agent to apply configuration changes."""
        print("🔄 Restarting Datadog agent...")

        self.run_cmd([
            "kubectl", "rollout", "restart",
            "deployment/datadog-cluster-agent",
            "-n", self.namespace,
        ])

        self.run_cmd([
            "kubectl", "rollout", "restart",
            "daemonset/datadog",
            "-n", self.namespace,
        ])

        return True

    def run(self) -> int:
        """Run the deployment."""
        self.setup_directories()
        self.update_secret()

        if not self.apply_configuration():
            return 1

        if not self.restart_agents():
            return 1

        print("✅ Datadog DBM configuration deployed successfully!")
        print("📊 Monitor your database in the Datadog dashboard: https://app.datadoghq.com/databases")

        return 0


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Deploy Datadog Database Monitoring configuration",
    )
    parser.add_argument(
        "db_password",
        help="Database password",
    )
    parser.add_argument(
        "--namespace",
        default="vibecode",
        help="Kubernetes namespace",
    )

    args = parser.parse_args()

    deployer = DatadogDBMDeployer(
        db_password=args.db_password,
        namespace=args.namespace,
    )

    return deployer.run()


if __name__ == "__main__":
    sys.exit(main())
