from __future__ import annotations
#!/usr/bin/env python3

# Datadog Unified Service Tagging
_dd_service = "vfkit-02-download-alpine-kernel"
_dd_env = __import__("os").environ.get("DD_ENV", "development")
_dd_version = __import__("os").environ.get("DD_VERSION", "0.1.0")
try:
    from ddtrace import config as _dd_config, patch_all as _dd_patch, tracer as _dd_tracer
    _dd_config.service = _dd_service
    _dd_config.env = _dd_env
    _dd_config.version = _dd_version
    _dd_tracer.set_tags({"team": "platform", "component": "vm-management"})
    _dd_patch()
except ImportError:
    pass


# Datadog Log Aggregation
from scripts.lib.log_aggregation import get_log_aggregation




"""Download Alpine Linux ARM64 kernel and initramfs for vfkit.

Uses Alpine virt variant optimized for virtualization.
"""


# Initialize log aggregation
log_agg = get_log_aggregation()

try:
    import os as _os; _c = __import__('ddtrace').config; _s = _os.path.basename(__file__).replace('.py',''); _c.service = _s; _c.requests.service = _s; __import__('ddtrace').patch_all()
except: pass
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

import gzip
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts.vfkit_py.log import log_error, log_section, log_warn

# Try to import network utilities
try:
    from scripts.vfkit.network_utils import fast_download, test_connectivity
except ImportError:
    fast_download = None
    test_connectivity = None

# Alpine version configuration
ALPINE_VERSION = "3.19"
ALPINE_RELEASE = "3.19.1"
ALPINE_ARCH = "aarch64"

ALPINE_BASE_URL = f"https://dl-cdn.alpinelinux.org/alpine/v{ALPINE_VERSION}/releases/{ALPINE_ARCH}"
ALPINE_ISO = f"alpine-virt-{ALPINE_RELEASE}-{ALPINE_ARCH}.iso"
ALPINE_ISO_URL = f"{ALPINE_BASE_URL}/{ALPINE_ISO}"


def get_kernel_dir() -> Path:
    """Get the kernel directory path."""
    vm_dir = Path.home() / ".vfkit" / "vms" / "vibecode-alpine"
    return vm_dir / "kernel"


def download_alpine_iso(kernel_dir: Path) -> Path:
    """Download the Alpine ISO if not already present."""
    iso_path = kernel_dir / ALPINE_ISO

    if iso_path.exists():
        print("✅ Alpine ISO already downloaded")
        return iso_path

    print(f"📥 Downloading Alpine ISO ({ALPINE_ISO})...")
    print(f"   URL: {ALPINE_ISO_URL}")
    print()

    # Use fast_download if available
    if fast_download is not None:
        if fast_download(ALPINE_ISO_URL, iso_path, connections=16):
            if iso_path.exists():
                size = iso_path.stat().st_size / (1024 * 1024)
                print(f"✅ Downloaded: {ALPINE_ISO} ({size:.1f}MB)")
                return iso_path
    elif shutil.which("aria2c"):
        result = subprocess.run(
            [
                "aria2c",
                "--max-connection-per-server=16",
                "--split=16",
                "--file-allocation=none",
                "--continue=true",
                f"--dir={kernel_dir}",
                f"--out={ALPINE_ISO}",
                ALPINE_ISO_URL,
            ],
            check=False,
        )
        if result.returncode == 0 and iso_path.exists():
            size = iso_path.stat().st_size / (1024 * 1024)
            print(f"✅ Downloaded: {ALPINE_ISO} ({size:.1f}MB)")
            return iso_path

    # Fallback to curl
    result = subprocess.run(
        ["curl", "-L", "-o", str(iso_path), ALPINE_ISO_URL],
        check=False,
    )
    if result.returncode == 0 and iso_path.exists():
        size = iso_path.stat().st_size / (1024 * 1024)
        print(f"✅ Downloaded: {ALPINE_ISO} ({size:.1f}MB)")
        return iso_path

    log_error("Failed to download Alpine ISO")
    raise RuntimeError("Failed to download Alpine ISO")


