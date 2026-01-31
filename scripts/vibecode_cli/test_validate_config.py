
# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

"""Tests for validate_config.py."""

from __future__ import annotations

import io
import subprocess
from pathlib import Path
from unittest import mock

import pytest

from . import validate_config


class TestValidationResult:
    """Tests for ValidationResult class."""

    def test_initial_state(self):
        result = validate_config.ValidationResult()
        assert result.warnings == 0
        assert result.errors == 0

    def test_warn_increments_counter(self):
        stream = io.StringIO()
        result = validate_config.ValidationResult(stream=stream)

        result.warn("Test warning")

        assert result.warnings == 1
        assert "Test warning" in stream.getvalue()

    def test_err_increments_counter(self):
        stream = io.StringIO()
        result = validate_config.ValidationResult(stream=stream)

        result.err("Test error")

        assert result.errors == 1
        assert "Test error" in stream.getvalue()

    def test_ok_no_increment(self):
        stream = io.StringIO()
        result = validate_config.ValidationResult(stream=stream)

        result.ok("Test success")

        assert result.warnings == 0
        assert result.errors == 0
        assert "Test success" in stream.getvalue()

    def test_info_no_increment(self):
        stream = io.StringIO()
        result = validate_config.ValidationResult(stream=stream)

        result.info("Test info")

        assert result.warnings == 0
        assert result.errors == 0
        assert "Test info" in stream.getvalue()


class TestLoadEnvVar:
    """Tests for load_env_var function."""

    def test_existing_variable(self, tmp_path: Path):
        config_file = tmp_path / ".env.local"
        config_file.write_text("FOO=bar\nBAZ=qux")

        value = validate_config.load_env_var(config_file, "FOO")

        assert value == "bar"

    def test_variable_with_equals_in_value(self, tmp_path: Path):
        config_file = tmp_path / ".env.local"
        config_file.write_text("URL=postgres://user:pass@host/db?foo=bar")

        value = validate_config.load_env_var(config_file, "URL")

        assert value == "postgres://user:pass@host/db?foo=bar"

    def test_missing_variable(self, tmp_path: Path):
        config_file = tmp_path / ".env.local"
        config_file.write_text("FOO=bar")

        value = validate_config.load_env_var(config_file, "MISSING")

        assert value == ""

    def test_missing_file(self, tmp_path: Path):
        config_file = tmp_path / "nonexistent"

        value = validate_config.load_env_var(config_file, "FOO")

        assert value == ""

    def test_last_value_wins(self, tmp_path: Path):
        config_file = tmp_path / ".env.local"
        config_file.write_text("FOO=first\nFOO=second")

        value = validate_config.load_env_var(config_file, "FOO")

        assert value == "second"


class TestValidateEnvFile:
    """Tests for validate_env_file function."""

    def test_env_file_exists(self, tmp_path: Path):
        env_file = tmp_path / ".env.local"
        env_file.write_text("FOO=bar")
        result = validate_config.ValidationResult(stream=io.StringIO())

        config_file = validate_config.validate_env_file(tmp_path, result)

        assert config_file == env_file
        assert result.errors == 0
        assert result.warnings == 0

    def test_env_file_missing_with_template(self, tmp_path: Path):
        template = tmp_path / "env.development.example"
        template.write_text("FOO=placeholder")
        result = validate_config.ValidationResult(stream=io.StringIO())

        config_file = validate_config.validate_env_file(tmp_path, result)

        assert config_file is None
        assert result.warnings == 1
        assert result.errors == 0

    def test_env_file_missing_no_template(self, tmp_path: Path):
        result = validate_config.ValidationResult(stream=io.StringIO())

        config_file = validate_config.validate_env_file(tmp_path, result)

        assert config_file is None
        assert result.errors == 1
        assert result.warnings == 0


class TestValidateDatadog:
    """Tests for validate_datadog function."""

    def test_no_config_file(self):
        result = validate_config.ValidationResult(stream=io.StringIO())

        validate_config.validate_datadog(None, result)

        assert result.warnings == 1

    def test_missing_api_key(self, tmp_path: Path):
        config_file = tmp_path / ".env.local"
        config_file.write_text("DD_SITE=datadoghq.com")
        result = validate_config.ValidationResult(stream=io.StringIO())

        validate_config.validate_datadog(config_file, result)

        assert result.warnings >= 1

    def test_placeholder_api_key(self, tmp_path: Path):
        config_file = tmp_path / ".env.local"
        config_file.write_text("DD_API_KEY=your-datadog-api-key")
        result = validate_config.ValidationResult(stream=io.StringIO())

        validate_config.validate_datadog(config_file, result)

        assert result.warnings >= 1

    def test_valid_api_key(self, tmp_path: Path):
        config_file = tmp_path / ".env.local"
        config_file.write_text("DD_API_KEY=abc123xyz\nDD_SITE=datadoghq.com")
        result = validate_config.ValidationResult(stream=io.StringIO())

        with mock.patch.object(validate_config, "which", return_value=None):
            validate_config.validate_datadog(config_file, result)

        # Should have at least one warning for skipping connectivity
        assert result.errors == 0


