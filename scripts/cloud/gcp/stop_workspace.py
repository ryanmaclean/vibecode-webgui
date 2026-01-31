#!/usr/bin/env python3
"""Stop a running GCP code-server workspace VM.

Optionally deletes the instance but keeps the persistent disk.
"""
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
            return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