def extract_with_7z(iso_path: Path, kernel_dir: Path) -> tuple[Path | None, Path | None]:
    """Extract kernel and initramfs using 7z."""
    boot_dir = kernel_dir / "boot"

    result = subprocess.run(
        ["7z", "x", "-y", str(iso_path), "boot/"],
        cwd=kernel_dir,
        capture_output=True,
        check=False,
    )

    if result.returncode != 0 or not boot_dir.exists():
        return None, None

    kernel_file = None
    initramfs_file = None

    for f in boot_dir.rglob("vmlinuz-*"):
        kernel_file = f
        break
    for f in boot_dir.rglob("initramfs-*"):
        initramfs_file = f
        break

    vmlinuz = kernel_dir / "vmlinuz"
    initramfs = kernel_dir / "initramfs"

    if kernel_file:
        shutil.copy(kernel_file, vmlinuz)
        print("✅ Extracted kernel: vmlinuz")
        print(f"   Size: {vmlinuz.stat().st_size / 1024:.1f}KB")

    if initramfs_file:
        shutil.copy(initramfs_file, initramfs)
        print("✅ Extracted initramfs: initramfs")
        print(f"   Size: {initramfs.stat().st_size / (1024*1024):.1f}MB")

    # Cleanup
    shutil.rmtree(boot_dir, ignore_errors=True)

    return vmlinuz if vmlinuz.exists() else None, initramfs if initramfs.exists() else None


def extract_with_bsdtar(iso_path: Path, kernel_dir: Path) -> tuple[Path | None, Path | None]:
    """Extract kernel and initramfs using bsdtar."""
    boot_dir = kernel_dir / "boot"

    # Try specific files first
    subprocess.run(
        ["bsdtar", "-xf", str(iso_path), "boot/vmlinuz-virt", "boot/initramfs-virt"],
        cwd=kernel_dir,
        capture_output=True,
        check=False,
    )

    if not boot_dir.exists():
        # Try extracting all boot files
        subprocess.run(
            ["bsdtar", "-xf", str(iso_path), "boot/"],
            cwd=kernel_dir,
            capture_output=True,
            check=False,
        )

    vmlinuz = kernel_dir / "vmlinuz"
    initramfs = kernel_dir / "initramfs"

    # Find and copy kernel
    kernel_candidates = ["boot/vmlinuz-virt", "boot/vmlinuz-lts"]
    for candidate in kernel_candidates:
        src = kernel_dir / candidate
        if src.exists():
            shutil.copy(src, vmlinuz)
            break
    else:
        for f in (kernel_dir / "boot").rglob("vmlinuz-*") if boot_dir.exists() else []:
            shutil.copy(f, vmlinuz)
            break

    # Find and copy initramfs
    initramfs_candidates = ["boot/initramfs-virt", "boot/initramfs-lts"]
    for candidate in initramfs_candidates:
        src = kernel_dir / candidate
        if src.exists():
            shutil.copy(src, initramfs)
            break
    else:
        for f in (kernel_dir / "boot").rglob("initramfs-*") if boot_dir.exists() else []:
            shutil.copy(f, initramfs)
            break

    # Cleanup
    shutil.rmtree(boot_dir, ignore_errors=True)

    return vmlinuz if vmlinuz.exists() else None, initramfs if initramfs.exists() else None


def extract_with_hdiutil(iso_path: Path, kernel_dir: Path) -> tuple[Path | None, Path | None]:
    """Extract kernel and initramfs using hdiutil (macOS specific)."""
    mount_point = Path(tempfile.mkdtemp(prefix="alpine-mount-"))

    try:
        result = subprocess.run(
            ["hdiutil", "attach", "-mountpoint", str(mount_point), str(iso_path)],
            capture_output=True,
            check=False,
        )

        if result.returncode != 0:
            return None, None

        print(f"✅ Mounted ISO at {mount_point}")

        vmlinuz = kernel_dir / "vmlinuz"
        initramfs = kernel_dir / "initramfs"

        boot_vmlinuz = mount_point / "boot" / "vmlinuz-virt"
        boot_initramfs = mount_point / "boot" / "initramfs-virt"

        if boot_vmlinuz.exists():
            shutil.copy(boot_vmlinuz, vmlinuz)
        if boot_initramfs.exists():
            shutil.copy(boot_initramfs, initramfs)

        return vmlinuz if vmlinuz.exists() else None, initramfs if initramfs.exists() else None

    finally:
        subprocess.run(
            ["hdiutil", "detach", str(mount_point)],
            capture_output=True,
            check=False,
        )
        shutil.rmtree(mount_point, ignore_errors=True)


