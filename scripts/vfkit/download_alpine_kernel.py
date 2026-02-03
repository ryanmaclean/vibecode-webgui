#!/usr/bin/env python3
"""Download Alpine Linux ARM64 kernel and initramfs for vfkit.

Uses Alpine virt variant optimized for virtualization.
"""

from __future__ import annotations

# Datadog APM tracing
try:
    from ddtrace import tracer, patch_all
    patch_all()
except ImportError:
    pass

import gzip
import shutil
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path

# ANSI color codes
GREEN = "\033[0;32m"
YELLOW = "\033[1;33m"
RED = "\033[0;31m"
NC = "\033[0m"


@dataclass
class AlpineConfig:
    """Alpine Linux download configuration."""

    version: str = "3.19"
    release: str = "3.19.1"
    arch: str = "aarch64"
    vm_dir: Path = field(default_factory=lambda: Path.home() / ".vfkit" / "vms" / "vibecode-alpine")

    @property
    def kernel_dir(self) -> Path:
        """Get kernel directory path."""
        return self.vm_dir / "kernel"

    @property
    def base_url(self) -> str:
        """Get Alpine download base URL."""
        return f"https://dl-cdn.alpinelinux.org/alpine/v{self.version}/releases/{self.arch}"

    @property
    def iso_name(self) -> str:
        """Get ISO filename."""
        return f"alpine-virt-{self.release}-{self.arch}.iso"

    @property
    def iso_url(self) -> str:
        """Get full ISO download URL."""
        return f"{self.base_url}/{self.iso_name}"


def log_info(msg: str) -> None:
    """Print info message."""
    print(msg)


def log_success(msg: str) -> None:
    """Print success message."""
    print(f"{GREEN}✅ {msg}{NC}")


def log_warning(msg: str) -> None:
    """Print warning message."""
    print(f"{YELLOW}⚠️  {msg}{NC}")


def log_error(msg: str) -> None:
    """Print error message."""
    print(f"{RED}❌ {msg}{NC}")


def get_file_size_human(path: Path) -> str:
    """Get human-readable file size."""
    if not path.exists():
        return "0B"
    size = path.stat().st_size
    for unit in ["B", "KB", "MB", "GB"]:
        if size < 1024:
            return f"{size:.1f}{unit}"
        size /= 1024
    return f"{size:.1f}TB"


def run_command(
    cmd: list[str],
    timeout: int = 600,
    capture: bool = True,
    cwd: Path | None = None,
) -> subprocess.CompletedProcess:
    """Run a command with error handling."""
    try:
        return subprocess.run(
            cmd,
            capture_output=capture,
            text=True,
            timeout=timeout,
            cwd=cwd,
        )
    except subprocess.TimeoutExpired:
        return subprocess.CompletedProcess(cmd, returncode=1, stdout="", stderr="Timeout")
    except subprocess.SubprocessError as e:
        return subprocess.CompletedProcess(cmd, returncode=1, stdout="", stderr=str(e))


def download_iso(config: AlpineConfig) -> bool:
    """Download Alpine ISO if not already present.

    Args:
        config: Alpine configuration.

    Returns:
        True if ISO is available.
    """
    iso_path = config.kernel_dir / config.iso_name

    if iso_path.exists():
        log_success("Alpine ISO already downloaded")
        return True

    log_info(f"📥 Downloading Alpine ISO ({config.iso_name})...")
    log_info(f"   URL: {config.iso_url}")
    print()

    # Try aria2c first (faster), then curl
    if shutil.which("aria2c"):
        result = run_command(
            [
                "aria2c",
                "--max-connection-per-server=16",
                "--split=16",
                "--file-allocation=none",
                "--continue=true",
                "--dir=" + str(config.kernel_dir),
                "--out=" + config.iso_name,
                config.iso_url,
            ],
            timeout=1800,
        )
        if result.returncode == 0:
            log_success(f"Downloaded: {config.iso_name} ({get_file_size_human(iso_path)})")
            return True

    # Fallback to curl
    result = run_command(
        ["curl", "-L", "-o", str(iso_path), config.iso_url],
        timeout=1800,
        cwd=config.kernel_dir,
    )

    if result.returncode == 0 and iso_path.exists():
        log_success(f"Downloaded: {config.iso_name} ({get_file_size_human(iso_path)})")
        return True

    log_error("Failed to download Alpine ISO")
    return False


