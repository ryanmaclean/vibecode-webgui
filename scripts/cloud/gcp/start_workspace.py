#!/usr/bin/env python3
"""Start (or create) a preemptible GCP VM that runs code-server with a persistent PD.

Prerequisites: gcloud CLI authenticated, project set, docker image pushed to Artifact Registry.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from dataclasses import dataclass
from typing import Optional


@dataclass
class GCPConfig:
    """GCP workspace configuration."""

    project: Optional[str] = None
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
        """Set derived defaults."""
        if self.disk_name is None:
            self.disk_name = f"{self.instance_name}-pd"

    @classmethod
    def from_env(cls) -> "GCPConfig":
        """Create config from environment variables."""
        return cls(
            project=os.environ.get("PROJECT"),
            zone=os.environ.get("ZONE", "us-central1-a"),
            instance_name=os.environ.get("INSTANCE_NAME", "codeserver-dev"),
            disk_name=os.environ.get("DISK_NAME"),
            disk_size_gb=int(os.environ.get("DISK_SIZE_GB", "50")),
            machine_type=os.environ.get("MACHINE_TYPE", "e2-small"),
            image_family=os.environ.get("IMAGE_FAMILY", "debian-12"),
            image_project=os.environ.get("IMAGE_PROJECT", "debian-cloud"),
            container_image=os.environ.get(
                "CONTAINER_IMAGE", "ghcr.io/ryanmaclean/vibecode-codeserver:latest"
            ),
            network_tags=os.environ.get("NETWORK_TAGS", "codeserver"),
            iap_ssh=os.environ.get("IAP_SSH", "false").lower() == "true",
            password=os.environ.get("PASSWORD", "changeme"),
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


def disk_exists(config: GCPConfig) -> bool:
    """Check if the persistent disk exists.

    Returns:
        True if disk exists, False otherwise.
    """
    cmd = [
        "gcloud", "compute", "disks", "list",
        "--project", config.project,
        f"--filter=name={config.disk_name}",
        "--format=value(name)",
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        return bool(result.stdout.strip())
    except (subprocess.TimeoutExpired, subprocess.SubprocessError):
        return False


def create_disk(config: GCPConfig) -> bool:
    """Create a persistent disk.

    Returns:
        True if successful, False otherwise.
    """
    print(f"Creating persistent disk {config.disk_name} ({config.disk_size_gb} GiB)...")

    cmd = [
        "gcloud", "compute", "disks", "create", config.disk_name,
        "--project", config.project,
        "--size", f"{config.disk_size_gb}GiB",
        "--type", "pd-standard",
        "--zone", config.zone,
    ]

    try:
        result = subprocess.run(cmd, timeout=120)
        return result.returncode == 0
    except (subprocess.TimeoutExpired, subprocess.SubprocessError):
        return False


def instance_exists(config: GCPConfig) -> bool:
    """Check if the instance exists.

    Returns:
        True if instance exists, False otherwise.
    """
    cmd = [
        "gcloud", "compute", "instances", "list",
        "--project", config.project,
        f"--filter=name={config.instance_name}",
        "--format=value(name)",
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        return bool(result.stdout.strip())
    except (subprocess.TimeoutExpired, subprocess.SubprocessError):
        return False


def get_default_service_account(project: str) -> Optional[str]:
    """Get the default Compute Engine service account.

    Returns:
        Service account email if found, None otherwise.
    """
    cmd = [
        "gcloud", "iam", "service-accounts", "list",
        "--filter=displayName:Compute Engine default service account",
        "--format=value(email)",
        "--project", project,
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip()
    except (subprocess.TimeoutExpired, subprocess.SubprocessError):
        pass
    return None


def create_instance(config: GCPConfig) -> bool:
    """Create a new preemptible VM with container.

    Returns:
        True if successful, False otherwise.
    """
    print(f"Creating preemptible VM {config.instance_name}...")

    service_account = get_default_service_account(config.project)
    if not service_account:
        print("WARNING: Could not find default service account", file=sys.stderr)
        service_account = ""

    cmd = [
        "gcloud", "compute", "instances", "create-with-container", config.instance_name,
        "--project", config.project,
        "--zone", config.zone,
        "--container-image", config.container_image,
        "--container-restart-policy", "on-failure",
        "--container-mount-disk",
        f"mount-path=/home/coder/workspace,name={config.disk_name}",
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
        "--container-mount-host-path",
        "mount-path=/var/run/docker.sock,host-path=/var/run/docker.sock",
        "--container-stdin", "--container-tty",
    ]

    try:
        result = subprocess.run(cmd, timeout=300)
        return result.returncode == 0
    except (subprocess.TimeoutExpired, subprocess.SubprocessError):
        return False


def start_instance(config: GCPConfig) -> bool:
    """Start an existing stopped instance.

    Returns:
        True if successful, False otherwise.
    """
    print(f"Starting existing instance: {config.instance_name}")

    cmd = [
        "gcloud", "compute", "instances", "start", config.instance_name,
        "--zone", config.zone,
        "--project", config.project,
    ]

    try:
        result = subprocess.run(cmd, timeout=120)
        return result.returncode == 0
    except (subprocess.TimeoutExpired, subprocess.SubprocessError):
        return False


def start_workspace(config: Optional[GCPConfig] = None) -> int:
    """Start or create a GCP workspace.

    Args:
        config: GCP configuration (uses env vars if None)

    Returns:
        Exit code (0 for success, 1 for failure)
    """
    if config is None:
        config = GCPConfig.from_env()

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

    print(f"Using project: {config.project}")

    # Ensure disk name is set
    if not config.disk_name:
        config.disk_name = f"{config.instance_name}-pd"

    # Create disk if needed
    if not disk_exists(config):
        if not create_disk(config):
            print("ERROR: Failed to create disk", file=sys.stderr)
            return 1
    else:
        print(f"Re-using existing disk: {config.disk_name}")

    # Create or start instance
    if not instance_exists(config):
        if not create_instance(config):
            print("ERROR: Failed to create instance", file=sys.stderr)
            return 1
    else:
        if not start_instance(config):
            print("ERROR: Failed to start instance", file=sys.stderr)
            return 1

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
    return start_workspace()


if __name__ == "__main__":
    sys.exit(main())
