
# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

"""Tests for agentapi scripts."""

import pytest
from unittest.mock import patch, MagicMock
import os
import sys
import tempfile
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agentapi.health_check import (
    HealthLevel,
    HealthMessage,
    HealthCheckConfig,
    HealthCheckResult,
    check_terminal_directory,
    check_zombie_processes,
    run_health_check,
)


class TestHealthLevel:
    """Tests for HealthLevel enum."""

    def test_health_levels(self):
        """Test that all health levels exist."""
        assert HealthLevel.OK.value == "OK"
        assert HealthLevel.WARN.value == "WARN"
        assert HealthLevel.ERROR.value == "ERROR"


class TestHealthMessage:
    """Tests for HealthMessage dataclass."""

    def test_health_message(self):
        """Test health message creation."""
        msg = HealthMessage(level=HealthLevel.OK, message="Test message")
        assert msg.level == HealthLevel.OK
        assert msg.message == "Test message"


class TestHealthCheckConfig:
    """Tests for HealthCheckConfig dataclass."""

    def test_default_values(self):
        """Test default configuration values."""
        config = HealthCheckConfig()
        assert config.host == "127.0.0.1"
        assert config.port == 3284
        assert config.terminal_dir == "/tmp/terminals"
        assert config.max_agents == 5
        assert config.max_response_time_ms == 1000

    def test_custom_values(self):
        """Test custom configuration values."""
        config = HealthCheckConfig(
            host="localhost",
            port=8080,
            terminal_dir="/custom/terminals",
            max_agents=10,
        )
        assert config.host == "localhost"
        assert config.port == 8080
        assert config.terminal_dir == "/custom/terminals"
        assert config.max_agents == 10


class TestHealthCheckResult:
    """Tests for HealthCheckResult dataclass."""

    def test_healthy_result(self):
        """Test healthy result."""
        result = HealthCheckResult(healthy=True)
        assert result.healthy is True
        assert result.messages == []

    def test_unhealthy_result(self):
        """Test unhealthy result with messages."""
        result = HealthCheckResult(
            healthy=False,
            messages=[
                HealthMessage(level=HealthLevel.ERROR, message="Test error"),
            ],
        )
        assert result.healthy is False
        assert len(result.messages) == 1


class TestCheckTerminalDirectory:
    """Tests for check_terminal_directory function."""

    def test_existing_directory(self):
        """Test with existing writable directory."""
        with tempfile.TemporaryDirectory() as tmpdir:
            config = HealthCheckConfig(terminal_dir=tmpdir)
            level, message = check_terminal_directory(config)
            assert level == HealthLevel.OK
            assert "accessible" in message

    def test_missing_directory(self):
        """Test with missing directory."""
        config = HealthCheckConfig(terminal_dir="/nonexistent/path/12345")
        level, message = check_terminal_directory(config)
        assert level == HealthLevel.ERROR
        assert "not accessible" in message


class TestCheckZombieProcesses:
    """Tests for check_zombie_processes function."""

    def test_no_zombies(self):
        """Test when there are no zombie processes."""
        level, message = check_zombie_processes()
        # Should return OK in most cases
        assert level in [HealthLevel.OK, HealthLevel.WARN]


class TestRunHealthCheck:
    """Tests for run_health_check function."""

    def test_returns_result(self):
        """Test that run_health_check returns a result."""
        # Use a config that won't try to connect to real services
        config = HealthCheckConfig(
            host="127.0.0.1",
            port=9999,  # Unlikely to be in use
        )

        # Create a temporary terminal directory
        with tempfile.TemporaryDirectory() as tmpdir:
            config.terminal_dir = tmpdir
            result = run_health_check(config)

            assert isinstance(result, HealthCheckResult)
            assert isinstance(result.messages, list)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])