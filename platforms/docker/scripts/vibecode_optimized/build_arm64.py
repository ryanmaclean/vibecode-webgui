#!/usr/bin/env python3
"""
ARM64 Native Build Script

Builds the application optimized for ARM64 architecture.

Usage:
    python build_arm64.py
"""

import os
import platform
import shutil
import subprocess
import sys


def check_arm64() -> bool:
    """Check if running on ARM64."""
    return platform.machine() in ("arm64", "aarch64")


def run_command(cmd: list[str], env: dict = None) -> int:
    """Run a command with optional environment variables."""
    full_env = {**os.environ, **(env or {})}

    try:
        result = subprocess.run(cmd, env=full_env)
        return result.returncode
    except FileNotFoundError:
        print(f"Command not found: {cmd[0]}")
        return 1


def build_arm64() -> int:
    """Build for ARM64 architecture."""
    print("🏗️  Building ARM64 native version...")

    # Set ARM64 environment
    env = {
        "ARCH": "arm64",
        "TARGET": "arm64-apple-darwin",
    }

    # Build with ARM64 optimizations
    print("Running npm build for ARM64...")
    rc = run_command(
        ["npm", "run", "build", "--", "--target=arm64-apple-darwin"],
        env=env,
    )

    if rc != 0:
        print("Build failed")
        return rc

    # Optimize Node.js for ARM64
    if shutil.which("node"):
        print("🔧 Optimizing Node.js for ARM64...")

        # Check Node.js version on ARM64
        if check_arm64():
            result = subprocess.run(
                ["arch", "-arm64", "node", "--version"],
                capture_output=True,
                text=True,
            )
            if result.returncode == 0:
                print(f"  Node.js version: {result.stdout.strip()}")

        # Set Node.js optimizations
        optimization_env = {
            "NODE_OPTIONS": "--max-old-space-size=4096 --optimize-for-size",
            "NODE_ENV": "production",
        }

        for key, value in optimization_env.items():
            os.environ[key] = value
            print(f"  Set {key}={value}")

        print("✅ Node.js optimized for ARM64")

    print("✅ ARM64 build complete")
    return 0


def main() -> int:
    """Main entry point."""
    return build_arm64()


if __name__ == "__main__":
    sys.exit(main())
