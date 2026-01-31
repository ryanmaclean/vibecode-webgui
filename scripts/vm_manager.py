#!/usr/bin/env python3
import argparse
import subprocess
import sys
import os
from vibecode.telemetry import init_telemetry, get_logger
from ddtrace import tracer

logger = get_logger("vm_manager")
init_telemetry("vibecode-vm-manager")

@tracer.wrap()
def create_vm():
    logger.info("Creating VM...")
    # Call the Swift binary
    cmd = ["./platforms/macos/vz-swift/.build/release/vibecode-vm-standalone", "openclaw", "openclaw-tiny"]
    if not os.path.exists(cmd[0]):
        # Try debug build
        cmd[0] = "./platforms/macos/vz-swift/.build/debug/vibecode-vm-standalone"
    
    if not os.path.exists(cmd[0]):
        logger.error("VM binary not found. Please build first.")
        return False
        
    try:
        subprocess.run(cmd, check=True)
        logger.info("✅ VM Created")
        return True
    except subprocess.CalledProcessError as e:
        logger.error(f"VM Creation Failed: {e}")
        return False

@tracer.wrap()
def install_openclaw():
    logger.info("Installing OpenClaw in VM...")
    # In a real scenario, this would SSH into the VM
    # For now, we simulate the check or run the local script if bridged
    logger.info("Please run scripts/vz/install-openclaw-in-vm-enhanced.sh inside the VM")
    return True

def main():
    parser = argparse.ArgumentParser(description="VibeCode VM Manager")
    parser.add_argument("action", choices=["create", "start", "install"], help="Action to perform")
    args = parser.parse_args()
    
    if args.action == "create":
        create_vm()
    elif args.action == "install":
        install_openclaw()

if __name__ == "__main__":
    main()
