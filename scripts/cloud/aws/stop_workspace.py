#!/usr/bin/env python3
"""Stop or terminate an AWS code-server workspace instance."""
from __future__ import annotations

# Datadog APM tracing
try:
    from ddtrace import tracer, patch_all
    patch_all()
except ImportError:
    pass  # ddtrace not installed


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


def find_instance(
    region: str,
    instance_name: str,
    profile: str | None,
) -> str | None:
    """Find an instance by name tag."""
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


def stop_instance(
    region: str,
    instance_id: str,
    profile: str | None,
) -> bool:
    """Stop an instance."""
    cmd = [
        "aws", "ec2", "stop-instances",
        "--region", region,
        "--instance-ids", instance_id,
    ]
    if profile:
        cmd.extend(["--profile", profile])

    result = run_cmd(cmd)
    return result.returncode == 0


def terminate_instance(
    region: str,
    instance_id: str,
    profile: str | None,
) -> bool:
    """Terminate an instance."""
    cmd = [
        "aws", "ec2", "terminate-instances",
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
        "--terminate",
        action="store_true",
        default=get_env("TERMINATE", "false").lower() == "true",
        help="Terminate instance instead of just stopping",
    )

    args = parser.parse_args(argv)

    instance_id = find_instance(args.region, args.instance_name, args.profile)

    if not instance_id:
        print(f"No instance found for tag Name={args.instance_name}")
        return 0

    print(f"Stopping instance {instance_id}")
    if not stop_instance(args.region, instance_id, args.profile):
        print("Failed to stop instance")
        return 1

    print("Instance stopped.")

    if args.terminate:
        print(f"Terminating instance {instance_id} (EBS volumes preserved unless DeleteOnTermination=true).")
        if not terminate_instance(args.region, instance_id, args.profile):
            print("Failed to terminate instance")
            return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
