#!/usr/bin/env python3


"""Unit tests for scripts/cloud/aws/stop_workspace.py."""

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

import subprocess
import sys
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, "scripts/cloud/aws")
from stop_workspace import (
    AWSStopConfig,
    find_instance,
    get_profile_args,
    main,
    stop_instance,
    stop_workspace,
    terminate_instance,
)


class TestAWSStopConfig:
    """Tests for AWSStopConfig dataclass."""

    def test_default_values(self) -> None:
        """Test default configuration values."""
        config = AWSStopConfig()
        assert config.region == "us-east-1"
        assert config.profile is None
        assert config.instance_name == "codeserver-dev"
        assert config.terminate is False

    def test_from_env_defaults(self) -> None:
        """Test from_env with no environment variables."""
        with patch.dict("os.environ", {}, clear=True):
            config = AWSStopConfig.from_env()
            assert config.region == "us-east-1"
            assert config.instance_name == "codeserver-dev"
            assert config.terminate is False

    def test_from_env_custom_values(self) -> None:
        """Test from_env with custom environment variables."""
        env = {
            "AWS_REGION": "us-west-2",
            "AWS_PROFILE": "myprofile",
            "INSTANCE_NAME": "custom-instance",
            "TERMINATE": "true",
        }
        with patch.dict("os.environ", env, clear=True):
            config = AWSStopConfig.from_env()
            assert config.region == "us-west-2"
            assert config.profile == "myprofile"
            assert config.instance_name == "custom-instance"
            assert config.terminate is True

    def test_terminate_false_variants(self) -> None:
        """Test various false values for TERMINATE."""
        for value in ["false", "False", "FALSE", "no", "0", ""]:
            with patch.dict("os.environ", {"TERMINATE": value}, clear=True):
                config = AWSStopConfig.from_env()
                assert config.terminate is False


class TestGetProfileArgs:
    """Tests for get_profile_args function."""

    def test_no_profile(self) -> None:
        """Test with no profile set."""
        config = AWSStopConfig(profile=None)
        assert get_profile_args(config) == []

    def test_with_profile(self) -> None:
        """Test with profile set."""
        config = AWSStopConfig(profile="myprofile")
        assert get_profile_args(config) == ["--profile", "myprofile"]


class TestFindInstance:
    """Tests for find_instance function."""

    @patch("subprocess.run")
    def test_instance_found(self, mock_run: MagicMock) -> None:
        """Test finding an instance."""
        mock_run.return_value = MagicMock(returncode=0, stdout="i-12345abc\n")
        config = AWSStopConfig()

        result = find_instance(config)

        assert result == "i-12345abc"
        mock_run.assert_called_once()

    @patch("subprocess.run")
    def test_multiple_instances_returns_first(self, mock_run: MagicMock) -> None:
        """Test with multiple instances, returns first."""
        mock_run.return_value = MagicMock(returncode=0, stdout="i-first i-second\n")
        config = AWSStopConfig()

        result = find_instance(config)

        assert result == "i-first"

    @patch("subprocess.run")
    def test_no_instance_found(self, mock_run: MagicMock) -> None:
        """Test when no instance is found."""
        mock_run.return_value = MagicMock(returncode=0, stdout="")
        config = AWSStopConfig()

        result = find_instance(config)

        assert result is None

    @patch("subprocess.run")
    def test_command_failure(self, mock_run: MagicMock) -> None:
        """Test when command fails."""
        mock_run.return_value = MagicMock(returncode=1, stdout="")
        config = AWSStopConfig()

        result = find_instance(config)

        assert result is None

    @patch("subprocess.run")
    def test_timeout(self, mock_run: MagicMock) -> None:
        """Test timeout handling."""
        mock_run.side_effect = subprocess.TimeoutExpired(cmd=[], timeout=30)
        config = AWSStopConfig()

        result = find_instance(config)

        assert result is None

    @patch("subprocess.run")
    def test_with_profile(self, mock_run: MagicMock) -> None:
        """Test that profile is included in command."""
        mock_run.return_value = MagicMock(returncode=0, stdout="i-12345\n")
        config = AWSStopConfig(profile="testprofile")

        find_instance(config)

        call_args = mock_run.call_args[0][0]
        assert "--profile" in call_args
        assert "testprofile" in call_args


class TestStopInstance:
    """Tests for stop_instance function."""

    @patch("subprocess.run")
    def test_success(self, mock_run: MagicMock) -> None:
        """Test successful instance stop."""
        mock_run.return_value = MagicMock(returncode=0)
        config = AWSStopConfig()

        result = stop_instance(config, "i-12345")

        assert result is True

    @patch("subprocess.run")
    def test_failure(self, mock_run: MagicMock) -> None:
        """Test failed instance stop."""
        mock_run.return_value = MagicMock(returncode=1)
        config = AWSStopConfig()

        result = stop_instance(config, "i-12345")

        assert result is False

    @patch("subprocess.run")
    def test_timeout(self, mock_run: MagicMock) -> None:
        """Test timeout handling."""
        mock_run.side_effect = subprocess.TimeoutExpired(cmd=[], timeout=60)
        config = AWSStopConfig()

        result = stop_instance(config, "i-12345")

        assert result is False

    @patch("subprocess.run")
    def test_with_profile(self, mock_run: MagicMock) -> None:
        """Test that profile is included."""
        mock_run.return_value = MagicMock(returncode=0)
        config = AWSStopConfig(profile="myprofile")

        stop_instance(config, "i-12345")

        call_args = mock_run.call_args[0][0]
        assert "--profile" in call_args
        assert "myprofile" in call_args


