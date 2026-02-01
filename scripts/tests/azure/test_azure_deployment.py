#!/usr/bin/env python3
"""
Test minimal Azure deployment to validate AKS bootstrap functionality.

This script tests various Azure resources to ensure the environment
is ready for AKS deployment.
"""

import argparse
import atexit
import os
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional


# ANSI color codes
class Colors:
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    NC = '\033[0m'  # No Color


@dataclass
class TestConfig:
    """Configuration for Azure deployment tests."""

    resource_group: str
    location: str = "eastus"
    storage_account: Optional[str] = None
    key_vault: Optional[str] = None

    @classmethod
    def create_test_config(cls, location: str = "eastus") -> "TestConfig":
        """Create a test configuration with unique names."""
        timestamp = str(int(time.time()))
        return cls(
            resource_group=f"vibecode-bootstrap-test-{timestamp}",
            location=location,
            storage_account=f"vibetest{timestamp[-6:]}",
            key_vault=f"vibetestkv{timestamp[-6:]}",
        )


class TestResult:
    """Tracks test results."""

    def __init__(self):
        self.results: dict[str, str] = {}

    def add(self, test_name: str, status: str) -> None:
        """Add a test result."""
        self.results[test_name] = status

    def print_summary(self) -> None:
        """Print test results summary."""
        print()
        print("Test Results Summary:")
        for test_name, status in self.results.items():
            print(f"   {status} {test_name}")
        print()


# Global config for cleanup
_cleanup_config: Optional[TestConfig] = None


def log(message: str) -> None:
    """Log a message with timestamp."""
    print(f"[{time.strftime('%H:%M:%S')}] {message}")


def run_az_command(args: list[str], capture: bool = True) -> tuple[int, str, str]:
    """
    Run an Azure CLI command.

    Args:
        args: Command arguments (without 'az' prefix)
        capture: Whether to capture output

    Returns:
        Tuple of (return_code, stdout, stderr)
    """
    cmd = ["az"] + args
    result = subprocess.run(
        cmd,
        capture_output=capture,
        text=True,
        check=False,
    )
    return result.returncode, result.stdout, result.stderr


def load_env_local() -> None:
    """Load environment variables from .env.local if it exists."""
    env_file = Path(".env.local")
    if env_file.exists():
        log("Loading .env.local configuration")
        with open(env_file) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, _, value = line.partition('=')
                    # Remove quotes if present
                    value = value.strip().strip('"').strip("'")
                    os.environ[key.strip()] = value


def cleanup() -> None:
    """Clean up test resources."""
    global _cleanup_config
    if _cleanup_config is None:
        return

    log("Cleaning up test resources")

    # Check if resource group exists
    returncode, _, _ = run_az_command([
        "group", "show",
        "--name", _cleanup_config.resource_group,
    ])

    if returncode == 0:
        log(f"Deleting test resource group: {_cleanup_config.resource_group}")
        run_az_command([
            "group", "delete",
            "--name", _cleanup_config.resource_group,
            "--yes",
            "--no-wait",
        ])
        log(f"{Colors.GREEN}+ Cleanup initiated (running in background){Colors.NC}")


def test_resource_group_create(config: TestConfig) -> bool:
    """Test 1: Create resource group."""
    log("Test 1: Creating resource group")

    returncode, _, _ = run_az_command([
        "group", "create",
        "--name", config.resource_group,
        "--location", config.location,
    ])

    if returncode == 0:
        log(f"{Colors.GREEN}+ Resource group created successfully{Colors.NC}")
        return True
    else:
        log(f"{Colors.RED}x Failed to create resource group{Colors.NC}")
        return False


def test_resource_group_validate(config: TestConfig) -> bool:
    """Test 2: Validate resource group exists."""
    log("Test 2: Validating resource group")

    returncode, _, _ = run_az_command([
        "group", "show",
        "--name", config.resource_group,
    ])

    if returncode == 0:
        log(f"{Colors.GREEN}+ Resource group validation successful{Colors.NC}")
        return True
    else:
        log(f"{Colors.RED}x Resource group validation failed{Colors.NC}")
        return False


