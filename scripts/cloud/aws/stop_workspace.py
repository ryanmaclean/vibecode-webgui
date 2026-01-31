#!/usr/bin/env python3
"""Stop or terminate an AWS code-server workspace instance."""

import os
import subprocess
import sys
from dataclasses import dataclass


@dataclass
class AWSConfig:
    """Configuration for AWS workspace operations."""

    region: str
    profile: str | None
    instance_name: str
    terminate: bool

    @classmethod
    def from_environment(cls) -> "AWSConfig":
        """Create config from environment variables.

        Returns:
            AWSConfig with values from environment or defaults.
        """
        return cls(
            region=os.environ.get("AWS_REGION", "us-east-1"),
            profile=os.environ.get("AWS_PROFILE"),
            instance_name=os.environ.get("INSTANCE_NAME", "codeserver-dev"),
            terminate=os.environ.get("TERMINATE", "false").lower() == "true",
        )


def run_aws_command(
    args: list[str],
    config: AWSConfig,
    capture_output: bool = True,
) -> subprocess.CompletedProcess[str]:
    """Run an AWS CLI command.

    Args:
        args: AWS CLI arguments (without 'aws' prefix).
        config: AWS configuration.
        capture_output: Whether to capture stdout/stderr.

    Returns:
        CompletedProcess result.
    """
    cmd = ["aws"] + args + ["--region", config.region]

    if config.profile:
        cmd.extend(["--profile", config.profile])

    return subprocess.run(
        cmd,
        capture_output=capture_output,
        text=True,
    )


def get_instance_id(config: AWSConfig) -> str | None:
    """Get instance ID by name tag.

    Args:
        config: AWS configuration.

    Returns:
        Instance ID if found, None otherwise.
    """
    result = run_aws_command(
        [
            "ec2",
            "describe-instances",
            "--filters",
            f"Name=tag:Name,Values={config.instance_name}",
            "Name=instance-state-name,Values=running,stopped",
            "--query",
            "Reservations[].Instances[].InstanceId",
            "--output",
            "text",
        ],
        config,
    )

    if result.returncode != 0:
        return None

    instance_ids = result.stdout.strip().split("\n")
    if instance_ids and instance_ids[0]:
        return instance_ids[0]

    return None


def stop_instance(instance_id: str, config: AWSConfig) -> bool:
    """Stop an EC2 instance.

    Args:
        instance_id: ID of the instance to stop.
        config: AWS configuration.

    Returns:
        True if successful.
    """
    print(f"Stopping instance {instance_id}")

    result = run_aws_command(
        ["ec2", "stop-instances", "--instance-ids", instance_id],
        config,
    )

    return result.returncode == 0


def terminate_instance(instance_id: str, config: AWSConfig) -> bool:
    """Terminate an EC2 instance.

    Args:
        instance_id: ID of the instance to terminate.
        config: AWS configuration.

    Returns:
        True if successful.
    """
    print(f"Terminating instance {instance_id} (EBS volumes preserved unless DeleteOnTermination=true).")

    result = run_aws_command(
        ["ec2", "terminate-instances", "--instance-ids", instance_id],
        config,
    )

    return result.returncode == 0


def main() -> int:
    """Main entry point.

    Returns:
        Exit code.
    """
    config = AWSConfig.from_environment()

    # Find instance
    instance_id = get_instance_id(config)

    if not instance_id:
        print(f"No instance found for tag Name={config.instance_name}")
        return 0

    # Stop instance
    if not stop_instance(instance_id, config):
        print("Failed to stop instance")
        return 1

    print("Instance stopped.")

    # Optionally terminate
    if config.terminate:
        if not terminate_instance(instance_id, config):
            print("Failed to terminate instance")
            return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
