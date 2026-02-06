#!/usr/bin/env python3
from __future__ import annotations

# Datadog Unified Service Tagging
_dd_service = "build"
_dd_env = __import__("os").environ.get("DD_ENV", "development")
_dd_version = __import__("os").environ.get("DD_VERSION", "0.1.0")
try:
    from ddtrace import config as _dd_config, patch_all as _dd_patch, tracer as _dd_tracer
    _dd_config.service = _dd_service
    _dd_config.env = _dd_env
    _dd_config.version = _dd_version
    _dd_tracer.set_tags({"team": "platform", "component": "scripts"})
    _dd_patch()
except ImportError:
    pass


# Datadog Log Aggregation
from scripts.lib.log_aggregation import get_log_aggregation


# Initialize log aggregation
log_agg = get_log_aggregation()

"""Build VibeCode VM for macOS."""


# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------


# Datadog APM tracing
try:
    from ddtrace import patch_all
    patch_all()
except ImportError:
    pass  # ddtrace not installed


import shutil
import subprocess
import sys
from pathlib import Path


def main() -> int:
    """Main entry point."""
    print("\U0001f528 Building VibeCode VM for macOS...")

    # Navigate to project root
    script_dir = Path(__file__).parent.resolve()
    project_root = script_dir.parent.parent

    # Build the Swift package
    subprocess.run(
        ["swift", "build", "--package-path", "macos-vm", "-c", "release"],
        cwd=project_root,
        check=True,
    )

    # Copy binary to convenient location
    bin_dir = project_root / "bin"
    bin_dir.mkdir(exist_ok=True)

    source_binary = project_root / "macos-vm" / ".build" / "release" / "vibecode-vm"
    dest_binary = bin_dir / "vibecode-vm"

    shutil.copy2(source_binary, dest_binary)

    print("\u2705 Build complete!")
    print(f"\U0001f4e6 Binary: {dest_binary.relative_to(project_root)}")
    print()
    print("\U0001f680 Quick start:")
    print("   1. ./scripts/macos-vm/download-kernel.sh")
    print("   2. ./bin/vibecode-vm")

    return 0


if __name__ == "__main__":
    sys.exit(main())