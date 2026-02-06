"""Tests for scripts/release/package_fast_openvscode_vm.py"""

from __future__ import annotations

import hashlib
import sys
import tarfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "scripts" / "release"))

from package_fast_openvscode_vm import (
    DEFAULT_EXCLUDES,
    PackageConfig,
    check_vm_directory,
    compute_sha256,
    create_archive,
    create_sha256_file,
    log_error,
    log_info,
    log_success,
    package_vm,
    should_exclude,
)


class TestPackageConfig:
    """Tests for PackageConfig dataclass."""

    def test_default_values(self) -> None:
        """Should create config with default values."""
        config = PackageConfig()
        assert config.target_dir == "fast-openvscode-vm"
        assert config.excludes == DEFAULT_EXCLUDES

    def test_vm_dir(self) -> None:
        """Should compute vm_dir correctly."""
        config = PackageConfig()
        assert config.vm_dir == config.root_dir / config.target_dir

    def test_dist_dir(self) -> None:
        """Should compute dist_dir correctly."""
        config = PackageConfig()
        assert config.dist_dir == config.root_dir / "dist"

    def test_timestamp_format(self) -> None:
        """Should generate valid timestamp."""
        config = PackageConfig()
        ts = config.timestamp
        assert len(ts) == 16  # YYYYMMDDTHHMMSSz
        assert ts.endswith("Z")

    def test_get_output_path(self) -> None:
        """Should generate output path with timestamp."""
        config = PackageConfig()
        path = config.get_output_path("20240101T120000Z")
        assert str(path).endswith("fast-openvscode-vm-20240101T120000Z.tar.gz")

    def test_get_sha_path(self, tmp_path: Path) -> None:
        """Should generate SHA path."""
        config = PackageConfig(root_dir=tmp_path)
        output = tmp_path / "test.tar.gz"
        sha_path = config.get_sha_path(output)
        assert sha_path == tmp_path / "test.tar.gz.sha256"

    def test_custom_config(self, tmp_path: Path) -> None:
        """Should accept custom values."""
        config = PackageConfig(
            root_dir=tmp_path,
            target_dir="custom-vm",
            excludes=["*.log"],
        )
        assert config.root_dir == tmp_path
        assert config.target_dir == "custom-vm"
        assert config.excludes == ["*.log"]


class TestLogFunctions:
    """Tests for log functions."""

    def test_log_info(self, capsys: pytest.CaptureFixture) -> None:
        """Should print info message."""
        log_info("Test message")
        captured = capsys.readouterr()
        assert "Test message" in captured.out

    def test_log_success(self, capsys: pytest.CaptureFixture) -> None:
        """Should print success message."""
        log_success("Success")
        captured = capsys.readouterr()
        assert "Success" in captured.out

    def test_log_error(self, capsys: pytest.CaptureFixture) -> None:
        """Should print error to stderr."""
        log_error("Error")
        captured = capsys.readouterr()
        assert "error" in captured.err
        assert "Error" in captured.err


class TestCheckVmDirectory:
    """Tests for check_vm_directory function."""

    def test_returns_true_when_exists(self, tmp_path: Path) -> None:
        """Should return True when directory exists."""
        vm_dir = tmp_path / "fast-openvscode-vm"
        vm_dir.mkdir()
        config = PackageConfig(root_dir=tmp_path)

        assert check_vm_directory(config) is True

    def test_returns_false_when_missing(self, tmp_path: Path) -> None:
        """Should return False when directory missing."""
        config = PackageConfig(root_dir=tmp_path)

        assert check_vm_directory(config) is False


class TestShouldExclude:
    """Tests for should_exclude function."""

    def test_excludes_matching_pattern(self) -> None:
        """Should exclude paths matching pattern."""
        excludes = ["*.log", "downloads/*.tar.gz"]

        assert should_exclude("fast-openvscode-vm/qemu.log", excludes, "fast-openvscode-vm") is True
        assert should_exclude("fast-openvscode-vm/downloads/file.tar.gz", excludes, "fast-openvscode-vm") is True

    def test_includes_non_matching_paths(self) -> None:
        """Should include paths not matching patterns."""
        excludes = ["*.log"]

        assert should_exclude("fast-openvscode-vm/script.sh", excludes, "fast-openvscode-vm") is False

    def test_excludes_exact_filenames(self) -> None:
        """Should exclude exact filename matches."""
        excludes = [".microvm.pid"]

        assert should_exclude("fast-openvscode-vm/.microvm.pid", excludes, "fast-openvscode-vm") is True

    def test_handles_nested_paths(self) -> None:
        """Should handle nested directory paths."""
        excludes = ["downloads/*.zip"]

        assert should_exclude("fast-openvscode-vm/downloads/archive.zip", excludes, "fast-openvscode-vm") is True
        assert should_exclude("fast-openvscode-vm/other/archive.zip", excludes, "fast-openvscode-vm") is False


