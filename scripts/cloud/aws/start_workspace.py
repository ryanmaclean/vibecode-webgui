#!/usr/bin/env python3
<<<<<<< HEAD


"""Start (or create) an AWS EC2 Spot instance for code-server with an attached EBS volume.

Requires aws CLI configured with appropriate IAM permissions.
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
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional


@dataclass
class AWSConfig:
    """AWS workspace configuration."""

    region: str = "us-east-1"
    profile: Optional[str] = None
    instance_name: str = "codeserver-dev"
    launch_template: str = "codeserver-template"
    volume_id: Optional[str] = None
    instance_type: str = "t4g.small"
    ami_id: Optional[str] = None
    security_group_ids: Optional[str] = None
    subnet_id: Optional[str] = None
    key_name: Optional[str] = None
    spot_price: Optional[str] = None
    iam_instance_profile: str = "EC2CodeServer"
    user_data_path: str = "scripts/cloud/aws/user-data.sh"

    @classmethod
    def from_env(cls) -> "AWSConfig":
        """Create config from environment variables."""
        return cls(
            region=os.environ.get("AWS_REGION", "us-east-1"),
            profile=os.environ.get("AWS_PROFILE"),
            instance_name=os.environ.get("INSTANCE_NAME", "codeserver-dev"),
            launch_template=os.environ.get("LAUNCH_TEMPLATE", "codeserver-template"),
            volume_id=os.environ.get("VOLUME_ID"),
            instance_type=os.environ.get("INSTANCE_TYPE", "t4g.small"),
            ami_id=os.environ.get("AMI_ID"),
            security_group_ids=os.environ.get("SECURITY_GROUP_IDS"),
            subnet_id=os.environ.get("SUBNET_ID"),
            key_name=os.environ.get("KEY_NAME"),
            spot_price=os.environ.get("SPOT_PRICE"),
            iam_instance_profile=os.environ.get("IAM_INSTANCE_PROFILE", "EC2CodeServer"),
        )


def get_profile_args(config: AWSConfig) -> list[str]:
    """Get AWS profile arguments if profile is set."""
    if config.profile:
        return ["--profile", config.profile]
    return []


def find_existing_instance(config: AWSConfig) -> Optional[str]:
    """Find an existing instance by name tag.

    Returns:
        Instance ID if found, None otherwise.
    """
    cmd = [
        "aws", "ec2", "describe-instances",
        "--region", config.region,
        *get_profile_args(config),
        "--filters",
        f"Name=tag:Name,Values={config.instance_name}",
=======
"""Start (or create) an AWS EC2 Spot instance for code-server.

