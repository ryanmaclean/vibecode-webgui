

"""Tests for scripts/vz/valkey_vm_launcher.py"""

from __future__ import annotations
# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "scripts" / "vz"))

from valkey_vm_launcher import (
    ENTITLEMENTS_PLIST,
    MAIN_SWIFT,
    PACKAGE_SWIFT,
    build_valkey_vm,
    create_swift_project,
    get_build_dir,
    get_project_root,
    run_valkey_vm_launcher,
    sign_with_entitlements,
)


class TestConstants:
    """Tests for module constants."""

    def test_package_swift_is_valid(self) -> None:
        """Should have valid Package.swift content."""
        assert "swift-tools-version: 5.9" in PACKAGE_SWIFT
        assert "ValkeyVM" in PACKAGE_SWIFT
        assert ".macOS(.v14)" in PACKAGE_SWIFT

    def test_main_swift_has_vm_class(self) -> None:
        """Should have ValkeyVM class in main.swift."""
        assert "class ValkeyVM" in MAIN_SWIFT
        assert "VZVirtualMachineDelegate" in MAIN_SWIFT
        assert "func start()" in MAIN_SWIFT
        assert "func stop()" in MAIN_SWIFT

    def test_entitlements_has_virtualization(self) -> None:
        """Should have virtualization entitlement."""
        assert "com.apple.security.virtualization" in ENTITLEMENTS_PLIST
        assert "<true/>" in ENTITLEMENTS_PLIST


class TestGetProjectRoot:
    """Tests for get_project_root function."""

    def test_returns_path(self) -> None:
        """Should return a Path object."""
        result = get_project_root()
        assert isinstance(result, Path)

    def test_returns_parent_of_scripts(self) -> None:
        """Should return parent of scripts directory."""
        result = get_project_root()
        # Should be two levels up from scripts/vz/
        assert result.name != "vz"
        assert result.name != "scripts"


class TestGetBuildDir:
    """Tests for get_build_dir function."""

    def test_returns_path(self) -> None:
        """Should return a Path object."""
        result = get_build_dir()
        assert isinstance(result, Path)

    def test_ends_with_build_vz(self) -> None:
        """Should end with .build/vz."""
        result = get_build_dir()
        assert result.name == "vz"
        assert result.parent.name == ".build"


class TestCreateSwiftProject:
    """Tests for create_swift_project function."""

    def test_creates_build_directory(self, tmp_path: Path) -> None:
        """Should create the build directory."""
        build_dir = tmp_path / "build"
        result = create_swift_project(build_dir)

        assert result is True
        assert build_dir.exists()

    def test_creates_package_swift(self, tmp_path: Path) -> None:
        """Should create Package.swift file."""
        build_dir = tmp_path / "build"
        create_swift_project(build_dir)

        package_file = build_dir / "Package.swift"
        assert package_file.exists()
        assert "ValkeyVM" in package_file.read_text()

    def test_creates_sources_directory(self, tmp_path: Path) -> None:
        """Should create Sources directory."""
        build_dir = tmp_path / "build"
        create_swift_project(build_dir)

        sources_dir = build_dir / "Sources"
        assert sources_dir.is_dir()

    def test_creates_main_swift(self, tmp_path: Path) -> None:
        """Should create main.swift file."""
        build_dir = tmp_path / "build"
        create_swift_project(build_dir)

        main_file = build_dir / "Sources" / "main.swift"
        assert main_file.exists()
        assert "ValkeyVM" in main_file.read_text()


class TestBuildValkeyVm:
    """Tests for build_valkey_vm function."""

    @patch("valkey_vm_launcher.subprocess.run")
    def test_returns_true_on_success(self, mock_run: MagicMock, tmp_path: Path) -> None:
        """Should return True on successful build."""
        mock_run.return_value = MagicMock(returncode=0, stdout="", stderr="")

        # Create the expected binary location
        binary_dir = tmp_path / ".build" / "release"
        binary_dir.mkdir(parents=True)
        (binary_dir / "ValkeyVM").touch()

        result = build_valkey_vm(tmp_path)
        assert result is True

    @patch("valkey_vm_launcher.subprocess.run")
    def test_returns_false_when_binary_missing(
        self, mock_run: MagicMock, tmp_path: Path
    ) -> None:
        """Should return False when binary is not created."""
        mock_run.return_value = MagicMock(returncode=0, stdout="", stderr="")
        # Don't create the binary

        result = build_valkey_vm(tmp_path)
        assert result is False

    @patch("valkey_vm_launcher.subprocess.run")
    def test_handles_timeout(self, mock_run: MagicMock, tmp_path: Path) -> None:
        """Should return False on timeout."""
        import subprocess

        mock_run.side_effect = subprocess.TimeoutExpired(cmd="swift", timeout=300)

        result = build_valkey_vm(tmp_path)
        assert result is False

    @patch("valkey_vm_launcher.subprocess.run")
    def test_handles_swift_not_found(
        self, mock_run: MagicMock, tmp_path: Path
    ) -> None:
        """Should return False when swift is not found."""
        mock_run.side_effect = FileNotFoundError()

        result = build_valkey_vm(tmp_path)
        assert result is False


