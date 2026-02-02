#!/usr/bin/env python3
"""Build a BusyBox + Neovim initramfs for MiniVim benchmarks.

Creates an initramfs with BusyBox utilities and Neovim editor.
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
from pathlib import Path

try:
    from .benchmark_utils import (
        REPO_ROOT,
        BenchmarkError,
        check_command,
        detect_cpu_count,
        file_size_human,
        log,
        run_cmd,
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
        detect_cpu_count,
        file_size_human,
        log,
        run_cmd,
        success,
        warn,
        error as log_error,
    )


DEFAULT_NEOVIM_VERSION = "v0.10.2"
DEFAULT_BUSYBOX_VERSION = "1.36.1"


INIT_SCRIPT = '''#!/bin/sh

# Mount essential filesystems
mount -t proc none /proc
mount -t sysfs none /sys
mount -t devtmpfs none /dev

# Set up environment
export PATH=/bin:/sbin:/usr/bin:/usr/sbin
export HOME=/root
export TERM=xterm-256color

# Clear screen
clear

# Welcome message
echo "=========================================="
echo "  MiniVim Kernel + Neovim Test Environment"
echo "=========================================="
echo ""
echo "Neovim is available as: nvim, vim, vi"
echo "Type 'nvim' to start Neovim"
echo "Type 'exit' to shutdown"
echo ""

# Start shell
exec /bin/sh
'''

WELCOME_TEXT = '''Welcome to MiniVim + Neovim!

This is a minimal Linux kernel with Neovim running in an initramfs.

Try editing this file with:
  nvim welcome.txt

Key features:
- Minimal kernel (< 10MB)
- Neovim for editing
- BusyBox utilities
- Fast boot time

Perfect for testing Avante.nvim and other Neovim plugins!
'''

NEOVIM_CONFIG = '''-- Minimal Neovim config for MiniVim
vim.opt.number = true
vim.opt.relativenumber = true
vim.opt.expandtab = true
vim.opt.shiftwidth = 2
vim.opt.tabstop = 2

-- Show welcome message
vim.api.nvim_create_autocmd("VimEnter", {
  callback = function()
    print("MiniVim + Neovim - Ready!")
  end,
})
'''


def download_neovim(work_dir: Path, version: str) -> Path | None:
    """Download and extract Neovim.

    Returns:
        Path to extracted Neovim directory or None
    """
    appimage_url = f"https://github.com/neovim/neovim/releases/download/{version}/nvim.appimage"
    static_url = f"https://github.com/neovim/neovim/releases/download/{version}/nvim-linux64.tar.gz"

    log(f"Downloading Neovim AppImage...")

    appimage_path = work_dir / "nvim.appimage"
    run_cmd(["curl", "-L", "-o", str(appimage_path), appimage_url])
    appimage_path.chmod(0o755)

    # Try to extract AppImage
    log("Extracting Neovim...")
    try:
        run_cmd([str(appimage_path), "--appimage-extract"], cwd=work_dir)
    except BenchmarkError:
        pass

    squashfs_root = work_dir / "squashfs-root"
    if squashfs_root.exists():
        return squashfs_root

    # Fall back to static build
    warn("Could not extract AppImage. Falling back to static build...")
    log(f"Downloading static build...")

    static_path = work_dir / "nvim-static.tar.gz"
    run_cmd(["curl", "-L", "-o", str(static_path), static_url])
    run_cmd(["tar", "xzf", str(static_path)], cwd=work_dir)

    nvim_dir = work_dir / "nvim-linux64"
    if nvim_dir.exists():
        return nvim_dir

    return None


def build_busybox(work_dir: Path, version: str, jobs: int) -> Path | None:
    """Build BusyBox if not available.

    Returns:
        Path to busybox binary or None
    """
    if check_command("busybox"):
        return Path(shutil.which("busybox"))

    log(f"Downloading BusyBox {version}...")
    url = f"https://busybox.net/downloads/busybox-{version}.tar.bz2"

    run_cmd(["curl", "-L", "-o", "busybox.tar.bz2", url], cwd=work_dir)
    run_cmd(["tar", "xjf", "busybox.tar.bz2"], cwd=work_dir)

    busybox_src = work_dir / f"busybox-{version}"
    os.chdir(busybox_src)

    # Configure for static build
    run_cmd(["make", "defconfig"])

    config_path = busybox_src / ".config"
    content = config_path.read_text()
    content = content.replace("# CONFIG_STATIC is not set", "CONFIG_STATIC=y")
    config_path.write_text(content)

    # Build
    log("Building BusyBox (this may take a few minutes)...")
    run_cmd(["make", f"-j{jobs}"])

    busybox_bin = busybox_src / "busybox"
    if busybox_bin.exists():
        return busybox_bin

    return None


def create_initramfs(
    work_dir: Path,
    output_path: Path,
    neovim_dir: Path,
    busybox_path: Path,
) -> None:
    """Create the initramfs archive."""
    log("Creating directory structure...")

    # Create directory structure
    dirs = [
        "bin", "sbin", "etc", "proc", "sys", "dev",
        "tmp", "usr/bin", "usr/sbin", "lib", "lib64", "root",
        "root/.config/nvim",
    ]
    for d in dirs:
        (work_dir / d).mkdir(parents=True, exist_ok=True)

    # Copy Neovim
    log("Copying Neovim files...")
    if (neovim_dir / "usr").exists():
        shutil.copytree(neovim_dir / "usr", work_dir / "usr", dirs_exist_ok=True)
    else:
        shutil.copytree(neovim_dir, work_dir / "usr", dirs_exist_ok=True)

    # Create symlinks for nvim
    nvim_bin = work_dir / "bin" / "nvim"
    if not nvim_bin.exists():
        nvim_bin.symlink_to("/usr/bin/nvim")

    for name in ["vim", "vi"]:
        link = work_dir / "bin" / name
        if not link.exists():
            link.symlink_to("nvim")

    # Copy BusyBox
    log("Copying BusyBox...")
    busybox_dst = work_dir / "bin" / "busybox"
    shutil.copy(busybox_path, busybox_dst)
    busybox_dst.chmod(0o755)

    # Create BusyBox symlinks
    log("Creating BusyBox symlinks...")
    busybox_cmds = [
        "sh", "ash", "bash", "ls", "cat", "echo", "mount", "umount",
        "mkdir", "rmdir", "cp", "mv", "rm", "ln", "chmod", "chown",
        "ps", "kill", "grep", "sed", "awk", "find", "xargs",
        "tar", "gzip", "gunzip", "less", "more", "head", "tail",
    ]
    for cmd in busybox_cmds:
        link = work_dir / "bin" / cmd
        if not link.exists():
            try:
                link.symlink_to("busybox")
            except Exception:
                pass

    # Check for library dependencies
    log("Checking for required libraries...")
    nvim_path = work_dir / "usr" / "bin" / "nvim"
    if nvim_path.exists():
        try:
            result = subprocess.run(
                ["ldd", str(nvim_path)],
                capture_output=True,
                text=True,
            )
            libs = []
            for line in result.stdout.split("\n"):
                if "=>" in line:
                    parts = line.split("=>")
                    if len(parts) >= 2:
                        lib_path = parts[1].split()[0].strip()
                        if lib_path and Path(lib_path).exists():
                            libs.append(lib_path)

            if libs:
                log("Copying required libraries...")
                for lib in libs:
                    lib_dst = work_dir / "lib" / Path(lib).name
                    try:
                        shutil.copy(lib, lib_dst)
                    except Exception:
                        pass

                # Copy ld-linux
                for line in result.stdout.split("\n"):
                    if "ld-linux" in line:
                        ld_path = line.split()[0]
                        if Path(ld_path).exists():
                            shutil.copy(ld_path, work_dir / "lib" / Path(ld_path).name)
                        break
        except Exception:
            pass

    # Create init script
    log("Creating init script...")
    init_path = work_dir / "init"
    init_path.write_text(INIT_SCRIPT)
    init_path.chmod(0o755)

    # Create welcome file
    (work_dir / "root" / "welcome.txt").write_text(WELCOME_TEXT)

    # Create Neovim config
    (work_dir / "root" / ".config" / "nvim" / "init.lua").write_text(NEOVIM_CONFIG)

    # Create initramfs
    log("Creating initramfs archive...")
    find_proc = subprocess.Popen(
        ["find", "."],
        cwd=work_dir,
        stdout=subprocess.PIPE,
    )
    cpio_proc = subprocess.Popen(
        ["cpio", "-o", "-H", "newc"],
        cwd=work_dir,
        stdin=find_proc.stdout,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
    )
    gzip_proc = subprocess.Popen(
        ["gzip"],
        stdin=cpio_proc.stdout,
        stdout=subprocess.PIPE,
    )

    output, _ = gzip_proc.communicate()
    output_path.write_bytes(output)


def main(argv: list[str] | None = None) -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--neovim-version",
        default=os.environ.get("NEOVIM_VERSION", DEFAULT_NEOVIM_VERSION),
        help=f"Neovim version (default: {DEFAULT_NEOVIM_VERSION})",
    )
    parser.add_argument(
        "--busybox-version",
        default=os.environ.get("BUSYBOX_VERSION", DEFAULT_BUSYBOX_VERSION),
        help=f"BusyBox version (default: {DEFAULT_BUSYBOX_VERSION})",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=REPO_ROOT / "bench-images" / "busybox",
        help="Output directory",
    )
    parser.add_argument(
        "--jobs", "-j",
        type=int,
        default=detect_cpu_count(),
        help="Number of parallel jobs",
    )

    args = parser.parse_args(argv)

    work_dir = REPO_ROOT / "artifacts" / "minivim" / "initramfs-work"
    output_path = args.output_dir / "busybox-neovim-initrd.cpio.gz"

    print(f"=== Building Neovim Initramfs ===")
    print(f"Neovim Version: {args.neovim_version}")
    print(f"Work Directory: {work_dir}")
    print()

    try:
        # Clean and create work directory
        if work_dir.exists():
            shutil.rmtree(work_dir)
        work_dir.mkdir(parents=True)

        # Download Neovim
        neovim_dir = download_neovim(work_dir, args.neovim_version)
        if not neovim_dir:
            log_error("Could not download Neovim")
            return 1

        # Build or find BusyBox
        busybox_path = build_busybox(work_dir, args.busybox_version, args.jobs)
        if not busybox_path:
            log_error("Could not find or build BusyBox")
            return 1

        # Create initramfs
        create_initramfs(work_dir, output_path, neovim_dir, busybox_path)

        # Report sizes
        size = output_path.stat().st_size

        print()
        print("=== Build Complete ===")
        print(f"Output: {output_path}")
        print(f"Size: {file_size_human(size)}")
        print()
        print("To test with QEMU:")
        print("  qemu-system-x86_64 -kernel bzImage -initrd busybox-neovim-initrd.cpio.gz -m 512M -nographic -append 'console=ttyS0'")
        print()

        # Cleanup
        shutil.rmtree(work_dir, ignore_errors=True)

        return 0

    except BenchmarkError as err:
        log_error(str(err))
        return 1


if __name__ == "__main__":
    sys.exit(main())
