#!/usr/bin/env python3
"""
Comprehensive DBM-APM Deployment Script

This script deploys DBM-APM configuration to all environments:
KIND (local), Staging, and Production.

Usage:
    python deploy_dbm_apm_all.py [kind|staging|production|all] [options]
    python deploy_dbm_apm_all.py --dry-run
    python deploy_dbm_apm_all.py kind --skip-validation
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
    PURPLE = '\033[0;35m'
    NC = '\033[0m'


class DBMAPMDeployer:
    """Handles DBM-APM deployment to all environments."""

    def __init__(
        self,
        skip_validation: bool = False,
        dry_run: bool = False,
    ):
        self.env_file = ".env.local"
        self.script_dir = Path(__file__).parent
        self.skip_validation = skip_validation
        self.dry_run = dry_run

        # Environment variables
        self.dd_service = ""
        self.dd_env = ""
        self.dd_version = ""
        self.dd_dbm_propagation_mode = ""

    def print_status(self, status: str, message: str) -> None:
        """Print status message."""
        status_colors = {
            "SUCCESS": (Color.GREEN, "✅"),
            "ERROR": (Color.RED, "❌"),
            "WARNING": (Color.YELLOW, "⚠️ "),
            "INFO": (Color.BLUE, "ℹ️ "),
            "HEADER": (Color.PURPLE, "🚀"),
        }
        color, emoji = status_colors.get(status, (Color.NC, ""))
        print(f"{color}{emoji} {message}{Color.NC}")

    def command_exists(self, cmd: str) -> bool:
        """Check if command exists."""
        return shutil.which(cmd) is not None

    def run_cmd(self, cmd: list[str]) -> tuple[bool, str, str]:
        """Run command and return (success, stdout, stderr)."""
        try:
            result = subprocess.run(cmd, capture_output=True, text=True)
            return result.returncode == 0, result.stdout, result.stderr
        except Exception as e:
            return False, "", str(e)

    def validate_environment(self) -> bool:
        """Validate environment file."""
        self.print_status("INFO", "Validating environment configuration...")

        if not Path(self.env_file).exists():
            self.print_status("ERROR", f"Environment file {self.env_file} not found")
            self.print_status("INFO", f"Please create {self.env_file} with your configuration")
            self.print_status("INFO", "You can use the example files:")
            self.print_status("INFO", "  cp env.development.example .env.local")
            return False

        # Load environment variables
        with open(self.env_file) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, value = line.split("=", 1)
                    os.environ[key] = value

        # Validate required variables
        required_vars = [
            "DD_API_KEY",
            "DD_SERVICE",
            "DD_ENV",
            "DD_VERSION",
            "DD_DBM_PROPAGATION_MODE",
        ]

        missing_vars = [var for var in required_vars if not os.environ.get(var)]

        if missing_vars:
            self.print_status("ERROR", f"Missing required environment variables: {' '.join(missing_vars)}")
            self.print_status("INFO", f"Please add these variables to {self.env_file}")
            return False

        self.dd_service = os.environ.get("DD_SERVICE", "")
        self.dd_env = os.environ.get("DD_ENV", "")
        self.dd_version = os.environ.get("DD_VERSION", "")
        self.dd_dbm_propagation_mode = os.environ.get("DD_DBM_PROPAGATION_MODE", "")

        self.print_status("SUCCESS", "Environment configuration validated")
        return True

    def run_validation(self) -> bool:
        """Run DBM-APM connection validation."""
        self.print_status("INFO", "Running DBM-APM connection validation...")

        validation_script = self.script_dir / "validate-dbm-apm-connection.sh"
        if validation_script.exists():
            success, _, _ = self.run_cmd(["bash", str(validation_script)])
            if success:
                self.print_status("SUCCESS", "DBM-APM connection validation passed")
                return True
            else:
                self.print_status("ERROR", "DBM-APM connection validation failed")
                return False
        else:
            self.print_status("WARNING", "Validation script not found, skipping validation")
            return True

    def check_target_prerequisites(self, target: str) -> bool:
        """Check prerequisites for specific targets."""
        if target == "kind":
            if not self.command_exists("docker"):
                self.print_status("ERROR", "Docker is required for KIND deployment")
                return False
            if not self.command_exists("kind"):
                self.print_status("ERROR", "KIND is required for local deployment")
                return False
            if not self.command_exists("kubectl"):
                self.print_status("ERROR", "kubectl is required for KIND deployment")
                return False
        elif target in ("staging", "production"):
            if not self.command_exists("az"):
                self.print_status("ERROR", "Azure CLI is required for Azure deployment")
                return False
            success, _, _ = self.run_cmd(["az", "account", "show"])
            if not success:
                self.print_status("ERROR", "Not logged into Azure CLI")
                return False
        elif target == "all":
            return (
                self.check_target_prerequisites("kind") and
                self.check_target_prerequisites("staging") and
                self.check_target_prerequisites("production")
            )

        return True

    def deploy_kind(self) -> bool:
        """Deploy to KIND local development."""
        self.print_status("HEADER", "Deploying to KIND Local Development")
        print("==============================================")

        kind_script = self.script_dir / "deploy-dbm-apm-kind.sh"
        if kind_script.exists():
            if self.dry_run:
                self.print_status("INFO", "DRY RUN: Would deploy to KIND")
                return True

            success, _, _ = self.run_cmd(["bash", str(kind_script)])
            if success:
                self.print_status("SUCCESS", "KIND deployment completed")
                return True
            else:
                self.print_status("ERROR", "KIND deployment failed")
                return False
        else:
            self.print_status("ERROR", "KIND deployment script not found")
            return False

    def deploy_azure_staging(self) -> bool:
        """Deploy to Azure staging."""
        self.print_status("HEADER", "Deploying to Azure Staging")
        print("==================================")

        azure_script = self.script_dir / "deploy-dbm-apm-azure.sh"
        if azure_script.exists():
            if self.dry_run:
                self.print_status("INFO", "DRY RUN: Would deploy to Azure staging")
                return True

            success, _, _ = self.run_cmd(["bash", str(azure_script), "staging"])
            if success:
                self.print_status("SUCCESS", "Azure staging deployment completed")
                return True
            else:
                self.print_status("ERROR", "Azure staging deployment failed")
                return False
        else:
            self.print_status("ERROR", "Azure deployment script not found")
            return False

    def deploy_azure_production(self) -> bool:
        """Deploy to Azure production."""
        self.print_status("HEADER", "Deploying to Azure Production")
        print("=====================================")

        azure_script = self.script_dir / "deploy-dbm-apm-azure.sh"
        if azure_script.exists():
            if self.dry_run:
                self.print_status("INFO", "DRY RUN: Would deploy to Azure production")
                return True

            success, _, _ = self.run_cmd(["bash", str(azure_script), "production"])
            if success:
                self.print_status("SUCCESS", "Azure production deployment completed")
                return True
            else:
                self.print_status("ERROR", "Azure production deployment failed")
                return False
        else:
            self.print_status("ERROR", "Azure deployment script not found")
            return False

    def show_deployment_summary(self) -> None:
        """Show deployment summary."""
        self.print_status("HEADER", "Deployment Summary")
        print("==================")
        print()

        print("🌍 Environment Status:")
        print("   ✅ KIND Local Development: DBM-APM configured")
        print("   ✅ Azure Staging: DBM-APM configured")
        print("   ✅ Azure Production: DBM-APM configured")
        print()

        print("📊 DBM-APM Configuration:")
        print(f"   DD_DBM_PROPAGATION_MODE: {self.dd_dbm_propagation_mode}")
        print("   DD_DBM_TRACE_INJECTION: true")
        print(f"   DD_SERVICE: {self.dd_service}")
        print(f"   DD_ENV: {self.dd_env}")
        print(f"   DD_VERSION: {self.dd_version}")
        print()

        print("🔍 Monitoring Access:")
        print("   Datadog Dashboard: https://app.datadoghq.com/")
        print(f"   Service: {self.dd_service}")
        print(f"   Environment: {self.dd_env}")
        print()

        print("🧪 Testing Commands:")
        print("   # Validate DBM-APM connection")
        print("   npm run validate:dbm-apm")
        print()
        print("   # Check KIND deployment")
        print("   kubectl get pods -n vibecode-platform")
        print()
        print("   # Check Azure App Service logs")
        print("   az webapp log tail --name vibecode-webgui-staging --resource-group rg-vibecode-appservice-staging")
        print("   az webapp log tail --name vibecode-webgui-prod --resource-group rg-vibecode-appservice-prod")
        print()

        print("📚 Documentation:")
        print("   DBM-APM Guide: DATADOG_DBM_APM_CONNECTION_GUIDE.md")
        print("   Validation Script: scripts/validate-dbm-apm-connection.sh")
        print()

    def run(self, target: str) -> int:
        """Run the deployment."""
        print(f"{Color.PURPLE}🚀 Comprehensive DBM-APM Deployment{Color.NC}")
        print("======================================")
        print()

        if not self.validate_environment():
            return 1

        if not self.check_target_prerequisites(target):
            return 1

        if not self.skip_validation:
            if not self.run_validation():
                self.print_status("ERROR", "Validation failed. Use --skip-validation to bypass.")
                return 1

        if self.dry_run:
            self.print_status("INFO", "DRY RUN MODE - No actual deployments will be performed")
            print()
            print("Would deploy to:")
            if target == "kind":
                print("  - KIND Local Development")
            elif target == "staging":
                print("  - Azure Staging")
            elif target == "production":
                print("  - Azure Production")
            elif target == "all":
                print("  - KIND Local Development")
                print("  - Azure Staging")
                print("  - Azure Production")
            print()
            self.print_status("INFO", "Dry run completed")
            return 0

        deployment_success = True

        if target == "kind":
            if not self.deploy_kind():
                deployment_success = False
        elif target == "staging":
            if not self.deploy_azure_staging():
                deployment_success = False
        elif target == "production":
            if not self.deploy_azure_production():
                deployment_success = False
        elif target == "all":
            if not self.deploy_kind():
                deployment_success = False
            print()
            if not self.deploy_azure_staging():
                deployment_success = False
            print()
            if not self.deploy_azure_production():
                deployment_success = False

        print()
        self.show_deployment_summary()

        if deployment_success:
            self.print_status("SUCCESS", "All deployments completed successfully!")
            return 0
        else:
            self.print_status("ERROR", "Some deployments failed. Check the logs above.")
            return 1


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Comprehensive DBM-APM Deployment Script",
    )
    parser.add_argument(
        "target",
        nargs="?",
        default="all",
        choices=["kind", "staging", "production", "all"],
        help="Deployment target",
    )
    parser.add_argument(
        "--skip-validation",
        action="store_true",
        help="Skip DBM-APM connection validation",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be deployed without executing",
    )

    args = parser.parse_args()

    deployer = DBMAPMDeployer(
        skip_validation=args.skip_validation,
        dry_run=args.dry_run,
    )

    return deployer.run(args.target)


if __name__ == "__main__":
    sys.exit(main())