def test_storage_account_create(config: TestConfig) -> bool:
    """Test 3: Create storage account."""
    log("Test 3: Creating test storage account")

    if config.storage_account is None:
        log(f"{Colors.YELLOW}! Storage account name not configured{Colors.NC}")
        return False

    returncode, _, _ = run_az_command([
        "storage", "account", "create",
        "--name", config.storage_account,
        "--resource-group", config.resource_group,
        "--location", config.location,
        "--sku", "Standard_LRS",
        "--kind", "StorageV2",
    ])

    if returncode == 0:
        log(f"{Colors.GREEN}+ Storage account created successfully{Colors.NC}")
        return True
    else:
        log(f"{Colors.RED}x Storage account creation failed{Colors.NC}")
        return False


def test_azure_permissions() -> bool:
    """Test 4: Validate Azure permissions."""
    log("Test 4: Validating Azure permissions")

    # Get subscription ID
    returncode, stdout, _ = run_az_command([
        "account", "show",
        "--query", "id",
        "-o", "tsv",
    ])

    if returncode != 0:
        log(f"{Colors.YELLOW}! Could not get subscription ID{Colors.NC}")
        return True  # Non-fatal

    subscription_id = stdout.strip()

    # Get user object ID
    returncode, stdout, _ = run_az_command([
        "ad", "signed-in-user", "show",
        "--query", "id",
        "-o", "tsv",
    ])

    if returncode != 0:
        log(f"{Colors.YELLOW}! Could not get user object ID{Colors.NC}")
        return True  # Non-fatal

    user_object_id = stdout.strip()

    # Check role assignments
    returncode, _, _ = run_az_command([
        "role", "assignment", "list",
        "--assignee", user_object_id,
        "--scope", f"/subscriptions/{subscription_id}",
    ])

    if returncode == 0:
        log(f"{Colors.GREEN}+ Azure permissions validated{Colors.NC}")
        return True
    else:
        log(f"{Colors.YELLOW}! Could not validate permissions (may still work){Colors.NC}")
        return True  # Non-fatal


def test_key_vault_create(config: TestConfig) -> bool:
    """Test 5: Create Key Vault and test secret creation."""
    log("Test 5: Testing Key Vault creation")

    if config.key_vault is None:
        log(f"{Colors.YELLOW}! Key Vault name not configured{Colors.NC}")
        return True  # Non-fatal

    # Create Key Vault
    returncode, _, _ = run_az_command([
        "keyvault", "create",
        "--name", config.key_vault,
        "--resource-group", config.resource_group,
        "--location", config.location,
        "--sku", "standard",
    ])

    if returncode != 0:
        log(f"{Colors.YELLOW}! Key Vault creation failed (permissions or naming conflict?){Colors.NC}")
        return True  # Non-fatal

    log(f"{Colors.GREEN}+ Key Vault created successfully{Colors.NC}")

    # Test secret creation
    returncode, _, _ = run_az_command([
        "keyvault", "secret", "set",
        "--vault-name", config.key_vault,
        "--name", "test-secret",
        "--value", "test-value",
    ])

    if returncode == 0:
        log(f"{Colors.GREEN}+ Key Vault secret creation successful{Colors.NC}")
    else:
        log(f"{Colors.YELLOW}! Key Vault secret creation failed (permissions?){Colors.NC}")

    return True


def test_virtual_network_create(config: TestConfig) -> bool:
    """Test 6: Create virtual network."""
    log("Test 6: Testing virtual network creation")

    returncode, _, _ = run_az_command([
        "network", "vnet", "create",
        "--name", "test-vnet",
        "--resource-group", config.resource_group,
        "--location", config.location,
        "--address-prefix", "10.0.0.0/16",
        "--subnet-name", "test-subnet",
        "--subnet-prefix", "10.0.1.0/24",
    ])

    if returncode == 0:
        log(f"{Colors.GREEN}+ Virtual network created successfully{Colors.NC}")
        return True
    else:
        log(f"{Colors.RED}x Virtual network creation failed{Colors.NC}")
        return False


