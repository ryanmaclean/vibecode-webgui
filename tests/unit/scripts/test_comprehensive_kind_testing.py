"""Tests for scripts/comprehensive_kind_testing.py"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch, mock_open

import pytest

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "scripts"))

from comprehensive_kind_testing import (
    CONTAINER_IMAGES,
    PORTS_TO_CHECK,
    KindTester,
    TestResult,
    TestSummary,
    run_comprehensive_testing,
)


class TestTestResult:
    """Tests for TestResult dataclass."""

    def test_creates_result(self) -> None:
        """Should create a test result."""
        result = TestResult(status="PASS", message="Test passed")
        assert result.status == "PASS"
        assert result.message == "Test passed"


class TestTestSummary:
    """Tests for TestSummary dataclass."""

    def test_initial_values(self) -> None:
        """Should have zero initial values."""
        summary = TestSummary()
        assert summary.passed == 0
        assert summary.failed == 0
        assert summary.warnings == 0

    def test_add_pass_result(self) -> None:
        """Should increment passed count."""
        summary = TestSummary()
        summary.add_result(TestResult("PASS", "test"))
        assert summary.passed == 1
        assert summary.failed == 0

    def test_add_fail_result(self) -> None:
        """Should increment failed count."""
        summary = TestSummary()
        summary.add_result(TestResult("FAIL", "test"))
        assert summary.failed == 1
        assert summary.passed == 0

    def test_add_warn_result(self) -> None:
        """Should increment warnings count."""
        summary = TestSummary()
        summary.add_result(TestResult("WARN", "test"))
        assert summary.warnings == 1

    def test_add_info_result(self) -> None:
        """Should not increment any count for INFO."""
        summary = TestSummary()
        summary.add_result(TestResult("INFO", "test"))
        assert summary.passed == 0
        assert summary.failed == 0
        assert summary.warnings == 0


class TestKindTester:
    """Tests for KindTester class."""

    @pytest.fixture
    def tester(self, tmp_path: Path) -> KindTester:
        """Create a tester instance."""
        return KindTester(results_file=tmp_path / "test-results.log")

    def test_log_test_pass(self, tester: KindTester, capsys: pytest.CaptureFixture) -> None:
        """Should log PASS result."""
        result = tester.log_test("PASS", "Test passed")
        assert result.status == "PASS"
        assert tester.summary.passed == 1
        captured = capsys.readouterr()
        assert "PASS" in captured.out

    def test_log_test_fail(self, tester: KindTester, capsys: pytest.CaptureFixture) -> None:
        """Should log FAIL result."""
        result = tester.log_test("FAIL", "Test failed")
        assert result.status == "FAIL"
        assert tester.summary.failed == 1

    def test_log_test_warn(self, tester: KindTester, capsys: pytest.CaptureFixture) -> None:
        """Should log WARN result."""
        result = tester.log_test("WARN", "Test warning")
        assert result.status == "WARN"
        assert tester.summary.warnings == 1

    @patch("comprehensive_kind_testing.shutil.which")
    def test_check_command_exists_true(self, mock_which: MagicMock, tester: KindTester) -> None:
        """Should return True when command exists."""
        mock_which.return_value = "/usr/bin/docker"
        assert tester._check_command_exists("docker") is True

    @patch("comprehensive_kind_testing.shutil.which")
    def test_check_command_exists_false(self, mock_which: MagicMock, tester: KindTester) -> None:
        """Should return False when command doesn't exist."""
        mock_which.return_value = None
        assert tester._check_command_exists("nonexistent") is False


class TestPrerequisites:
    """Tests for test_prerequisites method."""

    @pytest.fixture
    def tester(self, tmp_path: Path) -> KindTester:
        """Create a tester instance."""
        return KindTester(results_file=tmp_path / "test-results.log")

    @patch("comprehensive_kind_testing.shutil.which")
    @patch("comprehensive_kind_testing.subprocess.run")
    def test_all_prerequisites_installed(
        self, mock_run: MagicMock, mock_which: MagicMock, tester: KindTester
    ) -> None:
        """Should pass when all prerequisites are installed."""
        mock_which.return_value = "/usr/bin/cmd"
        mock_run.return_value = MagicMock(returncode=0, stdout="version 1.0\n", stderr="")

        result = tester.test_prerequisites()

        assert result is True
        assert tester.summary.passed >= 3

    @patch("comprehensive_kind_testing.shutil.which")
    def test_docker_not_installed(self, mock_which: MagicMock, tester: KindTester) -> None:
        """Should fail when Docker is not installed."""
        mock_which.return_value = None

        result = tester.test_prerequisites()

        assert result is False
        assert tester.summary.failed >= 1