class TestCreateArchive:
    """Tests for create_archive function."""

    def test_creates_archive(self, tmp_path: Path) -> None:
        """Should create tarball archive."""
        # Setup
        vm_dir = tmp_path / "fast-openvscode-vm"
        vm_dir.mkdir()
        (vm_dir / "file1.txt").write_text("content1")
        (vm_dir / "subdir").mkdir()
        (vm_dir / "subdir" / "file2.txt").write_text("content2")

        config = PackageConfig(root_dir=tmp_path, excludes=[])
        output_path = tmp_path / "output.tar.gz"

        result = create_archive(config, output_path)

        assert result is True
        assert output_path.exists()

        # Verify contents
        with tarfile.open(output_path, "r:gz") as tar:
            names = tar.getnames()
            assert "fast-openvscode-vm/file1.txt" in names
            assert "fast-openvscode-vm/subdir/file2.txt" in names

    def test_excludes_files(self, tmp_path: Path) -> None:
        """Should exclude matching files."""
        vm_dir = tmp_path / "fast-openvscode-vm"
        vm_dir.mkdir()
        (vm_dir / "keep.txt").write_text("keep")
        (vm_dir / "exclude.log").write_text("exclude")

        config = PackageConfig(root_dir=tmp_path, excludes=["*.log"])
        output_path = tmp_path / "output.tar.gz"

        create_archive(config, output_path)

        with tarfile.open(output_path, "r:gz") as tar:
            names = tar.getnames()
            assert "fast-openvscode-vm/keep.txt" in names
            assert "fast-openvscode-vm/exclude.log" not in names

    def test_returns_false_on_error(self, tmp_path: Path) -> None:
        """Should return False on error."""
        config = PackageConfig(root_dir=tmp_path)
        # Try to write to non-existent directory
        output_path = tmp_path / "nonexistent" / "output.tar.gz"

        result = create_archive(config, output_path)

        assert result is False


class TestComputeSha256:
    """Tests for compute_sha256 function."""

    def test_computes_hash(self, tmp_path: Path) -> None:
        """Should compute correct SHA256 hash."""
        test_file = tmp_path / "test.txt"
        test_file.write_bytes(b"hello world")

        result = compute_sha256(test_file)

        # Known SHA256 of "hello world"
        expected = hashlib.sha256(b"hello world").hexdigest()
        assert result == expected

    def test_handles_large_files(self, tmp_path: Path) -> None:
        """Should handle large files by reading in chunks."""
        test_file = tmp_path / "large.bin"
        # Write 1MB of data
        test_file.write_bytes(b"x" * (1024 * 1024))

        result = compute_sha256(test_file)

        assert len(result) == 64  # SHA256 hex is 64 chars


class TestCreateSha256File:
    """Tests for create_sha256_file function."""

    def test_creates_checksum_file(self, tmp_path: Path) -> None:
        """Should create checksum file."""
        archive = tmp_path / "test.tar.gz"
        archive.write_bytes(b"archive content")
        sha_path = tmp_path / "test.tar.gz.sha256"

        result = create_sha256_file(archive, sha_path)

        assert result is True
        assert sha_path.exists()

        content = sha_path.read_text()
        assert "test.tar.gz" in content
        assert len(content.split()[0]) == 64  # Hash length

    def test_returns_false_on_error(self, tmp_path: Path) -> None:
        """Should return False on error."""
        archive = tmp_path / "test.tar.gz"
        archive.write_bytes(b"content")
        sha_path = tmp_path / "nonexistent" / "checksum.sha256"

        result = create_sha256_file(archive, sha_path)

        assert result is False


class TestPackageVm:
    """Tests for package_vm function."""

    def test_successful_package(self, tmp_path: Path) -> None:
        """Should package VM successfully."""
        # Setup
        vm_dir = tmp_path / "fast-openvscode-vm"
        vm_dir.mkdir()
        (vm_dir / "file.txt").write_text("content")

        config = PackageConfig(root_dir=tmp_path, excludes=[])

        result = package_vm(config)

        assert result == 0

        # Verify outputs
        dist_dir = tmp_path / "dist"
        assert dist_dir.exists()

        archives = list(dist_dir.glob("*.tar.gz"))
        assert len(archives) == 1

        sha_files = list(dist_dir.glob("*.sha256"))
        assert len(sha_files) == 1

    def test_fails_when_vm_dir_missing(self, tmp_path: Path) -> None:
        """Should fail when VM directory missing."""
        config = PackageConfig(root_dir=tmp_path)

        result = package_vm(config)

        assert result == 1

    def test_accepts_target_dir_override(self, tmp_path: Path) -> None:
        """Should accept target directory override."""
        vm_dir = tmp_path / "custom-vm"
        vm_dir.mkdir()
        (vm_dir / "file.txt").write_text("content")

        result = package_vm(target_dir="custom-vm", config=PackageConfig(root_dir=tmp_path, excludes=[]))

        assert result == 0

    def test_creates_dist_directory(self, tmp_path: Path) -> None:
        """Should create dist directory if not exists."""
        vm_dir = tmp_path / "fast-openvscode-vm"
        vm_dir.mkdir()
        (vm_dir / "file.txt").write_text("content")

        config = PackageConfig(root_dir=tmp_path, excludes=[])

        package_vm(config)

        assert (tmp_path / "dist").exists()

    def test_uses_default_config(self) -> None:
        """Should use default config when None."""
        with patch("package_fast_openvscode_vm.check_vm_directory", return_value=False):
            result = package_vm(None)

            assert result == 1


class TestDefaultExcludes:
    """Tests for default exclude patterns."""

    def test_excludes_downloads(self) -> None:
        """Should exclude download files."""
        assert "downloads/*.tar.gz" in DEFAULT_EXCLUDES
        assert "downloads/*.zip" in DEFAULT_EXCLUDES

    def test_excludes_backup(self) -> None:
        """Should exclude backup files."""
        assert "openvscode-initramfs.cpio.gz.bak" in DEFAULT_EXCLUDES

    def test_excludes_logs(self) -> None:
        """Should exclude log files."""
        assert "qemu.log" in DEFAULT_EXCLUDES
        assert "qemu-console.log" in DEFAULT_EXCLUDES
        assert "qemu-test.log" in DEFAULT_EXCLUDES

    def test_excludes_pid_file(self) -> None:
        """Should exclude PID file."""
        assert ".microvm.pid" in DEFAULT_EXCLUDES
