

"""Tests for install.py."""

from __future__ import annotations
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

import io
import subprocess
from pathlib import Path
from unittest import mock

import pytest

from . import install


class TestParseArgs:
    """Tests for argument parsing."""

    def test_default_args(self):
        args = install.parse_args([])
        assert args.skip_install is False
        assert args.skip_setup is False

    def test_skip_install(self):
        args = install.parse_args(["--skip-install"])
        assert args.skip_install is True
        assert args.skip_setup is False

    def test_skip_setup(self):
        args = install.parse_args(["--skip-setup"])
        assert args.skip_install is False
        assert args.skip_setup is True

    def test_both_flags(self):
        args = install.parse_args(["--skip-install", "--skip-setup"])
        assert args.skip_install is True
        assert args.skip_setup is True


class TestCheckCommand:
    """Tests for check_command function."""

    def test_existing_command(self):
        with mock.patch.object(install, "which", return_value="/usr/bin/python"):
            result = install.check_command("python")
        assert result is True

    def test_missing_command(self):
        with mock.patch.object(install, "which", return_value=None):
            result = install.check_command("nonexistent")
        assert result is False


class TestGetNodeVersion:
    """Tests for get_node_version function."""

    def test_valid_version(self):
        mock_result = mock.Mock()
        mock_result.stdout = "v20.10.0\n"
        with mock.patch.object(install, "run_command", return_value=mock_result):
            version = install.get_node_version()
        assert version == (20, 10, 0)

    def test_version_without_patch(self):
        mock_result = mock.Mock()
        mock_result.stdout = "v18.18\n"
        with mock.patch.object(install, "run_command", return_value=mock_result):
            version = install.get_node_version()
        assert version == (18, 18, 0)

    def test_command_not_found(self):
        with mock.patch.object(
            install, "run_command", side_effect=FileNotFoundError
        ):
            version = install.get_node_version()
        assert version is None

    def test_command_failed(self):
        with mock.patch.object(
            install,
            "run_command",
            side_effect=subprocess.CalledProcessError(1, "node"),
        ):
            version = install.get_node_version()
        assert version is None


class TestCheckNodeVersion:
    """Tests for check_node_version function."""

    def test_compatible_version(self):
        with mock.patch.object(install, "get_node_version", return_value=(20, 10, 0)):
            result = install.check_node_version()
        assert result is True

    def test_exact_minimum_version(self):
        with mock.patch.object(install, "get_node_version", return_value=(18, 18, 0)):
            result = install.check_node_version()
        assert result is True

    def test_old_major_version(self):
        with mock.patch.object(install, "get_node_version", return_value=(16, 0, 0)):
            result = install.check_node_version()
        assert result is False

    def test_old_minor_version(self):
        with mock.patch.object(install, "get_node_version", return_value=(18, 17, 0)):
            result = install.check_node_version()
        assert result is False

    def test_no_version(self):
        with mock.patch.object(install, "get_node_version", return_value=None):
            result = install.check_node_version()
        assert result is False


class TestEnsureEnvFiles:
    """Tests for ensure_env_files function."""

    def test_env_local_exists(self, tmp_path: Path):
        env_local = tmp_path / ".env.local"
        env_local.write_text("FOO=bar")

        install.ensure_env_files(tmp_path)

        assert env_local.exists()
        assert env_local.read_text() == "FOO=bar"

    def test_create_from_template(self, tmp_path: Path):
        template = tmp_path / "env.development.example"
        template.write_text("EXAMPLE=value")

        install.ensure_env_files(tmp_path)

        env_local = tmp_path / ".env.local"
        assert env_local.exists()
        assert env_local.read_text() == "EXAMPLE=value"

    def test_no_template(self, tmp_path: Path):
        # Should not raise, just warn
        install.ensure_env_files(tmp_path)

        env_local = tmp_path / ".env.local"
        assert not env_local.exists()


