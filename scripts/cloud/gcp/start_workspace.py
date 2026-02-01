#!/usr/bin/env python3
<<<<<<< HEAD


"""Start (or create) a preemptible GCP VM that runs code-server with a persistent PD.

Prerequisites: gcloud CLI authenticated, project set, docker image pushed to Artifact Registry.
"""

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
=======
"""Start (or create) a preemptible GCP VM for code-server.

Prerequisites: gcloud CLI authenticated, project set.
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


def get_default_service_account(project: str) -> str:
    """Get the default Compute Engine service account."""
    result = run_cmd([
        "gcloud", "iam", "service-accounts", "list",
        "--filter", "displayName:Compute Engine default service account",
        "--format", "value(email)",
        "--project", project,
    ])
    return result.stdout.strip() if result.returncode == 0 else ""


def disk_exists(project: str, disk_name: str) -> bool:
    """Check if a persistent disk exists."""
    result = run_cmd([
        "gcloud", "compute", "disks", "list",
        "--project", project,
        "--filter", f"name={disk_name}",
        "--format", "value(name)",
    ])
    return bool(result.stdout.strip())


def instance_exists(project: str, instance_name: str) -> bool:
    """Check if an instance exists."""
    result = run_cmd([
        "gcloud", "compute", "instances", "list",
        "--project", project,
        "--filter", f"name={instance_name}",
        "--format", "value(name)",
    ])
    return bool(result.stdout.strip())


def create_disk(
    project: str,
    zone: str,
    disk_name: str,
    disk_size_gb: int,
) -> bool:
    """Create a persistent disk."""
    result = run_cmd([
        "gcloud", "compute", "disks", "create", disk_name,
        "--project", project,
        "--size", f"{disk_size_gb}GiB",
        "--type", "pd-standard",
        "--zone", zone,
    ], capture=False)
    return result.returncode == 0


def create_instance(
    project: str,
    zone: str,
    instance_name: str,
    disk_name: str,
    machine_type: str,
    container_image: str,
    network_tags: str,
    password: str,
    service_account: str,
) -> bool:
    """Create a preemptible container instance."""
    result = run_cmd([
        "gcloud", "compute", "instances", "create-with-container", instance_name,
        "--project", project,
        "--zone", zone,
        "--container-image", container_image,
        "--container-restart-policy", "on-failure",
        "--container-mount-disk", f"mount-path=/home/coder/workspace,name={disk_name}",
        "--container-env", f"PASSWORD={password}",
        "--machine-type", machine_type,
        "--network-interface", "subnet=default",
        "--tags", network_tags,
>>>>>>> 699bd88d9 (feat(scripts): convert shell scripts to Python with type hints)
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
<<<<<<< HEAD
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

=======
    ], capture=False)
    return result.returncode == 0


def start_instance(project: str, zone: str, instance_name: str) -> bool:
    """Start an existing instance."""
    result = run_cmd([
        "gcloud", "compute", "instances", "start", instance_name,
        "--zone", zone,
        "--project", project,
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
        "--disk-name",
        default=get_env("DISK_NAME"),
        help="Persistent disk name (default: <instance-name>-pd)",
    )
    parser.add_argument(
        "--disk-size-gb",
        type=int,
        default=int(get_env("DISK_SIZE_GB", "50")),
        help="Disk size in GB (default: 50)",
    )
    parser.add_argument(
        "--machine-type",
        default=get_env("MACHINE_TYPE", "e2-small"),
        help="Machine type (default: e2-small)",
    )
    parser.add_argument(
        "--container-image",
        default=get_env("CONTAINER_IMAGE", "ghcr.io/ryanmaclean/vibecode-codeserver:latest"),
        help="Container image",
    )
    parser.add_argument(
        "--network-tags",
        default=get_env("NETWORK_TAGS", "codeserver"),
        help="Network tags",
    )
    parser.add_argument(
        "--password",
        default=get_env("PASSWORD", "changeme"),
        help="code-server password",
    )
    parser.add_argument(
        "--iap-ssh",
        action="store_true",
        default=get_env("IAP_SSH", "false").lower() == "true",
        help="Print IAP SSH tunnel command",
    )

    args = parser.parse_args(argv)

    if not args.project:
        print("ERROR: gcloud project not configured.")
        print("Set PROJECT env var or run 'gcloud config set project <id>'.")
        return 1

    print(f"Using project: {args.project}")

    disk_name = args.disk_name or f"{args.instance_name}-pd"

    # Create disk if needed
    if not disk_exists(args.project, disk_name):
        print(f"Creating persistent disk {disk_name} ({args.disk_size_gb} GiB)...")
        if not create_disk(args.project, args.zone, disk_name, args.disk_size_gb):
            print("Failed to create disk")
            return 1
    else:
        print(f"Re-using existing disk: {disk_name}")

    # Get service account
    service_account = get_default_service_account(args.project)
    if not service_account:
        print("WARNING: Could not find default service account")
        service_account = "default"

    # Create or start instance
    if not instance_exists(args.project, args.instance_name):
        print(f"Creating preemptible VM {args.instance_name}...")
        if not create_instance(
            args.project,
            args.zone,
            args.instance_name,
            disk_name,
            args.machine_type,
            args.container_image,
            args.network_tags,
            args.password,
            service_account,
        ):
            print("Failed to create instance")
            return 1
    else:
        print(f"Starting existing instance: {args.instance_name}")
        if not start_instance(args.project, args.zone, args.instance_name):
            print("Failed to start instance")
            return 1

    if args.iap_ssh:
        print()
        print("Tip: To tunnel via IAP run:")
        print(f"  gcloud compute ssh {args.instance_name} --project {args.project} "
              f"--zone {args.zone} -- -N -L 8765:localhost:8765")

    print()
>>>>>>> 699bd88d9 (feat(scripts): convert shell scripts to Python with type hints)
    print("Workspace available once container finishes bootstrapping.")
    return 0


<<<<<<< HEAD
def main() -> int:
    """Main entry point."""
    return start_workspace()


if __name__ == "__main__":
    sys.exit(main())
=======
if __name__ == "__main__":
    sys.exit(main())
>>>>>>> 699bd88d9 (feat(scripts): convert shell scripts to Python with type hints)
