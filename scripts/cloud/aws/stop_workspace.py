#!/usr/bin/env python3
<<<<<<< HEAD


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
=======
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
>>>>>>> 699bd88d9 (feat(scripts): convert shell scripts to Python with type hints)
        "Name=instance-state-name,Values=running,stopped",
        "--query", "Reservations[].Instances[].InstanceId",
        "--output", "text",
    ]
<<<<<<< HEAD

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
=======
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
>>>>>>> 699bd88d9 (feat(scripts): convert shell scripts to Python with type hints)
            return 1

    return 0


<<<<<<< HEAD
def main() -> int:
    """Main entry point."""
    return stop_workspace()


if __name__ == "__main__":
    sys.exit(main())
=======
if __name__ == "__main__":
    sys.exit(main())
>>>>>>> 699bd88d9 (feat(scripts): convert shell scripts to Python with type hints)
