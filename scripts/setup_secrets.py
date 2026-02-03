#!/usr/bin/env python3
"""Kubernetes Secrets Automation Script - 2025 Best Practices.

Automates creation of Kubernetes secrets from environment variables.
Designed for CI/CD integration and local development.
"""

from __future__ import annotations

import argparse
import base64
import os
import secrets
import shutil
import string
import subprocess
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional


# ANSI color codes
class Colors:
    """ANSI color codes for terminal output."""

    RED = "\033[0;31m"
    GREEN = "\033[0;32m"
    YELLOW = "\033[1;33m"
    BLUE = "\033[0;34m"
    NC = "\033[0m"


def log_info(message: str) -> None:
    """Log info message."""
    print(f"{Colors.BLUE}\u2139\ufe0f  {message}{Colors.NC}")


def log_success(message: str) -> None:
    """Log success message."""
    print(f"{Colors.GREEN}\u2705 {message}{Colors.NC}")


def log_warning(message: str) -> None:
    """Log warning message."""
    print(f"{Colors.YELLOW}\u26a0\ufe0f  {message}{Colors.NC}")


def log_error(message: str) -> None:
    """Log error message."""
    print(f"{Colors.RED}\u274c {message}{Colors.NC}")


@dataclass
class SecretsConfig:
    """Secrets setup configuration."""

    script_dir: Path
    project_root: Path
    default_namespace: str = "vibecode-dev"
    write_env: bool = False
    verify_only: bool = False
    dry_run: bool = False
    namespace: str = field(default="")

    def __post_init__(self) -> None:
        """Set default namespace if not specified."""
        if not self.namespace:
            self.namespace = self.default_namespace

    @classmethod
    def from_script_location(cls) -> "SecretsConfig":
        """Create config based on script location."""
        script_dir = Path(__file__).parent.resolve()
        project_root = script_dir.parent
        return cls(script_dir=script_dir, project_root=project_root)


def run_command(
    command: list[str],
    capture: bool = True,
    input_data: Optional[str] = None,
    timeout: int = 30,
) -> tuple[bool, str, str]:
    """Run a shell command.

    Args:
        command: Command and arguments.
        capture: Whether to capture output.
        input_data: Input to pass to stdin.
        timeout: Command timeout in seconds.

    Returns:
        Tuple of (success, stdout, stderr).
    """
    try:
        result = subprocess.run(
            command,
            capture_output=capture,
            text=True,
            input=input_data,
            timeout=timeout,
        )
        return result.returncode == 0, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return False, "", "Command timed out"
    except subprocess.SubprocessError as e:
        return False, "", str(e)


def generate_password(length: int = 32) -> str:
    """Generate a secure random password.

    Args:
        length: Password length.

    Returns:
        Generated password.
    """
    alphabet = string.ascii_letters + string.digits + "!@#%^*_+="
    return "".join(secrets.choice(alphabet) for _ in range(length))


def write_env_if_requested(config: SecretsConfig, key: str, value: str) -> None:
    """Optionally persist generated creds to .env.local.

    Args:
        config: Secrets configuration.
        key: Environment variable name.
        value: Environment variable value.
    """
    if not config.write_env:
        return

    env_file = config.project_root / ".env.local"

    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    entry = f"\n# Added by setup-secrets.py on {timestamp}\n{key}={value}\n"

    with open(env_file, "a") as f:
        f.write(entry)


