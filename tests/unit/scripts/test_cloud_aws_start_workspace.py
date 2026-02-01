#!/usr/bin/env python3


"""Unit tests for scripts/cloud/aws/start_workspace.py."""

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
from start_workspace import (
    AWSConfig,
    build_run_instances_args,
    find_existing_instance,
    get_profile_args,
    launch_new_instance,
    main,
    start_existing_instance,
    start_workspace,
    wait_for_instance_running,
)


class TestAWSConfig:
    """Tests for AWSConfig dataclass."""

    def test_default_values(self) -> None:
        """Test default configuration values."""
        config = AWSConfig()
        assert config.region == "us-east-1"
        assert config.profile is None
        assert config.instance_name == "codeserver-dev"
        assert config.launch_template == "codeserver-template"
        assert config.volume_id is None
        assert config.instance_type == "t4g.small"
        assert config.ami_id is None
        assert config.iam_instance_profile == "EC2CodeServer"

    def test_from_env_defaults(self) -> None:
        """Test from_env with no environment variables."""
        with patch.dict("os.environ", {}, clear=True):
            config = AWSConfig.from_env()
            assert config.region == "us-east-1"
            assert config.instance_name == "codeserver-dev"

    def test_from_env_custom_values(self) -> None:
        """Test from_env with custom environment variables."""
        env = {
            "AWS_REGION": "us-west-2",
            "AWS_PROFILE": "myprofile",
            "INSTANCE_NAME": "custom-instance",
            "LAUNCH_TEMPLATE": "custom-template",
            "VOLUME_ID": "vol-12345",
            "INSTANCE_TYPE": "t4g.medium",
            "AMI_ID": "ami-12345",
            "SECURITY_GROUP_IDS": "sg-123 sg-456",
            "SUBNET_ID": "subnet-123",
            "KEY_NAME": "my-key",
            "SPOT_PRICE": "0.05",
            "IAM_INSTANCE_PROFILE": "CustomProfile",
        }
        with patch.dict("os.environ", env, clear=True):
            config = AWSConfig.from_env()
            assert config.region == "us-west-2"
            assert config.profile == "myprofile"
            assert config.instance_name == "custom-instance"
            assert config.volume_id == "vol-12345"
            assert config.instance_type == "t4g.medium"
            assert config.ami_id == "ami-12345"
            assert config.security_group_ids == "sg-123 sg-456"
            assert config.subnet_id == "subnet-123"
            assert config.key_name == "my-key"
            assert config.spot_price == "0.05"


class TestGetProfileArgs:
    """Tests for get_profile_args function."""

    def test_no_profile(self) -> None:
        """Test with no profile set."""
        config = AWSConfig(profile=None)
        assert get_profile_args(config) == []

    def test_with_profile(self) -> None:
        """Test with profile set."""
        config = AWSConfig(profile="myprofile")
        assert get_profile_args(config) == ["--profile", "myprofile"]


class TestFindExistingInstance:
    """Tests for find_existing_instance function."""

    @patch("subprocess.run")
    def test_instance_found(self, mock_run: MagicMock) -> None:
        """Test finding an existing instance."""
        mock_run.return_value = MagicMock(returncode=0, stdout="i-12345abc\n")
        config = AWSConfig()

        result = find_existing_instance(config)

        assert result == "i-12345abc"
        mock_run.assert_called_once()

    @patch("subprocess.run")
    def test_multiple_instances_returns_first(self, mock_run: MagicMock) -> None:
        """Test with multiple instances, returns first."""
        mock_run.return_value = MagicMock(returncode=0, stdout="i-first i-second\n")
        config = AWSConfig()

        result = find_existing_instance(config)

        assert result == "i-first"

    @patch("subprocess.run")
    def test_no_instance_found(self, mock_run: MagicMock) -> None:
        """Test when no instance is found."""
        mock_run.return_value = MagicMock(returncode=0, stdout="")
        config = AWSConfig()

        result = find_existing_instance(config)

        assert result is None

    @patch("subprocess.run")
    def test_command_failure(self, mock_run: MagicMock) -> None:
        """Test when command fails."""
        mock_run.return_value = MagicMock(returncode=1, stdout="")
        config = AWSConfig()

        result = find_existing_instance(config)

        assert result is None

    @patch("subprocess.run")
    def test_timeout(self, mock_run: MagicMock) -> None:
        """Test timeout handling."""
        mock_run.side_effect = subprocess.TimeoutExpired(cmd=[], timeout=30)
        config = AWSConfig()

        result = find_existing_instance(config)

        assert result is None

    @patch("subprocess.run")
    def test_with_profile(self, mock_run: MagicMock) -> None:
        """Test that profile is included in command."""
        mock_run.return_value = MagicMock(returncode=0, stdout="i-12345\n")
        config = AWSConfig(profile="testprofile")

        find_existing_instance(config)

        call_args = mock_run.call_args[0][0]
        assert "--profile" in call_args
        assert "testprofile" in call_args