Requires aws CLI configured with appropriate IAM permissions.
"""
from __future__ import annotations

# Datadog APM tracing
try:
    from ddtrace import tracer, patch_all
    patch_all()
except ImportError:
    pass  # ddtrace not installed


import argparse
import json
import os
import subprocess
import sys
from pathlib import Path


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


def find_existing_instance(
    region: str,
    instance_name: str,
    profile: str | None,
) -> str | None:
    """Find an existing instance by name."""
    cmd = [
        "aws", "ec2", "describe-instances",
        "--region", region,
        "--filters",
        f"Name=tag:Name,Values={instance_name}",
>>>>>>> 699bd88d9 (feat(scripts): convert shell scripts to Python with type hints)
        "Name=instance-state-name,Values=running,stopped",
        "--query", "Reservations[].Instances[].InstanceId",
        "--output", "text",
    ]
<<<<<<< HEAD

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode == 0 and result.stdout.strip():
            # Return first instance ID
            return result.stdout.strip().split()[0]
    except (subprocess.TimeoutExpired, subprocess.SubprocessError):
        pass

    return None


def start_existing_instance(config: AWSConfig, instance_id: str) -> bool:
    """Start an existing stopped instance.

    Returns:
        True if successful, False otherwise.
    """
    print(f"Starting existing instance {instance_id} ({config.instance_name})")

    cmd = [
        "aws", "ec2", "start-instances",
        "--region", config.region,
        *get_profile_args(config),
        "--instance-ids", instance_id,
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, timeout=60)
        return result.returncode == 0
    except (subprocess.TimeoutExpired, subprocess.SubprocessError):
        return False


def build_run_instances_args(config: AWSConfig) -> list[str]:
    """Build arguments for aws ec2 run-instances command."""
    args = [
        "aws", "ec2", "run-instances",
        "--region", config.region,
        *get_profile_args(config),
        "--instance-type", config.instance_type,
        "--tag-specifications",
        f"ResourceType=instance,Tags=[{{Key=Name,Value={config.instance_name}}}]",
        "--iam-instance-profile", f"Name={config.iam_instance_profile}",
        "--user-data", f"file://{config.user_data_path}",
    ]

    if config.ami_id:
        args.extend(["--image-id", config.ami_id])

    if config.security_group_ids:
        args.extend(["--security-group-ids", *config.security_group_ids.split()])

    if config.subnet_id:
        args.extend(["--subnet-id", config.subnet_id])

    if config.key_name:
        args.extend(["--key-name", config.key_name])

    if config.volume_id:
        block_device = (
            f'[{{"DeviceName":"/dev/sdf","Ebs":{{"VolumeId":"{config.volume_id}",'
            f'"DeleteOnTermination":false}}}}]'
        )
        args.extend(["--block-device-mappings", block_device])

    if config.spot_price:
        market_options = (
            f"MarketType=spot,SpotOptions={{MaxPrice={config.spot_price},"
            f"SpotInstanceType=persistent}}"
        )
        args.extend(["--instance-market-options", market_options])

    args.extend(["--query", "Instances[0].InstanceId", "--output", "text"])

    return args


def launch_new_instance(config: AWSConfig) -> Optional[str]:
    """Launch a new spot instance.

    Returns:
        Instance ID if successful, None otherwise.
    """
    print(f"Launching new spot instance for {config.instance_name}")

    if not config.ami_id:
        print("ERROR: AMI_ID not provided", file=sys.stderr)
        return None

    args = build_run_instances_args(config)

    try:
        result = subprocess.run(args, capture_output=True, text=True, timeout=120)
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip()
        if result.stderr:
            print(f"Error: {result.stderr}", file=sys.stderr)
    except (subprocess.TimeoutExpired, subprocess.SubprocessError) as e:
        print(f"Error launching instance: {e}", file=sys.stderr)

    return None


def wait_for_instance_running(config: AWSConfig, instance_id: str) -> bool:
    """Wait for instance to reach running state.

    Returns:
        True if instance is running, False otherwise.
    """
    print(f"Waiting for instance {instance_id} to reach running state...")

    cmd = [
        "aws", "ec2", "wait", "instance-running",
        "--region", config.region,
        *get_profile_args(config),
        "--instance-ids", instance_id,
    ]

    try:
        result = subprocess.run(cmd, timeout=300)
        return result.returncode == 0
    except (subprocess.TimeoutExpired, subprocess.SubprocessError):
        return False


def start_workspace(config: Optional[AWSConfig] = None) -> int:
    """Start or create an AWS workspace.

    Args:
        config: AWS configuration (uses env vars if None)

    Returns:
        Exit code (0 for success, 1 for failure)
    """
    if config is None:
        config = AWSConfig.from_env()

    # Check for aws CLI
    if not shutil.which("aws"):
        print("ERROR: aws CLI not found", file=sys.stderr)
        return 1

    # Check for existing instance
    instance_id = find_existing_instance(config)

    if instance_id:
        if start_existing_instance(config, instance_id):
            return 0
        return 1

    # Launch new instance
    instance_id = launch_new_instance(config)
    if not instance_id:
        return 1

    # Wait for running state
    if not wait_for_instance_running(config, instance_id):
        print("ERROR: Instance did not reach running state", file=sys.stderr)
        return 1

    print(f"Instance {instance_id} running. Attach to ALB or use Session Manager/SSH to reach code-server.")
    return 0


def main() -> int:
    """Main entry point."""
    return start_workspace()


if __name__ == "__main__":
    sys.exit(main())
=======
    if profile:
        cmd.extend(["--profile", profile])

    result = run_cmd(cmd)
    if result.returncode == 0 and result.stdout.strip():
        instances = result.stdout.strip().split()
        return instances[0] if instances else None
    return None


def start_instance(
    region: str,
    instance_id: str,
    profile: str | None,
) -> bool:
    """Start an existing instance."""
    cmd = [
        "aws", "ec2", "start-instances",
        "--region", region,
        "--instance-ids", instance_id,
    ]
    if profile:
        cmd.extend(["--profile", profile])

    result = run_cmd(cmd)
    return result.returncode == 0


def launch_new_instance(
    region: str,
    instance_name: str,
    instance_type: str,
    ami_id: str,
    profile: str | None,
    security_group_ids: str | None,
    subnet_id: str | None,
    key_name: str | None,
    volume_id: str | None,
    spot_price: str | None,
    iam_profile: str,
    user_data_path: Path,
) -> str | None:
    """Launch a new spot instance."""
    cmd = [
        "aws", "ec2", "run-instances",
        "--region", region,
        "--instance-type", instance_type,
        "--image-id", ami_id,
        "--tag-specifications",
        f"ResourceType=instance,Tags=[{{Key=Name,Value={instance_name}}}]",
        "--iam-instance-profile", f"Name={iam_profile}",
        "--query", "Instances[0].InstanceId",
        "--output", "text",
    ]

    if profile:
        cmd.extend(["--profile", profile])

    if user_data_path.exists():
        cmd.extend(["--user-data", f"file://{user_data_path}"])

    if security_group_ids:
        cmd.extend(["--security-group-ids"] + security_group_ids.split())

    if subnet_id:
        cmd.extend(["--subnet-id", subnet_id])

    if key_name:
        cmd.extend(["--key-name", key_name])

    if volume_id:
        block_devices = json.dumps([{
            "DeviceName": "/dev/sdf",
            "Ebs": {
                "VolumeId": volume_id,
                "DeleteOnTermination": False,
            },
        }])
        cmd.extend(["--block-device-mappings", block_devices])

    if spot_price:
        market_options = f"MarketType=spot,SpotOptions={{MaxPrice={spot_price},SpotInstanceType=persistent}}"
        cmd.extend(["--instance-market-options", market_options])

    result = run_cmd(cmd)
    if result.returncode == 0 and result.stdout.strip():
        return result.stdout.strip()
    return None


def wait_for_running(
    region: str,
    instance_id: str,
    profile: str | None,
) -> bool:
    """Wait for instance to reach running state."""
    cmd = [
        "aws", "ec2", "wait", "instance-running",
        "--region", region,
        "--instance-ids", instance_id,
    ]
    if profile:
        cmd.extend(["--profile", profile])

    result = run_cmd(cmd)
    return result.returncode == 0


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--region",
        default=get_env("AWS_REGION", "us-east-1"),
        help="AWS region (default: us-east-1)",
    )
    parser.add_argument(
        "--profile",
        default=get_env("AWS_PROFILE"),
        help="AWS CLI profile",
    )
    parser.add_argument(
        "--instance-name",
        default=get_env("INSTANCE_NAME", "codeserver-dev"),
        help="Instance name tag (default: codeserver-dev)",
    )
    parser.add_argument(
        "--instance-type",
        default=get_env("INSTANCE_TYPE", "t4g.small"),
        help="Instance type (default: t4g.small)",
    )
    parser.add_argument(
        "--ami-id",
        default=get_env("AMI_ID"),
        required=not get_env("AMI_ID"),
        help="AMI ID (required)",
    )
    parser.add_argument(
        "--security-group-ids",
        default=get_env("SECURITY_GROUP_IDS"),
        help="Security group IDs (space-separated)",
    )
    parser.add_argument(
        "--subnet-id",
        default=get_env("SUBNET_ID"),
        help="Subnet ID",
    )
    parser.add_argument(
        "--key-name",
        default=get_env("KEY_NAME"),
        help="SSH key pair name",
    )
    parser.add_argument(
        "--volume-id",
        default=get_env("VOLUME_ID"),
        help="EBS volume ID to attach",
    )
    parser.add_argument(
        "--spot-price",
        default=get_env("SPOT_PRICE"),
        help="Maximum spot price",
    )
    parser.add_argument(
        "--iam-profile",
        default=get_env("IAM_INSTANCE_PROFILE", "EC2CodeServer"),
        help="IAM instance profile name (default: EC2CodeServer)",
    )

    args = parser.parse_args(argv)

    # Find user-data script
    script_dir = Path(__file__).parent
    user_data_path = script_dir / "user-data.sh"

    # Check for existing instance
    instance_id = find_existing_instance(
        args.region,
        args.instance_name,
        args.profile,
    )

    if instance_id:
        print(f"Starting existing instance {instance_id} ({args.instance_name})")
        if start_instance(args.region, instance_id, args.profile):
            return 0
        print("Failed to start instance")
        return 1

    # Launch new instance
    print(f"Launching new spot instance for {args.instance_name}")

    instance_id = launch_new_instance(
        region=args.region,
        instance_name=args.instance_name,
        instance_type=args.instance_type,
        ami_id=args.ami_id,
        profile=args.profile,
        security_group_ids=args.security_group_ids,
        subnet_id=args.subnet_id,
        key_name=args.key_name,
        volume_id=args.volume_id,
        spot_price=args.spot_price,
        iam_profile=args.iam_profile,
        user_data_path=user_data_path,
    )

    if not instance_id:
        print("Failed to launch instance")
        return 1

    print(f"Waiting for instance {instance_id} to reach running state...")
    if not wait_for_running(args.region, instance_id, args.profile):
        print("Timeout waiting for instance")
        return 1

    print(f"Instance {instance_id} running.")
    print("Attach to ALB or use Session Manager/SSH to reach code-server.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
>>>>>>> 699bd88d9 (feat(scripts): convert shell scripts to Python with type hints)