def ensure_dbm_creds(config: SecretsConfig) -> None:
    """Ensure Datadog DBM username/password exist in env.

    Args:
        config: Secrets configuration.
    """
    # Username: default to 'datadog' if unset
    if not os.environ.get("DD_POSTGRES_USER"):
        os.environ["DD_POSTGRES_USER"] = "datadog"
        write_env_if_requested(config, "DD_POSTGRES_USER", "datadog")

    # Maintain legacy alias
    if not os.environ.get("DATADOG_POSTGRES_USER"):
        os.environ["DATADOG_POSTGRES_USER"] = os.environ["DD_POSTGRES_USER"]

    # Password: prefer DD_POSTGRES_PASSWORD, fallback from legacy, otherwise generate
    if not os.environ.get("DD_POSTGRES_PASSWORD") and os.environ.get("DATADOG_POSTGRES_PASSWORD"):
        os.environ["DD_POSTGRES_PASSWORD"] = os.environ["DATADOG_POSTGRES_PASSWORD"]
        log_warning("DD_POSTGRES_PASSWORD missing; using legacy DATADOG_POSTGRES_PASSWORD")

    if not os.environ.get("DD_POSTGRES_PASSWORD"):
        generated = generate_password()
        os.environ["DD_POSTGRES_PASSWORD"] = generated
        os.environ["DATADOG_POSTGRES_PASSWORD"] = generated
        write_env_if_requested(config, "DD_POSTGRES_PASSWORD", generated)
        if config.write_env:
            write_env_if_requested(config, "DATADOG_POSTGRES_PASSWORD", generated)
        log_success("Generated Datadog DBM password")


def check_dependencies() -> bool:
    """Check required dependencies.

    Returns:
        True if all dependencies found, False otherwise.
    """
    log_info("Checking dependencies...")

    missing_deps: list[str] = []

    if not shutil.which("kubectl"):
        missing_deps.append("kubectl")

    if not shutil.which("helm"):
        missing_deps.append("helm")

    if missing_deps:
        log_error(f"Missing dependencies: {' '.join(missing_deps)}")
        log_info("Please install the missing dependencies and try again")
        return False

    log_success("All dependencies found")
    return True


def source_environment(config: SecretsConfig) -> None:
    """Source environment variables from files.

    Args:
        config: Secrets configuration.
    """
    log_info("Sourcing environment variables...")

    env_files = [
        config.project_root / ".env",
        config.project_root / ".env.local",
        Path.home() / ".vibecode" / ".env",
    ]

    sourced = False
    for env_file in env_files:
        if env_file.exists():
            log_info(f"Sourcing {env_file}")
            # Parse .env file
            with open(env_file) as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        key, _, value = line.partition("=")
                        key = key.strip()
                        value = value.strip().strip('"').strip("'")
                        if key and key not in os.environ:
                            os.environ[key] = value
            sourced = True
            break

    if not sourced:
        log_warning("No environment file found. Checking environment variables...")


def validate_environment() -> bool:
    """Validate required environment variables.

    Returns:
        True if all required variables are set, False otherwise.
    """
    log_info("Validating environment variables...")

    # Handle legacy fallback
    if not os.environ.get("DD_API_KEY") and os.environ.get("DATADOG_API_KEY"):
        os.environ["DD_API_KEY"] = os.environ["DATADOG_API_KEY"]
        log_warning("DD_API_KEY missing; using legacy DATADOG_API_KEY")

    # Warn if both are set and differ
    dd_key = os.environ.get("DD_API_KEY", "")
    datadog_key = os.environ.get("DATADOG_API_KEY", "")
    if dd_key and datadog_key and dd_key != datadog_key:
        log_warning("Both DD_API_KEY and DATADOG_API_KEY are set and differ; using DD_API_KEY")

    required_vars = [
        ("DD_API_KEY", "Datadog API Key"),
        ("POSTGRES_PASSWORD", "PostgreSQL Password"),
    ]

    missing_vars: list[str] = []

    for var_name, var_desc in required_vars:
        if os.environ.get(var_name):
            log_success(f"{var_desc}: \u2713")
        else:
            missing_vars.append(f"{var_name} ({var_desc})")

    if missing_vars:
        log_error("Missing required environment variables:")
        for var in missing_vars:
            log_error(f"  - {var}")
        log_info("")
        log_info("Please set these variables in one of:")
        log_info("  - .env (preferred) or .env.local")
        log_info("  - Environment variables")
        log_info("  - CI/CD pipeline secrets")
        return False

    log_success("All required environment variables are set")
    return True