class TestValidateDatabase:
    """Tests for validate_database function."""

    def test_no_config_file(self):
        result = validate_config.ValidationResult(stream=io.StringIO())

        validate_config.validate_database(None, result)

        assert result.warnings == 1

    def test_missing_database_url(self, tmp_path: Path):
        config_file = tmp_path / ".env.local"
        config_file.write_text("FOO=bar")
        result = validate_config.ValidationResult(stream=io.StringIO())

        validate_config.validate_database(config_file, result)

        assert result.warnings == 1

    def test_psql_not_available(self, tmp_path: Path):
        config_file = tmp_path / ".env.local"
        config_file.write_text("DATABASE_URL=postgres://localhost/db")
        result = validate_config.ValidationResult(stream=io.StringIO())

        with mock.patch.object(validate_config, "which", return_value=None):
            validate_config.validate_database(config_file, result)

        assert result.warnings == 1

    def test_database_connection_success(self, tmp_path: Path):
        config_file = tmp_path / ".env.local"
        config_file.write_text("DATABASE_URL=postgres://localhost/db")
        result = validate_config.ValidationResult(stream=io.StringIO())

        with (
            mock.patch.object(validate_config, "which", return_value="/usr/bin/psql"),
            mock.patch.object(validate_config, "run_command"),
        ):
            validate_config.validate_database(config_file, result)

        assert result.errors == 0
        assert result.warnings == 0

    def test_database_connection_failure(self, tmp_path: Path):
        config_file = tmp_path / ".env.local"
        config_file.write_text("DATABASE_URL=postgres://localhost/db")
        result = validate_config.ValidationResult(stream=io.StringIO())

        with (
            mock.patch.object(validate_config, "which", return_value="/usr/bin/psql"),
            mock.patch.object(
                validate_config,
                "run_command",
                side_effect=subprocess.CalledProcessError(1, "psql"),
            ),
        ):
            validate_config.validate_database(config_file, result)

        assert result.warnings == 1


class TestValidateRedis:
    """Tests for validate_redis function."""

    def test_no_config_file(self):
        result = validate_config.ValidationResult(stream=io.StringIO())

        validate_config.validate_redis(None, result)

        assert result.warnings == 1

    def test_missing_redis_url(self, tmp_path: Path):
        config_file = tmp_path / ".env.local"
        config_file.write_text("FOO=bar")
        result = validate_config.ValidationResult(stream=io.StringIO())

        validate_config.validate_redis(config_file, result)

        assert result.warnings == 1

    def test_redis_cli_not_available(self, tmp_path: Path):
        config_file = tmp_path / ".env.local"
        config_file.write_text("REDIS_URL=redis://localhost:6379")
        result = validate_config.ValidationResult(stream=io.StringIO())

        with mock.patch.object(validate_config, "which", return_value=None):
            validate_config.validate_redis(config_file, result)

        assert result.warnings == 1

    def test_redis_connection_success(self, tmp_path: Path):
        config_file = tmp_path / ".env.local"
        config_file.write_text("REDIS_URL=redis://localhost:6379")
        result = validate_config.ValidationResult(stream=io.StringIO())

        with (
            mock.patch.object(validate_config, "which", return_value="/usr/bin/redis-cli"),
            mock.patch.object(validate_config, "run_command"),
        ):
            validate_config.validate_redis(config_file, result)

        assert result.errors == 0
        assert result.warnings == 0

    def test_redis_connection_failure(self, tmp_path: Path):
        config_file = tmp_path / ".env.local"
        config_file.write_text("REDIS_URL=redis://localhost:6379")
        result = validate_config.ValidationResult(stream=io.StringIO())

        with (
            mock.patch.object(validate_config, "which", return_value="/usr/bin/redis-cli"),
            mock.patch.object(
                validate_config,
                "run_command",
                side_effect=subprocess.CalledProcessError(1, "redis-cli"),
            ),
        ):
            validate_config.validate_redis(config_file, result)

        assert result.warnings == 1


class TestValidateTooling:
    """Tests for validate_tooling function."""

    def test_all_tools_available(self):
        result = validate_config.ValidationResult(stream=io.StringIO())

        with mock.patch.object(validate_config, "which", return_value="/usr/bin/tool"):
            validate_config.validate_tooling(result)

        assert result.errors == 0

    def test_missing_tool(self):
        result = validate_config.ValidationResult(stream=io.StringIO())

        def mock_which(cmd):
            return None if cmd == "node" else "/usr/bin/tool"

        with mock.patch.object(validate_config, "which", side_effect=mock_which):
            validate_config.validate_tooling(result)

        assert result.errors == 1


class TestValidateNodeModules:
    """Tests for validate_node_modules function."""

    def test_node_modules_exists(self, tmp_path: Path):
        node_modules = tmp_path / "node_modules"
        node_modules.mkdir()
        result = validate_config.ValidationResult(stream=io.StringIO())

        validate_config.validate_node_modules(tmp_path, result)

        assert result.warnings == 0

    def test_node_modules_missing(self, tmp_path: Path):
        result = validate_config.ValidationResult(stream=io.StringIO())

        validate_config.validate_node_modules(tmp_path, result)

        assert result.warnings == 1


class TestMain:
    """Tests for main function."""

    def test_returns_zero_on_no_errors(self, tmp_path: Path):
        env_file = tmp_path / ".env.local"
        env_file.write_text("")
        node_modules = tmp_path / "node_modules"
        node_modules.mkdir()

        with (
            mock.patch.object(validate_config, "get_project_root", return_value=tmp_path),
            mock.patch.object(validate_config, "which", return_value="/usr/bin/tool"),
        ):
            result = validate_config.main([])

        assert result == 0

    def test_returns_one_on_errors(self, tmp_path: Path):
        # No .env.local, no template -> error
        with (
            mock.patch.object(validate_config, "get_project_root", return_value=tmp_path),
            mock.patch.object(validate_config, "which", return_value=None),  # Missing tools
        ):
            result = validate_config.main([])

        assert result == 1