class TestSignWithEntitlements:
    """Tests for sign_with_entitlements function."""

    @patch("valkey_vm_launcher.subprocess.run")
    def test_creates_entitlements_file(
        self, mock_run: MagicMock, tmp_path: Path
    ) -> None:
        """Should create entitlements.plist file."""
        mock_run.return_value = MagicMock(returncode=0)

        # Create binary
        binary_dir = tmp_path / ".build" / "release"
        binary_dir.mkdir(parents=True)
        (binary_dir / "ValkeyVM").touch()

        sign_with_entitlements(tmp_path)

        entitlements_file = tmp_path / "entitlements.plist"
        assert entitlements_file.exists()
        assert "virtualization" in entitlements_file.read_text()

    @patch("valkey_vm_launcher.subprocess.run")
    def test_returns_true_on_success(
        self, mock_run: MagicMock, tmp_path: Path
    ) -> None:
        """Should return True on successful signing."""
        mock_run.return_value = MagicMock(returncode=0)

        # Create binary
        binary_dir = tmp_path / ".build" / "release"
        binary_dir.mkdir(parents=True)
        (binary_dir / "ValkeyVM").touch()

        result = sign_with_entitlements(tmp_path)
        assert result is True

    @patch("valkey_vm_launcher.subprocess.run")
    def test_returns_false_on_failure(
        self, mock_run: MagicMock, tmp_path: Path
    ) -> None:
        """Should return False when signing fails."""
        mock_run.return_value = MagicMock(returncode=1, stderr="signing error")

        # Create binary
        binary_dir = tmp_path / ".build" / "release"
        binary_dir.mkdir(parents=True)
        (binary_dir / "ValkeyVM").touch()

        result = sign_with_entitlements(tmp_path)
        assert result is False


class TestRunValkeyVmLauncher:
    """Tests for run_valkey_vm_launcher function."""

    @patch("valkey_vm_launcher.create_swift_project")
    def test_returns_error_when_project_creation_fails(
        self, mock_create: MagicMock, tmp_path: Path
    ) -> None:
        """Should return 1 when project creation fails."""
        mock_create.return_value = False

        result = run_valkey_vm_launcher(tmp_path)
        assert result == 1

    @patch("valkey_vm_launcher.create_swift_project")
    @patch("valkey_vm_launcher.build_valkey_vm")
    def test_returns_error_when_build_fails(
        self,
        mock_build: MagicMock,
        mock_create: MagicMock,
        tmp_path: Path,
    ) -> None:
        """Should return 1 when build fails."""
        mock_create.return_value = True
        mock_build.return_value = False

        result = run_valkey_vm_launcher(tmp_path)
        assert result == 1

    @patch("valkey_vm_launcher.create_swift_project")
    @patch("valkey_vm_launcher.build_valkey_vm")
    @patch("valkey_vm_launcher.sign_with_entitlements")
    def test_returns_error_when_signing_fails(
        self,
        mock_sign: MagicMock,
        mock_build: MagicMock,
        mock_create: MagicMock,
        tmp_path: Path,
    ) -> None:
        """Should return 1 when signing fails."""
        mock_create.return_value = True
        mock_build.return_value = True
        mock_sign.return_value = False

        result = run_valkey_vm_launcher(tmp_path)
        assert result == 1

    @patch("valkey_vm_launcher.create_swift_project")
    @patch("valkey_vm_launcher.build_valkey_vm")
    @patch("valkey_vm_launcher.sign_with_entitlements")
    @patch("valkey_vm_launcher.launch_valkey_vm")
    def test_launches_vm_on_success(
        self,
        mock_launch: MagicMock,
        mock_sign: MagicMock,
        mock_build: MagicMock,
        mock_create: MagicMock,
        tmp_path: Path,
    ) -> None:
        """Should launch VM when all steps succeed."""
        mock_create.return_value = True
        mock_build.return_value = True
        mock_sign.return_value = True
        mock_launch.return_value = 0

        result = run_valkey_vm_launcher(tmp_path)
        assert result == 0
        mock_launch.assert_called_once()