def check_kubernetes_connection() -> bool:
    """Check Kubernetes connection.

    Returns:
        True if connected, False otherwise.
    """
    log_info("Checking Kubernetes connection...")

    success, _, _ = run_command(["kubectl", "cluster-info"])
    if not success:
        log_error("Cannot connect to Kubernetes cluster")
        log_info("Please ensure kubectl is configured and cluster is accessible")
        return False

    success, stdout, _ = run_command(["kubectl", "config", "current-context"])
    if success:
        context = stdout.strip()
        log_success(f"Connected to Kubernetes cluster: {context}")

    return True


def ensure_namespace(namespace: str) -> bool:
    """Create namespace if it doesn't exist.

    Args:
        namespace: Namespace name.

    Returns:
        True if namespace exists or was created, False otherwise.
    """
    log_info(f"Ensuring namespace '{namespace}' exists...")

    success, _, _ = run_command(["kubectl", "get", "namespace", namespace])
    if success:
        log_success(f"Namespace '{namespace}' already exists")
        return True

    log_info(f"Creating namespace '{namespace}'...")
    success, _, _ = run_command(["kubectl", "create", "namespace", namespace])
    if not success:
        log_error(f"Failed to create namespace '{namespace}'")
        return False

    # Add labels
    environment = namespace.replace("vibecode-", "")
    run_command([
        "kubectl", "label", "namespace", namespace,
        "app.kubernetes.io/managed-by=vibecode-platform",
        f"environment={environment}",
    ])

    log_success(f"Namespace '{namespace}' created")
    return True


def base64_encode(value: str) -> str:
    """Base64 encode a string.

    Args:
        value: String to encode.

    Returns:
        Base64 encoded string.
    """
    return base64.b64encode(value.encode()).decode()


def create_or_update_secret(namespace: str, secret_name: str, secret_yaml: str) -> bool:
    """Create or update a Kubernetes secret.

    Args:
        namespace: Target namespace.
        secret_name: Secret name.
        secret_yaml: Secret YAML definition.

    Returns:
        True if successful, False otherwise.
    """
    log_info(f"Managing secret '{secret_name}' in namespace '{namespace}'...")

    # Check if secret exists
    success, _, _ = run_command(["kubectl", "get", "secret", secret_name, "-n", namespace])

    if success:
        log_info(f"Secret '{secret_name}' exists, updating...")
    else:
        log_info(f"Creating new secret '{secret_name}'...")

    # Apply secret
    success, _, stderr = run_command(
        ["kubectl", "apply", "-f", "-"],
        input_data=secret_yaml,
    )

    if not success:
        log_error(f"Failed to apply secret: {stderr}")
        return False

    # Add labels
    run_command([
        "kubectl", "label", "secret", secret_name,
        "app.kubernetes.io/managed-by=vibecode-platform",
        "app.kubernetes.io/created-by=setup-secrets-script",
        f"--namespace={namespace}",
        "--overwrite",
    ])

    log_success(f"Secret '{secret_name}' {'updated' if success else 'created'} successfully")
    return True


