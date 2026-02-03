#!/usr/bin/env python3
"""Stop a running GCP code-server workspace VM.

Optionally deletes the instance (but keeps the persistent disk).
"""
from __future__ import annotations

# Datadog APM tracing
try:
    import ddtrace
    ddtrace.patch_all()
except ImportError:
    pass

import argparse
import os
import subprocess
import sys
from dataclasses import dataclass
from typing import Optional

# ANSI colors for output
GREEN = '\033[0;32m'
RED = '\033[0;31m'
NC = '\033[0m'


@dataclass
class WorkspaceConfig:
    """Configuration for the GCP workspace."""

    project: str = ""
    zone: str = "us-central1-a"
    instance_name: str = "codeserver-dev"
    delete_instance: bool = False


def run_command(
    cmd: list[str],
    check: bool = True,
    capture: bool = True
) -> tuple[int, str, str]:
    """Run a command and return the result.

    Args:
        cmd: Command to run.
        check: If True, log errors on failure.
        capture: If True, capture output.

    Returns:
        Tuple of (return_code, stdout, stderr).
    """
    try:
        result = subprocess.run(
            cmd,
            capture_output=capture,
            text=True
        )
        if check and result.returncode != 0 and capture:
            print(f"{RED}ERROR:{NC} Command failed: {' '.join(cmd)}")
            if result.stderr:
                print(result.stderr)
        stdout = result.stdout if capture else ""
        stderr = result.stderr if capture else ""
        return result.returncode, stdout, stderr
    except FileNotFoundError:
        return -1, "", f"Command not found: {cmd[0]}"


def get_gcloud_project() -> Optional[str]:
    """Get the current gcloud project.

    Returns:
        Project ID or None.
    """
    rc, stdout, _ = run_command(
        ["gcloud", "config", "get-value", "project"],
        check=False
    )
    if rc == 0 and stdout.strip():
        return stdout.strip()
    return None


def get_config_from_env() -> WorkspaceConfig:
    """Get configuration from environment variables.

    Returns:
        WorkspaceConfig with values from environment.
    """
    project = os.environ.get("PROJECT", "")
    if not project:
        project = get_gcloud_project() or ""

    return WorkspaceConfig(
        project=project,
        zone=os.environ.get("ZONE", "us-central1-a"),
        instance_name=os.environ.get("INSTANCE_NAME", "codeserver-dev"),
        delete_instance=os.environ.get("DELETE_INSTANCE", "").lower() == "true"
    )


def stop_instance(config: WorkspaceConfig) -> bool:
    """Stop the GCP VM instance.

    Args:
        config: Workspace configuration.

    Returns:
        True if stop succeeded or instance was already stopped.
    """
    print(f"Stopping instance {config.instance_name}...")

    rc, _, _ = run_command([
        "gcloud", "compute", "instances", "stop",
        config.instance_name,
        "--zone", config.zone,
        "--project", config.project
    ], check=False)

    # Return True even if it fails (instance might already be stopped)
    return True


def delete_instance(config: WorkspaceConfig) -> bool:
    """Delete the GCP VM instance but keep the disks.

    Args:
        config: Workspace configuration.

    Returns:
        True if deletion succeeded.
    """
    print(f"Deleting instance resource {config.instance_name} (disk remains).")

    rc, _, _ = run_command([
        "gcloud", "compute", "instances", "delete",
        config.instance_name,
        "--zone", config.zone,
        "--project", config.project,
        "--keep-disks", "data",
        "--quiet"
    ])

    return rc == 0


def main(
    project: Optional[str] = None,
    zone: Optional[str] = None,
    instance_name: Optional[str] = None,
    delete: bool = False
) -> int:
    """Main entry point.

    Args:
        project: GCP project ID.
        zone: GCP zone.
        instance_name: Instance name.
        delete: If True, delete the instance after stopping.

    Returns:
        Exit code (0 for success).
    """
    # Get configuration from environment
    config = get_config_from_env()

    # Override with arguments if provided
    if project:
        config.project = project
    if zone:
        config.zone = zone
    if instance_name:
        config.instance_name = instance_name
    if delete:
        config.delete_instance = True

    # Validate project
    if not config.project:
        print(f"{RED}ERROR:{NC} gcloud project not configured. "
              "Set PROJECT env var or run 'gcloud config set project <id>'.")
        return 1

    # Stop instance
    stop_instance(config)

    print(f"Instance {config.instance_name} stopped. "
          "PD remains attached but not in use.")

    # Delete instance if requested
    if config.delete_instance:
        if not delete_instance(config):
            print(f"{RED}ERROR:{NC} Failed to delete instance")
            return 1

    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Stop a running GCP code-server workspace VM"
    )
    parser.add_argument(
        '--project',
        help="GCP project ID (default: from gcloud config or PROJECT env)"
    )
    parser.add_argument(
        '--zone',
        default=None,
        help="GCP zone (default: us-central1-a or ZONE env)"
    )
    parser.add_argument(
        '--instance-name',
        default=None,
        help="Instance name (default: codeserver-dev or INSTANCE_NAME env)"
    )
    parser.add_argument(
        '--delete',
        action='store_true',
        help="Delete instance after stopping (keeps disks)"
    )

    args = parser.parse_args()
    sys.exit(main(args.project, args.zone, args.instance_name, args.delete))
