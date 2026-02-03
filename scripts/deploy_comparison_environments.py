#!/usr/bin/env python3
"""Deploy Comparison Environments Script.

Sets up both AKS (dev) and Azure Functions (staging) for A/B testing.
"""

import argparse
import os
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Optional
from urllib.error import URLError
from urllib.request import urlopen

# Colors for output
RED = '\033[0;31m'
GREEN = '\033[0;32m'
YELLOW = '\033[1;33m'
BLUE = '\033[0;34m'
NC = '\033[0m'


@dataclass
class DeploymentConfig:
    """Deployment configuration."""

    aks_environment: str = "dev"
    functions_environment: str = "staging"
    resource_group_aks: str = "vibecode-dev-rg"
    resource_group_functions: str = "vibecode-staging-rg"
    cluster_name: str = "vibecode-dev-aks"
    function_app_name: str = "vibecode-docs-search-staging"
    aks_version: str = "latest"
    functions_version: str = "1.0.0"
    location: str = "East US 2"


@dataclass
class DeploymentStatus:
    """Deployment status tracking."""

    aks_healthy: bool = False
    functions_healthy: bool = False
    aks_url: str = ""
    functions_url: str = ""


def log(message: str) -> None:
    """Print log message with timestamp."""
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    print(f"{BLUE}[{timestamp}]{NC} {message}")


def error(message: str) -> None:
    """Print error message."""
    print(f"{RED}[ERROR]{NC} {message}")


def success(message: str) -> None:
    """Print success message."""
    print(f"{GREEN}[SUCCESS]{NC} {message}")


def warning(message: str) -> None:
    """Print warning message."""
    print(f"{YELLOW}[WARNING]{NC} {message}")


def command_exists(cmd: str) -> bool:
    """Check if a command exists."""
    return shutil.which(cmd) is not None


def run_command(
    cmd: list[str],
    check: bool = False,
    capture: bool = True,
    cwd: Optional[Path] = None
) -> tuple[int, str, str]:
    """Run a command and return result."""
    try:
        result = subprocess.run(
            cmd,
            capture_output=capture,
            text=True,
            check=check,
            cwd=cwd
        )
        return result.returncode, result.stdout, result.stderr
    except subprocess.CalledProcessError as e:
        return e.returncode, e.stdout or "", e.stderr or ""
    except FileNotFoundError:
        return -1, "", "command not found"


def check_url_health(url: str, timeout: int = 10) -> bool:
    """Check if a URL responds successfully."""
    try:
        with urlopen(url, timeout=timeout) as response:
            return response.status == 200
    except (URLError, TimeoutError, Exception):
        return False


def check_prerequisites() -> bool:
    """Check all prerequisites are installed.

    Returns:
        True if all prerequisites are met.
    """
    log("Checking prerequisites...")

    # Check Azure CLI
    if not command_exists("az"):
        error("Azure CLI is not installed. Please install it first.")
        return False

    # Check kubectl
    if not command_exists("kubectl"):
        error("kubectl is not installed. Please install it first.")
        return False

    # Check OpenTofu/Terraform
    if not command_exists("tofu") and not command_exists("terraform"):
        error("Neither OpenTofu nor Terraform is installed. Please install one.")
        return False

    # Check Azure login
    rc, _, _ = run_command(["az", "account", "show"])
    if rc != 0:
        error("Not logged in to Azure. Please run 'az login' first.")
        return False

    # Check Node.js and npm
    if not command_exists("node") or not command_exists("npm"):
        error("Node.js and npm are required. Please install them first.")
        return False

    success("All prerequisites satisfied")
    return True


def deploy_aks_environment(config: DeploymentConfig) -> bool:
    """Deploy AKS environment (dev).

    Args:
        config: Deployment configuration.

    Returns:
        True if successful.
    """
    log("Deploying AKS environment (dev)...")

    # Check if we have existing AKS deployment
    rc, stdout, _ = run_command(["kubectl", "config", "current-context"])
    if rc == 0 and config.cluster_name in stdout:
        warning("AKS cluster already configured. Updating existing deployment...")

        # Update the existing deployment
        helm_dir = Path("helm/vibecode-platform")
        if not helm_dir.exists():
            warning(f"Helm chart directory not found: {helm_dir}")
            return False

        rc, _, stderr = run_command([
            "helm", "upgrade", "vibecode-dev", ".",
            "--namespace", "vibecode-dev",
            "--create-namespace",
            "--values", "values-dev.yaml",
            "--set", f"image.tag={config.aks_version}",
            "--set", "environment=dev",
            "--set", "monitoring.datadog.enabled=true",
            "--timeout=10m"
        ], cwd=helm_dir)

        if rc != 0:
            error(f"Helm upgrade failed: {stderr}")
            return False

        success("AKS environment updated")
        return True
    else:
        warning("AKS cluster not found. Please deploy AKS infrastructure first:")
        print("  cd infrastructure/terraform/azure")
        print("  tofu init && tofu apply")
        print(f"  az aks get-credentials --resource-group {config.resource_group_aks} --name {config.cluster_name}")
        print("Then run this script again.")
        return False


