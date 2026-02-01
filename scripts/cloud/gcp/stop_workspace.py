#!/usr/bin/env python3
<<<<<<< HEAD


=======
>>>>>>> 699bd88d9 (feat(scripts): convert shell scripts to Python with type hints)
"""Stop a running GCP code-server workspace VM.

Optionally deletes the instance but keeps the persistent disk.
"""
<<<<<<< HEAD

from __future__ import annotations
# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

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
=======
from __future__ import annotations

import argparse
import os
import subprocess
import sys


def run_cmd(
    cmd: list[str],
    capture: bool = True,
    check: bool = False,
) -> subprocess.CompletedProcess[str]:
    """Run a command and return result."""
    return subprocess.run(cmd, capture_output=capture, text=True, check=check)


def get_env(name: str, default: str = "") -> str:
    """Get environment variable with default."""
    return os.environ.get(name, default)


def get_default_project() -> str:
    """Get the default GCP project from gcloud config."""
    result = run_cmd(["gcloud", "config", "get-value", "project"])
    return result.stdout.strip() if result.returncode == 0 else ""


def stop_instance(project: str, zone: str, instance_name: str) -> bool:
    """Stop an instance."""
    result = run_cmd([
        "gcloud", "compute", "instances", "stop", instance_name,
        "--zone", zone,
        "--project", project,
    ], capture=False)
    return result.returncode == 0


def delete_instance(project: str, zone: str, instance_name: str) -> bool:
    """Delete an instance but keep data disks."""
    result = run_cmd([
        "gcloud", "compute", "instances", "delete", instance_name,
        "--zone", zone,
        "--project", project,
        "--keep-disks", "data",
        "--quiet",
    ], capture=False)
    return result.returncode == 0


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--project",
        default=get_env("PROJECT") or get_default_project(),
        help="GCP project ID",
    )
    parser.add_argument(
        "--zone",
        default=get_env("ZONE", "us-central1-a"),
        help="GCP zone (default: us-central1-a)",
    )
    parser.add_argument(
        "--instance-name",
        default=get_env("INSTANCE_NAME", "codeserver-dev"),
        help="Instance name (default: codeserver-dev)",
    )
    parser.add_argument(
        "--delete",
        action="store_true",
        default=get_env("DELETE_INSTANCE", "false").lower() == "true",
        help="Delete instance (disk remains)",
    )

    args = parser.parse_args(argv)

    if not args.project:
        print("ERROR: gcloud project not configured.")
        print("Set PROJECT env var or run 'gcloud config set project <id>'.")
        return 1

    stop_instance(args.project, args.zone, args.instance_name)
    print(f"Instance {args.instance_name} stopped. PD remains attached but not in use.")

    if args.delete:
        print(f"Deleting instance resource {args.instance_name} (disk remains).")
        if not delete_instance(args.project, args.zone, args.instance_name):
            print("Failed to delete instance")
>>>>>>> 699bd88d9 (feat(scripts): convert shell scripts to Python with type hints)
            return 1

    return 0


<<<<<<< HEAD
def main() -> int:
    """Main entry point."""
    return stop_workspace()


if __name__ == "__main__":
    sys.exit(main())
=======
if __name__ == "__main__":
    sys.exit(main())
>>>>>>> 699bd88d9 (feat(scripts): convert shell scripts to Python with type hints)
