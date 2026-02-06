"""Tests for datadog_monitor module."""

from __future__ import annotations

import json
import subprocess
from unittest import mock

import pytest

from scripts.lib import datadog_monitor


class TestDatadogConfig:
    """Tests for DatadogConfig dataclass."""

    def test_default_values(self):
        config = datadog_monitor.DatadogConfig(api_key="test-key")
        assert config.api_key == "test-key"
        assert config.site == "datadoghq.com"
        assert config.hostname  # Should have a hostname

    def test_custom_values(self):
        config = datadog_monitor.DatadogConfig(
            api_key="custom-key",
            site="datadoghq.eu",
            hostname="custom-host",
        )
        assert config.api_key == "custom-key"
        assert config.site == "datadoghq.eu"
        assert config.hostname == "custom-host"


class TestContainerInfo:
    """Tests for ContainerInfo dataclass."""

    def test_creation(self):
        info = datadog_monitor.ContainerInfo(
            id="abc123",
            state="running",
            image="alpine:latest",
        )
        assert info.id == "abc123"
        assert info.state == "running"
        assert info.image == "alpine:latest"


class TestMetricSender:
    """Tests for MetricSender class."""

    def test_send_metric_success(self):
        config = datadog_monitor.DatadogConfig(api_key="test-key", hostname="test-host")
        sender = datadog_monitor.MetricSender(config)

        with mock.patch("urllib.request.urlopen") as mock_urlopen:
            mock_urlopen.return_value.__enter__ = mock.Mock()
            mock_urlopen.return_value.__exit__ = mock.Mock()

            result = sender.send_metric(
                "test.metric",
                42.0,
                ["tag1:value1"],
            )

        assert result is True
        mock_urlopen.assert_called_once()

    def test_send_metric_failure(self):
        config = datadog_monitor.DatadogConfig(api_key="test-key", hostname="test-host")
        sender = datadog_monitor.MetricSender(config)

        with mock.patch("urllib.request.urlopen") as mock_urlopen:
            from urllib.error import URLError
            mock_urlopen.side_effect = URLError("Connection failed")

            result = sender.send_metric(
                "test.metric",
                42.0,
                ["tag1:value1"],
            )

        assert result is False


