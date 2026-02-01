#!/usr/bin/env python3
"""
Deploy Comparison Environments Script

Sets up both AKS (dev) and Azure Functions (staging) for A/B testing.

Usage:
    python deploy_comparison_environments.py [deploy|validate|cleanup|help]
"""

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path


class Color:
    """ANSI color codes."""
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    NC = '\033[0m'


class ComparisonEnvironmentDeployer:
    """Handles deployment of comparison environments for A/B testing."""

    def __init__(self):
        self.aks_environment = "dev"
        self.functions_environment = "staging"
        self.resource_group_aks = "vibecode-dev-rg"
        self.resource_group_functions = "vibecode-staging-rg"
        self.cluster_name = "vibecode-dev-aks"
        self.function_app_name = "vibecode-docs-search-staging"

        self.aks_healthy = False
        self.functions_healthy = False

    def log(self, message: str) -> None:
        """Log message with timestamp."""
        import datetime
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"{Color.BLUE}[{timestamp}]{Color.NC} {message}")

    def error(self, message: str) -> None:
        """Log error message."""
        print(f"{Color.RED}[ERROR]{Color.NC} {message}")

    def success(self, message: str) -> None:
        """Log success message."""
        print(f"{Color.GREEN}[SUCCESS]{Color.NC} {message}")

    def warning(self, message: str) -> None:
        """Log warning message."""
        print(f"{Color.YELLOW}[WARNING]{Color.NC} {message}")

    def run_cmd(
        self,
        cmd: list[str],
        capture_output: bool = True,
    ) -> tuple[bool, str, str]:
        """Run command and return (success, stdout, stderr)."""
        try:
            result = subprocess.run(
                cmd,
                capture_output=capture_output,
                text=True,
            )
            return result.returncode == 0, result.stdout, result.stderr
        except Exception as e:
            return False, "", str(e)

    def check_prerequisites(self) -> bool:
        """Check prerequisites."""
        self.log("Checking prerequisites...")

        if not shutil.which("az"):
            self.error("Azure CLI is not installed. Please install it first.")
            return False

        if not shutil.which("kubectl"):
            self.error("kubectl is not installed. Please install it first.")
            return False

        if not shutil.which("tofu") and not shutil.which("terraform"):
            self.error("Neither OpenTofu nor Terraform is installed. Please install one.")
            return False

        success, _, _ = self.run_cmd(["az", "account", "show"])
        if not success:
            self.error("Not logged in to Azure. Please run 'az login' first.")
            return False

        if not shutil.which("node") or not shutil.which("npm"):
            self.error("Node.js and npm are required. Please install them first.")
            return False

        self.success("All prerequisites satisfied")
        return True

    def deploy_aks_environment(self) -> bool:
        """Deploy AKS environment (dev)."""
        self.log("Deploying AKS environment (dev)...")

        # Check if AKS cluster is configured
        success, stdout, _ = self.run_cmd(["kubectl", "config", "current-context"])
        if success and self.cluster_name in stdout:
            self.warning("AKS cluster already configured. Updating existing deployment...")

            os.chdir("helm/vibecode-platform")
            cmd = [
                "helm", "upgrade", "vibecode-dev", ".",
                "--namespace", "vibecode-dev",
                "--create-namespace",
                "--values", "values-dev.yaml",
                "--set", f"image.tag={os.environ.get('AKS_VERSION', 'latest')}",
                "--set", "environment=dev",
                "--set", "monitoring.datadog.enabled=true",
                "--timeout=10m",
            ]

            success, _, stderr = self.run_cmd(cmd)
            if success:
                self.success("AKS environment updated")
                return True
            else:
                self.error(f"AKS deployment failed: {stderr}")
                return False
        else:
            self.warning("AKS cluster not found. Please deploy AKS infrastructure first:")
            print("  cd infrastructure/terraform/azure")
            print("  tofu init && tofu apply")
            print(f"  az aks get-credentials --resource-group {self.resource_group_aks} --name {self.cluster_name}")
            print("Then run this script again.")
            return False

    def deploy_functions_environment(self) -> bool:
        """Deploy Azure Functions environment (staging)."""
        self.log("Deploying Azure Functions environment (staging)...")

        os.chdir("azure-functions")

        # Install dependencies
        self.run_cmd(["npm", "install"])

        # Build the functions
        self.run_cmd(["npm", "run", "build"])

        # Check if function app exists
        success, _, _ = self.run_cmd([
            "az", "functionapp", "show",
            "--name", self.function_app_name,
            "--resource-group", self.resource_group_functions,
        ])

        if success:
            self.warning("Function app already exists. Updating deployment...")
        else:
            self.log("Creating new function app...")

            # Create resource group
            self.run_cmd([
                "az", "group", "create",
                "--name", self.resource_group_functions,
                "--location", "East US 2",
            ])

            # Create storage account
            storage_account = f"{self.function_app_name}storage"[:24]
            self.run_cmd([
                "az", "storage", "account", "create",
                "--name", storage_account,
                "--location", "East US 2",
                "--resource-group", self.resource_group_functions,
                "--sku", "Standard_LRS",
                "--kind", "StorageV2",
            ])

            # Create function app
            self.run_cmd([
                "az", "functionapp", "create",
                "--name", self.function_app_name,
                "--storage-account", storage_account,
                "--consumption-plan-location", "East US 2",
                "--resource-group", self.resource_group_functions,
                "--runtime", "node",
                "--runtime-version", "18",
                "--functions-version", "4",
                "--tags", "Environment=staging", "Purpose=ab-testing",
            ])

        # Configure environment variables
        self.log("Configuring function app settings...")
        settings = [
            "DD_SITE=datadoghq.com",
            "DD_SERVICE=vibecode-docs-search-staging",
            "DD_ENV=staging",
            f"DD_VERSION={os.environ.get('FUNCTIONS_VERSION', '1.0.0')}",
            "DD_LOGS_ENABLED=true",
            "DD_TRACE_ENABLED=true",
            f"DATABASE_URL={os.environ.get('DATABASE_URL', '')}",
            f"AZURE_OPENAI_API_KEY={os.environ.get('AZURE_OPENAI_API_KEY', '')}",
            f"AZURE_OPENAI_ENDPOINT={os.environ.get('AZURE_OPENAI_ENDPOINT', '')}",
            f"EMBEDDINGS_DEPLOYMENT_NAME={os.environ.get('EMBEDDINGS_DEPLOYMENT_NAME', 'text-embedding-ada-002')}",
            f"DD_API_KEY={os.environ.get('DD_API_KEY', '')}",
        ]

        self.run_cmd([
            "az", "webapp", "config", "appsettings", "set",
            "--name", self.function_app_name,
            "--resource-group", self.resource_group_functions,
            "--settings", *settings,
        ])

        # Deploy functions
        self.log("Deploying functions...")
        self.run_cmd(["func", "azure", "functionapp", "publish", self.function_app_name, "--typescript"])

        self.success("Azure Functions environment deployed")
        os.chdir("..")
        return True

    def validate_deployments(self) -> bool:
        """Validate deployments."""
        self.log("Validating deployments...")

        # Test AKS deployment
        self.log("Testing AKS deployment...")
        aks_url = os.environ.get("AKS_BASE_URL", "http://localhost:3000")

        success, _, _ = self.run_cmd([
            "curl", "-f", f"{aks_url}/api/health", "--max-time", "10",
        ])
        if success:
            self.success("AKS deployment is healthy")
            self.aks_healthy = True
        else:
            self.warning("AKS deployment health check failed")
            self.aks_healthy = False

        # Test Azure Functions deployment
        self.log("Testing Azure Functions deployment...")
        functions_url = f"https://{self.function_app_name}.azurewebsites.net"

        self.log("Waiting for function app to be ready...")
        import time
        time.sleep(30)

        success, _, _ = self.run_cmd([
            "curl", "-f", f"{functions_url}/api/health", "--max-time", "30",
        ])
        if success:
            self.success("Azure Functions deployment is healthy")
            self.functions_healthy = True
        else:
            self.warning("Azure Functions deployment health check failed")
            self.functions_healthy = False

        # Summary
        print()
        self.log("Deployment Validation Summary:")
        print(f"  AKS (dev): {self.aks_healthy}")
        print(f"  Azure Functions (staging): {self.functions_healthy}")

        if self.aks_healthy and self.functions_healthy:
            self.success("Both environments are ready for A/B testing!")
            return True
        elif self.aks_healthy or self.functions_healthy:
            self.warning("One environment is ready. A/B testing can proceed with available environment.")
            return True
        else:
            self.error("No environments are healthy. Please check deployments.")
            return False

    def setup_test_environment(self) -> None:
        """Setup environment variables for testing."""
        self.log("Setting up test environment variables...")

        env_content = f"""# A/B Testing Environment Configuration
# Generated: {__import__('datetime').datetime.now()}

# AKS Environment (Dev)
AKS_BASE_URL={os.environ.get('AKS_BASE_URL', 'http://localhost:3000')}
AKS_VERSION={os.environ.get('AKS_VERSION', 'current')}
AKS_HEALTHY={str(self.aks_healthy).lower()}

# Azure Functions Environment (Staging)
FUNCTIONS_BASE_URL=https://{self.function_app_name}.azurewebsites.net
FUNCTIONS_VERSION={os.environ.get('FUNCTIONS_VERSION', '1.0.0')}
FUNCTIONS_HEALTHY={str(self.functions_healthy).lower()}

# Database Configuration
DATABASE_URL={os.environ.get('DATABASE_URL', '')}

# Azure OpenAI Configuration
AZURE_OPENAI_API_KEY={os.environ.get('AZURE_OPENAI_API_KEY', '')}
AZURE_OPENAI_ENDPOINT={os.environ.get('AZURE_OPENAI_ENDPOINT', '')}
EMBEDDINGS_DEPLOYMENT_NAME={os.environ.get('EMBEDDINGS_DEPLOYMENT_NAME', 'text-embedding-ada-002')}

# Datadog Configuration
DD_API_KEY={os.environ.get('DD_API_KEY', '')}
DD_SITE=datadoghq.com

# Test Configuration
NODE_ENV=test
AB_TESTING_ENABLED=true
"""

        with open(".env.ab-testing", "w") as f:
            f.write(env_content)

        self.success("Test environment configuration saved to .env.ab-testing")

        print()
        self.log("Next Steps:")
        print("1. Review and update .env.ab-testing with your actual values")
        print("2. Run A/B testing suite:")
        print("   npm run test:ab-compare")
        print("   # OR")
        print("   npx ts-node tests/performance/run-ab-test.ts")
        print()
        print("3. View results in tests/performance/results/")
        print()
        print("4. For continuous monitoring:")
        print("   npx ts-node tests/performance/run-ab-test.ts --monitor=30 --auto-rollback")

    def run(self, command: str) -> int:
        """Run the specified command."""
        if command == "deploy":
            print("🚀 Deploying Comparison Environments for A/B Testing")
            print("==================================================")

            if not self.check_prerequisites():
                return 1

            self.log("Deploying environments in parallel...")

            if self.deploy_aks_environment():
                self.success("AKS environment deployment completed")
            else:
                self.warning("AKS environment deployment had issues")

            if self.deploy_functions_environment():
                self.success("Azure Functions environment deployment completed")
            else:
                self.warning("Azure Functions environment deployment had issues")

            self.validate_deployments()
            self.setup_test_environment()

            self.success("Comparison environments deployment completed!")
            self.log("Ready for A/B testing between AKS (dev) and Azure Functions (staging)")
            return 0

        elif command == "validate":
            return 0 if self.validate_deployments() else 1

        elif command == "cleanup":
            self.log("Cleaning up test environments...")
            self.warning("Cleanup not implemented yet. Please clean up manually.")
            return 0

        elif command == "help":
            self.show_usage()
            return 0

        else:
            self.error(f"Unknown command: {command}")
            self.show_usage()
            return 1

    def show_usage(self) -> None:
        """Show usage information."""
        print("Usage: deploy_comparison_environments.py [deploy|validate|cleanup|help]")
        print()
        print("Commands:")
        print("  deploy   - Deploy both AKS and Azure Functions environments (default)")
        print("  validate - Validate existing deployments")
        print("  cleanup  - Clean up test environments")
        print("  help     - Show this help message")


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Deploy Comparison Environments for A/B Testing",
    )
    parser.add_argument(
        "command",
        nargs="?",
        default="deploy",
        choices=["deploy", "validate", "cleanup", "help"],
        help="Command to execute",
    )

    args = parser.parse_args()

    deployer = ComparisonEnvironmentDeployer()
    return deployer.run(args.command)


if __name__ == "__main__":
    sys.exit(main())