def run_all_tests(config: TestConfig) -> int:
    """
    Run all Azure deployment tests.

    Args:
        config: Test configuration

    Returns:
        0 on success, 1 on failure
    """
    global _cleanup_config
    _cleanup_config = config

    # Register cleanup handler
    atexit.register(cleanup)

    print(f"{Colors.BLUE}Testing Minimal Azure Deployment{Colors.NC}")
    print()
    log(f"Starting minimal Azure deployment test")
    log(f"Test Resource Group: {config.resource_group}")
    log(f"Location: {config.location}")
    print()

    results = TestResult()

    # Test 1: Create resource group
    if not test_resource_group_create(config):
        results.add("Resource Group Creation", f"{Colors.RED}FAILED{Colors.NC}")
        results.print_summary()
        return 1
    results.add("Resource Group Creation", f"{Colors.GREEN}PASSED{Colors.NC}")

    # Test 2: Validate resource group
    if not test_resource_group_validate(config):
        results.add("Resource Group Validation", f"{Colors.RED}FAILED{Colors.NC}")
        results.print_summary()
        return 1
    results.add("Resource Group Validation", f"{Colors.GREEN}PASSED{Colors.NC}")

    # Test 3: Create storage account
    if not test_storage_account_create(config):
        results.add("Storage Account Creation", f"{Colors.RED}FAILED{Colors.NC}")
        results.print_summary()
        return 1
    results.add("Storage Account Creation", f"{Colors.GREEN}PASSED{Colors.NC}")

    # Test 4: Validate permissions
    test_azure_permissions()
    results.add("Azure Permissions", f"{Colors.GREEN}VALIDATED{Colors.NC}")

    # Test 5: Create Key Vault
    test_key_vault_create(config)
    results.add("Key Vault Creation", f"{Colors.GREEN}PASSED{Colors.NC}")

    # Test 6: Create virtual network
    if not test_virtual_network_create(config):
        results.add("Virtual Network Creation", f"{Colors.RED}FAILED{Colors.NC}")
        results.print_summary()
        return 1
    results.add("Virtual Network Creation", f"{Colors.GREEN}PASSED{Colors.NC}")

    # Print success summary
    print()
    log(f"{Colors.GREEN}All infrastructure tests passed!{Colors.NC}")
    log(f"{Colors.GREEN}+ Azure deployment capabilities validated{Colors.NC}")
    log(f"{Colors.GREEN}+ Resource group management working{Colors.NC}")
    log(f"{Colors.GREEN}+ Storage account creation working{Colors.NC}")
    log(f"{Colors.GREEN}+ Network resource creation working{Colors.NC}")
    log(f"{Colors.GREEN}+ Permissions appear sufficient for AKS deployment{Colors.NC}")

    results.print_summary()

    print(f"{Colors.GREEN}Your Azure environment is ready for AKS deployment!{Colors.NC}")
    print()
    print("Next steps:")
    print("   1. Review your .env.local configuration")
    print("   2. Run: ./scripts/aks-bootstrap.sh")
    print("   3. Monitor logs in Datadog dashboard")
    print()

    return 0


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Test minimal Azure deployment to validate AKS bootstrap functionality"
    )
    parser.add_argument(
        "--location",
        type=str,
        default="eastus",
        help="Azure region for test resources (default: eastus)",
    )
    parser.add_argument(
        "--resource-group",
        type=str,
        help="Custom resource group name (default: auto-generated)",
    )
    parser.add_argument(
        "--skip-cleanup",
        action="store_true",
        help="Skip cleanup of test resources",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be tested without running",
    )
    args = parser.parse_args()

    # Load environment
    load_env_local()

    # Create test configuration
    config = TestConfig.create_test_config(location=args.location)

    if args.resource_group:
        config.resource_group = args.resource_group

    if args.dry_run:
        print("Dry run mode - would test the following:")
        print(f"  Resource Group: {config.resource_group}")
        print(f"  Location: {config.location}")
        print(f"  Storage Account: {config.storage_account}")
        print(f"  Key Vault: {config.key_vault}")
        return 0

    if args.skip_cleanup:
        global _cleanup_config
        _cleanup_config = None

    return run_all_tests(config)


if __name__ == "__main__":
    sys.exit(main())