def setup_datadog_secrets(namespace: str) -> bool:
    """Setup Datadog secrets.

    Args:
        namespace: Target namespace.

    Returns:
        True if successful, False otherwise.
    """
    log_info("Setting up Datadog secrets...")

    api_key = os.environ.get("DD_API_KEY", "")
    api_key_b64 = base64_encode(api_key)

    # Primary secret
    datadog_secret_yaml = f"""apiVersion: v1
kind: Secret
metadata:
  name: datadog-secret
  namespace: {namespace}
  labels:
    app.kubernetes.io/name: datadog-secret
    app.kubernetes.io/component: monitoring
    app.kubernetes.io/part-of: vibecode-platform
type: Opaque
data:
  api-key: {api_key_b64}
"""

    if not create_or_update_secret(namespace, "datadog-secret", datadog_secret_yaml):
        return False

    # Legacy alias
    datadog_legacy_yaml = f"""apiVersion: v1
kind: Secret
metadata:
  name: datadog-secrets
  namespace: {namespace}
  labels:
    app.kubernetes.io/name: datadog-secrets
    app.kubernetes.io/component: monitoring
    app.kubernetes.io/part-of: vibecode-platform
type: Opaque
data:
  api-key: {api_key_b64}
"""

    return create_or_update_secret(namespace, "datadog-secrets", datadog_legacy_yaml)


def setup_postgres_secrets(namespace: str) -> bool:
    """Setup PostgreSQL secrets.

    Args:
        namespace: Target namespace.

    Returns:
        True if successful, False otherwise.
    """
    log_info("Setting up PostgreSQL secrets...")

    # Resolve effective DBM creds
    effective_user = os.environ.get("DD_POSTGRES_USER") or os.environ.get("DATADOG_POSTGRES_USER") or "datadog"
    effective_pass = os.environ.get("DD_POSTGRES_PASSWORD") or os.environ.get("DATADOG_POSTGRES_PASSWORD") or ""

    if not effective_pass:
        log_error("Internal error: DD_POSTGRES_PASSWORD should have been generated; empty at secret creation")
        return False

    postgres_password = os.environ.get("POSTGRES_PASSWORD", "")

    postgres_secret_yaml = f"""apiVersion: v1
kind: Secret
metadata:
  name: postgres-credentials
  namespace: {namespace}
  labels:
    app.kubernetes.io/name: postgres-credentials
    app.kubernetes.io/component: database
    app.kubernetes.io/part-of: vibecode-platform
type: Opaque
data:
  postgres-password: {base64_encode(postgres_password)}
  datadog-username: {base64_encode(effective_user)}
  datadog-password: {base64_encode(effective_pass)}
"""

    return create_or_update_secret(namespace, "postgres-credentials", postgres_secret_yaml)


def verify_secret_key(namespace: str, secret_name: str, key: str) -> bool:
    """Verify a secret key exists and is valid.

    Args:
        namespace: Target namespace.
        secret_name: Secret name.
        key: Key to verify.

    Returns:
        True if key exists and is valid, False otherwise.
    """
    success, stdout, _ = run_command([
        "kubectl", "get", "secret", secret_name,
        "-n", namespace,
        "-o", f"jsonpath={{.data.{key}}}",
    ])

    if success and stdout:
        try:
            base64.b64decode(stdout)
            return True
        except Exception:
            return False
    return False


def verify_secrets(namespace: str) -> bool:
    """Verify all secrets.

    Args:
        namespace: Target namespace.

    Returns:
        True if all secrets are valid, False otherwise.
    """
    log_info(f"Verifying secrets in namespace '{namespace}'...")

    secrets_to_verify = [
        ("datadog-secret", ["api-key"]),
        ("datadog-secrets", ["api-key"]),
        ("postgres-credentials", ["postgres-password", "datadog-username", "datadog-password"]),
    ]

    all_good = True

    for secret_name, keys in secrets_to_verify:
        success, _, _ = run_command(["kubectl", "get", "secret", secret_name, "-n", namespace])

        if success:
            log_success(f"Secret '{secret_name}': \u2713")

            for key in keys:
                if verify_secret_key(namespace, secret_name, key):
                    log_success(f"  - {key}: \u2713")
                else:
                    log_error(f"  - {key}: Missing or invalid")
                    all_good = False
        else:
            log_error(f"Secret '{secret_name}': Missing")
            all_good = False

    if all_good:
        log_success("All secrets verified successfully!")
    else:
        log_error("Some secrets are missing or invalid")

    return all_good


