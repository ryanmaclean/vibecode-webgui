#!/usr/bin/env python3
"""
Script to deploy Datadog Database Monitoring configuration.

Converts deploy-datadog-dbm.sh to Python with enhanced error handling and Datadog tracing.
"""

from __future__ import annotations

import argparse
import base64
import shutil
import subprocess
import sys
from pathlib import Path

# Datadog APM tracing
try:
    from ddtrace import tracer
except ImportError:
    tracer = None

# Local imports
try:
    from lib.vibecode_common import init_vibecode_script
    USE_COMMON = True
except ImportError:
    USE_COMMON = False
    import logging
    logging.basicConfig(level=logging.INFO)


class CommandError(RuntimeError):
    """Raised when an underlying command fails."""


def print_status(message: str, emoji: str = "") -> None:
    """Print a status message."""
    print(f"{emoji} {message}" if emoji else message)


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


def encode_password(password: str) -> str:
    """Base64 encode a password."""
    return base64.b64encode(password.encode()).decode()


def update_secret_file(secret_file: Path, encoded_password: str) -> None:
    """Update the secret file with the encoded password."""
    if not secret_file.exists():
        raise CommandError(f"Secret file not found: {secret_file}")

    content = secret_file.read_text()
    # Replace empty password with encoded password
    updated_content = content.replace(
        'password: ""',
        f'password: "{encoded_password}"',
    )
    secret_file.write_text(updated_content)


def deploy_dbm_config(
    db_password: str,
    namespace: str,
    project_root: Path,
) -> None:
    """Deploy Datadog DBM configuration."""
    # Create the Kubernetes directory if it doesn't exist
    k8s_datadog_dir = project_root / "kubernetes" / "datadog"
    k8s_datadog_dir.mkdir(parents=True, exist_ok=True)

    # Generate base64 encoded password
    encoded_password = encode_password(db_password)

    # Update the secret file
    secret_file = k8s_datadog_dir / "datadog-db-secret.yaml"
    if secret_file.exists():
        # Create backup
        backup_file = secret_file.with_suffix(".yaml.bak")
        shutil.copy(secret_file, backup_file)

        # Update the secret
        update_secret_file(secret_file, encoded_password)

    # Apply ConfigMap and Secret
    print_status("Applying Datadog DBM configuration...", "\U0001F527")  # wrench emoji

    config_file = k8s_datadog_dir / "datadog-dbm-config.yaml"
    if config_file.exists():
        run(["kubectl", "apply", "-f", str(config_file), "-n", namespace])

    if secret_file.exists():
        run(["kubectl", "apply", "-f", str(secret_file), "-n", namespace])

    # Restart Datadog agents to apply configuration changes
    print_status("Restarting Datadog agent...", "\U0001F504")  # reload emoji

    try:
        run([
            "kubectl", "rollout", "restart",
            "deployment/datadog-cluster-agent",
            "-n", namespace,
        ])
    except CommandError:
        print_status("Note: datadog-cluster-agent deployment not found, skipping restart")

    try:
        run([
            "kubectl", "rollout", "restart",
            "daemonset/datadog",
            "-n", namespace,
        ])
    except CommandError:
        print_status("Note: datadog daemonset not found, skipping restart")

    print_status("Datadog DBM configuration deployed successfully!", "\u2705")  # checkmark
    print_status("Monitor your database in the Datadog dashboard: https://app.datadoghq.com/databases", "\U0001F4CA")  # chart emoji


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Deploy Datadog Database Monitoring configuration",
    )

    parser.add_argument(
        "db_password",
        help="Database password to configure for DBM",
    )
    parser.add_argument(
        "--namespace",
        default="vibecode",
        help="Kubernetes namespace (default: vibecode)",
    )

    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    args = parse_args(argv)

    # Initialize logging and tracing
    if USE_COMMON:
        logger, config_mgr, metrics, shutdown = init_vibecode_script(
            "deploy_datadog_dbm",
            service_name="vibecode-dbm-deployment",
        )

    # Determine project root
    script_dir = Path(__file__).parent.resolve()
    project_root = script_dir.parent

    try:
        deploy_dbm_config(
            db_password=args.db_password,
            namespace=args.namespace,
            project_root=project_root,
        )

    except CommandError as e:
        print_status(f"Error: {e}", "\u274C")  # X emoji
        return 1
    except KeyboardInterrupt:
        print_status("\nDeployment cancelled by user")
        return 130

    return 0


if __name__ == "__main__":
    sys.exit(main())
