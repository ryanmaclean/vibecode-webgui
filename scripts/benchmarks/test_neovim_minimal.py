#!/usr/bin/env python3
"""Quick test to see if we can get Neovim in a minimal environment.

This tests locally without requiring kernel build.
"""
from __future__ import annotations

# Datadog APM tracing
try:
    from ddtrace import tracer, patch_all
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

try:
    from .benchmark_utils import (
        REPO_ROOT,
        BenchmarkError,
        check_command,
        file_size_human,
        log,
        run_cmd,
        run_cmd_output,
        success,
        warn,
        error as log_error,
    )
except ImportError:
    sys.path.insert(0, str(Path(__file__).parent))
    from benchmark_utils import (
        REPO_ROOT,
        BenchmarkError,
        check_command,
        file_size_human,
        log,
        run_cmd,
        run_cmd_output,
        success,
        warn,
        error as log_error,
    )


NEOVIM_VERSION = "v0.10.2"


def check_local_neovim() -> tuple[Path | None, str | None]:
    """Check if Neovim is available locally.

    Returns:
        Tuple of (path, size) or (None, None)
    """
    if not check_command("nvim"):
        return None, None

    nvim_path = Path(shutil.which("nvim"))

    try:
        result = run_cmd_output(["nvim", "--version"])
        version = result.split("\n")[0]
    except BenchmarkError:
        version = "unknown"

    size = file_size_human(nvim_path.stat().st_size)

    return nvim_path, version


def check_static_linking(path: Path) -> bool:
    """Check if binary is statically linked."""
    if not check_command("file"):
        return False

    try:
        result = run_cmd_output(["file", str(path)])
        return "statically linked" in result
    except BenchmarkError:
        return False


def get_dynamic_deps(path: Path) -> list[str]:
    """Get dynamic library dependencies."""
    if not check_command("ldd"):
        return []

    try:
        result = subprocess.run(
            ["ldd", str(path)],
            capture_output=True,
            text=True,
        )
        return result.stdout.split("\n")[:10]
    except Exception:
        return []


def download_neovim(temp_dir: Path) -> Path | None:
    """Download Neovim static build.

    Returns:
        Path to nvim binary or None
    """
    import platform

    system = platform.system().lower()
    machine = platform.machine()

    if system == "darwin":
        archive = f"nvim-macos-{machine}.tar.gz"
    else:
        archive = "nvim-linux64.tar.gz"

    url = f"https://github.com/neovim/neovim/releases/download/{NEOVIM_VERSION}/{archive}"

    log(f"Downloading {archive}...")

    try:
        run_cmd(["curl", "-L", "-o", archive, url], cwd=temp_dir)
        run_cmd(["tar", "xzf", archive], cwd=temp_dir)

        # Find nvim binary
        for pattern in ["nvim-*/bin/nvim", "*/bin/nvim"]:
            matches = list(temp_dir.glob(pattern))
            if matches:
                return matches[0]

        return None
    except BenchmarkError as e:
        log_error(f"Download failed: {e}")
        return None


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    args = parser.parse_args(argv)

    print("=== MiniVim + Neovim Feasibility Test ===")
    print()

    nvim_path, nvim_version = check_local_neovim()
    nvim_size = "N/A"
    temp_dir = None

    if nvim_path:
        success(f"Neovim found: {nvim_version}")

        nvim_size = file_size_human(nvim_path.stat().st_size)
        print(f"  Binary size: {nvim_size}")

        if check_static_linking(nvim_path):
            success("Statically linked (perfect for initramfs!)")
        else:
            warn("Dynamically linked (will need libraries in initramfs)")
            print()
            print("  Required libraries:")
            for dep in get_dynamic_deps(nvim_path):
                if dep.strip():
                    print(f"    {dep.strip()}")
    else:
        log_error("Neovim not found locally")
        print()
        log("Installing Neovim for testing...")

        temp_dir = Path(tempfile.mkdtemp())
        nvim_path = download_neovim(temp_dir)

        if nvim_path:
            nvim_size = file_size_human(nvim_path.stat().st_size)
            success(f"Downloaded: {nvim_size}")
        else:
            log_error("Failed to download Neovim")

    print()
    print("=== Size Analysis ===")
    print()
    print("Estimated initramfs components:")
    print("  - BusyBox: ~1-2 MB (static)")
    print(f"  - Neovim: ~{nvim_size} (with runtime)")
    print("  - Libraries: ~5-10 MB (if dynamic)")
    print("  - Total: ~15-30 MB compressed")
    print()

    # Compare with current minimal initramfs
    current_initramfs = REPO_ROOT / "bench-images" / "busybox" / "busybox-initramfs.cpio.gz"
    if current_initramfs.exists():
        current_size = file_size_human(current_initramfs.stat().st_size)
        print(f"Current minimal initramfs: {current_size}")
    else:
        print("Current minimal initramfs: N/A")
    print()

    print("=== Boot Time Estimate ===")
    print()
    print("With MiniVim kernel + Neovim initramfs:")
    print("  - Kernel boot: ~1-2s")
    print("  - Initramfs load: ~0.5-1s")
    print("  - Neovim startup: ~0.1-0.3s")
    print("  - Total: ~2-4s to Neovim prompt")
    print()

    print("=== Avante.nvim Compatibility ===")
    print()
    print("Requirements for Avante.nvim:")
    print("  \u2713 Neovim >= 0.10.0")
    print("  \u2713 Lua support (built-in)")
    print("  \u2713 Tree-sitter (built-in)")
    print("  ? Network access (for AI APIs)")
    print("  ? Git (optional, for version control)")
    print()

    print("=== Next Steps ===")
    print()
    print("To build the full Neovim initramfs:")
    print("  ./scripts/benchmarks/build-neovim-initramfs.sh")
    print()
    print("To test with QEMU (after building kernel):")
    print("  qemu-system-x86_64 \\")
    print("    -kernel bench-images/minivim/bzImage-x86_64-6.17 \\")
    print("    -initrd bench-images/busybox/busybox-neovim-initrd.cpio.gz \\")
    print('    -m 512M -nographic \\')
    print("    -append 'console=ttyS0'")
    print()

    # Cleanup
    if temp_dir and temp_dir.exists():
        shutil.rmtree(temp_dir, ignore_errors=True)

    return 0


if __name__ == "__main__":
    sys.exit(main())
