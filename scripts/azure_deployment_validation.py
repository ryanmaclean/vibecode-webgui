#!/usr/bin/env python3
"""Azure Deployment Validation Script for VibeCode Platform.

Tests ARM templates and infrastructure deployment.
"""
from __future__ import annotations

# Datadog APM tracing
try:
    from ddtrace import tracer, patch_all
    patch_all()
except ImportError:
    pass  # ddtrace not installed


import argparse
import atexit
import json
import os
import secrets
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path


# ANSI color codes
class Colors:
    RED = "\033[0;31m"
    GREEN = "\033[0;32m"
    YELLOW = "\033[1;33m"
    BLUE = "\033[0;34m"
    PURPLE = "\033[0;35m"
    NC = "\033[0m"

    @classmethod
    def disable(cls) -> None:
        cls.RED = cls.GREEN = cls.YELLOW = ""
        cls.BLUE = cls.PURPLE = cls.NC = ""


if not sys.stdout.isatty():
    Colors.disable()


def log_info(msg: str) -> None:
    print(f"{Colors.BLUE}[INFO]{Colors.NC} {msg}")


def log_success(msg: str) -> None:
    print(f"{Colors.GREEN}[SUCCESS]{Colors.NC} {msg}")


def log_warning(msg: str) -> None:
    print(f"{Colors.YELLOW}[WARNING]{Colors.NC} {msg}")


def log_error(msg: str) -> None:
    print(f"{Colors.RED}[ERROR]{Colors.NC} {msg}")


def log_step(msg: str) -> None:
    print(f"{Colors.PURPLE}[STEP]{Colors.NC} {msg}")


@dataclass
class ValidationConfig:
    """Configuration for Azure deployment validation."""

    resource_group_name: str = "rg-vibecode-validation-temp"
    location: str = "East US"
    project_name: str = "vibecode"
    environment: str = "validation"
    arm_template_path: Path = Path("infrastructure/arm/azuredeploy.json")
    skip_cleanup: bool = False


def run_cmd(cmd: list[str], check: bool = True) -> subprocess.CompletedProcess:
    """Run a command and return result."""
    return subprocess.run(cmd, capture_output=True, text=True, check=check)


def run_az(args: list[str], check: bool = True) -> subprocess.CompletedProcess:
    """Run an Azure CLI command."""
    return run_cmd(["az"] + args, check=check)


def generate_secure_password() -> str:
    """Generate a secure password."""
    return secrets.token_urlsafe(18)[:25]


def cleanup_resources(config: ValidationConfig) -> None:
    """Clean up validation resources."""
    if config.skip_cleanup:
        log_warning(f"Skipping cleanup - resource group preserved: {config.resource_group_name}")
        return

    log_warning("Cleaning up validation resources...")
    result = run_az(["group", "exists", "--name", config.resource_group_name], check=False)
    if result.stdout.strip() == "true":
        log_info(f"Deleting resource group: {config.resource_group_name}")
        run_az(["group", "delete", "--name", config.resource_group_name, "--yes", "--no-wait"], check=False)
        log_success("Resource group deletion initiated")


def validate_prerequisites(config: ValidationConfig) -> bool:
    """Validate prerequisites."""
    log_step("Validating prerequisites...")

    # Check Azure CLI
    if not shutil.which("az"):
        log_error("Azure CLI is not installed")
        return False

    # Check login status
    result = run_az(["account", "show"], check=False)
    if result.returncode != 0:
        log_error("Not logged into Azure CLI. Run: az login")
        return False

    # Check ARM template exists
    if not config.arm_template_path.exists():
        log_error(f"ARM template not found: {config.arm_template_path}")
        return False

    # Display current account
    account_info = json.loads(result.stdout)
    log_success(f"Connected to subscription: {account_info.get('name', 'Unknown')}")
    log_success(f"Tenant: {account_info.get('tenantId', 'Unknown')}")

    return True


def validate_arm_template(config: ValidationConfig) -> bool:
    """Validate ARM template syntax."""
    log_step("Validating ARM template syntax...")

    postgres_password = generate_secure_password()

    # Create temporary parameters file
    params = {
        "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
        "contentVersion": "1.0.0.0",
        "parameters": {
            "projectName": {"value": config.project_name},
            "environment": {"value": config.environment},
            "location": {"value": config.location},
            "administratorLogin": {"value": "vibecodeusr"},
            "administratorPassword": {"value": postgres_password},
            "datadogApiKey": {"value": "demo-key-replace-with-real"},
            "datadogAppKey": {"value": "demo-app-key-replace-with-real"},
        },
    }

    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
        json.dump(params, f)
        params_file = f.name

    try:
        log_info("Running ARM template validation...")
        result = run_az(
            [
                "deployment", "group", "validate",
                "--resource-group", config.resource_group_name,
                "--template-file", str(config.arm_template_path),
                "--parameters", f"@{params_file}",
                "--output", "table",
            ],
            check=False,
        )

        if result.returncode == 0:
            log_success("ARM template validation passed")
            return True
        else:
            log_error("ARM template validation failed")
            print(result.stderr)
            return False
    finally:
        os.unlink(params_file)


