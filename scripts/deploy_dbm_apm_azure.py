#!/usr/bin/env python3
"""
Deploy DBM-APM Configuration to Azure App Service Environments

This script deploys the updated DBM-APM configuration to staging
and production Azure App Service.

Usage:
    python deploy_dbm_apm_azure.py [staging|production|all]
"""

import argparse
import json
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


class AzureDBMAPMDeployer:
    """Handles DBM-APM deployment to Azure App Service."""

    def __init__(self):
        self.env_file = ".env.local"
        self.staging_rg = "rg-vibecode-appservice-staging"
        self.production_rg = "rg-vibecode-appservice-prod"
        self.staging_app = "vibecode-webgui-staging"
        self.production_app = "vibecode-webgui-prod"

        # Environment variables
        self.dd_api_key = ""
        self.dd_service = ""
        self.dd_env = ""
        self.dd_version = ""
        self.dd_dbm_propagation_mode = ""
        self.dd_site = "datadoghq.com"

    def print_status(self, status: str, message: str) -> None:
        """Print status message."""
        status_colors = {
            "SUCCESS": (Color.GREEN, "✅"),
            "ERROR": (Color.RED, "❌"),
            "WARNING": (Color.YELLOW, "⚠️ "),
            "INFO": (Color.BLUE, "ℹ️ "),
        }
        color, emoji = status_colors.get(status, (Color.NC, ""))
        print(f"{color}{emoji} {message}{Color.NC}")

    def command_exists(self, cmd: str) -> bool:
        """Check if command exists."""
        return shutil.which(cmd) is not None

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
        self.print_status("INFO", "Checking prerequisites...")

        missing_tools = []
        if not self.command_exists("az"):
            missing_tools.append("az")
        if not self.command_exists("jq"):
            missing_tools.append("jq")

        if missing_tools:
            self.print_status("ERROR", f"Missing required tools: {' '.join(missing_tools)}")
            self.print_status("INFO", "Please install the missing tools and try again.")
            return False

        # Check Azure CLI login
        success, _, _ = self.run_cmd(["az", "account", "show"])
        if not success:
            self.print_status("ERROR", "Not logged into Azure CLI")
            self.print_status("INFO", "Please run: az login")
            return False

        self.print_status("SUCCESS", "All prerequisites are available")
        return True

    def load_environment(self) -> bool:
        """Load environment variables."""
        self.print_status("INFO", "Loading environment variables...")

        if Path(self.env_file).exists():
            self.print_status("SUCCESS", f"Found {self.env_file}")

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
                self.print_status("WARNING", f"Missing environment variables: {' '.join(missing_vars)}")
                self.print_status("INFO", "Setting default values for missing variables...")

                os.environ.setdefault("DD_SERVICE", "vibecode-webgui")
                os.environ.setdefault("DD_ENV", "production")
                os.environ.setdefault("DD_VERSION", "1.0.0")
                os.environ.setdefault("DD_DBM_PROPAGATION_MODE", "full")

            self.dd_api_key = os.environ.get("DD_API_KEY", "")
            self.dd_service = os.environ.get("DD_SERVICE", "vibecode-webgui")
            self.dd_env = os.environ.get("DD_ENV", "production")
            self.dd_version = os.environ.get("DD_VERSION", "1.0.0")
            self.dd_dbm_propagation_mode = os.environ.get("DD_DBM_PROPAGATION_MODE", "full")
            self.dd_site = os.environ.get("DD_SITE", "datadoghq.com")

            self.print_status("SUCCESS", "Environment variables loaded")
            return True
        else:
            self.print_status("ERROR", f"{self.env_file} not found")
            self.print_status("INFO", f"Please create {self.env_file} with your configuration")
            return False

    def validate_azure_resources(self) -> bool:
        """Validate Azure resources."""
        self.print_status("INFO", "Validating Azure resources...")

        # Check resource groups
        success, _, _ = self.run_cmd([
            "az", "group", "show", "--name", self.staging_rg,
        ])
        if not success:
            self.print_status("ERROR", f"Staging resource group '{self.staging_rg}' not found")
            return False

        success, _, _ = self.run_cmd([
            "az", "group", "show", "--name", self.production_rg,
        ])
        if not success:
            self.print_status("ERROR", f"Production resource group '{self.production_rg}' not found")
            return False

        # Check App Services
        success, _, _ = self.run_cmd([
            "az", "webapp", "show",
            "--name", self.staging_app,
            "--resource-group", self.staging_rg,
        ])
        if not success:
            self.print_status("ERROR", f"Staging App Service '{self.staging_app}' not found")
            return False

        success, _, _ = self.run_cmd([
            "az", "webapp", "show",
            "--name", self.production_app,
            "--resource-group", self.production_rg,
        ])
        if not success:
            self.print_status("ERROR", f"Production App Service '{self.production_app}' not found")
            return False

        self.print_status("SUCCESS", "All Azure resources are available")
        return True

    def update_app_service_env(
        self,
        app_name: str,
        resource_group: str,
        environment: str,
    ) -> bool:
        """Update App Service environment variables."""
        self.print_status("INFO", f"Updating App Service environment variables for {app_name}...")

        # Set environment-specific variables
        if environment == "staging":
            dd_env = "staging"
            dd_version = "0.1.0-staging"
            dd_trace_sample_rate = "0.5"
        elif environment == "production":
            dd_env = "production"
            dd_version = "1.0.0"
            dd_trace_sample_rate = "0.1"
        else:
            self.print_status("ERROR", f"Unknown environment: {environment}")
            return False

        settings = [
            f"DD_API_KEY={self.dd_api_key}",
            f"DD_SITE={self.dd_site}",
            f"DD_SERVICE={self.dd_service}",
            f"DD_ENV={dd_env}",
            f"DD_VERSION={dd_version}",
            f"DD_DBM_PROPAGATION_MODE={self.dd_dbm_propagation_mode}",
            "DD_DBM_TRACE_INJECTION=true",
            f"DD_TRACE_SAMPLE_RATE={dd_trace_sample_rate}",
            "DD_TRACE_ENABLED=true",
            "DD_TRACE_ANALYTICS_ENABLED=true",
            "DD_PROFILING_ENABLED=true",
            "DD_RUNTIME_METRICS_ENABLED=true",
            "DD_LLMOBS_ENABLED=true",
            "DD_LLMOBS_AGENTLESS_ENABLED=true",
            f"DD_LLMOBS_ML_APP=vibecode-ai-{environment}",
            f"NODE_ENV={environment}",
            "WEBSITES_PORT=3000",
            "WEBSITES_ENABLE_APP_SERVICE_STORAGE=false",
            "WEBSITES_CONTAINER_START_TIME_LIMIT=1800",
            "WEBSITES_CONTAINER_STOP_TIME_LIMIT=1800",
        ]

        cmd = [
            "az", "webapp", "config", "appsettings", "set",
            "--name", app_name,
            "--resource-group", resource_group,
            "--settings", *settings,
            "--output", "table",
        ]

        success, stdout, stderr = self.run_cmd(cmd, capture_output=False)
        if not success:
            self.print_status("ERROR", f"Failed to update settings: {stderr}")
            return False

        self.print_status("SUCCESS", f"App Service environment variables updated for {app_name}")
        return True

    def restart_app_service(self, app_name: str, resource_group: str) -> bool:
        """Restart App Service."""
        self.print_status("INFO", f"Restarting App Service {app_name}...")

        success, _, stderr = self.run_cmd([
            "az", "webapp", "restart",
            "--name", app_name,
            "--resource-group", resource_group,
            "--output", "table",
        ])

        if not success:
            self.print_status("ERROR", f"Failed to restart: {stderr}")
            return False

        self.print_status("SUCCESS", f"App Service {app_name} restarted")
        return True

    def validate_app_service_config(self, app_name: str, resource_group: str) -> bool:
        """Validate App Service configuration."""
        self.print_status("INFO", f"Validating App Service configuration for {app_name}...")

        success, stdout, _ = self.run_cmd([
            "az", "webapp", "config", "appsettings", "list",
            "--name", app_name,
            "--resource-group", resource_group,
            "--output", "json",
        ])

        if not success:
            return False

        try:
            config = json.loads(stdout)
        except json.JSONDecodeError:
            return False

        required_vars = [
            "DD_API_KEY",
            "DD_SERVICE",
            "DD_ENV",
            "DD_VERSION",
            "DD_DBM_PROPAGATION_MODE",
            "DD_DBM_TRACE_INJECTION",
            "DD_TRACE_SAMPLE_RATE",
            "DD_TRACE_ENABLED",
        ]

        config_names = [item.get("name") for item in config]
        missing_vars = [var for var in required_vars if var not in config_names]

        if missing_vars:
            self.print_status("ERROR", f"Missing required variables in {app_name}: {' '.join(missing_vars)}")
            return False

        self.print_status("SUCCESS", f"App Service configuration validated for {app_name}")
        return True

    def deploy_staging(self) -> bool:
        """Deploy to staging."""
        self.print_status("INFO", "Deploying DBM-APM configuration to staging...")

        if not self.update_app_service_env(self.staging_app, self.staging_rg, "staging"):
            return False
        if not self.restart_app_service(self.staging_app, self.staging_rg):
            return False
        if not self.validate_app_service_config(self.staging_app, self.staging_rg):
            return False

        self.print_status("SUCCESS", "Staging deployment completed")
        return True

    def deploy_production(self) -> bool:
        """Deploy to production."""
        self.print_status("INFO", "Deploying DBM-APM configuration to production...")

        # Confirm production deployment
        print(f"{Color.YELLOW}⚠️  You are about to deploy to PRODUCTION. This will affect live users.{Color.NC}")
        confirm = input("Are you sure you want to continue? (yes/no): ").strip()

        if confirm != "yes":
            self.print_status("INFO", "Production deployment cancelled")
            return True

        if not self.update_app_service_env(self.production_app, self.production_rg, "production"):
            return False
        if not self.restart_app_service(self.production_app, self.production_rg):
            return False
        if not self.validate_app_service_config(self.production_app, self.production_rg):
            return False

        self.print_status("SUCCESS", "Production deployment completed")
        return True

    def show_deployment_status(self) -> None:
        """Show deployment status."""
        self.print_status("INFO", "Deployment Status:")
        print()

        # Get staging URL
        success, stdout, _ = self.run_cmd([
            "az", "webapp", "show",
            "--name", self.staging_app,
            "--resource-group", self.staging_rg,
            "--query", "defaultHostName",
            "--output", "tsv",
        ])
        staging_url = stdout.strip() if success else "unknown"

        # Get production URL
        success, stdout, _ = self.run_cmd([
            "az", "webapp", "show",
            "--name", self.production_app,
            "--resource-group", self.production_rg,
            "--query", "defaultHostName",
            "--output", "tsv",
        ])
        production_url = stdout.strip() if success else "unknown"

        print("🔄 Staging Environment:")
        print(f"   URL: https://{staging_url}")
        print(f"   Resource Group: {self.staging_rg}")
        print(f"   App Service: {self.staging_app}")
        print()

        print("🚀 Production Environment:")
        print(f"   URL: https://{production_url}")
        print(f"   Resource Group: {self.production_rg}")
        print(f"   App Service: {self.production_app}")
        print()

        print("📊 DBM-APM Configuration:")
        print(f"   DD_DBM_PROPAGATION_MODE: {self.dd_dbm_propagation_mode}")
        print("   DD_DBM_TRACE_INJECTION: true")
        print(f"   DD_SERVICE: {self.dd_service}")
        print(f"   DD_ENV: {self.dd_env}")
        print(f"   DD_VERSION: {self.dd_version}")
        print()

        print("🔍 Monitoring:")
        print("   Datadog: https://app.datadoghq.com/")
        print(f"   Service: {self.dd_service}")
        print(f"   Environment: {self.dd_env}")
        print()

        print("🔧 Debug Commands:")
        print(f"   az webapp log tail --name {self.staging_app} --resource-group {self.staging_rg}")
        print(f"   az webapp log tail --name {self.production_app} --resource-group {self.production_rg}")
        print(f"   az webapp config appsettings list --name {self.staging_app} --resource-group {self.staging_rg}")
        print(f"   az webapp config appsettings list --name {self.production_app} --resource-group {self.production_rg}")

    def run(self, target: str) -> int:
        """Run the deployment."""
        print(f"{Color.BLUE}🚀 Deploying DBM-APM Configuration to Azure App Service{Color.NC}")
        print("==============================================================")
        print()

        if not self.check_prerequisites():
            return 1

        if not self.load_environment():
            return 1

        if not self.validate_azure_resources():
            return 1

        if target == "staging":
            if not self.deploy_staging():
                return 1
        elif target == "production":
            if not self.deploy_production():
                return 1
        elif target == "all":
            if not self.deploy_staging():
                return 1
            print()
            if not self.deploy_production():
                return 1
        else:
            print("Usage: deploy_dbm_apm_azure.py [staging|production|all]")
            return 1

        self.show_deployment_status()

        self.print_status("SUCCESS", "DBM-APM configuration deployed successfully to Azure App Service!")
        return 0


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Deploy DBM-APM Configuration to Azure App Service",
    )
    parser.add_argument(
        "target",
        nargs="?",
        default="all",
        choices=["staging", "production", "all"],
        help="Deployment target",
    )

    args = parser.parse_args()

    deployer = AzureDBMAPMDeployer()
    return deployer.run(args.target)


if __name__ == "__main__":
    sys.exit(main())
