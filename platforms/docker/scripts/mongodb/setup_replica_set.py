#!/usr/bin/env python3

# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

"""
MongoDB Replica Set Setup Script

Sets up a MongoDB replica set for VibeCode Chat-UI.

Usage:
    python setup_replica_set.py
"""

import subprocess
import sys
import time
from typing import Optional


def run_mongosh(eval_cmd: str, timeout: int = 30) -> tuple[int, str, str]:
    """Run a mongosh command."""
    try:
        result = subprocess.run(
            ["mongosh", "--eval", eval_cmd, "--quiet"],
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return result.returncode, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return -1, "", "Command timed out"
    except FileNotFoundError:
        return -1, "", "mongosh not found"


def wait_for_mongodb(max_attempts: int = 30) -> bool:
    """Wait for MongoDB to be ready."""
    for attempt in range(max_attempts):
        rc, stdout, _ = run_mongosh("print('MongoDB is ready')")
        if rc == 0:
            print("MongoDB is ready")
            return True

        print("Waiting for MongoDB to start...")
        time.sleep(2)

    print("MongoDB did not start in time")
    return False


def check_replica_set_status() -> Optional[str]:
    """Check if replica set is initialized."""
    rc, stdout, stderr = run_mongosh("rs.status()")

    if rc != 0:
        return None

    # Check for common "not initialized" messages
    if "not initialized" in stdout.lower() or "no replset config" in stderr.lower():
        return None

    return stdout


def initialize_replica_set(replica_set_name: str = "vibecode-chat-rs") -> bool:
    """Initialize the replica set."""
    print("Initializing replica set...")

    init_cmd = f"""
    rs.initiate({{
        _id: '{replica_set_name}',
        members: [
            {{ _id: 0, host: 'localhost:27017' }}
        ]
    }})
    """

    rc, stdout, stderr = run_mongosh(init_cmd)

    if rc != 0:
        print(f"Failed to initialize replica set: {stderr}")
        return False

    return True


def wait_for_primary(max_attempts: int = 30) -> bool:
    """Wait for the replica set to have a primary."""
    for attempt in range(max_attempts):
        rc, stdout, _ = run_mongosh("rs.isMaster().ismaster")

        if rc == 0 and "true" in stdout.lower():
            return True

        print("Waiting for replica set primary...")
        time.sleep(2)

    return False


def setup_replica_set(replica_set_name: str = "vibecode-chat-rs") -> int:
    """Set up the MongoDB replica set."""
    print("Setting up MongoDB replica set for VibeCode...")

    # Wait for MongoDB to be ready
    if not wait_for_mongodb():
        return 1

    # Check if already initialized
    status = check_replica_set_status()
    if status is not None:
        print("✅ Replica set already initialized")
        return 0

    # Initialize replica set
    if not initialize_replica_set(replica_set_name):
        return 1

    # Wait for primary
    print("Waiting for replica set to be ready...")
    if not wait_for_primary():
        print("Failed to elect primary")
        return 1

    print("✅ Replica set initialized successfully")
    print("MongoDB replica set setup completed!")

    return 0


def main() -> int:
    """Main entry point."""
    return setup_replica_set()


if __name__ == "__main__":
    sys.exit(main())