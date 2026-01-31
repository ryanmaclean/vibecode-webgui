"""Tests for install_claude_code_cli.py"""

import os
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "scripts"))

from install_claude_code_cli import (
    InstallConfig,
    Colors,
    is_root,
    command_exists,
    get_python_version,
    check_python_version_compatible,
    get_config_content,
    get_claude_cli_content,
)


class TestInstallConfig:
    """Tests for InstallConfig dataclass."""

    def test_default_values(self) -> None:
        """Should have correct default values."""
        config = InstallConfig()
        assert config.cli_version == "1.0.0"
        assert config.install_dir == Path("/opt/vibecode/ai-cli-tools/claude-code")
        assert config.config_dir == Path("/etc/vibecode/claude-code")
        assert config.log_file == Path("/var/log/vibecode/claude-code-cli-install.log")

    def test_custom_values(self) -> None:
        """Should accept custom values."""
        config = InstallConfig(
            cli_version="2.0.0",
            install_dir=Path("/custom/path"),
        )
        assert config.cli_version == "2.0.0"
        assert config.install_dir == Path("/custom/path")


class TestColors:
    """Tests for Colors class."""

    def test_has_required_colors(self) -> None:
        """Should have all required ANSI color codes."""
        assert hasattr(Colors, "RED")
        assert hasattr(Colors, "GREEN")
        assert hasattr(Colors, "YELLOW")
        assert hasattr(Colors, "BLUE")
        assert hasattr(Colors, "NC")

    def test_colors_are_ansi_codes(self) -> None:
        """Colors should be valid ANSI escape sequences."""
        assert Colors.RED.startswith("\033[")
        assert Colors.GREEN.startswith("\033[")
        assert Colors.NC == "\033[0m"


class TestIsRoot:
    """Tests for is_root function."""

    @patch("os.geteuid")
    def test_returns_true_when_root(self, mock_geteuid: MagicMock) -> None:
        """Should return True when running as root."""
        mock_geteuid.return_value = 0
        assert is_root() is True

    @patch("os.geteuid")
    def test_returns_false_when_not_root(self, mock_geteuid: MagicMock) -> None:
        """Should return False when not running as root."""
        mock_geteuid.return_value = 1000
        assert is_root() is False


class TestCommandExists:
    """Tests for command_exists function."""

    @patch("shutil.which")
    def test_returns_true_when_command_exists(self, mock_which: MagicMock) -> None:
        """Should return True when command is found."""
        mock_which.return_value = "/usr/bin/python3"
        assert command_exists("python3") is True

    @patch("shutil.which")
    def test_returns_false_when_command_missing(self, mock_which: MagicMock) -> None:
        """Should return False when command not found."""
        mock_which.return_value = None
        assert command_exists("nonexistent") is False


class TestGetPythonVersion:
    """Tests for get_python_version function."""

    @patch("install_claude_code_cli.run_command")
    def test_returns_version_string(self, mock_run: MagicMock) -> None:
        """Should return Python version string."""
        mock_run.return_value = MagicMock(stdout="Python 3.11.4\n")
        version = get_python_version()
        assert version == "3.11.4"

    @patch("install_claude_code_cli.run_command")
    def test_returns_none_on_error(self, mock_run: MagicMock) -> None:
        """Should return None on error."""
        mock_run.side_effect = Exception("Command failed")
        version = get_python_version()
        assert version is None


class TestCheckPythonVersionCompatible:
    """Tests for check_python_version_compatible function."""

    def test_current_version_is_compatible(self) -> None:
        """Current Python version should be compatible (3.8+)."""
        # This test runs on Python 3.8+, so it should pass
        assert check_python_version_compatible() is True


class TestGetConfigContent:
    """Tests for get_config_content function."""

    def test_returns_dict(self) -> None:
        """Should return a dictionary."""
        config = get_config_content()
        assert isinstance(config, dict)

    def test_has_default_model(self) -> None:
        """Should have default_model key."""
        config = get_config_content()
        assert "default_model" in config
        assert config["default_model"] == "claude-3-sonnet"

    def test_has_available_models(self) -> None:
        """Should have available_models list."""
        config = get_config_content()
        assert "available_models" in config
        assert isinstance(config["available_models"], list)
        assert "claude-3-opus" in config["available_models"]
        assert "claude-3-sonnet" in config["available_models"]
        assert "claude-3-haiku" in config["available_models"]

    def test_has_supported_languages(self) -> None:
        """Should have supported_languages list."""
        config = get_config_content()
        assert "supported_languages" in config
        assert "python" in config["supported_languages"]
        assert "javascript" in config["supported_languages"]
        assert "go" in config["supported_languages"]
        assert "rust" in config["supported_languages"]

    def test_has_max_tokens(self) -> None:
        """Should have max_tokens setting."""
        config = get_config_content()
        assert config["max_tokens"] == 4096

    def test_has_temperature(self) -> None:
        """Should have temperature setting."""
        config = get_config_content()
        assert config["temperature"] == 0.7


class TestGetClaudeCliContent:
    """Tests for get_claude_cli_content function."""

    def test_returns_string(self) -> None:
        """Should return a string."""
        content = get_claude_cli_content()
        assert isinstance(content, str)

    def test_has_shebang(self) -> None:
        """Should have Python shebang."""
        content = get_claude_cli_content()
        assert content.startswith("#!/usr/bin/env python3")

    def test_has_claude_cli_class(self) -> None:
        """Should define ClaudeCodeCLI class."""
        content = get_claude_cli_content()
        assert "class ClaudeCodeCLI:" in content

    def test_has_generate_code_method(self) -> None:
        """Should have generate_code method."""
        content = get_claude_cli_content()
        assert "def generate_code(" in content

    def test_has_explain_code_method(self) -> None:
        """Should have explain_code method."""
        content = get_claude_cli_content()
        assert "def explain_code(" in content

    def test_has_optimize_code_method(self) -> None:
        """Should have optimize_code method."""
        content = get_claude_cli_content()
        assert "def optimize_code(" in content

    def test_has_chat_method(self) -> None:
        """Should have chat method."""
        content = get_claude_cli_content()
        assert "def chat(" in content

    def test_imports_anthropic(self) -> None:
        """Should import anthropic SDK."""
        content = get_claude_cli_content()
        assert "import anthropic" in content

    def test_has_main_function(self) -> None:
        """Should have main function."""
        content = get_claude_cli_content()
        assert "def main()" in content
        assert 'if __name__ == "__main__":' in content
