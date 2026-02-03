#!/usr/bin/env python3
"""Quick test to see if we can get Neovim in a minimal environment.

This tests locally without requiring kernel build.
"""

import argparse
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Optional


# Colors for output
GREEN = '\033[0;32m'
YELLOW = '\033[1;33m'
RED = '\033[0;31m'
NC = '\033[0m'


def success(msg: str) -> None:
    """Print success message."""
    print(f"{GREEN}+{NC} {msg}")


def warning(msg: str) -> None:
    """Print warning message."""
    print(f"{YELLOW}!{NC} {msg}")


def error(msg: str) -> None:
    """Print error message."""
    print(f"{RED}x{NC} {msg}")


def run_command(
    cmd: list[str],
    capture: bool = True,
    timeout: int = 60
) -> tuple[int, str, str]:
    """Run a command."""
    try:
        result = subprocess.run(
            cmd,
            capture_output=capture,
            text=True,
            timeout=timeout
        )
        return result.returncode, result.stdout or "", result.stderr or ""
    except subprocess.TimeoutExpired:
        return -1, "", "timeout"
    except FileNotFoundError:
        return -1, "", "command not found"


def get_file_size(path: Path) -> str:
    """Get human-readable file size."""
    size = path.stat().st_size
    for unit in ["B", "KB", "MB", "GB"]:
        if size < 1024:
            return f"{size:.1f}{unit}"
        size /= 1024
    return f"{size:.1f}TB"


def check_local_neovim() -> Optional[tuple[Path, str]]:
    """Check if Neovim is available locally."""
    nvim_path = shutil.which("nvim")
    if not nvim_path:
        return None

    nvim_path = Path(nvim_path)

    # Get version
    rc, stdout, _ = run_command(["nvim", "--version"])
    if rc == 0:
        version = stdout.splitlines()[0] if stdout else "unknown"
    else:
        version = "unknown"

    return nvim_path, version


def download_neovim(version: str = "v0.10.2") -> Optional[Path]:
    """Download Neovim for testing."""
    temp_dir = Path(tempfile.mkdtemp())

    if sys.platform == "darwin":
        print("  Downloading macOS build...")
        url = f"https://github.com/neovim/neovim/releases/download/{version}/nvim-macos-x86_64.tar.gz"
        tarball = "nvim-macos.tar.gz"
        extract_dir = "nvim-macos-x86_64"
    else:
        print("  Downloading Linux static build...")
        url = f"https://github.com/neovim/neovim/releases/download/{version}/nvim-linux64.tar.gz"
        tarball = "nvim-linux.tar.gz"
        extract_dir = "nvim-linux64"

    tarball_path = temp_dir / tarball
    rc, _, stderr = run_command([
        "curl", "-L", "-o", str(tarball_path), url
    ])

    if rc != 0:
        error(f"Failed to download: {stderr}")
        return None

    run_command(["tar", "xzf", str(tarball_path)], timeout=120)

    nvim_path = temp_dir / extract_dir / "bin" / "nvim"
    if nvim_path.exists():
        return nvim_path

    return None


def run_feasibility_test() -> int:
    """Run the feasibility test."""
    print("=== MiniVim + Neovim Feasibility Test ===")
    print()

    nvim_path = None
    nvim_size = "unknown"

    # Check local Neovim
    local_result = check_local_neovim()
    if local_result:
        nvim_path, nvim_version = local_result
        success(f"Neovim found: {nvim_version}")

        nvim_size = get_file_size(nvim_path)
        print(f"  Binary size: {nvim_size}")

        # Check if statically linked
        rc, stdout, _ = run_command(["file", str(nvim_path)])
        if "statically linked" in stdout:
            success("Statically linked (perfect for initramfs!)")
        else:
            warning("Dynamically linked (will need libraries in initramfs)")
            print()
            print("  Required libraries:")
            rc, stdout, _ = run_command(["ldd", str(nvim_path)])
            if rc == 0:
                for line in stdout.splitlines()[:10]:
                    print(f"    {line}")
    else:
        error("Neovim not found locally")
        print()
        print("Installing Neovim for testing...")

        nvim_path = download_neovim()
        if nvim_path and nvim_path.exists():
            nvim_size = get_file_size(nvim_path)
            success(f"Downloaded: {nvim_size}")

    print()
    print("=== Size Analysis ===")
    print()
    print("Estimated initramfs components:")
    print("  - BusyBox: ~1-2 MB (static)")
    print(f"  - Neovim: ~{nvim_size} (with runtime)")
    print("  - Libraries: ~5-10 MB (if dynamic)")
    print("  - Total: ~15-30 MB compressed")
    print()

    # Check current minimal initramfs
    script_dir = Path(__file__).parent.resolve()
    repo_root = script_dir.parent.parent
    current_initramfs = repo_root / "bench-images" / "busybox" / "busybox-initramfs.cpio.gz"

    if current_initramfs.exists():
        current_size = get_file_size(current_initramfs)
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
    print(f"  {GREEN}+{NC} Neovim >= 0.10.0")
    print(f"  {GREEN}+{NC} Lua support (built-in)")
    print(f"  {GREEN}+{NC} Tree-sitter (built-in)")
    print(f"  {YELLOW}?{NC} Network access (for AI APIs)")
    print(f"  {YELLOW}?{NC} Git (optional, for version control)")
    print()

    print("=== Next Steps ===")
    print()
    print("To build the full Neovim initramfs:")
    print("  ./scripts/benchmarks/build_neovim_initramfs.py")
    print()
    print("To test with QEMU (after building kernel):")
    print("  qemu-system-x86_64 \\")
    print("    -kernel bench-images/minivim/bzImage-x86_64-6.17 \\")
    print("    -initrd bench-images/busybox/busybox-neovim-initrd.cpio.gz \\")
    print("    -m 512M -nographic \\")
    print("    -append 'console=ttyS0'")
    print()

    return 0


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="MiniVim + Neovim feasibility test"
    )

    args = parser.parse_args()
    return run_feasibility_test()


if __name__ == "__main__":
    sys.exit(main())
