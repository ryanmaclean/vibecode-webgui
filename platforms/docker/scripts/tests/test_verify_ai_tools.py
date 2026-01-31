
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

"""Tests for verify_ai_tools.py"""

import pytest
from unittest.mock import patch, MagicMock
import os
import sys

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from verify_ai_tools import (
    ToolStatus,
    check_command_exists,
    get_command_version,
    check_env_var_set,
    check_nodejs_ai_tools,
    check_python_ai_tools,
    check_api_keys,
)


class TestToolStatus:
    """Tests for ToolStatus dataclass."""

    def test_installed_tool(self):
        """Test installed tool status."""
        status = ToolStatus(name="test", installed=True, version="1.0.0")
        assert status.installed is True
        assert status.version == "1.0.0"

    def test_not_installed_tool(self):
        """Test not installed tool status."""
        status = ToolStatus(name="test", installed=False)
        assert status.installed is False
        assert status.version is None


class TestCheckCommandExists:
    """Tests for check_command_exists function."""

    def test_existing_command(self):
        """Test with existing command."""
        # 'python' or 'python3' should exist
        assert check_command_exists("python") or check_command_exists("python3")

    def test_missing_command(self):
        """Test with missing command."""
        assert check_command_exists("nonexistent_command_xyz") is False


class TestGetCommandVersion:
    """Tests for get_command_version function."""

    def test_python_version(self):
        """Test getting Python version."""
        # This should return something
        version = get_command_version("python3") or get_command_version("python")
        assert version is not None

    def test_missing_command_version(self):
        """Test version for missing command."""
        version = get_command_version("nonexistent_command_xyz")
        assert version is None


class TestCheckEnvVarSet:
    """Tests for check_env_var_set function."""

    def test_set_env_var(self):
        """Test with set environment variable."""
        os.environ["TEST_VAR_12345"] = "test_value"
        try:
            assert check_env_var_set("TEST_VAR_12345") is True
        finally:
            del os.environ["TEST_VAR_12345"]

    def test_unset_env_var(self):
        """Test with unset environment variable."""
        # Make sure it's not set
        if "UNSET_TEST_VAR_12345" in os.environ:
            del os.environ["UNSET_TEST_VAR_12345"]
        assert check_env_var_set("UNSET_TEST_VAR_12345") is False

    def test_empty_env_var(self):
        """Test with empty environment variable."""
        os.environ["EMPTY_TEST_VAR"] = ""
        try:
            assert check_env_var_set("EMPTY_TEST_VAR") is False
        finally:
            del os.environ["EMPTY_TEST_VAR"]


class TestCheckNodejsAiTools:
    """Tests for check_nodejs_ai_tools function."""

    def test_returns_list(self):
        """Test that function returns a list."""
        results = check_nodejs_ai_tools()
        assert isinstance(results, list)

    def test_expected_tools(self):
        """Test that expected tools are checked."""
        results = check_nodejs_ai_tools()
        tool_names = [r.name for r in results]
        assert "Claude Code CLI" in tool_names
        assert "OpenAI Codex CLI" in tool_names
        assert "Google Gemini CLI" in tool_names


class TestCheckPythonAiTools:
    """Tests for check_python_ai_tools function."""

    def test_returns_list(self):
        """Test that function returns a list."""
        results = check_python_ai_tools()
        assert isinstance(results, list)

    def test_aider_checked(self):
        """Test that Aider is checked."""
        results = check_python_ai_tools()
        tool_names = [r.name for r in results]
        assert "Aider" in tool_names


class TestCheckApiKeys:
    """Tests for check_api_keys function."""

    def test_returns_dict(self):
        """Test that function returns a dictionary."""
        result = check_api_keys()
        assert isinstance(result, dict)

    def test_expected_keys(self):
        """Test that expected keys are checked."""
        result = check_api_keys()
        assert "ANTHROPIC_API_KEY" in result
        assert "OPENAI_API_KEY" in result
        assert "GOOGLE_API_KEY" in result
        assert "OPENCODE_API_KEY" in result

    def test_detects_set_key(self):
        """Test that set keys are detected."""
        os.environ["ANTHROPIC_API_KEY"] = "test_key"
        try:
            result = check_api_keys()
            assert result["ANTHROPIC_API_KEY"] is True
        finally:
            del os.environ["ANTHROPIC_API_KEY"]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])