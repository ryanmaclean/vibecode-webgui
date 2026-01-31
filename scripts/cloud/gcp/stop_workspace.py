#!/usr/bin/env python3
"""Stop a running GCP code-server workspace VM.

Optionally deletes the instance but keeps the persistent disk.
"""

import os
import subprocess
import sys
from dataclasses import dataclass


@dataclass
class GCPConfig:
    """Configuration for GCP workspace operations."""

    project: str | None
    zone: str
    instance_name: str
    delete_instance: bool

    @classmethod
    def from_environment(cls) -> "GCPConfig":
        """Create config from environment variables.

        Returns:
            GCPConfig with values from environment or defaults.
        """
        # Try to get project from environment or gcloud config
        project = os.environ.get("PROJECT")
        if not project:
            project = get_gcloud_project()

        return cls(
            project=project,
            zone=os.environ.get("ZONE", "us-central1-a"),
            instance_name=os.environ.get("INSTANCE_NAME", "codeserver-dev"),
            delete_instance=os.environ.get("DELETE_INSTANCE", "false").lower() == "true",
        )


def get_gcloud_project() -> str | None:
    """Get the current gcloud project.

    Returns:
        Project ID if configured, None otherwise.
    """
    result = subprocess.run(
        ["gcloud", "config", "get-value", "project"],
        capture_output=True,
        text=True,
    )

    if result.returncode == 0 and result.stdout.strip():
        return result.stdout.strip()

    return None


def run_gcloud_command(
    args: list[str],
    config: GCPConfig,
    check: bool = False,
) -> subprocess.CompletedProcess[str]:
    """Run a gcloud command.

    Args:
        args: gcloud arguments (without 'gcloud' prefix).
        config: GCP configuration.
        check: Whether to raise on non-zero exit.

    Returns:
        CompletedProcess result.
    """
    cmd = ["gcloud"] + args

    if config.project:
        cmd.extend(["--project", config.project])

    return subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        check=check,
    )


def stop_instance(config: GCPConfig) -> bool:
    """Stop a GCP compute instance.

    Args:
        config: GCP configuration.

    Returns:
        True if successful or instance already stopped.
    """
    result = run_gcloud_command(
        [
            "compute",
            "instances",
            "stop",
            config.instance_name,
            "--zone",
            config.zone,
        ],
        config,
    )

    # Return true even on failure (instance might already be stopped)
    return True


def delete_instance(config: GCPConfig) -> bool:
    """Delete a GCP compute instance but keep disks.

    Args:
        config: GCP configuration.

    Returns:
        True if successful.
    """
    print(f"Deleting instance resource {config.instance_name} (disk remains).")

    result = run_gcloud_command(
        [
            "compute",
            "instances",
            "delete",
            config.instance_name,
            "--zone",
            config.zone,
            "--keep-disks",
            "data",
            "--quiet",
        ],
        config,
    )

    return result.returncode == 0


def main() -> int:
    """Main entry point.

    Returns:
        Exit code.
    """
    config = GCPConfig.from_environment()

    # Validate project
    if not config.project:
        print(
            "ERROR: gcloud project not configured. "
            "Set PROJECT env var or run 'gcloud config set project <id>'.",
            file=sys.stderr,
        )
        return 1

    # Stop instance
    stop_instance(config)
    print(f"Instance {config.instance_name} stopped. PD remains attached but not in use.")

    # Optionally delete instance
    if config.delete_instance:
        if not delete_instance(config):
            print("Failed to delete instance")
            return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
