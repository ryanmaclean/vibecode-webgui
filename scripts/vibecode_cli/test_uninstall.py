


"""Tests for uninstall.py."""

from __future__ import annotations
# Datadog Unified Service Tagging
_dd_service = "test-uninstall"
_dd_env = __import__("os").environ.get("DD_ENV", "development")
_dd_version = __import__("os").environ.get("DD_VERSION", "0.1.0")
try:
    from ddtrace import config as _dd_config, patch_all as _dd_patch, tracer as _dd_tracer
    _dd_config.service = _dd_service
    _dd_config.env = _dd_env
    _dd_config.version = _dd_version
    _dd_tracer.set_tags({"team": "platform", "component": "scripts"})
    _dd_patch()
except ImportError:
    pass

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

from pathlib import Path
from unittest import mock

import pytest

from . import uninstall


class TestParseArgs:
    """Tests for argument parsing."""

    def test_default_args(self):
        args = uninstall.parse_args([])
        assert args.dry_run is False
        assert args.keep_env is False
        assert args.keep_node_modules is False

    def test_dry_run(self):
        args = uninstall.parse_args(["--dry-run"])
        assert args.dry_run is True

    def test_keep_env(self):
        args = uninstall.parse_args(["--keep-env"])
        assert args.keep_env is True

    def test_keep_node_modules(self):
        args = uninstall.parse_args(["--keep-node-modules"])
        assert args.keep_node_modules is True

    def test_all_flags(self):
        args = uninstall.parse_args(["--dry-run", "--keep-env", "--keep-node-modules"])
        assert args.dry_run is True
        assert args.keep_env is True
        assert args.keep_node_modules is True


class TestLogRm:
    """Tests for log_rm function."""

    def test_remove_file(self, tmp_path: Path):
        test_file = tmp_path / "test.txt"
        test_file.write_text("content")

        result = uninstall.log_rm(test_file, dry_run=False)

        assert result is True
        assert not test_file.exists()

    def test_remove_directory(self, tmp_path: Path):
        test_dir = tmp_path / "test_dir"
        test_dir.mkdir()
        (test_dir / "file.txt").write_text("content")

        result = uninstall.log_rm(test_dir, dry_run=False)

        assert result is True
        assert not test_dir.exists()

    def test_remove_nested_directory(self, tmp_path: Path):
        test_dir = tmp_path / "test_dir"
        nested_dir = test_dir / "nested"
        nested_dir.mkdir(parents=True)
        (nested_dir / "file.txt").write_text("content")

        result = uninstall.log_rm(test_dir, dry_run=False)

        assert result is True
        assert not test_dir.exists()

    def test_nonexistent_path(self, tmp_path: Path):
        nonexistent = tmp_path / "nonexistent"

        result = uninstall.log_rm(nonexistent, dry_run=False)

        assert result is False

    def test_dry_run_file_exists(self, tmp_path: Path):
        test_file = tmp_path / "test.txt"
        test_file.write_text("content")

        result = uninstall.log_rm(test_file, dry_run=True)

        assert result is True
        assert test_file.exists()  # File should still exist

    def test_dry_run_file_not_exists(self, tmp_path: Path):
        nonexistent = tmp_path / "nonexistent"

        result = uninstall.log_rm(nonexistent, dry_run=True)

        assert result is False


class TestMain:
    """Tests for main function."""

    def test_root_user_aborts(self):
        with mock.patch.object(uninstall, "is_root_user", return_value=True):
            result = uninstall.main([])

        assert result == 1

    def test_removes_build_artifacts(self, tmp_path: Path):
        # Create some build artifacts
        (tmp_path / ".next").mkdir()
        (tmp_path / "dist").mkdir()
        (tmp_path / ".turbo").mkdir()

        with (
            mock.patch.object(uninstall, "is_root_user", return_value=False),
            mock.patch.object(uninstall, "get_project_root", return_value=tmp_path),
        ):
            result = uninstall.main([])

        assert result == 0
        assert not (tmp_path / ".next").exists()
        assert not (tmp_path / "dist").exists()
        assert not (tmp_path / ".turbo").exists()

    def test_removes_node_modules_by_default(self, tmp_path: Path):
        node_modules = tmp_path / "node_modules"
        node_modules.mkdir()

        with (
            mock.patch.object(uninstall, "is_root_user", return_value=False),
            mock.patch.object(uninstall, "get_project_root", return_value=tmp_path),
        ):
            result = uninstall.main([])

        assert result == 0
        assert not node_modules.exists()

    def test_keeps_node_modules_with_flag(self, tmp_path: Path):
        node_modules = tmp_path / "node_modules"
        node_modules.mkdir()

        with (
            mock.patch.object(uninstall, "is_root_user", return_value=False),
            mock.patch.object(uninstall, "get_project_root", return_value=tmp_path),
        ):
            result = uninstall.main(["--keep-node-modules"])

        assert result == 0
        assert node_modules.exists()

    def test_removes_env_files_by_default(self, tmp_path: Path):
        env_local = tmp_path / ".env.local"
        env_dev = tmp_path / ".env.development"
        env_test = tmp_path / ".env.test"
        env_local.write_text("LOCAL=1")
        env_dev.write_text("DEV=1")
        env_test.write_text("TEST=1")

        with (
            mock.patch.object(uninstall, "is_root_user", return_value=False),
            mock.patch.object(uninstall, "get_project_root", return_value=tmp_path),
        ):
            result = uninstall.main([])

        assert result == 0
        assert not env_local.exists()
        assert not env_dev.exists()
        assert not env_test.exists()

    def test_keeps_env_files_with_flag(self, tmp_path: Path):
        env_local = tmp_path / ".env.local"
        env_local.write_text("LOCAL=1")

        with (
            mock.patch.object(uninstall, "is_root_user", return_value=False),
            mock.patch.object(uninstall, "get_project_root", return_value=tmp_path),
        ):
            result = uninstall.main(["--keep-env"])

        assert result == 0
        assert env_local.exists()

    def test_dry_run_preserves_all(self, tmp_path: Path):
        # Create various artifacts
        (tmp_path / ".next").mkdir()
        (tmp_path / "node_modules").mkdir()
        env_local = tmp_path / ".env.local"
        env_local.write_text("LOCAL=1")

        with (
            mock.patch.object(uninstall, "is_root_user", return_value=False),
            mock.patch.object(uninstall, "get_project_root", return_value=tmp_path),
        ):
            result = uninstall.main(["--dry-run"])

        assert result == 0
        # All should still exist
        assert (tmp_path / ".next").exists()
        assert (tmp_path / "node_modules").exists()
        assert env_local.exists()