class TestContainerMonitor:
    """Tests for ContainerMonitor class."""

    def test_get_container_list_success(self):
        config = datadog_monitor.DatadogConfig(api_key="test-key", hostname="test-host")
        monitor = datadog_monitor.ContainerMonitor(config)

        mock_output = json.dumps([
            {"id": "abc", "state": "running", "image": "alpine"},
            {"id": "def", "state": "stopped", "image": "nginx"},
        ])

        with mock.patch.object(datadog_monitor, "subprocess") as mock_subprocess:
            mock_result = mock.Mock()
            mock_result.returncode = 0
            mock_result.stdout = mock_output
            mock_subprocess.run.return_value = mock_result
            mock_subprocess.TimeoutExpired = subprocess.TimeoutExpired
            mock_subprocess.CalledProcessError = subprocess.CalledProcessError

            containers = monitor.get_container_list()

        assert len(containers) == 2
        assert containers[0].id == "abc"
        assert containers[0].state == "running"
        assert containers[1].id == "def"
        assert containers[1].state == "stopped"

    def test_get_container_list_empty(self):
        config = datadog_monitor.DatadogConfig(api_key="test-key", hostname="test-host")
        monitor = datadog_monitor.ContainerMonitor(config)

        with mock.patch.object(datadog_monitor, "subprocess") as mock_subprocess:
            mock_result = mock.Mock()
            mock_result.returncode = 0
            mock_result.stdout = "[]"
            mock_subprocess.run.return_value = mock_result
            mock_subprocess.TimeoutExpired = subprocess.TimeoutExpired
            mock_subprocess.CalledProcessError = subprocess.CalledProcessError

            containers = monitor.get_container_list()

        assert containers == []

    def test_get_container_list_cli_not_found(self):
        config = datadog_monitor.DatadogConfig(api_key="test-key", hostname="test-host")
        monitor = datadog_monitor.ContainerMonitor(config)

        with mock.patch.object(datadog_monitor, "subprocess") as mock_subprocess:
            mock_subprocess.run.side_effect = FileNotFoundError("container not found")
            mock_subprocess.TimeoutExpired = subprocess.TimeoutExpired
            mock_subprocess.CalledProcessError = subprocess.CalledProcessError

            containers = monitor.get_container_list()

        assert containers == []

    def test_get_container_list_invalid_json(self):
        config = datadog_monitor.DatadogConfig(api_key="test-key", hostname="test-host")
        monitor = datadog_monitor.ContainerMonitor(config)

        with mock.patch.object(datadog_monitor, "subprocess") as mock_subprocess:
            mock_result = mock.Mock()
            mock_result.returncode = 0
            mock_result.stdout = "not valid json"
            mock_subprocess.run.return_value = mock_result
            mock_subprocess.TimeoutExpired = subprocess.TimeoutExpired
            mock_subprocess.CalledProcessError = subprocess.CalledProcessError

            containers = monitor.get_container_list()

        assert containers == []

    def test_collect_and_send_metrics(self):
        config = datadog_monitor.DatadogConfig(api_key="test-key", hostname="test-host")
        mock_sender = mock.Mock()
        monitor = datadog_monitor.ContainerMonitor(config, metric_sender=mock_sender)

        mock_containers = [
            datadog_monitor.ContainerInfo(id="abc", state="running", image="alpine"),
            datadog_monitor.ContainerInfo(id="def", state="stopped", image="nginx"),
            datadog_monitor.ContainerInfo(id="ghi", state="running", image="redis"),
        ]

        with mock.patch.object(monitor, "get_container_list", return_value=mock_containers):
            metrics = monitor.collect_and_send_metrics()

        assert metrics == {"total": 3, "running": 2}

        # Should have sent: total, running, and 2 container.up metrics
        assert mock_sender.send_metric.call_count == 4

    def test_collect_and_send_metrics_no_containers(self):
        config = datadog_monitor.DatadogConfig(api_key="test-key", hostname="test-host")
        mock_sender = mock.Mock()
        monitor = datadog_monitor.ContainerMonitor(config, metric_sender=mock_sender)

        with mock.patch.object(monitor, "get_container_list", return_value=[]):
            metrics = monitor.collect_and_send_metrics()

        assert metrics == {"total": 0, "running": 0}

        # Should have sent only total and running (both 0)
        assert mock_sender.send_metric.call_count == 2

    def test_run_once(self):
        config = datadog_monitor.DatadogConfig(api_key="test-key", hostname="test-host")
        mock_sender = mock.Mock()
        monitor = datadog_monitor.ContainerMonitor(config, metric_sender=mock_sender)

        with mock.patch.object(monitor, "get_container_list", return_value=[]):
            result = monitor.run_once()

        assert result == {"total": 0, "running": 0}

    def test_stop(self):
        config = datadog_monitor.DatadogConfig(api_key="test-key", hostname="test-host")
        monitor = datadog_monitor.ContainerMonitor(config)

        monitor._running = True
        monitor.stop()

        assert monitor._running is False


class TestParseArgs:
    """Tests for argument parsing."""

    def test_default_args(self, monkeypatch):
        monkeypatch.delenv("DD_API_KEY", raising=False)
        monkeypatch.delenv("DD_SITE", raising=False)

        args = datadog_monitor.parse_args([])

        assert args.api_key == ""
        assert args.site == "datadoghq.com"
        assert args.interval == 60
        assert args.once is False

    def test_custom_args(self):
        args = datadog_monitor.parse_args([
            "--api-key", "my-key",
            "--site", "datadoghq.eu",
            "--interval", "30",
            "--once",
        ])

        assert args.api_key == "my-key"
        assert args.site == "datadoghq.eu"
        assert args.interval == 30
        assert args.once is True

    def test_env_vars(self, monkeypatch):
        monkeypatch.setenv("DD_API_KEY", "env-key")
        monkeypatch.setenv("DD_SITE", "datadoghq.eu")

        args = datadog_monitor.parse_args([])

        assert args.api_key == "env-key"
        assert args.site == "datadoghq.eu"


class TestMain:
    """Tests for main function."""

    def test_missing_api_key(self, monkeypatch, capsys):
        monkeypatch.delenv("DD_API_KEY", raising=False)

        result = datadog_monitor.main(["--api-key", ""])

        assert result == 1
        captured = capsys.readouterr()
        assert "DD_API_KEY" in captured.out

    def test_run_once_mode(self, monkeypatch):
        monkeypatch.setenv("DD_API_KEY", "test-key")

        with mock.patch.object(datadog_monitor, "ContainerMonitor") as MockMonitor:
            mock_instance = mock.Mock()
            mock_instance.run_once.return_value = {"total": 0, "running": 0}
            MockMonitor.return_value = mock_instance

            result = datadog_monitor.main(["--once"])

        assert result == 0
        mock_instance.run_once.assert_called_once()
        mock_instance.run_loop.assert_not_called()