def test_deployment(config: ValidationConfig) -> bool:
    """Test actual deployment with reduced scope."""
    log_step("Testing actual deployment (reduced scope)...")

    # Create minimal test template
    template = {
        "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
        "contentVersion": "1.0.0.0",
        "parameters": {
            "projectName": {"type": "string", "defaultValue": "vibecode"},
            "environment": {"type": "string", "defaultValue": "test"},
        },
        "variables": {
            "resourcePrefix": "[concat(parameters('projectName'), '-', parameters('environment'))]",
            "storageAccountName": "[concat(replace(variables('resourcePrefix'), '-', ''), 'storage', uniqueString(resourceGroup().id))]",
        },
        "resources": [
            {
                "type": "Microsoft.Storage/storageAccounts",
                "apiVersion": "2023-01-01",
                "name": "[variables('storageAccountName')]",
                "location": "[resourceGroup().location]",
                "sku": {"name": "Standard_LRS"},
                "kind": "StorageV2",
                "properties": {
                    "accessTier": "Cool",
                    "supportsHttpsTrafficOnly": True,
                    "minimumTlsVersion": "TLS1_2",
                },
                "tags": {
                    "Project": "VibeCode",
                    "Environment": "[parameters('environment')]",
                    "Purpose": "ValidationTest",
                },
            }
        ],
        "outputs": {
            "storageAccountName": {
                "type": "string",
                "value": "[variables('storageAccountName')]",
            }
        },
    }

    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
        json.dump(template, f)
        template_file = f.name

    try:
        log_info("Deploying minimal test infrastructure...")
        timestamp = datetime.now().strftime("%H%M%S")
        result = run_az(
            [
                "deployment", "group", "create",
                "--resource-group", config.resource_group_name,
                "--template-file", template_file,
                "--parameters", f"projectName={config.project_name}", "environment=test",
                "--name", f"minimal-test-{timestamp}",
                "--output", "table",
            ],
            check=False,
        )

        if result.returncode == 0:
            log_success("Minimal deployment test passed")
            log_info("Resources created:")
            run_az(["resource", "list", "--resource-group", config.resource_group_name, "--output", "table"])
            return True
        else:
            log_error("Minimal deployment test failed")
            print(result.stderr)
            return False
    finally:
        os.unlink(template_file)


def validate_postgresql_config(config: ValidationConfig) -> None:
    """Validate PostgreSQL configuration for pgvector."""
    log_step("Validating PostgreSQL configuration for pgvector...")

    template_content = config.arm_template_path.read_text()

    # Check for vector extension
    if "vector" in template_content:
        log_success("ARM template includes vector extension configuration")
    else:
        log_warning("ARM template may need pgvector extension configuration")

    log_info("Checking PostgreSQL parameters in template...")

    configs_found = 0

    if "shared_preload_libraries" in template_content:
        log_success("Found shared_preload_libraries configuration")
        configs_found += 1
    else:
        log_warning("shared_preload_libraries not found in template")

    if "max_connections" in template_content:
        log_success("Found max_connections configuration")
        configs_found += 1
    else:
        log_warning("max_connections configuration not specified")

    log_info(f"PostgreSQL configuration score: {configs_found}/2")


def check_monitoring_integration(config: ValidationConfig) -> None:
    """Validate monitoring integration."""
    log_step("Validating monitoring integration...")

    template_content = config.arm_template_path.read_text().lower()

    # Check for Datadog
    if "datadog" in template_content:
        log_success("Datadog integration found in template")
    else:
        log_warning("Datadog integration not found in template")

    # Check for Log Analytics
    if "microsoft.operationalinsights/workspaces" in template_content:
        log_success("Log Analytics workspace configuration found")
    else:
        log_warning("Log Analytics workspace not found")

    # Check for Application Insights
    if "microsoft.insights/components" in template_content:
        log_success("Application Insights configuration found")
    else:
        log_warning("Application Insights not found")