def print_next_steps(namespace: str) -> None:
    """Print next steps after successful setup.

    Args:
        namespace: Target namespace.
    """
    log_info("")
    log_info("Next steps:")
    log_info("  1. Deploy with Helm:")
    log_info("     helm install vibecode-dev ./helm/vibecode-platform \\")
    log_info("       -f ./helm/vibecode-platform/values-dev.yaml \\")
    log_info(f"       --namespace={namespace}")
    log_info("")
    log_info("  2. Verify Datadog monitoring:")
    log_info(f"     kubectl get pods -n {namespace} | grep datadog")


def setup_secrets(config: SecretsConfig) -> int:
    """Run secrets setup.

    Args:
        config: Secrets configuration.

    Returns:
        Exit code (0 for success, 1 for failure).
    """
    log_info("\U0001f510 Kubernetes Secrets Automation - 2025 Best Practices")
    log_info(f"Target namespace: {config.namespace}")

    if config.dry_run:
        log_warning("DRY RUN MODE - No changes will be made")

    # Run checks
    if not check_dependencies():
        return 1

    source_environment(config)
    ensure_dbm_creds(config)

    if not validate_environment():
        return 1

    if not check_kubernetes_connection():
        return 1

    # Verify only mode
    if config.verify_only:
        log_info("Running in verify-only mode...")
        return 0 if verify_secrets(config.namespace) else 1

    # Dry run mode
    if config.dry_run:
        log_info(f"Would create/update secrets in namespace: {config.namespace}")
        log_info("  - datadog-secret (api-key)")
        log_info("  - datadog-secrets (api-key) [legacy alias]")
        log_info("  - postgres-credentials (postgres-password, datadog-username, datadog-password)")
        return 0

    # Setup secrets
    if not ensure_namespace(config.namespace):
        return 1

    if not setup_datadog_secrets(config.namespace):
        return 1

    if not setup_postgres_secrets(config.namespace):
        return 1

    # Verify
    if verify_secrets(config.namespace):
        log_success("\U0001f389 Secrets automation completed successfully!")
        print_next_steps(config.namespace)
        return 0
    else:
        log_error("\u274c Secrets automation failed!")
        return 1


def main() -> int:
    """Main entry point."""
    config = SecretsConfig.from_script_location()

    parser = argparse.ArgumentParser(
        description="Kubernetes Secrets Automation Script - 2025 Best Practices",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
ENVIRONMENT VARIABLES:
    Required:
        DD_API_KEY                        Datadog API Key
        POSTGRES_PASSWORD                 PostgreSQL admin password

    Optional:
        DD_POSTGRES_USER                  Datadog DBM username (default: datadog)
        DD_POSTGRES_PASSWORD              Datadog DBM password (auto-generated if missing)
        DATADOG_POSTGRES_PASSWORD         Legacy fallback for DD_POSTGRES_PASSWORD
        DATADOG_API_KEY                   Legacy fallback for DD_API_KEY

ENVIRONMENT FILES:
    The script will automatically source environment variables from:
        1. .env (preferred)
        2. .env.local
        3. ~/.vibecode/.env
""",
    )

    parser.add_argument(
        "namespace",
        nargs="?",
        default=config.default_namespace,
        help=f"Target namespace (default: {config.default_namespace})",
    )
    parser.add_argument(
        "-v", "--verify-only",
        action="store_true",
        help="Only verify existing secrets, don't create/update",
    )
    parser.add_argument(
        "-d", "--dry-run",
        action="store_true",
        help="Show what would be done without making changes",
    )
    parser.add_argument(
        "--write-env",
        action="store_true",
        help="Persist generated DBM creds to .env.local",
    )

    args = parser.parse_args()

    config.namespace = args.namespace
    config.verify_only = args.verify_only
    config.dry_run = args.dry_run
    config.write_env = args.write_env

    return setup_secrets(config)


if __name__ == "__main__":
    sys.exit(main())
