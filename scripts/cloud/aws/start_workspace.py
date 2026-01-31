#!/usr/bin/env python3
"""Start (or create) an AWS EC2 Spot instance for code-server.

Requires aws CLI configured with appropriate IAM permissions.
"""
from __future__ import annotations

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
        "Name=instance-state-name,Values=running,stopped",
        "--query", "Reservations[].Instances[].InstanceId",
        "--output", "text",
    ]
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
