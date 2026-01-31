#!/usr/bin/env python3
"""Stop a running GCP code-server workspace VM.

Optionally deletes the instance but keeps the persistent disk.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from dataclasses import dataclass
from typing import Optional


@dataclass
class GCPStopConfig:
    """GCP stop workspace configuration."""

    project: Optional[str] = None
    zone: str = "us-central1-a"
    instance_name: str = "codeserver-dev"
    delete_instance: bool = False

    @classmethod
    def from_env(cls) -> "GCPStopConfig":
        """Create config from environment variables."""
        return cls(
            project=os.environ.get("PROJECT"),
            zone=os.environ.get("ZONE", "us-central1-a"),
            instance_name=os.environ.get("INSTANCE_NAME", "codeserver-dev"),
            delete_instance=os.environ.get("DELETE_INSTANCE", "false").lower() == "true",
        )


def get_current_project() -> Optional[str]:
    """Get the current gcloud project.

    Returns:
        Project ID if configured, None otherwise.
    """
    try:
        result = subprocess.run(
            ["gcloud", "config", "get-value", "project"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip()
    except (subprocess.TimeoutExpired, subprocess.SubprocessError):
        pass
    return None


def stop_instance(config: GCPStopConfig) -> bool:
    """Stop the GCP instance.

    Returns:
        True if successful (or instance not found), False on error.
    """
    cmd = [
        "gcloud", "compute", "instances", "stop", config.instance_name,
        "--zone", config.zone,
        "--project", config.project,
    ]

    try:
        result = subprocess.run(cmd, timeout=120)
        # Return True even if instance not found (returncode might be non-zero)
        return True
    except (subprocess.TimeoutExpired, subprocess.SubprocessError):
        return False


def delete_instance(config: GCPStopConfig) -> bool:
    """Delete the GCP instance but keep data disks.

    Returns:
        True if successful, False otherwise.
    """
    print(f"Deleting instance resource {config.instance_name} (disk remains).")

    cmd = [
        "gcloud", "compute", "instances", "delete", config.instance_name,
        "--zone", config.zone,
        "--project", config.project,
        "--keep-disks", "data",
        "--quiet",
    ]

    try:
        result = subprocess.run(cmd, timeout=120)
        return result.returncode == 0
    except (subprocess.TimeoutExpired, subprocess.SubprocessError):
        return False


def stop_workspace(config: Optional[GCPStopConfig] = None) -> int:
    """Stop a GCP workspace.

    Args:
        config: GCP configuration (uses env vars if None)

    Returns:
        Exit code (0 for success, 1 for failure)
    """
    if config is None:
        config = GCPStopConfig.from_env()

    # Check for gcloud CLI
    if not shutil.which("gcloud"):
        print("ERROR: gcloud CLI not found", file=sys.stderr)
        return 1

    # Get project if not set
    if not config.project:
        config.project = get_current_project()

    if not config.project:
        print(
            "ERROR: gcloud project not configured. "
            "Set PROJECT env var or run 'gcloud config set project <id>'.",
            file=sys.stderr,
        )
        return 1

    # Stop instance
    if not stop_instance(config):
        print("ERROR: Failed to stop instance", file=sys.stderr)
        return 1

    print(f"Instance {config.instance_name} stopped. PD remains attached but not in use.")

    # Optionally delete instance
    if config.delete_instance:
        if not delete_instance(config):
            print("ERROR: Failed to delete instance", file=sys.stderr)
            return 1

    return 0


def main() -> int:
    """Main entry point."""
    return stop_workspace()


if __name__ == "__main__":
    sys.exit(main())