def find_extractor() -> str | None:
    """Find available ISO extraction tool.

    Returns:
        Extractor name or None if not found.
    """
    if shutil.which("7z"):
        return "7z"
    if shutil.which("bsdtar"):
        return "bsdtar"
    return None


def extract_with_7z(iso_path: Path, kernel_dir: Path) -> tuple[Path | None, Path | None]:
    """Extract kernel and initramfs using 7z.

    Returns:
        Tuple of (kernel_path, initramfs_path) or (None, None) on failure.
    """
    boot_dir = kernel_dir / "boot"

    # Extract boot directory
    run_command(["7z", "x", "-y", str(iso_path), "boot/"], cwd=kernel_dir)

    kernel_path = None
    initramfs_path = None

    if boot_dir.exists():
        # Find kernel
        for kernel_file in boot_dir.glob("vmlinuz-*"):
            kernel_path = kernel_dir / "vmlinuz"
            shutil.copy(kernel_file, kernel_path)
            log_success(f"Extracted kernel: vmlinuz ({get_file_size_human(kernel_path)})")
            break

        # Find initramfs
        for initramfs_file in boot_dir.glob("initramfs-*"):
            initramfs_path = kernel_dir / "initramfs"
            shutil.copy(initramfs_file, initramfs_path)
            log_success(f"Extracted initramfs: initramfs ({get_file_size_human(initramfs_path)})")
            break

        # Cleanup
        shutil.rmtree(boot_dir, ignore_errors=True)

    return kernel_path, initramfs_path


def extract_with_bsdtar(iso_path: Path, kernel_dir: Path) -> tuple[Path | None, Path | None]:
    """Extract kernel and initramfs using bsdtar.

    Returns:
        Tuple of (kernel_path, initramfs_path) or (None, None) on failure.
    """
    boot_dir = kernel_dir / "boot"

    # Try to extract specific files first
    run_command(
        ["bsdtar", "-xf", str(iso_path), "boot/vmlinuz-virt", "boot/initramfs-virt"],
        cwd=kernel_dir,
    )

    # If that failed, try extracting all of boot/
    if not boot_dir.exists():
        run_command(["bsdtar", "-xf", str(iso_path), "boot/"], cwd=kernel_dir)

    kernel_path = None
    initramfs_path = None

    if boot_dir.exists():
        # Copy kernel - try virt first, then lts, then any
        vmlinuz_dest = kernel_dir / "vmlinuz"
        for variant in ["vmlinuz-virt", "vmlinuz-lts"]:
            src = boot_dir / variant
            if src.exists():
                shutil.copy(src, vmlinuz_dest)
                kernel_path = vmlinuz_dest
                break

        if not kernel_path:
            for kernel_file in boot_dir.glob("vmlinuz-*"):
                shutil.copy(kernel_file, vmlinuz_dest)
                kernel_path = vmlinuz_dest
                break

        if kernel_path:
            log_success(f"Extracted kernel: vmlinuz ({get_file_size_human(kernel_path)})")

        # Copy initramfs - try virt first, then lts, then any
        initramfs_dest = kernel_dir / "initramfs"
        for variant in ["initramfs-virt", "initramfs-lts"]:
            src = boot_dir / variant
            if src.exists():
                shutil.copy(src, initramfs_dest)
                initramfs_path = initramfs_dest
                break

        if not initramfs_path:
            for initramfs_file in boot_dir.glob("initramfs-*"):
                shutil.copy(initramfs_file, initramfs_dest)
                initramfs_path = initramfs_dest
                break

        if initramfs_path:
            log_success(f"Extracted initramfs: initramfs ({get_file_size_human(initramfs_path)})")

        # Cleanup
        shutil.rmtree(boot_dir, ignore_errors=True)

    return kernel_path, initramfs_path