def deploy_functions_environment(config: DeploymentConfig) -> bool:
    """Deploy Azure Functions environment (staging).

    Args:
        config: Deployment configuration.

    Returns:
        True if successful.
    """
    log("Deploying Azure Functions environment (staging)...")

    functions_dir = Path("azure-functions")
    if not functions_dir.exists():
        warning(f"Azure Functions directory not found: {functions_dir}")
        return False

    # Install dependencies
    rc, _, stderr = run_command(["npm", "install"], cwd=functions_dir)
    if rc != 0:
        error(f"npm install failed: {stderr}")
        return False

    # Build the functions
    rc, _, stderr = run_command(["npm", "run", "build"], cwd=functions_dir)
    if rc != 0:
        error(f"npm run build failed: {stderr}")
        return False

    # Check if function app exists
    rc, _, _ = run_command([
        "az", "functionapp", "show",
        "--name", config.function_app_name,
        "--resource-group", config.resource_group_functions
    ])

    if rc == 0:
        warning("Function app already exists. Updating deployment...")
    else:
        log("Creating new function app...")

        # Create resource group if it doesn't exist
        run_command([
            "az", "group", "create",
            "--name", config.resource_group_functions,
            "--location", config.location
        ])

        # Create storage account
        storage_account = f"{config.function_app_name}storage"[:24]  # Max 24 chars
        run_command([
            "az", "storage", "account", "create",
            "--name", storage_account,
            "--location", config.location,
            "--resource-group", config.resource_group_functions,
            "--sku", "Standard_LRS",
            "--kind", "StorageV2"
        ])

        # Create function app
        rc, _, stderr = run_command([
            "az", "functionapp", "create",
            "--name", config.function_app_name,
            "--storage-account", storage_account,
            "--consumption-plan-location", config.location,
            "--resource-group", config.resource_group_functions,
            "--runtime", "node",
            "--runtime-version", "18",
            "--functions-version", "4",
            "--tags", "Environment=staging", "Purpose=ab-testing"
        ])

        if rc != 0:
            error(f"Function app creation failed: {stderr}")
            return False

    # Configure environment variables
    log("Configuring function app settings...")
    settings = [
        "DD_SITE=datadoghq.com",
        "DD_SERVICE=vibecode-docs-search-staging",
        "DD_ENV=staging",
        f"DD_VERSION={config.functions_version}",
        "DD_LOGS_ENABLED=true",
        "DD_TRACE_ENABLED=true",
        f"DATABASE_URL={os.environ.get('DATABASE_URL', '')}",
        f"AZURE_OPENAI_API_KEY={os.environ.get('AZURE_OPENAI_API_KEY', '')}",
        f"AZURE_OPENAI_ENDPOINT={os.environ.get('AZURE_OPENAI_ENDPOINT', '')}",
        f"EMBEDDINGS_DEPLOYMENT_NAME={os.environ.get('EMBEDDINGS_DEPLOYMENT_NAME', 'text-embedding-ada-002')}",
        f"DD_API_KEY={os.environ.get('DD_API_KEY', '')}"
    ]

    run_command([
        "az", "functionapp", "config", "appsettings", "set",
        "--name", config.function_app_name,
        "--resource-group", config.resource_group_functions,
        "--settings"
    ] + settings)

    # Deploy functions
    log("Deploying functions...")
    if command_exists("func"):
        rc, _, stderr = run_command([
            "func", "azure", "functionapp", "publish",
            config.function_app_name, "--typescript"
        ], cwd=functions_dir)

        if rc != 0:
            error(f"Function deployment failed: {stderr}")
            return False

    success("Azure Functions environment deployed")
    return True