class TestStartExistingInstance:
    """Tests for start_existing_instance function."""

    @patch("subprocess.run")
    def test_success(self, mock_run: MagicMock) -> None:
        """Test successful instance start."""
        mock_run.return_value = MagicMock(returncode=0)
        config = AWSConfig()

        result = start_existing_instance(config, "i-12345")

        assert result is True

    @patch("subprocess.run")
    def test_failure(self, mock_run: MagicMock) -> None:
        """Test failed instance start."""
        mock_run.return_value = MagicMock(returncode=1)
        config = AWSConfig()

        result = start_existing_instance(config, "i-12345")

        assert result is False

    @patch("subprocess.run")
    def test_timeout(self, mock_run: MagicMock) -> None:
        """Test timeout handling."""
        mock_run.side_effect = subprocess.TimeoutExpired(cmd=[], timeout=60)
        config = AWSConfig()

        result = start_existing_instance(config, "i-12345")

        assert result is False


class TestBuildRunInstancesArgs:
    """Tests for build_run_instances_args function."""

    def test_minimal_args(self) -> None:
        """Test with minimal configuration."""
        config = AWSConfig(ami_id="ami-12345")

        args = build_run_instances_args(config)

        assert "aws" in args
        assert "ec2" in args
        assert "run-instances" in args
        assert "--region" in args
        assert "--instance-type" in args
        assert "--image-id" in args
        assert "ami-12345" in args

    def test_with_all_options(self) -> None:
        """Test with all optional parameters."""
        config = AWSConfig(
            ami_id="ami-12345",
            security_group_ids="sg-123 sg-456",
            subnet_id="subnet-123",
            key_name="my-key",
            volume_id="vol-123",
            spot_price="0.05",
        )

        args = build_run_instances_args(config)

        assert "--security-group-ids" in args
        assert "--subnet-id" in args
        assert "--key-name" in args
        assert "--block-device-mappings" in args
        assert "--instance-market-options" in args

    def test_with_profile(self) -> None:
        """Test that profile is included."""
        config = AWSConfig(ami_id="ami-12345", profile="myprofile")

        args = build_run_instances_args(config)

        assert "--profile" in args
        assert "myprofile" in args


class TestLaunchNewInstance:
    """Tests for launch_new_instance function."""

    @patch("subprocess.run")
    def test_success(self, mock_run: MagicMock) -> None:
        """Test successful instance launch."""
        mock_run.return_value = MagicMock(returncode=0, stdout="i-newinstance\n", stderr="")
        config = AWSConfig(ami_id="ami-12345")

        result = launch_new_instance(config)

        assert result == "i-newinstance"

    @patch("subprocess.run")
    def test_no_ami_id(self, mock_run: MagicMock) -> None:
        """Test when AMI_ID is not provided."""
        config = AWSConfig(ami_id=None)

        result = launch_new_instance(config)

        assert result is None
        mock_run.assert_not_called()

    @patch("subprocess.run")
    def test_command_failure(self, mock_run: MagicMock) -> None:
        """Test when command fails."""
        mock_run.return_value = MagicMock(returncode=1, stdout="", stderr="error")
        config = AWSConfig(ami_id="ami-12345")

        result = launch_new_instance(config)

        assert result is None

    @patch("subprocess.run")
    def test_timeout(self, mock_run: MagicMock) -> None:
        """Test timeout handling."""
        mock_run.side_effect = subprocess.TimeoutExpired(cmd=[], timeout=120)
        config = AWSConfig(ami_id="ami-12345")

        result = launch_new_instance(config)

        assert result is None