def extract_with_hdiutil(iso_path: Path, kernel_dir: Path) -> tuple[Path | None, Path | None]:
    """Extract kernel and initramfs by mounting ISO (macOS only).

    Returns:
        Tuple of (kernel_path, initramfs_path) or (None, None) on failure.
    """
    if not shutil.which("hdiutil"):
        return None, None

    mount_point = Path(f"/tmp/alpine-mount-{subprocess.os.getpid()}")
    mount_point.mkdir(parents=True, exist_ok=True)

    kernel_path = None
    initramfs_path = None

    try:
        # Mount ISO
        result = run_command(
            ["hdiutil", "attach", "-mountpoint", str(mount_point), str(iso_path)],
            timeout=60,
        )

        if result.returncode == 0:
            log_success(f"Mounted ISO at {mount_point}")

            # Copy kernel
            src_kernel = mount_point / "boot" / "vmlinuz-virt"
            src_initramfs = mount_point / "boot" / "initramfs-virt"

            if src_kernel.exists():
                kernel_path = kernel_dir / "vmlinuz"
                shutil.copy(src_kernel, kernel_path)

            if src_initramfs.exists():
                initramfs_path = kernel_dir / "initramfs"
                shutil.copy(src_initramfs, initramfs_path)

    finally:
        # Unmount
        run_command(["hdiutil", "detach", str(mount_point)], timeout=30)
        shutil.rmtree(mount_point, ignore_errors=True)

    return kernel_path, initramfs_path


def extract_kernel_and_initramfs(config: AlpineConfig) -> bool:
    """Extract kernel and initramfs from Alpine ISO.

    Args:
        config: Alpine configuration.

    Returns:
        True if extraction successful.
    """
    log_info("📦 Extracting kernel and initramfs from ISO...")

    iso_path = config.kernel_dir / config.iso_name
    kernel_path = config.kernel_dir / "vmlinuz"
    initramfs_path = config.kernel_dir / "initramfs"

    # Find extractor
    extractor = find_extractor()
    if not extractor:
        log_error("No ISO extraction tool found")
        log_info("Install 7zip: brew install p7zip")
        log_info("Or use built-in: bsdtar (should be pre-installed on macOS)")
        return False

    log_info(f"Using extractor: {extractor}")
    print()

    # Extract using available tool
    if extractor == "7z":
        kernel_path, initramfs_path = extract_with_7z(iso_path, config.kernel_dir)
    elif extractor == "bsdtar":
        kernel_path, initramfs_path = extract_with_bsdtar(iso_path, config.kernel_dir)

    # If extraction failed, try hdiutil (macOS)
    if not kernel_path or not initramfs_path:
        log_warning("Primary extraction failed, trying hdiutil...")
        kernel_path, initramfs_path = extract_with_hdiutil(iso_path, config.kernel_dir)

    # Final verification
    final_kernel = config.kernel_dir / "vmlinuz"
    final_initramfs = config.kernel_dir / "initramfs"

    if not final_kernel.exists() or not final_initramfs.exists():
        log_error("Failed to extract kernel and initramfs")
        print()
        log_info("Manual extraction steps:")
        log_info(f"1. Mount the ISO: hdiutil attach {iso_path}")
        log_info("2. Copy files: cp /Volumes/ALPINE/boot/vmlinuz-virt vmlinuz")
        log_info("3. Copy files: cp /Volumes/ALPINE/boot/initramfs-virt initramfs")
        log_info("4. Unmount: hdiutil detach /Volumes/ALPINE")
        return False

    return True