class TestDockerDaemon:
    """Tests for test_docker_daemon method."""

    @pytest.fixture
    def tester(self, tmp_path: Path) -> KindTester:
        """Create a tester instance."""
        return KindTester(results_file=tmp_path / "test-results.log")

    @patch("comprehensive_kind_testing.subprocess.run")
    def test_daemon_running(self, mock_run: MagicMock, tester: KindTester) -> None:
        """Should pass when daemon is running."""
        mock_run.return_value = MagicMock(returncode=0, stdout="100MB\n", stderr="")

        result = tester.test_docker_daemon()

        assert result is True
        assert tester.summary.passed >= 1

    @patch("comprehensive_kind_testing.subprocess.run")
    def test_daemon_not_running(self, mock_run: MagicMock, tester: KindTester) -> None:
        """Should fail when daemon is not running."""
        mock_run.return_value = MagicMock(returncode=1, stdout="", stderr="error")

        result = tester.test_docker_daemon()

        assert result is False
        assert tester.summary.failed >= 1


class TestProductionConfig:
    """Tests for test_production_config method."""

    @pytest.fixture
    def tester(self, tmp_path: Path) -> KindTester:
        """Create a tester instance."""
        return KindTester(results_file=tmp_path / "test-results.log")

    @patch("comprehensive_kind_testing.Path.exists")
    def test_config_not_found(self, mock_exists: MagicMock, tester: KindTester) -> None:
        """Should fail when config file not found."""
        mock_exists.return_value = False

        result = tester.test_production_config()

        assert result is False
        assert tester.summary.failed >= 1


class TestSystemResources:
    """Tests for test_system_resources method."""

    @pytest.fixture
    def tester(self, tmp_path: Path) -> KindTester:
        """Create a tester instance."""
        return KindTester(results_file=tmp_path / "test-results.log")

    @patch("comprehensive_kind_testing.platform.system")
    @patch("comprehensive_kind_testing.subprocess.run")
    def test_macos_resources(
        self, mock_run: MagicMock, mock_system: MagicMock, tester: KindTester
    ) -> None:
        """Should check resources on macOS."""
        mock_system.return_value = "Darwin"
        mock_run.return_value = MagicMock(
            returncode=0,
            stdout="17179869184\n",  # 16GB
            stderr="",
        )

        result = tester.test_system_resources()

        assert result is True

    @patch("comprehensive_kind_testing.platform.system")
    @patch("comprehensive_kind_testing.subprocess.run")
    def test_linux_resources(
        self, mock_run: MagicMock, mock_system: MagicMock, tester: KindTester
    ) -> None:
        """Should check resources on Linux."""
        mock_system.return_value = "Linux"
        mock_run.return_value = MagicMock(
            returncode=0,
            stdout="              total        used        free      shared  buff/cache   available\nMem:    17179869184  8589934592  4294967296   1073741824  4294967296  8589934592\n",
            stderr="",
        )

        result = tester.test_system_resources()

        assert result is True


class TestNetworkConfiguration:
    """Tests for test_network_configuration method."""

    @pytest.fixture
    def tester(self, tmp_path: Path) -> KindTester:
        """Create a tester instance."""
        return KindTester(results_file=tmp_path / "test-results.log")

    @patch("comprehensive_kind_testing.platform.system")
    @patch("comprehensive_kind_testing.subprocess.run")
    def test_ports_available(
        self, mock_run: MagicMock, mock_system: MagicMock, tester: KindTester
    ) -> None:
        """Should check port availability."""
        mock_system.return_value = "Darwin"
        # First calls for lsof return nothing (ports available)
        # Last call for docker network returns bridge
        mock_run.side_effect = [
            MagicMock(returncode=1, stdout="", stderr=""),  # Port 80
            MagicMock(returncode=1, stdout="", stderr=""),  # Port 443
            MagicMock(returncode=1, stdout="", stderr=""),  # Port 8080
            MagicMock(returncode=1, stdout="", stderr=""),  # Port 3000
            MagicMock(returncode=1, stdout="", stderr=""),  # Port 5432
            MagicMock(returncode=1, stdout="", stderr=""),  # Port 6379
            MagicMock(returncode=1, stdout="", stderr=""),  # Port 9091
            MagicMock(returncode=0, stdout="bridge\nhost\nnone\n", stderr=""),  # docker network
        ]

        result = tester.test_network_configuration()

        assert result is True


