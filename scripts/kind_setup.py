#!/usr/bin/env python3
"""
VibeCode KIND Setup - One command to rule them all.

This script creates a complete local Kubernetes development environment
by orchestrating the execution of multiple setup scripts in sequence.

Features:
- Environment validation
- Cleanup of previous installations
- KIND cluster creation
- Service deployment
- Health checks
"""

import argparse
import subprocess
import sys
from pathlib import Path
from typing import Optional


# ANSI color codes
class Colors:
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    NC = '\033[0m'  # No Color


# Configuration
CLUSTER_NAME = "vibecode-test"


def log_step(message: str) -> None:
    """Log a step message in green."""
    print(f"\n{Colors.GREEN}==>{Colors.NC} {message}")


def log_error(message: str) -> None:
    """Log an error message in red."""
    print(f"{Colors.RED}ERROR:{Colors.NC} {message}")


def log_warning(message: str) -> None:
    """Log a warning message in yellow."""
    print(f"{Colors.YELLOW}WARNING:{Colors.NC} {message}")


def run_script(script_path: Path, required: bool = True) -> bool:
    """
    Run a shell script and return success status.

    Args:
        script_path: Path to the script to execute
        required: If True, missing script is an error; if False, it's a warning

    Returns:
        True if script ran successfully, False otherwise
    """
    if not script_path.exists():
        if required:
            log_error(f"Script not found: {script_path}")
            return False
        else:
            log_warning(f"Script not found, skipping: {script_path}")
            return True

    # Make script executable
    script_path.chmod(script_path.stat().st_mode | 0o111)

    try:
        result = subprocess.run(
            [str(script_path)],
            check=False,
            capture_output=False,
        )
        return result.returncode == 0
    except subprocess.SubprocessError as e:
        log_error(f"Failed to run script {script_path}: {e}")
        return False


def step_environment_check(script_dir: Path) -> bool:
    """Step 1: Environment check."""
    log_step("Step 1: Environment check")
    script_path = script_dir / "kind-env-check.sh"

    if not run_script(script_path, required=True):
        log_error("Environment check failed. Please resolve the issues above.")
        print()
        print(f"{Colors.YELLOW}Docker issues detected? Try Docker Doctor:{Colors.NC}")
        print(f"   {Colors.GREEN}./scripts/docker-doctor.sh{Colors.NC}")
        print()
        return False
    return True


def step_cleanup(script_dir: Path) -> bool:
    """Step 2: Cleanup previous installations."""
    log_step("Step 2: Cleanup previous installations")
    script_path = script_dir / "kind-cleanup.sh"
    run_script(script_path, required=False)
    return True


def step_create_cluster(script_dir: Path) -> bool:
    """Step 3: Create KIND cluster."""
    log_step("Step 3: Create KIND cluster")
    script_path = script_dir / "kind-create-cluster.sh"

    if not run_script(script_path, required=True):
        log_error("Cluster creation failed")
        return False
    return True


def step_deploy_services(script_dir: Path) -> bool:
    """Step 4: Deploy VibeCode services."""
    log_step("Step 4: Deploy VibeCode services")
    script_path = script_dir / "kind-deploy-services.sh"

    if not run_script(script_path, required=True):
        log_error("Service deployment failed")
        return False
    return True


def step_health_check(script_dir: Path) -> bool:
    """Step 5: Final health check."""
    log_step("Step 5: Final health check")
    script_path = script_dir / "kind-health-check.sh"

    if not script_path.exists():
        log_warning(f"Health check script not found: {script_path}")
        return True

    if not run_script(script_path, required=False):
        log_warning("Health check detected issues, but setup is complete")
        print()
        print("The environment may need a few more minutes to fully initialize.")
        print("   Try running the health check again in 2-3 minutes:")
        print("   ./scripts/kind-health-check.sh")
    return True


def print_success_message() -> None:
    """Print the success message with helpful commands."""
    print()
    print("SUCCESS! VibeCode KIND environment is ready")
    print()
    print("Cluster Information:")
    print(f"   Cluster name: {CLUSTER_NAME}")
    print(f"   Context: kind-{CLUSTER_NAME}")
    print("   Namespace: vibecode")
    print()
    print("Quick access commands:")
    print("   # Check status")
    print("   kubectl get pods -n vibecode")
    print()
    print("   # Access application")
    print("   kubectl port-forward -n vibecode svc/vibecode-service 3000:3000")
    print("   open http://localhost:3000")
    print()
    print("   # View logs")
    print("   kubectl logs -f deployment/vibecode-webgui -n vibecode")
    print()
    print("   # Health check")
    print("   ./scripts/kind-health-check.sh")
    print()
    print("What to test next:")
    print("   1. AI Chat - Test the enhanced AI features with multiple models")
    print("   2. RAG Search - Upload files and test semantic search")
    print("   3. Console Mode - Try VS Code in the browser")
    print("   4. Project Generation - Generate a new project with AI")
    print("   5. Agent Framework - Test the multi-agent capabilities")
    print()
    print("If you encounter issues:")
    print("   - Check logs: kubectl logs -l app=vibecode-webgui -n vibecode")
    print("   - Restart pods: kubectl rollout restart deployment/vibecode-webgui -n vibecode")
    print(f"   - Full reset: kind delete cluster --name={CLUSTER_NAME} && ./scripts/kind-setup.sh")
    print()
    print("Documentation:")
    print("   - Troubleshooting: KIND_TROUBLESHOOTING_GUIDE.md")
    print("   - Features: ENHANCED_AI_FEATURES.md")
    print("   - Repository scan: REPOSITORY_SCAN_REPORT_JULY_2025.md")


def main(script_dir: Optional[Path] = None) -> int:
    """
    Main entry point for KIND setup.

    Args:
        script_dir: Directory containing the setup scripts. If None, uses the
                   directory containing this script.

    Returns:
        0 on success, 1 on failure
    """
    print("VibeCode KIND Setup - Automated")
    print("==================================")
    print("This will create a complete local Kubernetes development environment")
    print()

    if script_dir is None:
        script_dir = Path(__file__).parent.resolve()

    # Step 1: Environment check
    if not step_environment_check(script_dir):
        return 1

    # Step 2: Cleanup
    if not step_cleanup(script_dir):
        return 1

    # Step 3: Create cluster
    if not step_create_cluster(script_dir):
        return 1

    # Step 4: Deploy services
    if not step_deploy_services(script_dir):
        return 1

    # Step 5: Health check
    step_health_check(script_dir)

    # Success message
    print_success_message()

    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="VibeCode KIND Setup - Create a complete local Kubernetes development environment"
    )
    parser.add_argument(
        "--script-dir",
        type=Path,
        help="Directory containing the setup scripts (default: script's directory)",
    )
    args = parser.parse_args()

    sys.exit(main(script_dir=args.script_dir))
