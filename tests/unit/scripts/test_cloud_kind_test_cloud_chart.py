#!/usr/bin/env python3

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

"""Unit tests for scripts/cloud/kind/test_cloud_chart.py."""

from __future__ import annotations

import subprocess
import sys
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, "scripts/cloud/kind")
from test_cloud_chart import (
    KindTestConfig,
    check_prerequisites,
    cluster_exists,
    create_cluster,
    deploy_helm_chart,
    main,
    set_kubectl_context,
    test_cloud_chart,
    wait_for_rollout,
)


class TestKindTestConfig:
    """Tests for KindTestConfig dataclass."""

    def test_default_values(self) -> None:
        """Test default configuration values."""
        config = KindTestConfig()
        assert config.cluster_name == "codeserver-cloud"
        assert config.helm_release == "codeserver"
        assert config.chart_path == "helm/code-server-cloud"
        assert config.password == "kindtest"
        assert config.rollout_timeout == "180s"

    def test_from_env_defaults(self) -> None:
        """Test from_env with no environment variables."""
        with patch.dict("os.environ", {}, clear=True):
            config = KindTestConfig.from_env()
            assert config.cluster_name == "codeserver-cloud"
            assert config.helm_release == "codeserver"
            assert config.chart_path == "helm/code-server-cloud"

    def test_from_env_custom_values(self) -> None:
        """Test from_env with custom environment variables."""
        env = {
            "CLUSTER_NAME": "custom-cluster",
            "HELM_RELEASE": "custom-release",
            "CHART_PATH": "custom/chart/path",
        }
        with patch.dict("os.environ", env, clear=True):
            config = KindTestConfig.from_env()
            assert config.cluster_name == "custom-cluster"
            assert config.helm_release == "custom-release"
            assert config.chart_path == "custom/chart/path"


class TestCheckPrerequisites:
    """Tests for check_prerequisites function."""

    @patch("shutil.which")
    def test_all_tools_present(self, mock_which: MagicMock) -> None:
        """Test when all tools are present."""
        mock_which.return_value = "/usr/bin/tool"

        result = check_prerequisites()

        assert result is True
        assert mock_which.call_count == 3

    @patch("shutil.which")
    def test_kind_missing(self, mock_which: MagicMock) -> None:
        """Test when kind is missing."""
        mock_which.side_effect = lambda tool: None if tool == "kind" else "/usr/bin/tool"

        result = check_prerequisites()

        assert result is False

    @patch("shutil.which")
    def test_kubectl_missing(self, mock_which: MagicMock) -> None:
        """Test when kubectl is missing."""
        mock_which.side_effect = lambda tool: None if tool == "kubectl" else "/usr/bin/tool"

        result = check_prerequisites()

        assert result is False

    @patch("shutil.which")
    def test_helm_missing(self, mock_which: MagicMock) -> None:
        """Test when helm is missing."""
        mock_which.side_effect = lambda tool: None if tool == "helm" else "/usr/bin/tool"

        result = check_prerequisites()

        assert result is False


class TestClusterExists:
    """Tests for cluster_exists function."""

    @patch("subprocess.run")
    def test_cluster_exists(self, mock_run: MagicMock) -> None:
        """Test when cluster exists."""
        mock_run.return_value = MagicMock(returncode=0, stdout="codeserver-cloud\nother-cluster\n")

        result = cluster_exists("codeserver-cloud")

        assert result is True

    @patch("subprocess.run")
    def test_cluster_not_exists(self, mock_run: MagicMock) -> None:
        """Test when cluster does not exist."""
        mock_run.return_value = MagicMock(returncode=0, stdout="other-cluster\n")

        result = cluster_exists("codeserver-cloud")

        assert result is False

    @patch("subprocess.run")
    def test_no_clusters(self, mock_run: MagicMock) -> None:
        """Test when no clusters exist."""
        mock_run.return_value = MagicMock(returncode=0, stdout="")

        result = cluster_exists("codeserver-cloud")

        assert result is False

    @patch("subprocess.run")
    def test_command_failure(self, mock_run: MagicMock) -> None:
        """Test command failure."""
        mock_run.return_value = MagicMock(returncode=1, stdout="")

        result = cluster_exists("codeserver-cloud")

        assert result is False

    @patch("subprocess.run")
    def test_timeout(self, mock_run: MagicMock) -> None:
        """Test timeout handling."""
        mock_run.side_effect = subprocess.TimeoutExpired(cmd=[], timeout=30)

        result = cluster_exists("codeserver-cloud")

        assert result is False


