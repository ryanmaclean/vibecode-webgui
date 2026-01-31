#!/usr/bin/env python3
"""
VibeCode Azure Infrastructure Deployment Script.

Uses OpenTofu/Terraform for infrastructure as code.
Converts deploy.sh to Python with enhanced error handling and Datadog tracing.
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

# Datadog APM tracing
try:
    from ddtrace import tracer
except ImportError:
    tracer = None


class CommandError(RuntimeError):
    """Raised when an underlying command fails."""


class Colors:
    """ANSI color codes for terminal output."""
    RED = "\033[0;31m"
    GREEN = "\033[0;32m"
    YELLOW = "\033[1;33m"
    NC = "\033[0m"


def log_info(message: str) -> None:
    """Log an info message."""
    print(f"{Colors.GREEN}[INFO]{Colors.NC} {message}")


def log_warn(message: str) -> None:
    """Log a warning message."""
    print(f"{Colors.YELLOW}[WARN]{Colors.NC} {message}")


def log_error(message: str) -> None:
    """Log an error message."""
    print(f"{Colors.RED}[ERROR]{Colors.NC} {message}")


def run(
    cmd: list[str],
    *,
    capture_output: bool = False,
    check: bool = True,
    cwd: Path | None = None,
) -> subprocess.CompletedProcess[str]:
    """Run a shell command with proper error handling."""
    try:
        return subprocess.run(
            cmd,
            text=True,
            capture_output=capture_output,
            check=check,
            cwd=cwd,
        )
    except subprocess.CalledProcessError as exc:
        raise CommandError(
            f"Command failed ({' '.join(cmd)}): {exc.stderr or exc.stdout}"
        ) from exc


def get_tf_command() -> str:
    """Determine which Terraform/OpenTofu command to use."""
    if shutil.which("tofu"):
        result = run(["tofu", "version"], capture_output=True)
        version = result.stdout.splitlines()[0] if result.stdout else "unknown"
        log_info(f"Using OpenTofu: {version}")
        return "tofu"
    elif shutil.which("terraform"):
        result = run(["terraform", "version"], capture_output=True)
        version = result.stdout.splitlines()[0] if result.stdout else "unknown"
        log_info(f"Using Terraform: {version}")
        return "terraform"
    else:
        raise CommandError("Neither OpenTofu nor Terraform found. Install one of them.")


def check_prerequisites() -> str:
    """Check all prerequisites and return the Terraform command."""
    log_info("Checking prerequisites...")

    # Get Terraform/OpenTofu command
    tf_cmd = get_tf_command()

    # Check Azure CLI
    if not shutil.which("az"):
        raise CommandError("Azure CLI not found. Install with: brew install azure-cli")

    # Check Azure login
    try:
        run(["az", "account", "show"], capture_output=True)
    except CommandError:
        log_warn("Not logged into Azure. Running az login...")
        run(["az", "login"])

    # Check required environment variables
    required_vars = ["TF_VAR_datadog_api_key", "TF_VAR_datadog_app_key"]
    for var in required_vars:
        if not os.environ.get(var):
            raise CommandError(
                f"Required environment variable {var} is not set. "
                f"Set it with: export {var}='your-value'"
            )

    log_info("All prerequisites met")
    return tf_cmd


def cmd_init(tf_dir: Path, tf_cmd: str) -> None:
    """Initialize Terraform/OpenTofu."""
    log_info(f"Initializing {tf_cmd}...")

    backend_file = tf_dir / "backend.tfvars"
    if not backend_file.exists():
        log_info("Creating backend.tfvars from template...")
        backend_file.write_text("""\