class TestPerformance:
    """Tests for test_performance method."""

    @pytest.fixture
    def tester(self, tmp_path: Path) -> KindTester:
        """Create a tester instance."""
        return KindTester(results_file=tmp_path / "test-results.log")

    @patch("comprehensive_kind_testing.subprocess.run")
    @patch("comprehensive_kind_testing.time.perf_counter")
    def test_fast_performance(
        self, mock_time: MagicMock, mock_run: MagicMock, tester: KindTester
    ) -> None:
        """Should pass when Docker is fast."""
        mock_time.side_effect = [0.0, 1.5]  # 1.5 seconds
        mock_run.return_value = MagicMock(returncode=0, stdout="", stderr="")

        result = tester.test_performance()

        assert result is True
        assert tester.summary.passed >= 1

    @patch("comprehensive_kind_testing.subprocess.run")
    @patch("comprehensive_kind_testing.time.perf_counter")
    def test_slow_performance(
        self, mock_time: MagicMock, mock_run: MagicMock, tester: KindTester
    ) -> None:
        """Should warn when Docker is slow."""
        mock_time.side_effect = [0.0, 10.0]  # 10 seconds
        mock_run.return_value = MagicMock(returncode=0, stdout="", stderr="")

        result = tester.test_performance()

        assert result is True
        assert tester.summary.warnings >= 1


class TestIntegrationReadiness:
    """Tests for test_integration_readiness method."""

    @pytest.fixture
    def tester(self, tmp_path: Path) -> KindTester:
        """Create a tester instance."""
        return KindTester(results_file=tmp_path / "test-results.log")

    @patch.dict("os.environ", {"DATADOG_API_KEY": "real-key", "OPENROUTER_API_KEY": "real-key"})
    @patch("comprehensive_kind_testing.Path.exists")
    def test_all_configured(self, mock_exists: MagicMock, tester: KindTester) -> None:
        """Should pass when all integrations are configured."""
        mock_exists.return_value = True

        result = tester.test_integration_readiness()

        assert result is True
        assert tester.summary.passed >= 3

    @patch.dict("os.environ", {"DATADOG_API_KEY": "", "OPENROUTER_API_KEY": ""}, clear=True)
    @patch("comprehensive_kind_testing.Path.exists")
    def test_nothing_configured(self, mock_exists: MagicMock, tester: KindTester) -> None:
        """Should warn when nothing is configured."""
        mock_exists.return_value = False

        result = tester.test_integration_readiness()

        assert result is True
        assert tester.summary.warnings >= 3


class TestRunAllTests:
    """Tests for run_all_tests method."""

    @pytest.fixture
    def tester(self, tmp_path: Path) -> KindTester:
        """Create a tester instance."""
        return KindTester(results_file=tmp_path / "test-results.log")

    @patch.object(KindTester, "test_prerequisites")
    @patch.object(KindTester, "test_docker_daemon")
    @patch.object(KindTester, "test_kind_cluster_management")
    @patch.object(KindTester, "test_production_config")
    @patch.object(KindTester, "test_kubernetes_manifests")
    @patch.object(KindTester, "test_container_images")
    @patch.object(KindTester, "test_system_resources")
    @patch.object(KindTester, "test_network_configuration")
    @patch.object(KindTester, "test_performance")
    @patch.object(KindTester, "test_integration_readiness")
    def test_all_pass(
        self,
        mock_integration: MagicMock,
        mock_perf: MagicMock,
        mock_network: MagicMock,
        mock_resources: MagicMock,
        mock_images: MagicMock,
        mock_manifests: MagicMock,
        mock_prod: MagicMock,
        mock_kind: MagicMock,
        mock_docker: MagicMock,
        mock_prereq: MagicMock,
        tester: KindTester,
    ) -> None:
        """Should return 0 when all tests pass."""
        mock_prereq.return_value = True
        mock_docker.return_value = True
        mock_kind.return_value = True
        mock_prod.return_value = True
        mock_manifests.return_value = True
        mock_images.return_value = True
        mock_resources.return_value = True
        mock_network.return_value = True
        mock_perf.return_value = True
        mock_integration.return_value = True

        exit_code = tester.run_all_tests()

        assert exit_code == 0

    @patch.object(KindTester, "test_prerequisites")
    def test_prereq_fail_exits_early(
        self,
        mock_prereq: MagicMock,
        tester: KindTester,
    ) -> None:
        """Should exit early when prerequisites fail."""
        mock_prereq.return_value = False
        tester.summary.failed = 1

        exit_code = tester.run_all_tests()

        assert exit_code == 1


class TestConstants:
    """Tests for module constants."""

    def test_container_images_not_empty(self) -> None:
        """Should have container images defined."""
        assert len(CONTAINER_IMAGES) > 0
        assert "nginx:alpine" in CONTAINER_IMAGES

    def test_ports_to_check_not_empty(self) -> None:
        """Should have ports to check defined."""
        assert len(PORTS_TO_CHECK) > 0
        assert 80 in PORTS_TO_CHECK
        assert 443 in PORTS_TO_CHECK


class TestRunComprehensiveTesting:
    """Tests for run_comprehensive_testing function."""

    @patch.object(KindTester, "run_all_tests")
    def test_returns_exit_code(self, mock_run: MagicMock) -> None:
        """Should return exit code from tester."""
        mock_run.return_value = 42

        result = run_comprehensive_testing()

        assert result == 42
