#!/usr/bin/env python3
"""Fetch Firecracker-compatible kernel for OpenVSCode microVM."""
from __future__ import annotations

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