class TestWaitForInstanceRunning:
    """Tests for wait_for_instance_running function."""

    @patch("subprocess.run")
    def test_success(self, mock_run: MagicMock) -> None:
        """Test successful wait."""
        mock_run.return_value = MagicMock(returncode=0)
        config = AWSConfig()

        result = wait_for_instance_running(config, "i-12345")

        assert result is True

    @patch("subprocess.run")
    def test_failure(self, mock_run: MagicMock) -> None:
        """Test when wait fails."""
        mock_run.return_value = MagicMock(returncode=1)
        config = AWSConfig()

        result = wait_for_instance_running(config, "i-12345")

        assert result is False

    @patch("subprocess.run")
    def test_timeout(self, mock_run: MagicMock) -> None:
        """Test timeout handling."""
        mock_run.side_effect = subprocess.TimeoutExpired(cmd=[], timeout=300)
        config = AWSConfig()

        result = wait_for_instance_running(config, "i-12345")

        assert result is False


class TestStartWorkspace:
    """Tests for start_workspace function."""

    @patch("shutil.which")
    def test_no_aws_cli(self, mock_which: MagicMock) -> None:
        """Test when aws CLI is not installed."""
        mock_which.return_value = None

        result = start_workspace()

        assert result == 1

    @patch("shutil.which")
    @patch("start_workspace.find_existing_instance")
    @patch("start_workspace.start_existing_instance")
    def test_start_existing_instance_success(
        self, mock_start: MagicMock, mock_find: MagicMock, mock_which: MagicMock
    ) -> None:
        """Test starting an existing instance."""
        mock_which.return_value = "/usr/bin/aws"
        mock_find.return_value = "i-existing"
        mock_start.return_value = True

        result = start_workspace()

        assert result == 0
        mock_start.assert_called_once()

    @patch("shutil.which")
    @patch("start_workspace.find_existing_instance")
    @patch("start_workspace.start_existing_instance")
    def test_start_existing_instance_failure(
        self, mock_start: MagicMock, mock_find: MagicMock, mock_which: MagicMock
    ) -> None:
        """Test when starting existing instance fails."""
        mock_which.return_value = "/usr/bin/aws"
        mock_find.return_value = "i-existing"
        mock_start.return_value = False

        result = start_workspace()

        assert result == 1

    @patch("shutil.which")
    @patch("start_workspace.find_existing_instance")
    @patch("start_workspace.launch_new_instance")
    @patch("start_workspace.wait_for_instance_running")
    def test_launch_new_instance_success(
        self,
        mock_wait: MagicMock,
        mock_launch: MagicMock,
        mock_find: MagicMock,
        mock_which: MagicMock,
    ) -> None:
        """Test launching a new instance."""
        mock_which.return_value = "/usr/bin/aws"
        mock_find.return_value = None
        mock_launch.return_value = "i-new"
        mock_wait.return_value = True

        result = start_workspace()

        assert result == 0
        mock_launch.assert_called_once()
        mock_wait.assert_called_once()

    @patch("shutil.which")
    @patch("start_workspace.find_existing_instance")
    @patch("start_workspace.launch_new_instance")
    def test_launch_new_instance_failure(
        self, mock_launch: MagicMock, mock_find: MagicMock, mock_which: MagicMock
    ) -> None:
        """Test when launching new instance fails."""
        mock_which.return_value = "/usr/bin/aws"
        mock_find.return_value = None
        mock_launch.return_value = None

        result = start_workspace()

        assert result == 1

    @patch("shutil.which")
    @patch("start_workspace.find_existing_instance")
    @patch("start_workspace.launch_new_instance")
    @patch("start_workspace.wait_for_instance_running")
    def test_wait_for_running_failure(
        self,
        mock_wait: MagicMock,
        mock_launch: MagicMock,
        mock_find: MagicMock,
        mock_which: MagicMock,
    ) -> None:
        """Test when wait for running fails."""
        mock_which.return_value = "/usr/bin/aws"
        mock_find.return_value = None
        mock_launch.return_value = "i-new"
        mock_wait.return_value = False

        result = start_workspace()

        assert result == 1

    def test_with_custom_config(self) -> None:
        """Test with custom configuration."""
        config = AWSConfig(region="us-west-2", instance_name="custom")

        with patch("shutil.which", return_value=None):
            result = start_workspace(config)

        assert result == 1


class TestMain:
    """Tests for main function."""

    @patch("start_workspace.start_workspace")
    def test_main(self, mock_start: MagicMock) -> None:
        """Test main function."""
        mock_start.return_value = 0

        result = main()

        assert result == 0
        mock_start.assert_called_once()