def extract_uncompressed_kernel(config: AlpineConfig) -> bool:
    """Extract uncompressed kernel for vfkit.

    vfkit requires an uncompressed kernel. This extracts the gzip-compressed
    kernel from vmlinuz and decompresses it.

    Args:
        config: Alpine configuration.

    Returns:
        True if extraction successful, False otherwise.
    """
    print()
    log_info("📦 Extracting uncompressed kernel for vfkit...")
    log_info("   (vfkit requires an uncompressed kernel)")

    vmlinuz_path = config.kernel_dir / "vmlinuz"
    vmlinux_path = config.kernel_dir / "vmlinux"
    vmlinuz_gz_path = config.kernel_dir / "vmlinuz.gz"

    if not vmlinuz_path.exists():
        log_warning("vmlinuz not found - skipping vmlinux extraction")
        return False

    try:
        # Read vmlinuz and find gzip header
        with open(vmlinuz_path, "rb") as f:
            data = f.read()

        # Find gzip magic number (0x1f 0x8b)
        gzip_offset = data.find(b"\x1f\x8b")
        if gzip_offset < 0:
            log_warning("No gzip header found in vmlinuz")
            return False

        # Write gzipped kernel
        with open(vmlinuz_gz_path, "wb") as f:
            f.write(data[gzip_offset:])

        # Decompress
        with gzip.open(vmlinuz_gz_path, "rb") as f_in:
            with open(vmlinux_path, "wb") as f_out:
                shutil.copyfileobj(f_in, f_out)

        # Cleanup temp file
        vmlinuz_gz_path.unlink(missing_ok=True)

        if vmlinux_path.exists() and vmlinux_path.stat().st_size > 0:
            log_success(f"Extracted uncompressed kernel: vmlinux ({get_file_size_human(vmlinux_path)})")
            return True
        else:
            log_warning("Failed to extract vmlinux - will try at launch time")
            return False

    except Exception as e:
        log_warning(f"Failed to extract vmlinux: {e}")
        vmlinuz_gz_path.unlink(missing_ok=True)
        return False


def get_directory_size(path: Path) -> str:
    """Get total size of directory contents."""
    total = sum(f.stat().st_size for f in path.rglob("*") if f.is_file())
    for unit in ["B", "KB", "MB", "GB"]:
        if total < 1024:
            return f"{total:.1f}{unit}"
        total /= 1024
    return f"{total:.1f}TB"


def print_summary(config: AlpineConfig) -> None:
    """Print download summary."""
    kernel_dir = config.kernel_dir
    vmlinuz = kernel_dir / "vmlinuz"
    initramfs = kernel_dir / "initramfs"
    vmlinux = kernel_dir / "vmlinux"
    iso = kernel_dir / config.iso_name

    print()
    log_info("=== Download Complete ===")
    print()

    vmlinux_info = ""
    if vmlinux.exists():
        vmlinux_info = f" (uncompressed: {get_file_size_human(vmlinux)})"

    log_success(f"Kernel: {vmlinuz} ({get_file_size_human(vmlinuz)}){vmlinux_info}")
    log_success(f"Initramfs: {initramfs} ({get_file_size_human(initramfs)})")
    log_success(f"ISO: {iso}")
    print()
    log_info(f"Total size: {get_directory_size(kernel_dir)}")
    print()
    log_info("Next step:")
    log_info("  ./scripts/vfkit/03-create-alpine-rootfs.sh")
    print()


def run_download(config: AlpineConfig | None = None) -> int:
    """Run the Alpine kernel download process.

    Args:
        config: Alpine configuration (uses defaults if None).

    Returns:
        Exit code (0 for success, 1 for failure).
    """
    if config is None:
        config = AlpineConfig()

    log_info("=== Downloading Alpine Linux ARM64 Kernel ===")
    print()

    log_info(f"Alpine Version: {config.release}")
    log_info(f"Architecture: {config.arch}")
    log_info("Variant: virt (optimized for virtualization)")
    print()

    # Create kernel directory
    config.kernel_dir.mkdir(parents=True, exist_ok=True)

    # Download ISO
    if not download_iso(config):
        return 1

    print()

    # Extract kernel and initramfs
    if not extract_kernel_and_initramfs(config):
        return 1

    # Extract uncompressed kernel (optional, for vfkit)
    extract_uncompressed_kernel(config)

    # Print summary
    print_summary(config)

    return 0


def main() -> int:
    """Main entry point."""
    return run_download()


if __name__ == "__main__":
    sys.exit(main())
