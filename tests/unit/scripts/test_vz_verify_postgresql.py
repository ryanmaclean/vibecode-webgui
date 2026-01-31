
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

"""Tests for scripts/vz/verify_postgresql.py"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "scripts" / "vz"))

from verify_postgresql import (
    PostgreSQLConfig,
    VerificationResults,
    run_psql,
    run_psql_command,
    check_active_connections,
    check_database_size,
    check_list_extensions,
    check_pgvector_extension,
    check_port_connectivity,
    check_postgresql_version,
    check_vector_operations,
    verify_postgresql,
)


class TestPostgreSQLConfig:
    """Tests for PostgreSQLConfig dataclass."""

    def test_default_values(self) -> None:
        """Should have correct default values."""
        config = PostgreSQLConfig()
        assert config.host == "127.0.0.1"
        assert config.port == 5432
        assert config.user == "vibecode"
        assert config.database == "vibecode"

    def test_custom_values(self) -> None:
        """Should accept custom values."""
        config = PostgreSQLConfig(
            host="localhost",
            port=5433,
            user="test",
            database="testdb",
        )
        assert config.host == "localhost"
        assert config.port == 5433
        assert config.user == "test"
        assert config.database == "testdb"

    @patch.dict(os.environ, {
        "PG_HOST": "custom_host",
        "PG_PORT": "5555",
        "PG_USER": "custom_user",
        "PG_DB": "custom_db",
    })
    def test_from_env(self) -> None:
        """Should read from environment variables."""
        config = PostgreSQLConfig.from_env()
        assert config.host == "custom_host"
        assert config.port == 5555
        assert config.user == "custom_user"
        assert config.database == "custom_db"

    def test_from_env_defaults(self) -> None:
        """Should use defaults when env vars not set."""
        # Clear any existing env vars
        for var in ["PG_HOST", "PG_PORT", "PG_USER", "PG_DB"]:
            os.environ.pop(var, None)

        config = PostgreSQLConfig.from_env()
        assert config.host == "127.0.0.1"
        assert config.port == 5432


class TestVerificationResults:
    """Tests for VerificationResults dataclass."""

    def test_initial_values(self) -> None:
        """Should start with zero passed and failed."""
        results = VerificationResults()
        assert results.passed == 0
        assert results.failed == 0

    def test_record_pass(self) -> None:
        """Should increment passed count."""
        results = VerificationResults()
        results.record_pass()
        results.record_pass()
        assert results.passed == 2
        assert results.failed == 0

    def test_record_fail(self) -> None:
        """Should increment failed count."""
        results = VerificationResults()
        results.record_fail()
        assert results.passed == 0
        assert results.failed == 1

    def test_all_passed_true(self) -> None:
        """Should return True when no failures."""
        results = VerificationResults()
        results.record_pass()
        assert results.all_passed() is True

    def test_all_passed_false(self) -> None:
        """Should return False when there are failures."""
        results = VerificationResults()
        results.record_pass()
        results.record_fail()
        assert results.all_passed() is False


class TestRunPsql:
    """Tests for run_psql function."""

    @patch("verify_postgresql.shutil.which")
    def test_returns_none_when_psql_missing(self, mock_which: MagicMock) -> None:
        """Should return None when psql is not found."""
        mock_which.return_value = None
        config = PostgreSQLConfig()
        result = run_psql(config, "SELECT 1;")
        assert result is None

    @patch("verify_postgresql.shutil.which")
    @patch("verify_postgresql.subprocess.run")
    def test_returns_output_on_success(
        self, mock_run: MagicMock, mock_which: MagicMock
    ) -> None:
        """Should return query output on success."""
        mock_which.return_value = "/usr/bin/psql"
        mock_run.return_value = MagicMock(returncode=0, stdout="test output")

        config = PostgreSQLConfig()
        result = run_psql(config, "SELECT 1;")
        assert result == "test output"

    @patch("verify_postgresql.shutil.which")
    @patch("verify_postgresql.subprocess.run")
    def test_returns_none_on_failure(
        self, mock_run: MagicMock, mock_which: MagicMock
    ) -> None:
        """Should return None on query failure."""
        mock_which.return_value = "/usr/bin/psql"
        mock_run.return_value = MagicMock(returncode=1, stdout="")

        config = PostgreSQLConfig()
        result = run_psql(config, "SELECT 1;")
        assert result is None


class TestRunPsqlCommand:
    """Tests for run_psql_command function."""

    @patch("verify_postgresql.shutil.which")
    def test_returns_false_when_psql_missing(self, mock_which: MagicMock) -> None:
        """Should return False when psql is not found."""
        mock_which.return_value = None
        config = PostgreSQLConfig()
        result = run_psql_command(config, "SELECT 1;")
        assert result is False

    @patch("verify_postgresql.shutil.which")
    @patch("verify_postgresql.subprocess.run")
    def test_returns_true_on_success(
        self, mock_run: MagicMock, mock_which: MagicMock
    ) -> None:
        """Should return True on successful command."""
        mock_which.return_value = "/usr/bin/psql"
        mock_run.return_value = MagicMock(returncode=0)

        config = PostgreSQLConfig()
        result = run_psql_command(config, "SELECT 1;")
        assert result is True


class TestCheckPortConnectivity:
    """Tests for check_port_connectivity function."""

    @patch("verify_postgresql.subprocess.run")
    def test_records_pass_on_success(self, mock_run: MagicMock) -> None:
        """Should record pass when port is listening."""
        mock_run.return_value = MagicMock(returncode=0, stderr="succeeded")

        config = PostgreSQLConfig()
        results = VerificationResults()
        check_port_connectivity(config, results)

        assert results.passed == 1
        assert results.failed == 0

    @patch("verify_postgresql.subprocess.run")
    def test_records_fail_on_failure(self, mock_run: MagicMock) -> None:
        """Should record fail when port is not listening."""
        mock_run.return_value = MagicMock(returncode=1, stderr="refused")

        config = PostgreSQLConfig()
        results = VerificationResults()
        check_port_connectivity(config, results)

        assert results.passed == 0
        assert results.failed == 1


class TestCheckPostgresqlVersion:
    """Tests for check_postgresql_version function."""

    @patch("verify_postgresql.run_psql")
    def test_records_pass_on_success(self, mock_psql: MagicMock) -> None:
        """Should record pass when PostgreSQL responds."""
        mock_psql.return_value = "PostgreSQL 16.1 on aarch64-apple-darwin"

        config = PostgreSQLConfig()
        results = VerificationResults()
        check_postgresql_version(config, results)

        assert results.passed == 1

    @patch("verify_postgresql.run_psql")
    def test_records_fail_on_failure(self, mock_psql: MagicMock) -> None:
        """Should record fail when PostgreSQL does not respond."""
        mock_psql.return_value = None

        config = PostgreSQLConfig()
        results = VerificationResults()
        check_postgresql_version(config, results)

        assert results.failed == 1


class TestCheckPgvectorExtension:
    """Tests for check_pgvector_extension function."""

    @patch("verify_postgresql.run_psql")
    def test_records_pass_when_extension_found(self, mock_psql: MagicMock) -> None:
        """Should record pass when pgvector is found."""
        mock_psql.return_value = " 0.7.0\n"

        config = PostgreSQLConfig()
        results = VerificationResults()
        check_pgvector_extension(config, results)

        assert results.passed == 1

    @patch("verify_postgresql.run_psql")
    def test_records_fail_when_extension_missing(self, mock_psql: MagicMock) -> None:
        """Should record fail when pgvector is missing."""
        mock_psql.return_value = "\n"

        config = PostgreSQLConfig()
        results = VerificationResults()
        check_pgvector_extension(config, results)

        assert results.failed == 1


class TestCheckVectorOperations:
    """Tests for check_vector_operations function."""

    @patch("verify_postgresql.run_psql_command")
    def test_records_pass_on_success(self, mock_psql: MagicMock) -> None:
        """Should record pass when vector operations work."""
        mock_psql.return_value = True

        config = PostgreSQLConfig()
        results = VerificationResults()
        check_vector_operations(config, results)

        assert results.passed == 1

    @patch("verify_postgresql.run_psql_command")
    def test_records_fail_on_failure(self, mock_psql: MagicMock) -> None:
        """Should record fail when vector operations fail."""
        mock_psql.return_value = False

        config = PostgreSQLConfig()
        results = VerificationResults()
        check_vector_operations(config, results)

        assert results.failed == 1


class TestVerifyPostgresql:
    """Tests for verify_postgresql function."""

    @patch("verify_postgresql.check_port_connectivity")
    @patch("verify_postgresql.check_postgresql_version")
    @patch("verify_postgresql.check_pgvector_extension")
    @patch("verify_postgresql.check_vector_operations")
    @patch("verify_postgresql.check_database_size")
    @patch("verify_postgresql.check_list_extensions")
    @patch("verify_postgresql.check_active_connections")
    def test_returns_zero_when_all_pass(
        self,
        mock_connections: MagicMock,
        mock_extensions: MagicMock,
        mock_size: MagicMock,
        mock_vector: MagicMock,
        mock_pgvector: MagicMock,
        mock_version: MagicMock,
        mock_port: MagicMock,
    ) -> None:
        """Should return 0 when all checks pass."""
        # Make all checks pass
        def make_pass(config: PostgreSQLConfig, results: VerificationResults) -> None:
            results.record_pass()

        mock_port.side_effect = make_pass
        mock_version.side_effect = make_pass
        mock_pgvector.side_effect = make_pass
        mock_vector.side_effect = make_pass
        mock_size.side_effect = make_pass
        mock_extensions.side_effect = make_pass
        mock_connections.side_effect = make_pass

        result = verify_postgresql()
        assert result == 0

    @patch("verify_postgresql.check_port_connectivity")
    @patch("verify_postgresql.check_postgresql_version")
    @patch("verify_postgresql.check_pgvector_extension")
    @patch("verify_postgresql.check_vector_operations")
    @patch("verify_postgresql.check_database_size")
    @patch("verify_postgresql.check_list_extensions")
    @patch("verify_postgresql.check_active_connections")
    def test_returns_one_when_any_fail(
        self,
        mock_connections: MagicMock,
        mock_extensions: MagicMock,
        mock_size: MagicMock,
        mock_vector: MagicMock,
        mock_pgvector: MagicMock,
        mock_version: MagicMock,
        mock_port: MagicMock,
    ) -> None:
        """Should return 1 when any check fails."""
        def make_pass(config: PostgreSQLConfig, results: VerificationResults) -> None:
            results.record_pass()

        def make_fail(config: PostgreSQLConfig, results: VerificationResults) -> None:
            results.record_fail()

        mock_port.side_effect = make_fail  # One failure
        mock_version.side_effect = make_pass
        mock_pgvector.side_effect = make_pass
        mock_vector.side_effect = make_pass
        mock_size.side_effect = make_pass
        mock_extensions.side_effect = make_pass
        mock_connections.side_effect = make_pass

        result = verify_postgresql()
        assert result == 1