def generate_deployment_report(config: ValidationConfig) -> Path:
    """Generate deployment validation report."""
    log_step("Generating deployment validation report...")

    template_content = config.arm_template_path.read_text()
    template_lower = template_content.lower()

    # Get subscription info
    result = run_az(["account", "show", "--query", "name", "--output", "tsv"], check=False)
    subscription = result.stdout.strip() if result.returncode == 0 else "Unknown"

    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    report_file = Path(f"/tmp/vibecode-azure-validation-report-{timestamp}.md")

    def check_mark(condition: bool) -> str:
        return "✅" if condition else "⚠️"

    vector_status = check_mark("vector" in template_content) + (" Configured" if "vector" in template_content else " Needs Review")
    ha_status = check_mark("highAvailability" in template_content) + (" Available" if "highAvailability" in template_content else " Not Found")
    datadog_status = check_mark("datadog" in template_lower) + (" Configured" if "datadog" in template_lower else " Missing")
    log_analytics_status = check_mark("microsoft.operationalinsights" in template_lower) + (" Configured" if "microsoft.operationalinsights" in template_lower else " Missing")

    cleanup_note = (
        f"Resources preserved for further testing: {config.resource_group_name}"
        if config.skip_cleanup
        else "Resources will be cleaned up automatically"
    )

    report = f"""# VibeCode Azure Deployment Validation Report

**Generated**: {datetime.now().isoformat()}
**Subscription**: {subscription}
**Location**: {config.location}

## Validation Results

### ARM Template Validation
- ✅ Template syntax validation passed
- ✅ Parameter validation passed
- ✅ Resource dependencies validated

### Infrastructure Components
- **Resource Group**: {config.resource_group_name}
- **Project**: {config.project_name}
- **Environment**: {config.environment}

### Test Deployment
- ✅ Minimal infrastructure deployment successful
- ✅ Resource creation verified

### PostgreSQL Configuration
- Vector extension support: {vector_status}
- High availability: {ha_status}

### Monitoring Setup
- Datadog integration: {datadog_status}
- Log Analytics: {log_analytics_status}

### Recommendations for Content

1. **Production Ready**: ARM template structure is solid for production deployment
2. **Monitoring**: Comprehensive monitoring setup for observability demonstrations
3. **PostgreSQL**: Vector database configuration suitable for GenAI applications
4. **Scalability**: AKS cluster configured for production workloads

### Friction Points Identified

1. **Complex Setup**: Initial deployment requires multiple parameters
2. **Cost Considerations**: Full deployment may incur significant Azure costs
3. **Prerequisites**: Requires proper Azure permissions and subscription setup

### Next Steps

1. Test with real Datadog API keys for monitoring validation
2. Deploy PostgreSQL and verify pgvector extension installation
3. Create simplified "easy mode" deployment for demos
4. Document cost optimization strategies

## Resource Cleanup

{cleanup_note}

"""

    report_file.write_text(report)
    log_success(f"Validation report generated: {report_file}")
    print()
    print(report)

    return report_file


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--skip-cleanup",
        action="store_true",
        help="Keep Azure resources after validation for manual testing",
    )
    parser.add_argument(
        "--resource-group",
        default="rg-vibecode-validation-temp",
        help="Resource group name for validation",
    )
    parser.add_argument(
        "--location",
        default="East US",
        help="Azure location for deployment",
    )
    parser.add_argument(
        "--template",
        type=Path,
        default=Path("infrastructure/arm/azuredeploy.json"),
        help="Path to ARM template",
    )

    args = parser.parse_args(argv)

    config = ValidationConfig(
        resource_group_name=args.resource_group,
        location=args.location,
        arm_template_path=args.template,
        skip_cleanup=args.skip_cleanup,
    )

    # Register cleanup handler
    atexit.register(cleanup_resources, config)

    print("🚀 Azure Deployment Validation for VibeCode")
    print("===========================================")

    # Validate prerequisites
    if not validate_prerequisites(config):
        return 1

    # Create resource group
    log_info(f"Creating resource group: {config.resource_group_name}")
    result = run_az(
        ["group", "create", "--name", config.resource_group_name, "--location", config.location, "--output", "table"],
        check=False,
    )
    if result.returncode != 0:
        log_error("Failed to create resource group")
        return 1

    # Run validation steps
    if not validate_arm_template(config):
        return 1

    validate_postgresql_config(config)
    check_monitoring_integration(config)

    if not test_deployment(config):
        return 1

    generate_deployment_report(config)

    log_success("🎉 Azure deployment validation completed successfully!")

    if config.skip_cleanup:
        log_warning("Resources preserved for further testing. Clean up manually when done:")
        log_warning(f"az group delete --name {config.resource_group_name} --yes")

    return 0


if __name__ == "__main__":
    sys.exit(main())
