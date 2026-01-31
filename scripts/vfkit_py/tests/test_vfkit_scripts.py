
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

"""Tests for vfkit Python scripts."""

from __future__ import annotations

import io
import subprocess
from pathlib import Path
from unittest import mock

import pytest


class TestTestAllVMs:
    """Tests for test_all_vms module."""

    def test_check_vm_running_not_running(self):
        from scripts.vfkit_py import test_all_vms

        with mock.patch.object(test_all_vms, "subprocess") as mock_subprocess:
            mock_result = mock.Mock()
            mock_result.stdout = "some process\nanother process\n"
            mock_subprocess.run.return_value = mock_result

            running, pid = test_all_vms.check_vm_running("nonexistent-vm")

            assert running is False
            assert pid is None

    def test_read_console_log_missing(self, tmp_path: Path):
        from scripts.vfkit_py import test_all_vms

        with mock.patch.object(test_all_vms, "get_vfkit_home", return_value=tmp_path):
            lines = test_all_vms.read_console_log("nonexistent-vm", 10)

        assert lines == ["No console log"]

    def test_read_console_log_exists(self, tmp_path: Path):
        from scripts.vfkit_py import test_all_vms

        vm_dir = tmp_path / "test-vm" / "logs"
        vm_dir.mkdir(parents=True)
        console_log = vm_dir / "console.log"
        console_log.write_text("line1\nline2\nline3\n")

        with mock.patch.object(test_all_vms, "get_vfkit_home", return_value=tmp_path):
            lines = test_all_vms.read_console_log("test-vm", 2)

        assert lines == ["line2", "line3"]

    def test_generate_report(self):
        from scripts.vfkit_py import test_all_vms

        output = io.StringIO()

        with mock.patch.object(test_all_vms, "check_vm_running", return_value=(False, None)):
            test_all_vms.generate_report(output)

        content = output.getvalue()
        assert "# Comprehensive VM Test Report" in content
        assert "VM Inventory" in content


class TestTestBusyboxNodeDocker:
    """Tests for test_busybox_node_docker module."""

    def test_docker_available_true(self):
        from scripts.vfkit_py import test_busybox_node_docker

        with mock.patch.object(test_busybox_node_docker, "subprocess") as mock_subprocess:
            mock_subprocess.run.return_value = mock.Mock()
            mock_subprocess.CalledProcessError = subprocess.CalledProcessError

            result = test_busybox_node_docker.docker_available()

        assert result is True

    def test_docker_available_false(self):
        from scripts.vfkit_py import test_busybox_node_docker

        with mock.patch.object(test_busybox_node_docker, "subprocess") as mock_subprocess:
            mock_subprocess.run.side_effect = subprocess.CalledProcessError(1, "docker")
            mock_subprocess.CalledProcessError = subprocess.CalledProcessError

            result = test_busybox_node_docker.docker_available()

        assert result is False

    def test_image_exists_true(self):
        from scripts.vfkit_py import test_busybox_node_docker

        with mock.patch.object(test_busybox_node_docker, "subprocess") as mock_subprocess:
            mock_result = mock.Mock()
            mock_result.stdout = "vibecode-busybox-node\n"
            mock_subprocess.run.return_value = mock_result

            result = test_busybox_node_docker.image_exists("vibecode-busybox-node")

        assert result is True

    def test_image_exists_false(self):
        from scripts.vfkit_py import test_busybox_node_docker

        with mock.patch.object(test_busybox_node_docker, "subprocess") as mock_subprocess:
            mock_result = mock.Mock()
            mock_result.stdout = ""
            mock_subprocess.run.return_value = mock_result

            result = test_busybox_node_docker.image_exists("nonexistent")

        assert result is False


class TestTestNodejsDev:
    """Tests for test_nodejs_dev module."""

    def test_check_jq_available(self):
        from scripts.vfkit_py import test_nodejs_dev

        with mock.patch.object(test_nodejs_dev, "shutil") as mock_shutil:
            mock_shutil.which.return_value = "/usr/bin/jq"
            result = test_nodejs_dev.check_jq_available()

        assert result is True

    def test_check_jq_not_available(self):
        from scripts.vfkit_py import test_nodejs_dev

        with mock.patch.object(test_nodejs_dev, "shutil") as mock_shutil:
            mock_shutil.which.return_value = None
            result = test_nodejs_dev.check_jq_available()

        assert result is False

    def test_fetch_health_data_success(self):
        from scripts.vfkit_py import test_nodejs_dev

        config = test_nodejs_dev.NodeJSConfig()

        with mock.patch.object(test_nodejs_dev, "shutil") as mock_shutil:
            mock_shutil.which.return_value = "/usr/bin/curl"

            with mock.patch.object(test_nodejs_dev, "subprocess") as mock_subprocess:
                mock_result = mock.Mock()
                mock_result.returncode = 0
                mock_result.stdout = '{"node_version": "v20.0.0"}'
                mock_subprocess.run.return_value = mock_result
                mock_subprocess.TimeoutExpired = subprocess.TimeoutExpired

                data = test_nodejs_dev.fetch_health_data(config)

        assert data == {"node_version": "v20.0.0"}

    def test_fetch_health_data_no_curl(self):
        from scripts.vfkit_py import test_nodejs_dev

        config = test_nodejs_dev.NodeJSConfig()

        with mock.patch.object(test_nodejs_dev, "shutil") as mock_shutil:
            mock_shutil.which.return_value = None

            data = test_nodejs_dev.fetch_health_data(config)

        assert data is None

    def test_test_result_tracking(self):
        from scripts.vfkit_py import test_nodejs_dev

        result = test_nodejs_dev.TestResult()
        assert result.passed == 0
        assert result.failed == 0

        test_nodejs_dev.run_test("Test 1", lambda: True, result)
        assert result.passed == 1
        assert result.failed == 0

        test_nodejs_dev.run_test("Test 2", lambda: False, result)
        assert result.passed == 1
        assert result.failed == 1