def extract_kernel_initramfs(iso_path: Path, kernel_dir: Path) -> tuple[Path, Path]:
    """Extract kernel and initramfs from ISO."""
    print()
    print("📦 Extracting kernel and initramfs from ISO...")

    # Determine extractor
    if shutil.which("7z"):
        extractor = "7z"
    elif shutil.which("bsdtar"):
        extractor = "bsdtar"
    else:
        log_error("No ISO extraction tool found")
        print("Install 7zip: brew install p7zip")
        print("Or use built-in: bsdtar (should be pre-installed on macOS)")
        raise RuntimeError("No ISO extraction tool available")

    print(f"Using extractor: {extractor}")
    print()

    if extractor == "7z":
        vmlinuz, initramfs = extract_with_7z(iso_path, kernel_dir)
    else:
        vmlinuz, initramfs = extract_with_bsdtar(iso_path, kernel_dir)

    if vmlinuz is None or initramfs is None:
        print("Trying alternative method with hdiutil...")
        vmlinuz, initramfs = extract_with_hdiutil(iso_path, kernel_dir)

    if vmlinuz is None or initramfs is None:
        log_error("Failed to extract kernel and initramfs")
        print()
        print("Manual extraction steps:")
        print(f"1. Mount the ISO: hdiutil attach {iso_path}")
        print("2. Copy files: cp /Volumes/ALPINE/boot/vmlinuz-virt vmlinuz")
        print("3. Copy files: cp /Volumes/ALPINE/boot/initramfs-virt initramfs")
        print("4. Unmount: hdiutil detach /Volumes/ALPINE")
        raise RuntimeError("Failed to extract kernel and initramfs")

    return vmlinuz, initramfs


def extract_uncompressed_kernel(kernel_dir: Path) -> Path | None:
    """Extract uncompressed kernel for vfkit (which requires it)."""
    print()
    print("📦 Extracting uncompressed kernel for vfkit...")
    print("   (vfkit requires an uncompressed kernel)")

    vmlinuz = kernel_dir / "vmlinuz"
    vmlinux = kernel_dir / "vmlinux"

    if not vmlinuz.exists():
        return None

    # Read the compressed kernel and find gzip header
    data = vmlinuz.read_bytes()
    gzip_magic = b"\x1f\x8b"
    offset = data.find(gzip_magic)

    if offset < 0:
        log_warn("Could not find gzip header in kernel - will try at launch time")
        return None

    # Extract gzip portion and decompress
    vmlinuz_gz = kernel_dir / "vmlinuz.gz"
    try:
        vmlinuz_gz.write_bytes(data[offset:])

        with gzip.open(vmlinuz_gz, "rb") as f_in:
            vmlinux.write_bytes(f_in.read())

        vmlinuz_gz.unlink(missing_ok=True)

        if vmlinux.exists() and vmlinux.stat().st_size > 0:
            print("✅ Extracted uncompressed kernel: vmlinux")
            return vmlinux

    except Exception as e:
        log_warn(f"Failed to extract vmlinux: {e}")
        vmlinuz_gz.unlink(missing_ok=True)

    log_warn("Failed to extract vmlinux - will try at launch time")
    return None


def print_summary(kernel_dir: Path, vmlinuz: Path, initramfs: Path, vmlinux: Path | None) -> None:
    """Print download summary."""
    print()
    log_section("Download Complete")
    print()

    vmlinuz_size = f"{vmlinuz.stat().st_size / 1024:.1f}KB"
    vmlinux_info = ""
    if vmlinux and vmlinux.exists():
        vmlinux_size = f"{vmlinux.stat().st_size / (1024*1024):.1f}MB"
        vmlinux_info = f" (uncompressed: {vmlinux_size})"

    initramfs_size = f"{initramfs.stat().st_size / (1024*1024):.1f}MB"

    print(f"✅ Kernel: {vmlinuz} ({vmlinuz_size}){vmlinux_info}")
    print(f"✅ Initramfs: {initramfs} ({initramfs_size})")
    print(f"✅ ISO: {kernel_dir / ALPINE_ISO}")
    print()

    total_size = sum(f.stat().st_size for f in kernel_dir.iterdir() if f.is_file())
    print(f"Total size: {total_size / (1024*1024):.1f}MB")
    print()
    print("Next step:")
    print("  ./scripts/vfkit/03-create-alpine-rootfs.sh")
    print()


def main() -> int:
    """Main entry point."""
    log_section("Downloading Alpine Linux ARM64 Kernel")
    print()

    # Test network connectivity if available
    if test_connectivity is not None:
        test_connectivity()

    print(f"Alpine Version: {ALPINE_RELEASE}")
    print(f"Architecture: {ALPINE_ARCH}")
    print("Variant: virt (optimized for virtualization)")
    print()

    # Create kernel directory
    kernel_dir = get_kernel_dir()
    kernel_dir.mkdir(parents=True, exist_ok=True)

    try:
        # Download Alpine ISO
        iso_path = download_alpine_iso(kernel_dir)

        # Extract kernel and initramfs
        vmlinuz, initramfs = extract_kernel_initramfs(iso_path, kernel_dir)

        # Extract uncompressed kernel
        vmlinux = extract_uncompressed_kernel(kernel_dir)

        # Print summary
        print_summary(kernel_dir, vmlinuz, initramfs, vmlinux)

        return 0

    except Exception as e:
        log_error(str(e))
        return 1


if __name__ == "__main__":
    sys.exit(main())