class TestCreateCluster:
    """Tests for create_cluster function."""

    @patch("subprocess.run")
    def test_success(self, mock_run: MagicMock) -> None:
        """Test successful cluster creation."""
        mock_run.return_value = MagicMock(returncode=0)

        result = create_cluster("test-cluster")

        assert result is True
        call_args = mock_run.call_args[0][0]
        assert "kind" in call_args
        assert "create" in call_args
        assert "cluster" in call_args
        assert "--name" in call_args
        assert "test-cluster" in call_args

    @patch("subprocess.run")
    def test_failure(self, mock_run: MagicMock) -> None:
        """Test failed cluster creation."""
        mock_run.return_value = MagicMock(returncode=1)

        result = create_cluster("test-cluster")

        assert result is False

    @patch("subprocess.run")
    def test_timeout(self, mock_run: MagicMock) -> None:
        """Test timeout handling."""
        mock_run.side_effect = subprocess.TimeoutExpired(cmd=[], timeout=300)

        result = create_cluster("test-cluster")

        assert result is False


class TestSetKubectlContext:
    """Tests for set_kubectl_context function."""

    @patch("subprocess.run")
    def test_success(self, mock_run: MagicMock) -> None:
        """Test successful context switch."""
        mock_run.return_value = MagicMock(returncode=0)

        result = set_kubectl_context("test-cluster")

        assert result is True
        call_args = mock_run.call_args[0][0]
        assert "kubectl" in call_args
        assert "config" in call_args
        assert "use-context" in call_args
        assert "kind-test-cluster" in call_args

    @patch("subprocess.run")
    def test_failure(self, mock_run: MagicMock) -> None:
        """Test failed context switch."""
        mock_run.return_value = MagicMock(returncode=1)

        result = set_kubectl_context("test-cluster")

        assert result is False

    @patch("subprocess.run")
    def test_timeout(self, mock_run: MagicMock) -> None:
        """Test timeout handling."""
        mock_run.side_effect = subprocess.TimeoutExpired(cmd=[], timeout=10)

        result = set_kubectl_context("test-cluster")

        assert result is False


class TestDeployHelmChart:
    """Tests for deploy_helm_chart function."""

    @patch("subprocess.run")
    def test_success(self, mock_run: MagicMock) -> None:
        """Test successful Helm deployment."""
        mock_run.return_value = MagicMock(returncode=0)
        config = KindTestConfig()

        result = deploy_helm_chart(config)

        assert result is True
        call_args = mock_run.call_args[0][0]
        assert "helm" in call_args
        assert "upgrade" in call_args
        assert "--install" in call_args
        assert config.helm_release in call_args
        assert config.chart_path in call_args

    @patch("subprocess.run")
    def test_failure(self, mock_run: MagicMock) -> None:
        """Test failed Helm deployment."""
        mock_run.return_value = MagicMock(returncode=1)
        config = KindTestConfig()

        result = deploy_helm_chart(config)

        assert result is False

    @patch("subprocess.run")
    def test_timeout(self, mock_run: MagicMock) -> None:
        """Test timeout handling."""
        mock_run.side_effect = subprocess.TimeoutExpired(cmd=[], timeout=120)
        config = KindTestConfig()

        result = deploy_helm_chart(config)

        assert result is False


class TestWaitForRollout:
    """Tests for wait_for_rollout function."""

    @patch("subprocess.run")
    def test_success(self, mock_run: MagicMock) -> None:
        """Test successful rollout wait."""
        mock_run.return_value = MagicMock(returncode=0)
        config = KindTestConfig()

        result = wait_for_rollout(config)

        assert result is True
        call_args = mock_run.call_args[0][0]
        assert "kubectl" in call_args
        assert "rollout" in call_args
        assert "status" in call_args
        assert f"deployment/{config.helm_release}" in call_args

    @patch("subprocess.run")
    def test_failure(self, mock_run: MagicMock) -> None:
        """Test failed rollout wait."""
        mock_run.return_value = MagicMock(returncode=1)
        config = KindTestConfig()

        result = wait_for_rollout(config)

        assert result is False

    @patch("subprocess.run")
    def test_timeout(self, mock_run: MagicMock) -> None:
        """Test timeout handling."""
        mock_run.side_effect = subprocess.TimeoutExpired(cmd=[], timeout=200)
        config = KindTestConfig()

        result = wait_for_rollout(config)

        assert result is False


