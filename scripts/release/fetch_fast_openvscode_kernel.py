#!/usr/bin/env python3
from __future__ import annotations

# Datadog Unified Service Tagging
_dd_service = "fetch-fast-openvscode-kernel"
_dd_env = __import__("os").environ.get("DD_ENV", "development")
_dd_version = __import__("os").environ.get("DD_VERSION", "0.1.0")
try:
    from ddtrace import config as _dd_config, patch_all as _dd_patch, tracer as _dd_tracer
    _dd_config.service = _dd_service
    _dd_config.env = _dd_env
    _dd_config.version = _dd_version
    _dd_tracer.set_tags({"team": "platform", "component": "release"})
    _dd_patch()
except ImportError:
    pass


# Datadog Log Aggregation
from scripts.lib.log_aggregation import get_log_aggregation


# Initialize log aggregation
log_agg = get_log_aggregation()

"""Fetch Firecracker-compatible kernel for OpenVSCode microVM."""


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


import argparse
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


def run_cmd(
    cmd: list[str],
    capture: bool = True,
    check: bool = False,
) -> subprocess.CompletedProcess[str]:
    """Run a command and return result."""
    return subprocess.run(cmd, capture_output=capture, text=True, check=check)


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "version",
        nargs="?",
        default="5.10.201",
        help="Kernel version (default: 5.10.201)",
    )
    parser.add_argument(
        "--firecracker-release",
        default=os.environ.get("FIRECRACKER_RELEASE", "v1.7.0"),
        help="Firecracker release tag",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Output path (default: fast-openvscode-vm/vmlinux-fast)",
    )

    args = parser.parse_args(argv)

    script_dir = Path(__file__).parent.resolve()
    root_dir = script_dir.parent.parent

    vm_dir = root_dir / "fast-openvscode-vm"
    output = args.output or (vm_dir / "vmlinux-fast")

    url = f"https://github.com/firecracker-microvm/firecracker/releases/download/{args.firecracker_release}/vmlinux-{args.version}"

    vm_dir.mkdir(parents=True, exist_ok=True)

    print(f"Downloading Firecracker kernel {args.version} from {url}", file=sys.stderr)

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir) / "vmlinux"

        result = run_cmd([
            "curl", "-L", "--fail", "--silent", "--show-error",
            url, "-o", str(tmp_path),
        ])

        if result.returncode != 0:
            print(f"""error: unable to download vmlinux from Firecracker release {args.firecracker_release}.
Firecracker stopped publishing prebuilt kernels; run their resources/kernel
build scripts or update FIRECRACKER_RELEASE/URL to a mirror that hosts the
desired artefact. The OpenVSCode microVM will continue using vmlinuz-host.""", file=sys.stderr)
            return 1

        tmp_path.chmod(0o755)
        shutil.move(str(tmp_path), str(output))

    print(f"Kernel written to {output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())