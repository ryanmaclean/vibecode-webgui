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
Native Node.js Build Script

Builds Node.js from source with optimizations.

Usage:
    python build_nodejs.py [--version VERSION]
"""

import argparse
import os
import platform
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


def run_command(
    cmd: list[str],
    cwd: str = None,
    env: dict = None,
) -> tuple[int, str, str]:
    """Run a command and return (returncode, stdout, stderr)."""
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            cwd=cwd,
            env={**os.environ, **(env or {})},
        )
        return result.returncode, result.stdout, result.stderr
    except FileNotFoundError:
        return -1, "", f"Command not found: {cmd[0]}"


def get_cpu_count() -> int:
    """Get the number of CPUs."""
    try:
        return os.cpu_count() or 4
    except Exception:
        return 4


def download_node_source(version: str, work_dir: Path) -> bool:
    """Download Node.js source code."""
    url = f"https://nodejs.org/dist/v{version}/node-v{version}.tar.gz"
    tarball = work_dir / f"node-v{version}.tar.gz"

    print(f"Downloading Node.js v{version}...")

    rc, _, stderr = run_command([
        "wget", url, "-O", str(tarball),
    ])

    if rc != 0:
        # Try curl if wget fails
        rc, _, stderr = run_command([
            "curl", "-L", url, "-o", str(tarball),
        ])

        if rc != 0:
            print(f"Failed to download Node.js: {stderr}")
            return False

    # Extract
    print("Extracting source...")
    rc, _, stderr = run_command([
        "tar", "-xzf", str(tarball),
    ], cwd=str(work_dir))

    if rc != 0:
        print(f"Failed to extract: {stderr}")
        return False

    return True


def configure_node(source_dir: Path, prefix: str = "/usr/local") -> bool:
    """Configure Node.js build."""
    print("Configuring Node.js build...")

    machine = platform.machine()
    system = platform.system().lower()

    # Map machine to Node.js CPU names
    cpu_map = {
        "arm64": "arm64",
        "aarch64": "arm64",
        "x86_64": "x64",
        "amd64": "x64",
    }

    dest_cpu = cpu_map.get(machine, "x64")
    dest_os = "darwin" if system == "darwin" else "linux"

    configure_args = [
        "./configure",
        "--enable-static",
        "--enable-optimizations",
        "--without-snapshot",
        f"--dest-cpu={dest_cpu}",
        f"--dest-os={dest_os}",
        f"--prefix={prefix}",
    ]

    rc, stdout, stderr = run_command(
        configure_args,
        cwd=str(source_dir),
    )

    if rc != 0:
        print(f"Configure failed: {stderr}")
        return False

    return True


def build_node(source_dir: Path) -> bool:
    """Build Node.js from source."""
    print("Building Node.js (this may take a while)...")

    cpu_count = get_cpu_count()

    # Build with maximum optimizations
    env = {
        "CFLAGS": "-O3 -march=native",
        "CXXFLAGS": "-O3 -march=native",
    }

    rc, stdout, stderr = run_command(
        ["make", f"-j{cpu_count}"],
        cwd=str(source_dir),
        env=env,
    )

    if rc != 0:
        print(f"Build failed: {stderr}")
        return False

    return True


def install_node(source_dir: Path) -> bool:
    """Install Node.js."""
    print("Installing Node.js...")

    # This requires root privileges
    rc, _, stderr = run_command(
        ["sudo", "make", "install"],
        cwd=str(source_dir),
    )

    if rc != 0:
        print(f"Install failed: {stderr}")
        print("Note: Installation requires root privileges")
        return False

    return True


def build_native_nodejs(version: str = "20.10.0", install: bool = True) -> int:
    """Build native Node.js from source."""
    print(f"🏗️  Building native Node.js v{version}...")

    # Create temporary work directory
    with tempfile.TemporaryDirectory() as work_dir:
        work_path = Path(work_dir)

        # Download source
        if not download_node_source(version, work_path):
            return 1

        source_dir = work_path / f"node-v{version}"

        # Configure
        if not configure_node(source_dir):
            return 1

        # Build
        if not build_node(source_dir):
            return 1

        # Install
        if install:
            if not install_node(source_dir):
                return 1

    print("✅ Native Node.js build complete")
    return 0


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(description="Build native Node.js from source")
    parser.add_argument(
        "--version",
        default="20.10.0",
        help="Node.js version to build (default: 20.10.0)",
    )
    parser.add_argument(
        "--no-install",
        action="store_true",
        help="Build only, do not install",
    )

    args = parser.parse_args()

    return build_native_nodejs(args.version, install=not args.no_install)


if __name__ == "__main__":
    sys.exit(main())