class TestTestCloudChart:
    """Tests for test_cloud_chart function."""

    @patch("test_cloud_chart.check_prerequisites")
    def test_prerequisites_fail(self, mock_prereq: MagicMock) -> None:
        """Test when prerequisites check fails."""
        mock_prereq.return_value = False

        result = test_cloud_chart()

        assert result == 1

    @patch("test_cloud_chart.check_prerequisites")
    @patch("test_cloud_chart.cluster_exists")
    @patch("test_cloud_chart.create_cluster")
    def test_cluster_creation_failure(
        self, mock_create: MagicMock, mock_exists: MagicMock, mock_prereq: MagicMock
    ) -> None:
        """Test when cluster creation fails."""
        mock_prereq.return_value = True
        mock_exists.return_value = False
        mock_create.return_value = False

        result = test_cloud_chart()

        assert result == 1

    @patch("test_cloud_chart.check_prerequisites")
    @patch("test_cloud_chart.cluster_exists")
    @patch("test_cloud_chart.set_kubectl_context")
    def test_context_switch_failure(
        self, mock_context: MagicMock, mock_exists: MagicMock, mock_prereq: MagicMock
    ) -> None:
        """Test when kubectl context switch fails."""
        mock_prereq.return_value = True
        mock_exists.return_value = True
        mock_context.return_value = False

        result = test_cloud_chart()

        assert result == 1

    @patch("test_cloud_chart.check_prerequisites")
    @patch("test_cloud_chart.cluster_exists")
    @patch("test_cloud_chart.set_kubectl_context")
    @patch("test_cloud_chart.deploy_helm_chart")
    def test_helm_deployment_failure(
        self,
        mock_deploy: MagicMock,
        mock_context: MagicMock,
        mock_exists: MagicMock,
        mock_prereq: MagicMock,
    ) -> None:
        """Test when Helm deployment fails."""
        mock_prereq.return_value = True
        mock_exists.return_value = True
        mock_context.return_value = True
        mock_deploy.return_value = False

        result = test_cloud_chart()

        assert result == 1

    @patch("test_cloud_chart.check_prerequisites")
    @patch("test_cloud_chart.cluster_exists")
    @patch("test_cloud_chart.set_kubectl_context")
    @patch("test_cloud_chart.deploy_helm_chart")
    @patch("test_cloud_chart.wait_for_rollout")
    def test_rollout_failure(
        self,
        mock_rollout: MagicMock,
        mock_deploy: MagicMock,
        mock_context: MagicMock,
        mock_exists: MagicMock,
        mock_prereq: MagicMock,
    ) -> None:
        """Test when rollout fails."""
        mock_prereq.return_value = True
        mock_exists.return_value = True
        mock_context.return_value = True
        mock_deploy.return_value = True
        mock_rollout.return_value = False

        result = test_cloud_chart()

        assert result == 1

    @patch("test_cloud_chart.check_prerequisites")
    @patch("test_cloud_chart.cluster_exists")
    @patch("test_cloud_chart.set_kubectl_context")
    @patch("test_cloud_chart.deploy_helm_chart")
    @patch("test_cloud_chart.wait_for_rollout")
    def test_success_existing_cluster(
        self,
        mock_rollout: MagicMock,
        mock_deploy: MagicMock,
        mock_context: MagicMock,
        mock_exists: MagicMock,
        mock_prereq: MagicMock,
    ) -> None:
        """Test successful run with existing cluster."""
        mock_prereq.return_value = True
        mock_exists.return_value = True
        mock_context.return_value = True
        mock_deploy.return_value = True
        mock_rollout.return_value = True

        result = test_cloud_chart()

        assert result == 0

    @patch("test_cloud_chart.check_prerequisites")
    @patch("test_cloud_chart.cluster_exists")
    @patch("test_cloud_chart.create_cluster")
    @patch("test_cloud_chart.set_kubectl_context")
    @patch("test_cloud_chart.deploy_helm_chart")
    @patch("test_cloud_chart.wait_for_rollout")
    def test_success_new_cluster(
        self,
        mock_rollout: MagicMock,
        mock_deploy: MagicMock,
        mock_context: MagicMock,
        mock_create: MagicMock,
        mock_exists: MagicMock,
        mock_prereq: MagicMock,
    ) -> None:
        """Test successful run with new cluster creation."""
        mock_prereq.return_value = True
        mock_exists.return_value = False
        mock_create.return_value = True
        mock_context.return_value = True
        mock_deploy.return_value = True
        mock_rollout.return_value = True

        result = test_cloud_chart()

        assert result == 0
        mock_create.assert_called_once()

    def test_with_custom_config(self) -> None:
        """Test with custom configuration."""
        config = KindTestConfig(cluster_name="custom", helm_release="custom-release")

        with patch("test_cloud_chart.check_prerequisites", return_value=False):
            result = test_cloud_chart(config)

        assert result == 1


class TestMain:
    """Tests for main function."""

    @patch("test_cloud_chart.test_cloud_chart")
    def test_main(self, mock_test: MagicMock) -> None:
        """Test main function."""
        mock_test.return_value = 0

        result = main()

        assert result == 0
        mock_test.assert_called_once()