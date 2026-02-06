#!/usr/bin/env python3
"""Package fast-openvscode-vm into a distributable tarball."""

from __future__ import annotations

import hashlib
import os
import shutil
import subprocess
import sys
import tarfile
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

# ANSI color codes
GREEN = "\033[0;32m"
RED = "\033[0;31m"
NC = "\033[0m"

# Default excludes for packaging
DEFAULT_EXCLUDES = [
    "downloads/*.tar.gz",
    "downloads/*.zip",
    "openvscode-initramfs.cpio.gz.bak",
    "qemu.log",
    "qemu-console.log",
    "qemu-test.log",
    ".microvm.pid",
]


@dataclass
class PackageConfig:
    """Package configuration."""

    root_dir: Path = field(default_factory=lambda: Path(__file__).parent.parent.parent.resolve())
    target_dir: str = "fast-openvscode-vm"
    excludes: list[str] = field(default_factory=lambda: DEFAULT_EXCLUDES.copy())

    @property
    def vm_dir(self) -> Path:
        """Get VM directory path."""
        return self.root_dir / self.target_dir

    @property
    def dist_dir(self) -> Path:
        """Get distribution directory path."""
        return self.root_dir / "dist"

    @property
    def timestamp(self) -> str:
        """Get UTC timestamp for filename."""
        return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

    def get_output_path(self, timestamp: str | None = None) -> Path:
        """Get output archive path.

        Args:
            timestamp: Optional timestamp (uses current if None).

        Returns:
            Path to output archive.
        """
        ts = timestamp or self.timestamp
        return self.dist_dir / f"{self.target_dir}-{ts}.tar.gz"

    def get_sha_path(self, output_path: Path) -> Path:
        """Get SHA256 checksum file path.

        Args:
            output_path: Path to archive.

        Returns:
            Path to checksum file.
        """
        return Path(str(output_path) + ".sha256")


def log_info(msg: str) -> None:
    """Print info message."""
    print(msg)


def log_error(msg: str) -> None:
    """Print error message."""
    print(f"{RED}error:{NC} {msg}", file=sys.stderr)


def log_success(msg: str) -> None:
    """Print success message."""
    print(f"{GREEN}{msg}{NC}")


def check_vm_directory(config: PackageConfig) -> bool:
    """Check if VM directory exists.

    Args:
        config: Package configuration.

    Returns:
        True if directory exists.
    """
    if not config.vm_dir.is_dir():
        log_error(f"{config.target_dir} directory not found")
        return False
    return True


def should_exclude(path: str, excludes: list[str], target_dir: str) -> bool:
    """Check if a path should be excluded.

    Args:
        path: Path to check (relative to archive root).
        excludes: List of exclude patterns.
        target_dir: Target directory name.

    Returns:
        True if path should be excluded.
    """
    import fnmatch

    # Get path relative to target dir
    if path.startswith(target_dir + "/"):
        rel_path = path[len(target_dir) + 1:]
    else:
        rel_path = path

    for pattern in excludes:
        if fnmatch.fnmatch(rel_path, pattern):
            return True
        # Also check if basename matches
        if fnmatch.fnmatch(Path(rel_path).name, pattern):
            return True

    return False


def create_archive(config: PackageConfig, output_path: Path) -> bool:
    """Create tarball archive.

    Args:
        config: Package configuration.
        output_path: Path for output archive.

    Returns:
        True if archive created successfully.
    """
    log_info(f"Packaging {config.target_dir} into {output_path}")

    try:
        with tarfile.open(output_path, "w:gz") as tar:
            # Walk the VM directory
            for root, dirs, files in os.walk(config.vm_dir):
                for file in files:
                    file_path = Path(root) / file
                    # Get path relative to root_dir
                    arcname = str(file_path.relative_to(config.root_dir))

                    if should_exclude(arcname, config.excludes, config.target_dir):
                        continue

                    tar.add(file_path, arcname=arcname)

                # Also add directories (for empty dirs)
                for dir_name in dirs:
                    dir_path = Path(root) / dir_name
                    arcname = str(dir_path.relative_to(config.root_dir))

                    if should_exclude(arcname, config.excludes, config.target_dir):
                        dirs.remove(dir_name)  # Don't recurse into excluded dirs

        return True

    except (OSError, tarfile.TarError) as e:
        log_error(f"Failed to create archive: {e}")
        return False


def compute_sha256(file_path: Path) -> str:
    """Compute SHA256 hash of a file.

    Args:
        file_path: Path to file.

    Returns:
        Hex digest of SHA256 hash.
    """
    sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            sha256.update(chunk)
    return sha256.hexdigest()


def create_sha256_file(archive_path: Path, sha_path: Path) -> bool:
    """Create SHA256 checksum file.

    Args:
        archive_path: Path to archive.
        sha_path: Path for checksum file.

    Returns:
        True if checksum file created successfully.
    """
    try:
        sha256_hash = compute_sha256(archive_path)
        # Format like sha256sum output: hash  filename
        content = f"{sha256_hash}  {archive_path.name}\n"
        sha_path.write_text(content)
        return True
    except OSError as e:
        log_error(f"Failed to create checksum file: {e}")
        return False


def package_vm(config: PackageConfig | None = None, target_dir: str | None = None) -> int:
    """Package the VM into a distributable tarball.

    Args:
        config: Package configuration (uses defaults if None).
        target_dir: Optional target directory override.

    Returns:
        Exit code (0 for success, 1 for failure).
    """
    if config is None:
        config = PackageConfig()

    if target_dir:
        config = PackageConfig(
            root_dir=config.root_dir,
            target_dir=target_dir,
            excludes=config.excludes,
        )

    # Check VM directory exists
    if not check_vm_directory(config):
        return 1

    # Create dist directory
    try:
        config.dist_dir.mkdir(parents=True, exist_ok=True)
    except OSError as e:
        log_error(f"Failed to create dist directory: {e}")
        return 1

    # Generate output paths
    timestamp = config.timestamp
    output_path = config.get_output_path(timestamp)
    sha_path = config.get_sha_path(output_path)

    # Create archive
    if not create_archive(config, output_path):
        return 1

    # Create SHA256 checksum
    if not create_sha256_file(output_path, sha_path):
        return 1

    # Print results
    log_success(f"Created archive: {output_path}")
    log_info("SHA256:")
    print(sha_path.read_text(), end="")

    return 0


def main() -> int:
    """Main entry point."""
    target_dir = sys.argv[1] if len(sys.argv) > 1 else None
    return package_vm(target_dir=target_dir)


if __name__ == "__main__":
    sys.exit(main())
