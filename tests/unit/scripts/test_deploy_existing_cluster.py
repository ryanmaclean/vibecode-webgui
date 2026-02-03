"""Tests for scripts/deploy_existing_cluster.py"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "scripts"))

from deploy_existing_cluster import (
    CLUSTER_CONTEXT,
    DEPLOYMENT_MANIFEST,
    NAMESPACE,
    check_cluster_connectivity,
    create_namespace,
    deploy_application,
    get_project_root,
    print_error,
    print_header,
    print_status,
    print_success,
    print_warning,
    run_command,
    run_deployment,
    set_cluster_context,
    wait_for_deployment,
)


class TestPrintFunctions:
    """Tests for print helper functions."""

    def test_print_header(self, capsys: pytest.CaptureFixture) -> None:
        """Should print header with decoration."""
        print_header("Test Header")
        captured = capsys.readouterr()
        assert "Test Header" in captured.out
        assert "=" in captured.out

    def test_print_status(self, capsys: pytest.CaptureFixture) -> None:
        """Should print status message."""
        print_status("Status message")
        captured = capsys.readouterr()
        assert "INFO" in captured.out
        assert "Status message" in captured.out

    def test_print_success(self, capsys: pytest.CaptureFixture) -> None:
        """Should print success message."""
        print_success("Success message")
        captured = capsys.readouterr()
        assert "SUCCESS" in captured.out
        assert "Success message" in captured.out

    def test_print_warning(self, capsys: pytest.CaptureFixture) -> None:
        """Should print warning message."""
        print_warning("Warning message")
        captured = capsys.readouterr()
        assert "WARNING" in captured.out
        assert "Warning message" in captured.out

    def test_print_error(self, capsys: pytest.CaptureFixture) -> None:
        """Should print error message."""
        print_error("Error message")
        captured = capsys.readouterr()
        assert "ERROR" in captured.out
        assert "Error message" in captured.out


class TestRunCommand:
    """Tests for run_command function."""

    @patch("deploy_existing_cluster.subprocess.run")
    def test_returns_result_on_success(self, mock_run: MagicMock) -> None:
        """Should return subprocess result on success."""
        mock_run.return_value = MagicMock(returncode=0, stdout="output", stderr="")
        result = run_command(["echo", "test"])
        assert result.returncode == 0
        assert result.stdout == "output"

    @patch("deploy_existing_cluster.subprocess.run")
    def test_handles_timeout(self, mock_run: MagicMock) -> None:
        """Should handle timeout gracefully."""
        mock_run.side_effect = subprocess.TimeoutExpired(cmd="test", timeout=30)
        result = run_command(["sleep", "100"], timeout=1)
        assert result.returncode == 1
        assert "Timeout" in result.stderr

    @patch("deploy_existing_cluster.subprocess.run")
    def test_handles_subprocess_error(self, mock_run: MagicMock) -> None:
        """Should handle subprocess errors gracefully."""
        mock_run.side_effect = subprocess.SubprocessError("error")
        result = run_command(["bad", "command"])
        assert result.returncode == 1


class TestCheckClusterConnectivity:
    """Tests for check_cluster_connectivity function."""

    @patch("deploy_existing_cluster.run_command")
    def test_returns_true_when_connected(self, mock_run: MagicMock) -> None:
        """Should return True when cluster is accessible."""
        mock_run.return_value = MagicMock(returncode=0)
        assert check_cluster_connectivity() is True

    @patch("deploy_existing_cluster.run_command")
    def test_returns_false_when_not_connected(
        self, mock_run: MagicMock, capsys: pytest.CaptureFixture
    ) -> None:
        """Should return False when cluster is not accessible."""
        mock_run.return_value = MagicMock(returncode=1)
        assert check_cluster_connectivity() is False
        captured = capsys.readouterr()
        assert "Cannot connect" in captured.out


class TestSetClusterContext:
    """Tests for set_cluster_context function."""

    @patch("deploy_existing_cluster.run_command")
    def test_returns_true_on_success(self, mock_run: MagicMock) -> None:
        """Should return True when context is set."""
        mock_run.return_value = MagicMock(returncode=0)
        assert set_cluster_context() is True

    @patch("deploy_existing_cluster.run_command")
    def test_returns_false_on_failure(self, mock_run: MagicMock) -> None:
        """Should return False when context fails to set."""
        mock_run.return_value = MagicMock(returncode=1)
        assert set_cluster_context() is False


class TestCreateNamespace:
    """Tests for create_namespace function."""

    @patch("deploy_existing_cluster.subprocess.run")
    @patch("deploy_existing_cluster.run_command")
    def test_creates_namespace(
        self, mock_run_cmd: MagicMock, mock_run: MagicMock
    ) -> None:
        """Should create namespace successfully."""
        mock_run_cmd.return_value = MagicMock(
            returncode=0, stdout="apiVersion: v1\nkind: Namespace"
        )
        mock_run.return_value = MagicMock(returncode=0)
        assert create_namespace("test-ns") is True


class TestDeployApplication:
    """Tests for deploy_application function."""

    @patch("deploy_existing_cluster.subprocess.run")
    def test_deploys_successfully(self, mock_run: MagicMock) -> None:
        """Should deploy application successfully."""
        mock_run.return_value = MagicMock(returncode=0)
        assert deploy_application("test-ns") is True

    @patch("deploy_existing_cluster.subprocess.run")
    def test_fails_on_error(self, mock_run: MagicMock) -> None:
        """Should return False on deployment error."""
        mock_run.return_value = MagicMock(returncode=1)
        assert deploy_application("test-ns") is False


class TestWaitForDeployment:
    """Tests for wait_for_deployment function."""

    @patch("deploy_existing_cluster.run_command")
    def test_returns_true_when_ready(self, mock_run: MagicMock) -> None:
        """Should return True when deployment is ready."""
        mock_run.return_value = MagicMock(returncode=0)
        assert wait_for_deployment("test-ns") is True

    @patch("deploy_existing_cluster.run_command")
    def test_returns_false_on_timeout(
        self, mock_run: MagicMock, capsys: pytest.CaptureFixture
    ) -> None:
        """Should return False and warn on timeout."""
        mock_run.return_value = MagicMock(returncode=1)
        assert wait_for_deployment("test-ns") is False
        captured = capsys.readouterr()
        assert "still be starting" in captured.out


class TestGetProjectRoot:
    """Tests for get_project_root function."""

    def test_returns_path(self) -> None:
        """Should return a Path object."""
        result = get_project_root()
        assert isinstance(result, Path)

    def test_returns_parent_of_scripts(self) -> None:
        """Should return parent of scripts directory."""
        result = get_project_root()
        assert (result / "scripts").exists()


class TestRunDeployment:
    """Tests for run_deployment function."""

    @patch("deploy_existing_cluster.check_cluster_connectivity")
    def test_fails_on_no_connectivity(self, mock_check: MagicMock) -> None:
        """Should fail when cluster is not accessible."""
        mock_check.return_value = False
        assert run_deployment() == 1

    @patch("deploy_existing_cluster.check_cluster_connectivity")
    @patch("deploy_existing_cluster.set_cluster_context")
    def test_fails_on_context_error(
        self, mock_context: MagicMock, mock_check: MagicMock
    ) -> None:
        """Should fail when context cannot be set."""
        mock_check.return_value = True
        mock_context.return_value = False
        assert run_deployment() == 1

    @patch("deploy_existing_cluster.check_cluster_connectivity")
    @patch("deploy_existing_cluster.set_cluster_context")
    @patch("deploy_existing_cluster.create_namespace")
    @patch("deploy_existing_cluster.deploy_application")
    @patch("deploy_existing_cluster.wait_for_deployment")
    @patch("deploy_existing_cluster.show_pod_status")
    @patch("deploy_existing_cluster.show_deployment_info")
    def test_succeeds_with_skip_build(
        self,
        mock_info: MagicMock,
        mock_status: MagicMock,
        mock_wait: MagicMock,
        mock_deploy: MagicMock,
        mock_ns: MagicMock,
        mock_context: MagicMock,
        mock_check: MagicMock,
    ) -> None:
        """Should succeed when skipping build."""
        mock_check.return_value = True
        mock_context.return_value = True
        mock_ns.return_value = True
        mock_deploy.return_value = True
        mock_wait.return_value = True

        assert run_deployment(skip_build=True) == 0


class TestConstants:
    """Tests for module constants."""

    def test_namespace_defined(self) -> None:
        """Should have namespace defined."""
        assert NAMESPACE == "vibecode-platform"

    def test_cluster_context_defined(self) -> None:
        """Should have cluster context defined."""
        assert CLUSTER_CONTEXT == "kind-vibecode-kind-local"

    def test_deployment_manifest_valid(self) -> None:
        """Should have valid deployment manifest."""
        assert "Deployment" in DEPLOYMENT_MANIFEST
        assert "Service" in DEPLOYMENT_MANIFEST
        assert "{namespace}" in DEPLOYMENT_MANIFEST