class TestCheckPrismaSchema:
    """Tests for check_prisma_schema function."""

    def test_schema_exists(self, tmp_path: Path):
        prisma_dir = tmp_path / "prisma"
        prisma_dir.mkdir()
        schema = prisma_dir / "schema.prisma"
        schema.write_text("// prisma schema")

        # Should not raise
        install.check_prisma_schema(tmp_path)

    def test_schema_missing(self, tmp_path: Path):
        # Should not raise, just warn
        install.check_prisma_schema(tmp_path)


class TestRunNpmInstall:
    """Tests for run_npm_install function."""

    def test_success(self, tmp_path: Path):
        with mock.patch.object(install, "run_command") as mock_run:
            result = install.run_npm_install(tmp_path)

        assert result is True
        mock_run.assert_called_once_with(
            ["npm", "install"], cwd=tmp_path, check=True
        )

    def test_failure(self, tmp_path: Path):
        with mock.patch.object(
            install,
            "run_command",
            side_effect=subprocess.CalledProcessError(1, "npm"),
        ):
            result = install.run_npm_install(tmp_path)

        assert result is False


class TestRunNpmSetup:
    """Tests for run_npm_setup function."""

    def test_success(self, tmp_path: Path):
        with mock.patch.object(install, "run_command"):
            result = install.run_npm_setup(tmp_path)

        assert result is True

    def test_failure(self, tmp_path: Path):
        with mock.patch.object(
            install,
            "run_command",
            side_effect=subprocess.CalledProcessError(1, "npm"),
        ):
            result = install.run_npm_setup(tmp_path)

        assert result is False


class TestRunHealthChecks:
    """Tests for run_health_checks function."""

    def test_success(self, tmp_path: Path):
        with mock.patch.object(install, "run_command"):
            result = install.run_health_checks(tmp_path)

        assert result is True

    def test_failure(self, tmp_path: Path):
        with mock.patch.object(
            install,
            "run_command",
            side_effect=subprocess.CalledProcessError(1, "npm"),
        ):
            result = install.run_health_checks(tmp_path)

        assert result is False


class TestConfirmRootExecution:
    """Tests for confirm_root_execution function."""

    def test_user_confirms(self):
        with mock.patch("builtins.input", return_value="y"):
            result = install.confirm_root_execution()
        assert result is True

    def test_user_confirms_yes(self):
        with mock.patch("builtins.input", return_value="yes"):
            result = install.confirm_root_execution()
        assert result is True

    def test_user_declines(self):
        with mock.patch("builtins.input", return_value="n"):
            result = install.confirm_root_execution()
        assert result is False

    def test_user_empty_input(self):
        with mock.patch("builtins.input", return_value=""):
            result = install.confirm_root_execution()
        assert result is False

    def test_eof_error(self):
        with mock.patch("builtins.input", side_effect=EOFError):
            result = install.confirm_root_execution()
        assert result is False


class TestMain:
    """Tests for main function."""

    def test_missing_node(self, tmp_path: Path):
        with (
            mock.patch.object(install, "is_root_user", return_value=False),
            mock.patch.object(install, "get_project_root", return_value=tmp_path),
            mock.patch.object(install, "which", return_value=None),
        ):
            result = install.main([])

        assert result == 1

    def test_skip_flags_respected(self, tmp_path: Path):
        with (
            mock.patch.object(install, "is_root_user", return_value=False),
            mock.patch.object(install, "get_project_root", return_value=tmp_path),
            mock.patch.object(install, "which", return_value="/usr/bin/cmd"),
            mock.patch.object(install, "get_node_version", return_value=(20, 0, 0)),
            mock.patch.object(install, "run_npm_install") as mock_install,
            mock.patch.object(install, "run_npm_setup") as mock_setup,
            mock.patch.object(install, "run_health_checks"),
        ):
            result = install.main(["--skip-install", "--skip-setup"])

        assert result == 0
        mock_install.assert_not_called()
        mock_setup.assert_not_called()

    def test_root_user_declined(self):
        with (
            mock.patch.object(install, "is_root_user", return_value=True),
            mock.patch.object(install, "confirm_root_execution", return_value=False),
        ):
            result = install.main([])

        assert result == 1