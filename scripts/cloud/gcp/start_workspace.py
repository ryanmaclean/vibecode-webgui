#!/usr/bin/env python3
"""
Start (or create) a preemptible GCP VM that runs code-server with a persistent PD.

Prerequisites:
- gcloud CLI authenticated
- Project set
- Docker image pushed to Artifact Registry
"""

import argparse
import os
import subprocess
import sys
from dataclasses import dataclass
from typing import Optional


@dataclass
class WorkspaceConfig:
    """Configuration for the GCP workspace."""

    project: str
    zone: str = "us-central1-a"
    instance_name: str = "codeserver-dev"
    disk_name: Optional[str] = None
    disk_size_gb: int = 50
    machine_type: str = "e2-small"
    image_family: str = "debian-12"
    image_project: str = "debian-cloud"
    container_image: str = "ghcr.io/ryanmaclean/vibecode-codeserver:latest"
    network_tags: str = "codeserver"
    iap_ssh: bool = False
    password: str = "changeme"

    def __post_init__(self) -> None:
        if self.disk_name is None:
            self.disk_name = f"{self.instance_name}-pd"


def get_current_project() -> Optional[str]:
    """Get the current gcloud project."""
    result = subprocess.run(
        ["gcloud", "config", "get-value", "project"],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode == 0 and result.stdout.strip():
        return result.stdout.strip()
    return None


def disk_exists(project: str, disk_name: str) -> bool:
    """Check if a persistent disk exists."""
    result = subprocess.run(
        [
            "gcloud", "compute", "disks", "list",
            "--project", project,
            "--filter", f"name={disk_name}",
            "--format", "value(name)",
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    return bool(result.stdout.strip())


def create_disk(project: str, disk_name: str, disk_size_gb: int, zone: str) -> None:
    """Create a persistent disk."""
    print(f"Creating persistent disk {disk_name} ({disk_size_gb} GiB)...")
    subprocess.run(
        [
            "gcloud", "compute", "disks", "create", disk_name,
            "--project", project,
            "--size", f"{disk_size_gb}GiB",
            "--type", "pd-standard",
            "--zone", zone,
        ],
        check=True,
    )


def instance_exists(project: str, instance_name: str) -> bool:
    """Check if a VM instance exists."""
    result = subprocess.run(
        [
            "gcloud", "compute", "instances", "list",
            "--project", project,
            "--filter", f"name={instance_name}",
            "--format", "value(name)",
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    return bool(result.stdout.strip())


def get_default_service_account(project: str) -> str:
    """Get the default Compute Engine service account email."""
    result = subprocess.run(
        [
            "gcloud", "iam", "service-accounts", "list",
            "--filter", "displayName:Compute Engine default service account",
            "--format", "value(email)",
            "--project", project,
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    return result.stdout.strip()


def create_instance(config: WorkspaceConfig) -> None:
    """Create a new preemptible VM instance with container."""
    print(f"Creating preemptible VM {config.instance_name}...")

    service_account = get_default_service_account(config.project)

    cmd = [
        "gcloud", "compute", "instances", "create-with-container", config.instance_name,
        "--project", config.project,
        "--zone", config.zone,
        "--container-image", config.container_image,
        "--container-restart-policy", "on-failure",
        "--container-mount-disk", f"mount-path=/home/coder/workspace,name={config.disk_name}",
        "--container-env", f"PASSWORD={config.password}",
        "--machine-type", config.machine_type,
        "--network-interface", "subnet=default",
        "--tags", config.network_tags,
        "--service-account", service_account,
        "--scopes=https://www.googleapis.com/auth/devstorage.read_write",
        "--preemptible",
        "--maintenance-policy", "TERMINATE",
        "--provisioning-model", "SPOT",
        "--boot-disk-type=pd-balanced",
        "--boot-disk-size=20GB",
        "--container-mount-host-path", "mount-path=/var/run/docker.sock,host-path=/var/run/docker.sock",
        "--container-stdin",
        "--container-tty",
    ]

    subprocess.run(cmd, check=True)


def start_instance(project: str, instance_name: str, zone: str) -> None:
    """Start an existing VM instance."""
    print(f"Starting existing instance: {instance_name}")
    subprocess.run(
        [
            "gcloud", "compute", "instances", "start", instance_name,
            "--zone", zone,
            "--project", project,
        ],
        check=True,
    )


def start_workspace(config: WorkspaceConfig) -> int:
    """
    Start or create a GCP workspace.

    Args:
        config: Workspace configuration

    Returns:
        0 on success, 1 on failure
    """
    print(f"Using project: {config.project}")

    # Check/create persistent disk
    if not disk_exists(config.project, config.disk_name):
        create_disk(config.project, config.disk_name, config.disk_size_gb, config.zone)
    else:
        print(f"Re-using existing disk: {config.disk_name}")

    # Check/create or start instance
    if not instance_exists(config.project, config.instance_name):
        create_instance(config)
    else:
        start_instance(config.project, config.instance_name, config.zone)

    # Show IAP SSH tip if enabled
    if config.iap_ssh:
        print(
            f"Tip: To tunnel via IAP run -> "
            f"gcloud compute ssh {config.instance_name} "
            f"--project {config.project} --zone {config.zone} "
            f"-- -N -L 8765:localhost:8765"
        )

    print("Workspace available once container finishes bootstrapping.")

    return 0


def main() -> int:
    """Main entry point."""
    # Get default project
    default_project = os.environ.get("PROJECT") or get_current_project()

    parser = argparse.ArgumentParser(
        description="Start (or create) a preemptible GCP VM that runs code-server"
    )
    parser.add_argument(
        "--project",
        type=str,
        default=default_project,
        help="GCP project ID",
    )
    parser.add_argument(
        "--zone",
        type=str,
        default=os.environ.get("ZONE", "us-central1-a"),
        help="GCP zone (default: us-central1-a)",
    )
    parser.add_argument(
        "--instance-name",
        type=str,
        default=os.environ.get("INSTANCE_NAME", "codeserver-dev"),
        help="VM instance name (default: codeserver-dev)",
    )
    parser.add_argument(
        "--disk-name",
        type=str,
        default=os.environ.get("DISK_NAME"),
        help="Persistent disk name (default: <instance-name>-pd)",
    )
    parser.add_argument(
        "--disk-size-gb",
        type=int,
        default=int(os.environ.get("DISK_SIZE_GB", "50")),
        help="Persistent disk size in GB (default: 50)",
    )
    parser.add_argument(
        "--machine-type",
        type=str,
        default=os.environ.get("MACHINE_TYPE", "e2-small"),
        help="GCP machine type (default: e2-small)",
    )
    parser.add_argument(
        "--container-image",
        type=str,
        default=os.environ.get("CONTAINER_IMAGE", "ghcr.io/ryanmaclean/vibecode-codeserver:latest"),
        help="Container image to run",
    )
    parser.add_argument(
        "--network-tags",
        type=str,
        default=os.environ.get("NETWORK_TAGS", "codeserver"),
        help="Network tags (default: codeserver)",
    )
    parser.add_argument(
        "--iap-ssh",
        action="store_true",
        default=os.environ.get("IAP_SSH", "false").lower() == "true",
        help="Show IAP SSH tunnel tip",
    )
    parser.add_argument(
        "--password",
        type=str,
        default=os.environ.get("PASSWORD", "changeme"),
        help="code-server password",
    )
    args = parser.parse_args()

    if not args.project:
        print(
            "ERROR: gcloud project not configured. "
            "Set PROJECT env var or run 'gcloud config set project <id>'.",
            file=sys.stderr,
        )
        return 1

    config = WorkspaceConfig(
        project=args.project,
        zone=args.zone,
        instance_name=args.instance_name,
        disk_name=args.disk_name,
        disk_size_gb=args.disk_size_gb,
        machine_type=args.machine_type,
        container_image=args.container_image,
        network_tags=args.network_tags,
        iap_ssh=args.iap_ssh,
        password=args.password,
    )

    try:
        return start_workspace(config)
    except subprocess.CalledProcessError as e:
        print(f"ERROR: Command failed with exit code {e.returncode}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
