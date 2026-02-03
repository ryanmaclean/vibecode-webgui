#!/usr/bin/env python3
"""Stop or terminate an AWS code-server workspace instance."""

from __future__ import annotations

import os
import subprocess
import sys
from dataclasses import dataclass, field


@dataclass
class AWSConfig:
    """AWS configuration for workspace instances."""

    region: str = field(default_factory=lambda: os.environ.get("AWS_REGION", "us-east-1"))
    profile: str = field(default_factory=lambda: os.environ.get("AWS_PROFILE", ""))
    instance_name: str = field(default_factory=lambda: os.environ.get("INSTANCE_NAME", "codeserver-dev"))
    terminate: bool = field(default_factory=lambda: os.environ.get("TERMINATE", "false").lower() == "true")

    def get_profile_args(self) -> list[str]:
        """Get AWS CLI profile arguments."""
        if self.profile:
            return ["--profile", self.profile]
        return []


def run_aws_command(
    args: list[str],
    config: AWSConfig,
    *,
    capture_output: bool = True,
) -> subprocess.CompletedProcess[str]:
    """Run an AWS CLI command.

    Args:
        args: AWS CLI arguments (without 'aws' prefix).
        config: AWS configuration.
        capture_output: Whether to capture stdout/stderr.

    Returns:
        Completed process result.
    """
    cmd = ["aws"] + args + ["--region", config.region] + config.get_profile_args()
    return subprocess.run(
        cmd,
        capture_output=capture_output,
        text=True,
    )


def find_instance(config: AWSConfig) -> str | None:
    """Find an instance by name tag.

    Args:
        config: AWS configuration.

    Returns:
        Instance ID if found, None otherwise.
    """
    result = run_aws_command(
        [
            "ec2", "describe-instances",
            "--filters",
            f"Name=tag:Name,Values={config.instance_name}",
            "Name=instance-state-name,Values=running,stopped",
            "--query", "Reservations[].Instances[].InstanceId",
            "--output", "text",
        ],
        config,
    )

    if result.returncode != 0:
        return None

    instance_id = result.stdout.strip().split("\n")[0] if result.stdout.strip() else ""
    return instance_id if instance_id else None


def stop_instance(instance_id: str, config: AWSConfig) -> bool:
    """Stop an EC2 instance.

    Args:
        instance_id: EC2 instance ID.
        config: AWS configuration.

    Returns:
        True if successful, False otherwise.
    """
    print(f"Stopping instance {instance_id}")

    result = run_aws_command(
        ["ec2", "stop-instances", "--instance-ids", instance_id],
        config,
    )

    if result.returncode == 0:
        print("Instance stopped.")
        return True

    print(f"Failed to stop instance: {result.stderr}", file=sys.stderr)
    return False


def terminate_instance(instance_id: str, config: AWSConfig) -> bool:
    """Terminate an EC2 instance.

    Args:
        instance_id: EC2 instance ID.
        config: AWS configuration.

    Returns:
        True if successful, False otherwise.
    """
    print(f"Terminating instance {instance_id} (EBS volumes preserved unless DeleteOnTermination=true).")

    result = run_aws_command(
        ["ec2", "terminate-instances", "--instance-ids", instance_id],
        config,
    )

    if result.returncode == 0:
        print("Instance terminated.")
        return True

    print(f"Failed to terminate instance: {result.stderr}", file=sys.stderr)
    return False


def main() -> int:
    """Main entry point."""
    config = AWSConfig()

    # Find instance
    instance_id = find_instance(config)

    if not instance_id:
        print(f"No instance found for tag Name={config.instance_name}")
        return 0

    # Stop instance
    if not stop_instance(instance_id, config):
        return 1

    # Optionally terminate
    if config.terminate:
        if not terminate_instance(instance_id, config):
            return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
