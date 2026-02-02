#!/usr/bin/env python3


"""Unit tests for scripts/cloud/gcp/start_workspace.py."""

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

# Import from specific path to avoid conflicts with aws/start_workspace.py
_spec = importlib.util.spec_from_file_location(
    "gcp_start_workspace",
    Path("scripts/cloud/gcp/start_workspace.py")
)
_module = importlib.util.module_from_spec(_spec)
sys.modules["gcp_start_workspace"] = _module
_spec.loader.exec_module(_module)

GCPConfig = _module.GCPConfig
create_disk = _module.create_disk
create_instance = _module.create_instance
disk_exists = _module.disk_exists
get_current_project = _module.get_current_project
get_default_service_account = _module.get_default_service_account
instance_exists = _module.instance_exists
main = _module.main
start_instance = _module.start_instance
start_workspace = _module.start_workspace


class TestGCPConfig:
    """Tests for GCPConfig dataclass."""

    def test_default_values(self) -> None:
        """Test default configuration values."""
        config = GCPConfig()
        assert config.project is None
        assert config.zone == "us-central1-a"
        assert config.instance_name == "codeserver-dev"
        assert config.disk_name == "codeserver-dev-pd"
        assert config.disk_size_gb == 50
        assert config.machine_type == "e2-small"
        assert config.password == "changeme"

    def test_disk_name_derived_from_instance(self) -> None:
        """Test disk_name is derived from instance_name."""
        config = GCPConfig(instance_name="myvm")
        assert config.disk_name == "myvm-pd"

    def test_disk_name_explicit(self) -> None:
        """Test explicit disk_name overrides derived value."""
        config = GCPConfig(instance_name="myvm", disk_name="explicit-disk")
        assert config.disk_name == "explicit-disk"

    def test_from_env_defaults(self) -> None:
        """Test from_env with no environment variables."""
        with patch.dict("os.environ", {}, clear=True):
            config = GCPConfig.from_env()
            assert config.project is None
            assert config.zone == "us-central1-a"
            assert config.instance_name == "codeserver-dev"

    def test_from_env_custom_values(self) -> None:
        """Test from_env with custom environment variables."""
        env = {
            "PROJECT": "my-project",
            "ZONE": "us-west1-b",
            "INSTANCE_NAME": "custom-instance",
            "DISK_NAME": "custom-disk",
            "DISK_SIZE_GB": "100",
            "MACHINE_TYPE": "e2-medium",
            "IMAGE_FAMILY": "debian-11",
            "IMAGE_PROJECT": "custom-cloud",
            "CONTAINER_IMAGE": "myregistry/myimage:latest",
            "NETWORK_TAGS": "web,api",
            "IAP_SSH": "true",
            "PASSWORD": "secret",
        }
        with patch.dict("os.environ", env, clear=True):
            config = GCPConfig.from_env()
            assert config.project == "my-project"
            assert config.zone == "us-west1-b"
            assert config.instance_name == "custom-instance"
            assert config.disk_name == "custom-disk"
            assert config.disk_size_gb == 100
            assert config.machine_type == "e2-medium"
            assert config.iap_ssh is True
            assert config.password == "secret"


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


class TestDiskExists:
    """Tests for disk_exists function."""

    @patch("subprocess.run")
    def test_disk_exists(self, mock_run: MagicMock) -> None:
        """Test when disk exists."""
        mock_run.return_value = MagicMock(returncode=0, stdout="codeserver-dev-pd\n")
        config = GCPConfig(project="my-project")

        result = disk_exists(config)

        assert result is True

    @patch("subprocess.run")
    def test_disk_not_exists(self, mock_run: MagicMock) -> None:
        """Test when disk does not exist."""
        mock_run.return_value = MagicMock(returncode=0, stdout="")
        config = GCPConfig(project="my-project")

        result = disk_exists(config)

        assert result is False

    @patch("subprocess.run")
    def test_timeout(self, mock_run: MagicMock) -> None:
        """Test timeout handling."""
        mock_run.side_effect = subprocess.TimeoutExpired(cmd=[], timeout=30)
        config = GCPConfig(project="my-project")

        result = disk_exists(config)

        assert result is False


class TestCreateDisk:
    """Tests for create_disk function."""

    @patch("subprocess.run")
    def test_success(self, mock_run: MagicMock) -> None:
        """Test successful disk creation."""
        mock_run.return_value = MagicMock(returncode=0)
        config = GCPConfig(project="my-project")

        result = create_disk(config)

        assert result is True

    @patch("subprocess.run")
    def test_failure(self, mock_run: MagicMock) -> None:
        """Test failed disk creation."""
        mock_run.return_value = MagicMock(returncode=1)
        config = GCPConfig(project="my-project")

        result = create_disk(config)

        assert result is False

    @patch("subprocess.run")
    def test_timeout(self, mock_run: MagicMock) -> None:
        """Test timeout handling."""
        mock_run.side_effect = subprocess.TimeoutExpired(cmd=[], timeout=120)
        config = GCPConfig(project="my-project")

        result = create_disk(config)

        assert result is False


