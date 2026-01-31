#!/usr/bin/env python3
import sys
import argparse
import subprocess
import os

def start():
    print("🚀 Starting VibeCode VM...")
    # Use the existing launch script
    base_dir = os.path.dirname(os.path.realpath(__file__))
    script_path = os.path.join(base_dir, "launch_ubuntu_vm.py")
    subprocess.run([sys.executable, script_path])

def stop():
    print("🛑 Stopping VibeCode VM...")
    # Kill vfkit process
    try:
        subprocess.run(["pkill", "-f", "vfkit"], check=True)
        print("✅ VM Stopped")
    except subprocess.CalledProcessError:
        print("ℹ️  VM was not running (vfkit process not found)")

def status():
    print("🔍 Checking VibeCode VM Status...")
    # Use the existing Ralph Loop script
    base_dir = os.path.dirname(os.path.realpath(__file__))
    script_path = os.path.join(base_dir, "ralph_loop.py")
    subprocess.run([sys.executable, script_path])

def main():
    parser = argparse.ArgumentParser(description="VibeCode VM Manager (Ruthless Edition)")
    subparsers = parser.add_subparsers(dest="command", required=True)
    
    subparsers.add_parser("start", help="Start the VM")
    subparsers.add_parser("stop", help="Stop the VM")
    subparsers.add_parser("status", help="Check VM status")
    
    args = parser.parse_args()
    
    if args.command == "start":
        start()
    elif args.command == "stop":
        stop()
    elif args.command == "status":
        status()

if __name__ == "__main__":
    main()
