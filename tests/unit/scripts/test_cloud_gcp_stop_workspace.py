#!/usr/bin/env python3


"""Unit tests for scripts/cloud/gcp/stop_workspace.py."""

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

import importlib.util
import subprocess
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Import from specific path to avoid conflicts with aws/stop_workspace.py
_spec = importlib.util.spec_from_file_location(
    "gcp_stop_workspace",
    Path("scripts/cloud/gcp/stop_workspace.py")
)
_module = importlib.util.module_from_spec(_spec)
sys.modules["gcp_stop_workspace"] = _module
_spec.loader.exec_module(_module)

GCPStopConfig = _module.GCPStopConfig
delete_instance = _module.delete_instance
get_current_project = _module.get_current_project
main = _module.main
stop_instance = _module.stop_instance
stop_workspace = _module.stop_workspace


class TestGCPStopConfig:
    """Tests for GCPStopConfig dataclass."""

    def test_default_values(self) -> None:
        """Test default configuration values."""
        config = GCPStopConfig()
        assert config.project is None
        assert config.zone == "us-central1-a"
        assert config.instance_name == "codeserver-dev"
        assert config.delete_instance is False

    def test_from_env_defaults(self) -> None:
        """Test from_env with no environment variables."""
        with patch.dict("os.environ", {}, clear=True):
            config = GCPStopConfig.from_env()
            assert config.project is None
            assert config.zone == "us-central1-a"
            assert config.instance_name == "codeserver-dev"
            assert config.delete_instance is False

    def test_from_env_custom_values(self) -> None:
        """Test from_env with custom environment variables."""
        env = {
            "PROJECT": "my-project",
            "ZONE": "us-west1-b",
            "INSTANCE_NAME": "custom-instance",
            "DELETE_INSTANCE": "true",
        }
        with patch.dict("os.environ", env, clear=True):
            config = GCPStopConfig.from_env()
            assert config.project == "my-project"
            assert config.zone == "us-west1-b"
            assert config.instance_name == "custom-instance"
            assert config.delete_instance is True

    def test_delete_instance_false_variants(self) -> None:
        """Test various false values for DELETE_INSTANCE."""
        for value in ["false", "False", "FALSE", "no", "0", ""]:
            with patch.dict("os.environ", {"DELETE_INSTANCE": value}, clear=True):
                config = GCPStopConfig.from_env()
                assert config.delete_instance is False


class TestGetCurrentProject:
    """Tests for get_current_project function."""

    @patch("subprocess.run")
    def test_success(self, mock_run: MagicMock) -> None:
        """Test successful project retrieval."""
        mock_run.return_value = MagicMock(returncode=0, stdout="my-project\n")

        result = get_current_project()

        assert result == "my-project"

    @patch("subprocess.run")
    def test_empty_output(self, mock_run: MagicMock) -> None:
        """Test empty output."""
        mock_run.return_value = MagicMock(returncode=0, stdout="")

        result = get_current_project()

        assert result is None

    @patch("subprocess.run")
    def test_command_failure(self, mock_run: MagicMock) -> None:
        """Test command failure."""
        mock_run.return_value = MagicMock(returncode=1, stdout="")

        result = get_current_project()

        assert result is None

    @patch("subprocess.run")
    def test_timeout(self, mock_run: MagicMock) -> None:
        """Test timeout handling."""
        mock_run.side_effect = subprocess.TimeoutExpired(cmd=[], timeout=10)

        result = get_current_project()

        assert result is None


class TestStopInstance:
    """Tests for stop_instance function."""

    @patch("subprocess.run")
    def test_success(self, mock_run: MagicMock) -> None:
        """Test successful instance stop."""
        mock_run.return_value = MagicMock(returncode=0)
        config = GCPStopConfig(project="my-project")

        result = stop_instance(config)

        assert result is True

    @patch("subprocess.run")
    def test_returns_true_even_on_failure(self, mock_run: MagicMock) -> None:
        """Test that stop returns True even if instance not found."""
        mock_run.return_value = MagicMock(returncode=1)
        config = GCPStopConfig(project="my-project")

        result = stop_instance(config)

        # Note: The implementation returns True regardless of returncode
        # This is intentional - see the comment in stop_workspace.py:71-72
        assert result is True

    @patch("subprocess.run")
    def test_timeout(self, mock_run: MagicMock) -> None:
        """Test timeout handling."""
        mock_run.side_effect = subprocess.TimeoutExpired(cmd=[], timeout=120)
        config = GCPStopConfig(project="my-project")

        result = stop_instance(config)

        assert result is False