class TestInstanceExists:
    """Tests for instance_exists function."""

    @patch("subprocess.run")
    def test_instance_exists(self, mock_run: MagicMock) -> None:
        """Test when instance exists."""
        mock_run.return_value = MagicMock(returncode=0, stdout="codeserver-dev\n")
        config = GCPConfig(project="my-project")

        result = instance_exists(config)

        assert result is True

    @patch("subprocess.run")
    def test_instance_not_exists(self, mock_run: MagicMock) -> None:
        """Test when instance does not exist."""
        mock_run.return_value = MagicMock(returncode=0, stdout="")
        config = GCPConfig(project="my-project")

        result = instance_exists(config)

        assert result is False

    @patch("subprocess.run")
    def test_timeout(self, mock_run: MagicMock) -> None:
        """Test timeout handling."""
        mock_run.side_effect = subprocess.TimeoutExpired(cmd=[], timeout=30)
        config = GCPConfig(project="my-project")

        result = instance_exists(config)

        assert result is False


class TestGetDefaultServiceAccount:
    """Tests for get_default_service_account function."""

    @patch("subprocess.run")
    def test_success(self, mock_run: MagicMock) -> None:
        """Test successful service account retrieval."""
        mock_run.return_value = MagicMock(
            returncode=0, stdout="123456789-compute@developer.gserviceaccount.com\n"
        )

        result = get_default_service_account("my-project")

        assert result == "123456789-compute@developer.gserviceaccount.com"

    @patch("subprocess.run")
    def test_not_found(self, mock_run: MagicMock) -> None:
        """Test when service account is not found."""
        mock_run.return_value = MagicMock(returncode=0, stdout="")

        result = get_default_service_account("my-project")

        assert result is None

    @patch("subprocess.run")
    def test_timeout(self, mock_run: MagicMock) -> None:
        """Test timeout handling."""
        mock_run.side_effect = subprocess.TimeoutExpired(cmd=[], timeout=30)

        result = get_default_service_account("my-project")

        assert result is None


class TestCreateInstance:
    """Tests for create_instance function."""

    @patch("gcp_start_workspace.get_default_service_account")
    @patch("subprocess.run")
    def test_success(self, mock_run: MagicMock, mock_sa: MagicMock) -> None:
        """Test successful instance creation."""
        mock_sa.return_value = "sa@project.iam.gserviceaccount.com"
        mock_run.return_value = MagicMock(returncode=0)
        config = GCPConfig(project="my-project")

        result = create_instance(config)

        assert result is True

    @patch("gcp_start_workspace.get_default_service_account")
    @patch("subprocess.run")
    def test_no_service_account(self, mock_run: MagicMock, mock_sa: MagicMock) -> None:
        """Test creation with missing service account."""
        mock_sa.return_value = None
        mock_run.return_value = MagicMock(returncode=0)
        config = GCPConfig(project="my-project")

        result = create_instance(config)

        assert result is True

    @patch("gcp_start_workspace.get_default_service_account")
    @patch("subprocess.run")
    def test_failure(self, mock_run: MagicMock, mock_sa: MagicMock) -> None:
        """Test failed instance creation."""
        mock_sa.return_value = "sa@project.iam.gserviceaccount.com"
        mock_run.return_value = MagicMock(returncode=1)
        config = GCPConfig(project="my-project")

        result = create_instance(config)

        assert result is False

    @patch("gcp_start_workspace.get_default_service_account")
    @patch("subprocess.run")
    def test_timeout(self, mock_run: MagicMock, mock_sa: MagicMock) -> None:
        """Test timeout handling."""
        mock_sa.return_value = "sa@project.iam.gserviceaccount.com"
        mock_run.side_effect = subprocess.TimeoutExpired(cmd=[], timeout=300)
        config = GCPConfig(project="my-project")

        result = create_instance(config)

        assert result is False


class TestStartInstance:
    """Tests for start_instance function."""

    @patch("subprocess.run")
    def test_success(self, mock_run: MagicMock) -> None:
        """Test successful instance start."""
        mock_run.return_value = MagicMock(returncode=0)
        config = GCPConfig(project="my-project")

        result = start_instance(config)

        assert result is True

    @patch("subprocess.run")
    def test_failure(self, mock_run: MagicMock) -> None:
        """Test failed instance start."""
        mock_run.return_value = MagicMock(returncode=1)
        config = GCPConfig(project="my-project")

        result = start_instance(config)

        assert result is False

    @patch("subprocess.run")
    def test_timeout(self, mock_run: MagicMock) -> None:
        """Test timeout handling."""
        mock_run.side_effect = subprocess.TimeoutExpired(cmd=[], timeout=120)
        config = GCPConfig(project="my-project")

        result = start_instance(config)

        assert result is False


