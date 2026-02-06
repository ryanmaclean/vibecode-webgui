#!/usr/bin/env python3
"""Start (or create) an AWS EC2 Spot instance for code-server.

Requires aws CLI configured with appropriate IAM permissions.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class AWSConfig:
    """AWS configuration for workspace instances."""

    region: str = field(default_factory=lambda: os.environ.get("AWS_REGION", "us-east-1"))
    profile: str = field(default_factory=lambda: os.environ.get("AWS_PROFILE", ""))
    instance_name: str = field(default_factory=lambda: os.environ.get("INSTANCE_NAME", "codeserver-dev"))
    instance_type: str = field(default_factory=lambda: os.environ.get("INSTANCE_TYPE", "t4g.small"))
    ami_id: str = field(default_factory=lambda: os.environ.get("AMI_ID", ""))
    security_group_ids: str = field(default_factory=lambda: os.environ.get("SECURITY_GROUP_IDS", ""))
    subnet_id: str = field(default_factory=lambda: os.environ.get("SUBNET_ID", ""))
    key_name: str = field(default_factory=lambda: os.environ.get("KEY_NAME", ""))
    volume_id: str = field(default_factory=lambda: os.environ.get("VOLUME_ID", ""))
    spot_price: str = field(default_factory=lambda: os.environ.get("SPOT_PRICE", ""))
    iam_instance_profile: str = field(default_factory=lambda: os.environ.get("IAM_INSTANCE_PROFILE", "EC2CodeServer"))

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


def find_existing_instance(config: AWSConfig) -> str | None:
    """Find an existing instance by name tag.

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


def start_existing_instance(instance_id: str, config: AWSConfig) -> bool:
    """Start an existing stopped instance.

    Args:
        instance_id: EC2 instance ID.
        config: AWS configuration.

    Returns:
        True if successful, False otherwise.
    """
    print(f"Starting existing instance {instance_id} ({config.instance_name})")

    result = run_aws_command(
        ["ec2", "start-instances", "--instance-ids", instance_id],
        config,
    )

    return result.returncode == 0


def get_user_data_path() -> Path:
    """Get path to user-data script."""
    script_dir = Path(__file__).resolve().parent
    return script_dir / "user-data.sh"


def launch_new_instance(config: AWSConfig) -> str | None:
    """Launch a new spot instance.

    Args:
        config: AWS configuration.

    Returns:
        Instance ID if successful, None otherwise.
    """
    print(f"Launching new spot instance for {config.instance_name}")

    if not config.ami_id:
        print("ERROR: AMI_ID not provided", file=sys.stderr)
        return None

    # Build tag specifications
    tag_spec = f"ResourceType=instance,Tags=[{{Key=Name,Value={config.instance_name}}}]"

    # Build run-instances arguments
    args = [
        "ec2", "run-instances",
        "--instance-type", config.instance_type,
        "--image-id", config.ami_id,
        "--tag-specifications", tag_spec,
        "--iam-instance-profile", f"Name={config.iam_instance_profile}",
    ]

    # Add user-data
    user_data_path = get_user_data_path()
    if user_data_path.exists():
        args.extend(["--user-data", f"file://{user_data_path}"])

    # Optional arguments
    if config.security_group_ids:
        args.extend(["--security-group-ids"] + config.security_group_ids.split())

    if config.subnet_id:
        args.extend(["--subnet-id", config.subnet_id])

    if config.key_name:
        args.extend(["--key-name", config.key_name])

    if config.volume_id:
        block_device = json.dumps([{
            "DeviceName": "/dev/sdf",
            "Ebs": {
                "VolumeId": config.volume_id,
                "DeleteOnTermination": False,
            },
        }])
        args.extend(["--block-device-mappings", block_device])

    if config.spot_price:
        market_options = f"MarketType=spot,SpotOptions={{MaxPrice={config.spot_price},SpotInstanceType=persistent}}"
        args.extend(["--instance-market-options", market_options])

    args.extend(["--query", "Instances[0].InstanceId", "--output", "text"])

    result = run_aws_command(args, config)

    if result.returncode != 0:
        print(f"Failed to launch instance: {result.stderr}", file=sys.stderr)
        return None

    return result.stdout.strip()


def wait_for_instance(instance_id: str, config: AWSConfig) -> bool:
    """Wait for instance to reach running state.

    Args:
        instance_id: EC2 instance ID.
        config: AWS configuration.

    Returns:
        True if instance is running, False on timeout/error.
    """
    print(f"Waiting for instance {instance_id} to reach running state...")

    result = run_aws_command(
        ["ec2", "wait", "instance-running", "--instance-ids", instance_id],
        config,
        capture_output=False,
    )

    return result.returncode == 0


def main() -> int:
    """Main entry point."""
    config = AWSConfig()

    # Check for existing instance
    instance_id = find_existing_instance(config)

    if instance_id:
        if start_existing_instance(instance_id, config):
            return 0
        return 1

    # Launch new instance
    instance_id = launch_new_instance(config)
    if not instance_id:
        return 1

    # Wait for instance to be running
    if not wait_for_instance(instance_id, config):
        print("Timeout waiting for instance to start", file=sys.stderr)
        return 1

    print(f"Instance {instance_id} running. Attach to ALB or use Session Manager/SSH to reach code-server.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
