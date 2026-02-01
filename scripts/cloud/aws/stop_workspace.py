#!/usr/bin/env python3


"""Stop or terminate an AWS code-server workspace instance."""

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
class AWSStopConfig:
    """AWS stop workspace configuration."""

    region: str = "us-east-1"
    profile: Optional[str] = None
    instance_name: str = "codeserver-dev"
    terminate: bool = False

    @classmethod
    def from_env(cls) -> "AWSStopConfig":
        """Create config from environment variables."""
        return cls(
            region=os.environ.get("AWS_REGION", "us-east-1"),
            profile=os.environ.get("AWS_PROFILE"),
            instance_name=os.environ.get("INSTANCE_NAME", "codeserver-dev"),
            terminate=os.environ.get("TERMINATE", "false").lower() == "true",
        )


def get_profile_args(config: AWSStopConfig) -> list[str]:
    """Get AWS profile arguments if profile is set."""
    if config.profile:
        return ["--profile", config.profile]
    return []


def find_instance(config: AWSStopConfig) -> Optional[str]:
    """Find an instance by name tag.

    Returns:
        Instance ID if found, None otherwise.
    """
    cmd = [
        "aws", "ec2", "describe-instances",
        "--region", config.region,
        *get_profile_args(config),
        "--filters",
        f"Name=tag:Name,Values={config.instance_name}",
        "Name=instance-state-name,Values=running,stopped",
        "--query", "Reservations[].Instances[].InstanceId",
        "--output", "text",
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip().split()[0]
    except (subprocess.TimeoutExpired, subprocess.SubprocessError):
        pass

    return None


def stop_instance(config: AWSStopConfig, instance_id: str) -> bool:
    """Stop an instance.

    Returns:
        True if successful, False otherwise.
    """
    print(f"Stopping instance {instance_id}")

    cmd = [
        "aws", "ec2", "stop-instances",
        "--region", config.region,
        *get_profile_args(config),
        "--instance-ids", instance_id,
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, timeout=60)
        if result.returncode == 0:
            print("Instance stopped.")
            return True
    except (subprocess.TimeoutExpired, subprocess.SubprocessError):
        pass

    return False


def terminate_instance(config: AWSStopConfig, instance_id: str) -> bool:
    """Terminate an instance.

    Returns:
        True if successful, False otherwise.
    """
    print(f"Terminating instance {instance_id} (EBS volumes preserved unless DeleteOnTermination=true).")

    cmd = [
        "aws", "ec2", "terminate-instances",
        "--region", config.region,
        *get_profile_args(config),
        "--instance-ids", instance_id,
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, timeout=60)
        return result.returncode == 0
    except (subprocess.TimeoutExpired, subprocess.SubprocessError):
        return False


def stop_workspace(config: Optional[AWSStopConfig] = None) -> int:
    """Stop or terminate an AWS workspace.

    Args:
        config: AWS configuration (uses env vars if None)

    Returns:
        Exit code (0 for success, 1 for failure)
    """
    if config is None:
        config = AWSStopConfig.from_env()

    # Check for aws CLI
    if not shutil.which("aws"):
        print("ERROR: aws CLI not found", file=sys.stderr)
        return 1

    # Find instance
    instance_id = find_instance(config)

    if not instance_id:
        print(f"No instance found for tag Name={config.instance_name}")
        return 0

    # Stop instance
    if not stop_instance(config, instance_id):
        print("ERROR: Failed to stop instance", file=sys.stderr)
        return 1

    # Optionally terminate
    if config.terminate:
        if not terminate_instance(config, instance_id):
            print("ERROR: Failed to terminate instance", file=sys.stderr)
            return 1

    return 0


def main() -> int:
    """Main entry point."""
    return stop_workspace()


if __name__ == "__main__":
    sys.exit(main())