class TestStartWorkspace:
    """Tests for start_workspace function."""

    @patch("shutil.which")
    def test_no_gcloud_cli(self, mock_which: MagicMock) -> None:
        """Test when gcloud CLI is not installed."""
        mock_which.return_value = None

        result = start_workspace()

        assert result == 1

    @patch("shutil.which")
    @patch("gcp_start_workspace.get_current_project")
    def test_no_project(self, mock_project: MagicMock, mock_which: MagicMock) -> None:
        """Test when no project is configured."""
        mock_which.return_value = "/usr/bin/gcloud"
        mock_project.return_value = None

        result = start_workspace()

        assert result == 1

    @patch("shutil.which")
    @patch("gcp_start_workspace.get_current_project")
    @patch("gcp_start_workspace.disk_exists")
    @patch("gcp_start_workspace.create_disk")
    def test_disk_creation_failure(
        self,
        mock_create_disk: MagicMock,
        mock_disk_exists: MagicMock,
        mock_project: MagicMock,
        mock_which: MagicMock,
    ) -> None:
        """Test when disk creation fails."""
        mock_which.return_value = "/usr/bin/gcloud"
        mock_project.return_value = "my-project"
        mock_disk_exists.return_value = False
        mock_create_disk.return_value = False

        result = start_workspace()

        assert result == 1

    @patch("shutil.which")
    @patch("gcp_start_workspace.get_current_project")
    @patch("gcp_start_workspace.disk_exists")
    @patch("gcp_start_workspace.instance_exists")
    @patch("gcp_start_workspace.create_instance")
    def test_instance_creation_failure(
        self,
        mock_create_instance: MagicMock,
        mock_instance_exists: MagicMock,
        mock_disk_exists: MagicMock,
        mock_project: MagicMock,
        mock_which: MagicMock,
    ) -> None:
        """Test when instance creation fails."""
        mock_which.return_value = "/usr/bin/gcloud"
        mock_project.return_value = "my-project"
        mock_disk_exists.return_value = True
        mock_instance_exists.return_value = False
        mock_create_instance.return_value = False

        result = start_workspace()

        assert result == 1

    @patch("shutil.which")
    @patch("gcp_start_workspace.get_current_project")
    @patch("gcp_start_workspace.disk_exists")
    @patch("gcp_start_workspace.instance_exists")
    @patch("gcp_start_workspace.create_instance")
    def test_success_create_new(
        self,
        mock_create_instance: MagicMock,
        mock_instance_exists: MagicMock,
        mock_disk_exists: MagicMock,
        mock_project: MagicMock,
        mock_which: MagicMock,
    ) -> None:
        """Test successful creation of new instance."""
        mock_which.return_value = "/usr/bin/gcloud"
        mock_project.return_value = "my-project"
        mock_disk_exists.return_value = True
        mock_instance_exists.return_value = False
        mock_create_instance.return_value = True

        result = start_workspace()

        assert result == 0

    @patch("shutil.which")
    @patch("gcp_start_workspace.get_current_project")
    @patch("gcp_start_workspace.disk_exists")
    @patch("gcp_start_workspace.instance_exists")
    @patch("gcp_start_workspace.start_instance")
    def test_success_start_existing(
        self,
        mock_start_instance: MagicMock,
        mock_instance_exists: MagicMock,
        mock_disk_exists: MagicMock,
        mock_project: MagicMock,
        mock_which: MagicMock,
    ) -> None:
        """Test successful start of existing instance."""
        mock_which.return_value = "/usr/bin/gcloud"
        mock_project.return_value = "my-project"
        mock_disk_exists.return_value = True
        mock_instance_exists.return_value = True
        mock_start_instance.return_value = True

        result = start_workspace()

        assert result == 0

    def test_with_custom_config(self) -> None:
        """Test with custom configuration."""
        config = GCPConfig(project="custom-project", zone="us-west1-a")

        with patch("shutil.which", return_value=None):
            result = start_workspace(config)

        assert result == 1


class TestMain:
    """Tests for main function."""

    @patch("gcp_start_workspace.start_workspace")
    def test_main(self, mock_start: MagicMock) -> None:
        """Test main function."""
        mock_start.return_value = 0

        result = main()

        assert result == 0
        mock_start.assert_called_once()