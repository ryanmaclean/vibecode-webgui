#!/usr/bin/env python3
"""
Deployment Readiness Validation Script.

Validates all prerequisites before executing Azure deployment.
Converts validate-deployment-readiness.sh to Python with enhanced error handling.
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path


class Colors:
    """ANSI color codes for terminal output."""
    RED = "\033[0;31m"
    GREEN = "\033[0;32m"
    YELLOW = "\033[1;33m"
    BLUE = "\033[0;34m"
    NC = "\033[0m"


@dataclass
class ValidationResult:
    """Tracks validation results."""
    errors: int = 0
    warnings: int = 0
    messages: list[str] = field(default_factory=list)


def success(message: str) -> None:
    """Print a success message."""
    print(f"{Colors.GREEN}\u2705 {message}{Colors.NC}")


def warning(message: str) -> None:
    """Print a warning message."""
    print(f"{Colors.YELLOW}\u26A0\uFE0F  {message}{Colors.NC}")


def error(message: str) -> None:
    """Print an error message."""
    print(f"{Colors.RED}\u274C {message}{Colors.NC}")


def info(message: str) -> None:
    """Print an info message."""
    print(f"{Colors.BLUE}\u2139\uFE0F  {message}{Colors.NC}")


def log(message: str) -> None:
    """Print a log message."""
    from datetime import datetime
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] {message}")


def run(
    cmd: list[str],
    *,
    capture_output: bool = True,
    check: bool = True,
    cwd: Path | None = None,
) -> subprocess.CompletedProcess[str]:
    """Run a shell command."""
    try:
        return subprocess.run(
            cmd,
            text=True,
            capture_output=capture_output,
            check=check,
            cwd=cwd,
        )
    except subprocess.CalledProcessError:
        raise


def check_requirement(
    result: ValidationResult,
    requirement: str,
    command: str,
    expected: str,
) -> None:
    """Check if a required tool is installed."""
    if shutil.which(command):
        try:
            proc = run([command, "--version"], check=False)
            version = proc.stdout.splitlines()[0] if proc.stdout else "unknown"
            success(f"{requirement}: {version}")
        except Exception:
            success(f"{requirement}: installed (version unknown)")
    else:
        error(f"{requirement}: NOT INSTALLED (required: {expected})")
        result.errors += 1


def check_env_var(
    result: ValidationResult,
    var_name: str,
    description: str,
    required: bool = True,
) -> None:
    """Check if an environment variable is set."""
    value = os.environ.get(var_name, "")

    if value:
        # Hide sensitive values
        if any(s in var_name.upper() for s in ["KEY", "SECRET", "PASSWORD"]):
            success(f"{description}: SET (***hidden***)")
        else:
            success(f"{description}: {value}")
    else:
        if required:
            error(f"{description}: NOT SET (required variable: {var_name})")
            result.errors += 1
        else:
            warning(f"{description}: NOT SET (optional variable: {var_name})")
            result.warnings += 1


def load_env_file(env_file: Path) -> bool:
    """Load environment variables from a file."""
    if not env_file.exists():
        return False

    for line in env_file.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue

        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ[key] = value

    return True


def validate_tools(result: ValidationResult) -> None:
    """Validate required tools are installed."""
    print()
    info("Checking required tools...")

    check_requirement(result, "Azure CLI", "az", "2.0+")
    check_requirement(result, "OpenTofu", "tofu", "1.6+")
    check_requirement(result, "kubectl", "kubectl", "1.28+")
    check_requirement(result, "Helm", "helm", "3.12+")
    check_requirement(result, "Docker", "docker", "20.0+")


def validate_azure_auth(result: ValidationResult) -> None:
    """Validate Azure authentication."""
    print()
    info("Checking Azure authentication...")

    try:
        proc = run(["az", "account", "show", "--query", "name", "-o", "tsv"])
        subscription_name = proc.stdout.strip()

        proc = run(["az", "account", "show", "--query", "id", "-o", "tsv"])
        subscription_id = proc.stdout.strip()

        success(f"Azure authentication: Logged in to '{subscription_name}' ({subscription_id})")
    except subprocess.CalledProcessError:
        error("Azure authentication: NOT LOGGED IN (run 'az login')")
        result.errors += 1


def validate_env_file(result: ValidationResult, project_root: Path) -> None:
    """Validate environment file exists and load it."""
    env_file_name = os.environ.get("ENV_FILE", ".env.aks")
    env_file = project_root / env_file_name

    if load_env_file(env_file):
        success(f"Environment file: Found {env_file_name}")
    else:
        error(f"Environment file: {env_file_name} not found (copy from env.aks.example)")
        result.errors += 1


def validate_required_env_vars(result: ValidationResult) -> None:
    """Validate required environment variables."""
    print()
    info("Checking required environment variables...")

    check_env_var(result, "TF_VAR_datadog_api_key", "Datadog API Key", required=True)
    check_env_var(result, "TF_VAR_datadog_app_key", "Datadog App Key", required=True)
    check_env_var(result, "TF_VAR_postgresql_admin_password", "PostgreSQL Password", required=True)
    check_env_var(result, "TF_VAR_nextauth_secret", "NextAuth Secret", required=True)
    check_env_var(result, "TF_VAR_resource_group_name", "Resource Group Name", required=True)
    check_env_var(result, "TF_VAR_location", "Azure Location", required=True)


def validate_optional_env_vars(result: ValidationResult) -> None:
    """Validate optional environment variables."""
    print()
    info("Checking optional environment variables...")

    check_env_var(result, "TF_VAR_openrouter_api_key", "OpenRouter API Key", required=False)
    check_env_var(result, "TF_VAR_azure_openai_api_key", "Azure OpenAI API Key", required=False)
    check_env_var(result, "TF_VAR_azure_openai_endpoint", "Azure OpenAI Endpoint", required=False)
    check_env_var(result, "OPENAI_API_KEY", "OpenAI API Key (for AI generation)", required=False)


def validate_opentofu(result: ValidationResult, project_root: Path) -> None:
    """Validate OpenTofu configuration."""
    print()
    info("Checking OpenTofu configuration...")

    tofu_dir = project_root / "tofu"
    if tofu_dir.exists():
        success("OpenTofu directory: Found")

        validation = run(["tofu", "validate"], cwd=tofu_dir, check=False)
        if validation.returncode == 0:
            success("OpenTofu validation: PASSED")
        else:
            error("OpenTofu validation: FAILED")
            output = (validation.stdout or "") + (validation.stderr or "")
            if output.strip():
                info(output.strip())
            result.errors += 1
    else:
        error("OpenTofu directory: NOT FOUND")
        result.errors += 1


def validate_container_config(result: ValidationResult, project_root: Path) -> None:
    """Validate container configuration."""
    print()
    info("Checking container configuration...")

    dockerfile = project_root / "docker" / "Dockerfile"
    if dockerfile.exists():
        success("Production Dockerfile: Found")
    else:
        error("Production Dockerfile: NOT FOUND (docker/Dockerfile required)")
        result.errors += 1

    charts_dir = project_root / "charts" / "vibecode"
    deploy_script = project_root / "scripts" / "tofu-aks-deploy.sh"
    if charts_dir.exists() or deploy_script.exists():
        success("Helm configuration: Ready (will be created during deployment)")
    else:
        warning("Helm configuration: Will be generated during deployment")
        result.warnings += 1


def validate_ai_project(result: ValidationResult, project_root: Path) -> None:
    """Validate AI project generation dependencies."""
    print()
    info("Checking AI project generation...")

    ai_generator = project_root / "src" / "lib" / "services" / "ai-project-generator.ts"
    if ai_generator.exists():
        success("AI Project Generator: Implemented")
    else:
        error("AI Project Generator: NOT FOUND")
        result.errors += 1

    ai_api = project_root / "src" / "app" / "api" / "ai" / "generate-project" / "route.ts"
    if ai_api.exists():
        success("AI Generation API: Implemented")
    else:
        error("AI Generation API: NOT FOUND")
        result.errors += 1


def validate_azure_resources(result: ValidationResult) -> None:
    """Check Azure resource availability."""
    print()
    info("Checking Azure resource availability...")

    rg_name = os.environ.get("TF_VAR_resource_group_name", "")
    if rg_name:
        try:
            run(["az", "group", "show", "--name", rg_name])
            warning("Resource Group: Already exists (will be reused)")
            result.warnings += 1
        except subprocess.CalledProcessError:
            success("Resource Group: Available for creation")


def display_cost_estimation() -> None:
    """Display deployment cost estimation."""
    print()
    info("Deployment cost estimation...")
    info("Expected monthly costs:")
    info("  - AKS Cluster (3 nodes): ~$200-400/month")
    info("  - PostgreSQL (Flexible): ~$50-100/month")
    info("  - Container Registry: ~$5-20/month")
    info("  - Networking & Storage: ~$20-50/month")
    info("  - Total estimated: ~$275-570/month")
    info("")
    info("To minimize costs:")
    info("  - Use spot instances where possible")
    info("  - Scale down during non-business hours")
    info("  - Monitor usage with Azure Cost Management")


def display_summary(result: ValidationResult) -> None:
    """Display validation summary."""
    print()
    log("Validation Summary")

    if result.errors == 0:
        success("All critical requirements satisfied!")
        if result.warnings > 0:
            warning(f"{result.warnings} warnings found (non-critical)")
        print()
        success("READY FOR DEPLOYMENT")
        print()
        info("Next steps:")
        info("  1. Review cost estimates above")
        info("  2. Run: ./scripts/tofu-aks-deploy.sh")
        info("  3. Monitor deployment progress")
        info("  4. Verify application functionality")
    else:
        error(f"{result.errors} critical errors found")
        if result.warnings > 0:
            warning(f"{result.warnings} warnings found")
        print()
        error("NOT READY FOR DEPLOYMENT")
        print()
        info("Fix the errors above before deploying")


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Validate deployment readiness for Azure AKS",
    )

    parser.add_argument(
        "--env-file",
        default=os.environ.get("ENV_FILE", ".env.aks"),
        help="Environment file to load (default: .env.aks)",
    )
    parser.add_argument(
        "--skip-azure-check",
        action="store_true",
        help="Skip Azure authentication and resource checks",
    )

    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    args = parse_args(argv)

    log("Validating deployment readiness for Azure AKS")

    # Determine project root
    script_dir = Path(__file__).parent.resolve()
    project_root = script_dir.parent

    # Set env file path
    os.environ["ENV_FILE"] = args.env_file

    result = ValidationResult()

    try:
        validate_tools(result)

        if not args.skip_azure_check:
            validate_azure_auth(result)

        validate_env_file(result, project_root)
        validate_required_env_vars(result)
        validate_optional_env_vars(result)
        validate_opentofu(result, project_root)
        validate_container_config(result, project_root)
        validate_ai_project(result, project_root)

        if not args.skip_azure_check:
            validate_azure_resources(result)

        display_cost_estimation()
        display_summary(result)

    except KeyboardInterrupt:
        log("Validation cancelled by user")
        return 130

    return 1 if result.errors > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