class TestTerminateInstance:
    """Tests for terminate_instance function."""

    @patch("subprocess.run")
    def test_success(self, mock_run: MagicMock) -> None:
        """Test successful instance termination."""
        mock_run.return_value = MagicMock(returncode=0)
        config = AWSStopConfig()

        result = terminate_instance(config, "i-12345")

        assert result is True

    @patch("subprocess.run")
    def test_failure(self, mock_run: MagicMock) -> None:
        """Test failed instance termination."""
        mock_run.return_value = MagicMock(returncode=1)
        config = AWSStopConfig()

        result = terminate_instance(config, "i-12345")

        assert result is False

    @patch("subprocess.run")
    def test_timeout(self, mock_run: MagicMock) -> None:
        """Test timeout handling."""
        mock_run.side_effect = subprocess.TimeoutExpired(cmd=[], timeout=60)
        config = AWSStopConfig()

        result = terminate_instance(config, "i-12345")

        assert result is False


class TestStopWorkspace:
    """Tests for stop_workspace function."""

    @patch("shutil.which")
    def test_no_aws_cli(self, mock_which: MagicMock) -> None:
        """Test when aws CLI is not installed."""
        mock_which.return_value = None

        result = stop_workspace()

        assert result == 1

    @patch("shutil.which")
    @patch("stop_workspace.find_instance")
    def test_no_instance_found(self, mock_find: MagicMock, mock_which: MagicMock) -> None:
        """Test when no instance is found."""
        mock_which.return_value = "/usr/bin/aws"
        mock_find.return_value = None

        result = stop_workspace()

        assert result == 0

    @patch("shutil.which")
    @patch("stop_workspace.find_instance")
    @patch("stop_workspace.stop_instance")
    def test_stop_success(
        self, mock_stop: MagicMock, mock_find: MagicMock, mock_which: MagicMock
    ) -> None:
        """Test successful instance stop."""
        mock_which.return_value = "/usr/bin/aws"
        mock_find.return_value = "i-12345"
        mock_stop.return_value = True

        result = stop_workspace()

        assert result == 0
        mock_stop.assert_called_once()

    @patch("shutil.which")
    @patch("stop_workspace.find_instance")
    @patch("stop_workspace.stop_instance")
    def test_stop_failure(
        self, mock_stop: MagicMock, mock_find: MagicMock, mock_which: MagicMock
    ) -> None:
        """Test when instance stop fails."""
        mock_which.return_value = "/usr/bin/aws"
        mock_find.return_value = "i-12345"
        mock_stop.return_value = False

        result = stop_workspace()

        assert result == 1

    @patch("shutil.which")
    @patch("stop_workspace.find_instance")
    @patch("stop_workspace.stop_instance")
    @patch("stop_workspace.terminate_instance")
    def test_stop_and_terminate_success(
        self,
        mock_terminate: MagicMock,
        mock_stop: MagicMock,
        mock_find: MagicMock,
        mock_which: MagicMock,
    ) -> None:
        """Test successful stop and terminate."""
        mock_which.return_value = "/usr/bin/aws"
        mock_find.return_value = "i-12345"
        mock_stop.return_value = True
        mock_terminate.return_value = True

        config = AWSStopConfig(terminate=True)
        result = stop_workspace(config)

        assert result == 0
        mock_terminate.assert_called_once()

    @patch("shutil.which")
    @patch("stop_workspace.find_instance")
    @patch("stop_workspace.stop_instance")
    @patch("stop_workspace.terminate_instance")
    def test_terminate_failure(
        self,
        mock_terminate: MagicMock,
        mock_stop: MagicMock,
        mock_find: MagicMock,
        mock_which: MagicMock,
    ) -> None:
        """Test when terminate fails."""
        mock_which.return_value = "/usr/bin/aws"
        mock_find.return_value = "i-12345"
        mock_stop.return_value = True
        mock_terminate.return_value = False

        config = AWSStopConfig(terminate=True)
        result = stop_workspace(config)

        assert result == 1

    def test_with_custom_config(self) -> None:
        """Test with custom configuration."""
        config = AWSStopConfig(region="us-west-2", instance_name="custom")

        with patch("shutil.which", return_value=None):
            result = stop_workspace(config)

        assert result == 1


class TestMain:
    """Tests for main function."""

    @patch("stop_workspace.stop_workspace")
    def test_main(self, mock_stop: MagicMock) -> None:
        """Test main function."""
        mock_stop.return_value = 0

        result = main()

        assert result == 0
        mock_stop.assert_called_once()