resource_group_name  = "rg-vibecode-tofu-state"
storage_account_name = "vibecodetofustate"
container_name       = "tfstate"
key                  = "vibecode-azure.tfstate"
""")
        log_warn("Update backend.tfvars with your state storage details")

    run(
        [tf_cmd, "init", "-backend-config=backend.tfvars", "-upgrade"],
        cwd=tf_dir,
    )


def cmd_plan(tf_dir: Path, tf_cmd: str) -> None:
    """Plan infrastructure deployment."""
    log_info("Planning deployment...")
    run(
        [tf_cmd, "plan", "-out=tfplan", "-var-file=terraform.tfvars"],
        cwd=tf_dir,
    )
    log_info("Plan saved to tfplan")


def cmd_apply(tf_dir: Path, tf_cmd: str) -> None:
    """Apply infrastructure deployment."""
    log_info("Applying deployment...")

    plan_file = tf_dir / "tfplan"
    if plan_file.exists():
        run([tf_cmd, "apply", "tfplan"], cwd=tf_dir)
    else:
        log_warn("No plan file found. Running plan first...")
        run([tf_cmd, "apply", "-var-file=terraform.tfvars"], cwd=tf_dir)

    log_info("Deployment complete!")


def cmd_destroy(tf_dir: Path, tf_cmd: str) -> None:
    """Destroy infrastructure."""
    log_warn("This will DESTROY all infrastructure!")
    confirm = input("Are you sure? (type 'yes' to confirm): ")

    if confirm == "yes":
        run([tf_cmd, "destroy", "-var-file=terraform.tfvars"], cwd=tf_dir)
        log_info("Infrastructure destroyed")
    else:
        log_info("Destroy cancelled")


def cmd_kubeconfig(tf_dir: Path, tf_cmd: str) -> None:
    """Get kubeconfig for AKS."""
    log_info("Getting AKS kubeconfig...")

    try:
        result = run([tf_cmd, "output", "-raw", "aks_cluster_name"], cwd=tf_dir, capture_output=True)
        cluster_name = result.stdout.strip()

        result = run([tf_cmd, "output", "-raw", "resource_group_name"], cwd=tf_dir, capture_output=True)
        rg_name = result.stdout.strip()
    except CommandError:
        raise CommandError("Could not get cluster details from Terraform output")

    if not cluster_name or not rg_name:
        raise CommandError("Could not get cluster details from Terraform output")

    run([
        "az", "aks", "get-credentials",
        "--resource-group", rg_name,
        "--name", cluster_name,
        "--overwrite-existing",
    ])

    run(["kubelogin", "convert-kubeconfig", "-l", "azurecli"])

    log_info(f"Kubeconfig updated for {cluster_name}")


def cmd_setup_state() -> None:
    """Set up Terraform state storage in Azure."""
    log_info("Setting up Terraform state storage...")

    rg_name = "rg-vibecode-tofu-state"
    storage_name = "vibecodetofustate"
    container_name = "tfstate"
    location = "eastus2"

    # Create resource group
    run([
        "az", "group", "create",
        "--name", rg_name,
        "--location", location,
        "--output", "none",
    ])

    # Create storage account
    run([
        "az", "storage", "account", "create",
        "--name", storage_name,
        "--resource-group", rg_name,
        "--location", location,
        "--sku", "Standard_LRS",
        "--encryption-services", "blob",
        "--output", "none",
    ])

    # Create blob container
    run([
        "az", "storage", "container", "create",
        "--name", container_name,
        "--account-name", storage_name,
        "--output", "none",
    ])

    log_info(f"State storage created: {storage_name}/{container_name}")


def cmd_outputs(tf_dir: Path, tf_cmd: str) -> None:
    """Show Terraform outputs."""
    log_info("Terraform outputs:")
    run([tf_cmd, "output"], cwd=tf_dir)


def show_help() -> None:
    """Show usage help."""
    print("""\
VibeCode Azure Infrastructure Deployment

Usage: deploy.py <command>

Commands:
  setup-state   Create Azure Storage for Terraform state
  init          Initialize Terraform/OpenTofu
  plan          Plan infrastructure changes
  apply         Apply infrastructure changes
  destroy       Destroy all infrastructure
  kubeconfig    Get AKS kubeconfig
  outputs       Show Terraform outputs
  full-deploy   Run init, plan, apply, and kubeconfig

Required environment variables:
  TF_VAR_datadog_api_key  - Datadog API key
  TF_VAR_datadog_app_key  - Datadog App key

Optional environment variables:
  TF_VAR_openai_api_key       - OpenAI API key
  TF_VAR_github_client_id     - GitHub OAuth client ID
  TF_VAR_github_client_secret - GitHub OAuth client secret
""")


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="VibeCode Azure Infrastructure Deployment",
        add_help=False,
    )
    parser.add_argument(
        "command",
        nargs="?",
        default="help",
        choices=[
            "init", "plan", "apply", "destroy",
            "kubeconfig", "setup-state", "outputs",
            "full-deploy", "help",
        ],
        help="Command to execute",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    args = parse_args(argv)

    # Determine script directory
    tf_dir = Path(__file__).parent.resolve()

    try:
        if args.command == "help":
            show_help()
            return 0

        if args.command == "setup-state":
            cmd_setup_state()
            return 0

        # Commands that need prerequisites check
        tf_cmd = check_prerequisites()

        if args.command == "init":
            cmd_init(tf_dir, tf_cmd)
        elif args.command == "plan":
            cmd_plan(tf_dir, tf_cmd)
        elif args.command == "apply":
            cmd_apply(tf_dir, tf_cmd)
        elif args.command == "destroy":
            cmd_destroy(tf_dir, tf_cmd)
        elif args.command == "kubeconfig":
            cmd_kubeconfig(tf_dir, tf_cmd)
        elif args.command == "outputs":
            cmd_outputs(tf_dir, tf_cmd)
        elif args.command == "full-deploy":
            cmd_init(tf_dir, tf_cmd)
            cmd_plan(tf_dir, tf_cmd)
            cmd_apply(tf_dir, tf_cmd)
            cmd_kubeconfig(tf_dir, tf_cmd)

    except CommandError as e:
        log_error(str(e))
        return 1
    except KeyboardInterrupt:
        log_info("Operation cancelled by user")
        return 130

    return 0


if __name__ == "__main__":
    sys.exit(main())