def validate_deployments(config: DeploymentConfig) -> DeploymentStatus:
    """Validate deployments are healthy.

    Args:
        config: Deployment configuration.

    Returns:
        DeploymentStatus with health check results.
    """
    log("Validating deployments...")
    status = DeploymentStatus()

    # Test AKS deployment
    log("Testing AKS deployment...")
    aks_url = os.environ.get("AKS_BASE_URL", "http://localhost:3000")
    status.aks_url = aks_url

    if check_url_health(f"{aks_url}/api/health"):
        success("AKS deployment is healthy")
        status.aks_healthy = True
    else:
        warning("AKS deployment health check failed")

    # Test Azure Functions deployment
    log("Testing Azure Functions deployment...")
    functions_url = f"https://{config.function_app_name}.azurewebsites.net"
    status.functions_url = functions_url

    # Wait for function app to be ready
    log("Waiting for function app to be ready...")
    time.sleep(30)

    if check_url_health(f"{functions_url}/api/health", timeout=30):
        success("Azure Functions deployment is healthy")
        status.functions_healthy = True
    else:
        warning("Azure Functions deployment health check failed")

    # Summary
    print()
    log("Deployment Validation Summary:")
    print(f"  AKS (dev): {status.aks_healthy}")
    print(f"  Azure Functions (staging): {status.functions_healthy}")

    if status.aks_healthy and status.functions_healthy:
        success("Both environments are ready for A/B testing!")
    elif status.aks_healthy or status.functions_healthy:
        warning("One environment is ready. A/B testing can proceed with available environment.")
    else:
        error("No environments are healthy. Please check deployments.")

    return status


def setup_test_environment(config: DeploymentConfig, status: DeploymentStatus) -> None:
    """Setup environment variables for testing.

    Args:
        config: Deployment configuration.
        status: Deployment status.
    """
    log("Setting up test environment variables...")

    env_content = f"""# A/B Testing Environment Configuration
# Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

# AKS Environment (Dev)
AKS_BASE_URL={status.aks_url or 'http://localhost:3000'}
AKS_VERSION={config.aks_version}
AKS_HEALTHY={str(status.aks_healthy).lower()}

# Azure Functions Environment (Staging)
FUNCTIONS_BASE_URL={status.functions_url}
FUNCTIONS_VERSION={config.functions_version}
FUNCTIONS_HEALTHY={str(status.functions_healthy).lower()}

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

    Path(".env.ab-testing").write_text(env_content)
    success("Test environment configuration saved to .env.ab-testing")

    # Display next steps
    print()
    log("Next Steps:")
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


def deploy(config: DeploymentConfig) -> int:
    """Run full deployment.

    Args:
        config: Deployment configuration.

    Returns:
        Exit code.
    """
    log("Starting comparison environment deployment...")

    if not check_prerequisites():
        return 1

    log("Deploying environments...")

    # Deploy AKS environment
    if deploy_aks_environment(config):
        success("AKS environment deployment completed")
    else:
        warning("AKS environment deployment had issues")

    # Deploy Azure Functions environment
    if deploy_functions_environment(config):
        success("Azure Functions environment deployment completed")
    else:
        warning("Azure Functions environment deployment had issues")

    # Validate deployments
    status = validate_deployments(config)

    # Setup test environment
    setup_test_environment(config, status)

    success("Comparison environments deployment completed!")
    log("Ready for A/B testing between AKS (dev) and Azure Functions (staging)")

    return 0


def main() -> int:
    """Main entry point.

    Returns:
        Exit code.
    """
    print("🚀 Deploying Comparison Environments for A/B Testing")
    print("=" * 50)

    parser = argparse.ArgumentParser(
        description="Deploy comparison environments for A/B testing"
    )
    parser.add_argument(
        'command',
        nargs='?',
        default='deploy',
        choices=['deploy', 'validate', 'cleanup', 'help'],
        help='Command to run (default: deploy)'
    )
    parser.add_argument(
        '--aks-version',
        default='latest',
        help='AKS deployment version'
    )
    parser.add_argument(
        '--functions-version',
        default='1.0.0',
        help='Azure Functions version'
    )

    args = parser.parse_args()

    config = DeploymentConfig(
        aks_version=args.aks_version,
        functions_version=args.functions_version
    )

    if args.command == 'deploy':
        return deploy(config)
    elif args.command == 'validate':
        status = validate_deployments(config)
        return 0 if (status.aks_healthy or status.functions_healthy) else 1
    elif args.command == 'cleanup':
        log("Cleaning up test environments...")
        warning("Cleanup not implemented yet. Please clean up manually.")
        return 0
    elif args.command == 'help':
        print()
        print("Usage: deploy_comparison_environments.py [deploy|validate|cleanup|help]")
        print()
        print("Commands:")
        print("  deploy   - Deploy both AKS and Azure Functions environments (default)")
        print("  validate - Validate existing deployments")
        print("  cleanup  - Clean up test environments")
        print("  help     - Show this help message")
        return 0

    return 0


if __name__ == "__main__":
    sys.exit(main())
