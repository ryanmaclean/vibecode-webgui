#!/usr/bin/env python3
import os
import subprocess
import sys
from vibecode.telemetry import init_telemetry, get_logger
from ddtrace import tracer

logger = get_logger("release_manager")
init_telemetry("vibecode-release-manager")

@tracer.wrap()
def check_gh_cli():
    try:
        subprocess.run(["gh", "--version"], check=True, capture_output=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        logger.error("GitHub CLI (gh) not found")
        return False

@tracer.wrap()
def publish_release(version):
    logger.info(f"Publishing {version}...")
    
    # Check if tag exists
    try:
        subprocess.run(["git", "rev-parse", version], check=True, capture_output=True)
    except subprocess.CalledProcessError:
        logger.error(f"Tag {version} not found")
        return False

    # Create/Update Release
    cmd = [
        "gh", "release", "create", version,
        "--title", f"VibeCode {version} - The OpenClaw Era",
        "--notes-file", "docs/releases/v5.0.0_RELEASE_NOTES.md",
        "release-v5.0.0/Install-VM.command",
        "release-v5.0.0/README.md",
        "release-v5.0.0/RELEASE_NOTES.md"
    ]
    
    # Check if exists
    exists = subprocess.run(["gh", "release", "view", version], capture_output=True).returncode == 0
    if exists:
        logger.info("Release exists, uploading artifacts...")
        # Simplified logic for update
        subprocess.run(["gh", "release", "upload", version, "release-v5.0.0/Install-VM.command", "--clobber"], check=True)
    else:
        subprocess.run(cmd, check=True)
    
    logger.info(f"✅ {version} Published")
    return True

if __name__ == "__main__":
    if not check_gh_cli():
        sys.exit(1)
    
    publish_release("v5.0.0")