class TestDeleteInstance:
    """Tests for delete_instance function."""

    @patch("subprocess.run")
    def test_success(self, mock_run: MagicMock) -> None:
        """Test successful instance deletion."""
        mock_run.return_value = MagicMock(returncode=0)
        config = GCPStopConfig(project="my-project")

        result = delete_instance(config)

        assert result is True
        call_args = mock_run.call_args[0][0]
        assert "delete" in call_args
        assert "--keep-disks" in call_args
        assert "data" in call_args
        assert "--quiet" in call_args

    @patch("subprocess.run")
    def test_failure(self, mock_run: MagicMock) -> None:
        """Test failed instance deletion."""
        mock_run.return_value = MagicMock(returncode=1)
        config = GCPStopConfig(project="my-project")

        result = delete_instance(config)

        assert result is False

    @patch("subprocess.run")
    def test_timeout(self, mock_run: MagicMock) -> None:
        """Test timeout handling."""
        mock_run.side_effect = subprocess.TimeoutExpired(cmd=[], timeout=120)
        config = GCPStopConfig(project="my-project")

        result = delete_instance(config)

        assert result is False


class TestStopWorkspace:
    """Tests for stop_workspace function."""

    @patch("shutil.which")
    def test_no_gcloud_cli(self, mock_which: MagicMock) -> None:
        """Test when gcloud CLI is not installed."""
        mock_which.return_value = None

        result = stop_workspace()

        assert result == 1

    @patch("shutil.which")
    @patch("gcp_stop_workspace.get_current_project")
    def test_no_project(self, mock_project: MagicMock, mock_which: MagicMock) -> None:
        """Test when no project is configured."""
        mock_which.return_value = "/usr/bin/gcloud"
        mock_project.return_value = None

        result = stop_workspace()

        assert result == 1

    @patch("shutil.which")
    @patch("gcp_stop_workspace.get_current_project")
    @patch("gcp_stop_workspace.stop_instance")
    def test_stop_success(
        self, mock_stop: MagicMock, mock_project: MagicMock, mock_which: MagicMock
    ) -> None:
        """Test successful instance stop."""
        mock_which.return_value = "/usr/bin/gcloud"
        mock_project.return_value = "my-project"
        mock_stop.return_value = True

        result = stop_workspace()

        assert result == 0

    @patch("shutil.which")
    @patch("gcp_stop_workspace.get_current_project")
    @patch("gcp_stop_workspace.stop_instance")
    def test_stop_failure(
        self, mock_stop: MagicMock, mock_project: MagicMock, mock_which: MagicMock
    ) -> None:
        """Test when instance stop fails."""
        mock_which.return_value = "/usr/bin/gcloud"
        mock_project.return_value = "my-project"
        mock_stop.return_value = False

        result = stop_workspace()

        assert result == 1

    @patch("shutil.which")
    @patch("gcp_stop_workspace.get_current_project")
    @patch("gcp_stop_workspace.stop_instance")
    @patch("gcp_stop_workspace.delete_instance")
    def test_stop_and_delete_success(
        self,
        mock_delete: MagicMock,
        mock_stop: MagicMock,
        mock_project: MagicMock,
        mock_which: MagicMock,
    ) -> None:
        """Test successful stop and delete."""
        mock_which.return_value = "/usr/bin/gcloud"
        mock_project.return_value = "my-project"
        mock_stop.return_value = True
        mock_delete.return_value = True

        config = GCPStopConfig(delete_instance=True)
        result = stop_workspace(config)

        assert result == 0
        mock_delete.assert_called_once()

    @patch("shutil.which")
    @patch("gcp_stop_workspace.get_current_project")
    @patch("gcp_stop_workspace.stop_instance")
    @patch("gcp_stop_workspace.delete_instance")
    def test_delete_failure(
        self,
        mock_delete: MagicMock,
        mock_stop: MagicMock,
        mock_project: MagicMock,
        mock_which: MagicMock,
    ) -> None:
        """Test when delete fails."""
        mock_which.return_value = "/usr/bin/gcloud"
        mock_project.return_value = "my-project"
        mock_stop.return_value = True
        mock_delete.return_value = False

        config = GCPStopConfig(delete_instance=True)
        result = stop_workspace(config)

        assert result == 1

    def test_with_explicit_project(self) -> None:
        """Test with explicit project in config."""
        config = GCPStopConfig(project="explicit-project")

        with patch("shutil.which", return_value="/usr/bin/gcloud"):
            with patch("gcp_stop_workspace.stop_instance", return_value=True):
                result = stop_workspace(config)

        assert result == 0


class TestMain:
    """Tests for main function."""

    @patch("gcp_stop_workspace.stop_workspace")
    def test_main(self, mock_stop: MagicMock) -> None:
        """Test main function."""
        mock_stop.return_value = 0

        result = main()

        assert result == 0
        mock_stop.assert_called_once()