class TestPostgreSQLTester:
    """Tests for postgresql_tester module."""

    def test_config_defaults(self):
        from scripts.vfkit_py.postgresql_tester import PostgreSQLConfig

        config = PostgreSQLConfig()
        assert config.host == "localhost"
        assert config.port == 5432
        assert config.user == "vibecode"
        assert config.database == "vibecode"

    def test_cli_detect_found(self):
        from scripts.vfkit_py.postgresql_tester import PostgreSQLCLI

        with mock.patch("shutil.which", return_value="/usr/bin/psql"):
            cli = PostgreSQLCLI.detect()

        assert cli.binary == "/usr/bin/psql"

    def test_cli_detect_not_found(self):
        from scripts.vfkit_py.postgresql_tester import PostgreSQLCLI

        with mock.patch("shutil.which", return_value=None):
            with pytest.raises(FileNotFoundError):
                PostgreSQLCLI.detect()

    def test_tester_port_connectivity_success(self):
        from scripts.vfkit_py.postgresql_tester import PostgreSQLCLI, PostgreSQLConfig, PostgreSQLTester

        config = PostgreSQLConfig()
        cli = PostgreSQLCLI("/usr/bin/psql")
        tester = PostgreSQLTester(config, cli)

        with mock.patch("socket.create_connection") as mock_conn:
            mock_conn.return_value.__enter__ = mock.Mock()
            mock_conn.return_value.__exit__ = mock.Mock()

            result = tester.test_port_connectivity()

        assert result is True

    def test_tester_port_connectivity_failure(self):
        from scripts.vfkit_py.postgresql_tester import PostgreSQLCLI, PostgreSQLConfig, PostgreSQLTester

        config = PostgreSQLConfig()
        cli = PostgreSQLCLI("/usr/bin/psql")
        tester = PostgreSQLTester(config, cli)

        with mock.patch("socket.create_connection") as mock_conn:
            mock_conn.side_effect = OSError("Connection refused")

            result = tester.test_port_connectivity()

        assert result is False


class TestTestVMPerformance:
    """Tests for test_vm_performance module."""

    def test_compare_performance_optimized_faster(self, capsys):
        from scripts.vfkit_py import test_vm_performance

        test_vm_performance.compare_performance(10.0, 5.0)

        captured = capsys.readouterr()
        # Check both stdout and stderr since log functions may use either
        all_output = captured.out + captured.err
        assert "10.00s" in all_output
        assert "5.00s" in all_output

    def test_compare_performance_optimized_slower(self, capsys):
        from scripts.vfkit_py import test_vm_performance

        test_vm_performance.compare_performance(5.0, 10.0)

        captured = capsys.readouterr()
        all_output = captured.out + captured.err
        assert "5.00s" in all_output
        assert "10.00s" in all_output

    def test_compare_performance_with_none(self, capsys):
        from scripts.vfkit_py import test_vm_performance

        test_vm_performance.compare_performance(None, 5.0)

        captured = capsys.readouterr()
        all_output = captured.out + captured.err
        assert "Failed" in all_output

    def test_vm_config(self, tmp_path: Path):
        from scripts.vfkit_py.test_vm_performance import VMConfig

        config = VMConfig(name="test", vm_dir=tmp_path)
        assert config.name == "test"
        assert config.vm_dir == tmp_path
        assert config.launch_script == "launch.sh"


class TestTestOpenvsCodeInVM:
    """Tests for test_openvscode_in_vm module."""

    def test_create_test_script(self):
        from scripts.vfkit_py import test_openvscode_in_vm

        script = test_openvscode_in_vm.create_test_script()

        assert "#!/bin/sh" in script
        assert "openvscode-server" in script
        assert "apk add" in script

    def test_create_init_script(self):
        from scripts.vfkit_py import test_openvscode_in_vm

        script = test_openvscode_in_vm.create_init_script()

        assert "#!/bin/busybox sh" in script
        assert "mount -t proc" in script
        assert "ip link set eth0 up" in script

    def test_create_launch_script(self, tmp_path: Path):
        from scripts.vfkit_py import test_openvscode_in_vm

        script = test_openvscode_in_vm.create_launch_script(tmp_path)

        assert "vfkit" in script
        assert "--cpus 4" in script
        assert "--memory 4096" in script

    def test_read_console_log_missing(self, tmp_path: Path):
        from scripts.vfkit_py import test_openvscode_in_vm

        lines = test_openvscode_in_vm.read_console_log(tmp_path, 10)

        assert lines == ["No console log"]

    def test_read_console_log_exists(self, tmp_path: Path):
        from scripts.vfkit_py import test_openvscode_in_vm

        logs_dir = tmp_path / "logs"
        logs_dir.mkdir()
        console_log = logs_dir / "console.log"
        console_log.write_text("line1\nline2\nline3\nline4\nline5\n")

        lines = test_openvscode_in_vm.read_console_log(tmp_path, 3)

        assert lines == ["line3", "line4", "line5"]