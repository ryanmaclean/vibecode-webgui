"""Tests for mongodb scripts."""

import pytest
from unittest.mock import patch, MagicMock
import os
import sys
import tempfile
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from mongodb.backup import (
    BackupConfig,
    BackupResult,
    get_file_size,
    cleanup_old_backups,
)

from mongodb.healthcheck import (
    HealthConfig,
    HealthResult,
)

from mongodb.setup_replica_set import (
    run_mongosh,
)


class TestBackupConfig:
    """Tests for BackupConfig dataclass."""

    def test_default_values(self):
        """Test default configuration values."""
        config = BackupConfig()
        assert config.backup_dir == "/opt/vibecode/backups"
        assert config.db_name == "chatui"
        assert config.retention_days == 7
        assert config.mongo_host == "localhost"
        assert config.mongo_port == "27017"

    def test_custom_values(self):
        """Test custom configuration values."""
        config = BackupConfig(
            backup_dir="/custom/backups",
            db_name="custom_db",
            retention_days=14,
            mongo_host="mongodb.example.com",
            mongo_port="27018",
        )
        assert config.backup_dir == "/custom/backups"
        assert config.db_name == "custom_db"
        assert config.retention_days == 14


class TestBackupResult:
    """Tests for BackupResult dataclass."""

    def test_successful_backup(self):
        """Test successful backup result."""
        result = BackupResult(
            backup_name="test_backup",
            backup_size="100MB",
            backup_date="20240101",
            backup_path="/backups/test.tar.gz",
            success=True,
        )
        assert result.success is True
        assert result.backup_size == "100MB"

    def test_failed_backup(self):
        """Test failed backup result."""
        result = BackupResult(
            backup_name="test_backup",
            backup_size="0",
            backup_date="20240101",
            backup_path="",
            success=False,
        )
        assert result.success is False


class TestGetFileSize:
    """Tests for get_file_size function."""

    def test_small_file(self):
        """Test size of small file."""
        with tempfile.NamedTemporaryFile(delete=False) as f:
            f.write(b"x" * 100)
            f.flush()

            try:
                size = get_file_size(Path(f.name))
                assert "B" in size
            finally:
                os.unlink(f.name)

    def test_larger_file(self):
        """Test size of larger file."""
        with tempfile.NamedTemporaryFile(delete=False) as f:
            f.write(b"x" * 10000)
            f.flush()

            try:
                size = get_file_size(Path(f.name))
                assert "KB" in size or "B" in size
            finally:
                os.unlink(f.name)


class TestCleanupOldBackups:
    """Tests for cleanup_old_backups function."""

    def test_cleanup_old_files(self):
        """Test that old files are cleaned up."""
        with tempfile.TemporaryDirectory() as tmpdir:
            backup_dir = Path(tmpdir)

            # Create an old backup file (mtime will be now, but we test the logic)
            old_file = backup_dir / "chatui_backup_20200101.tar.gz"
            old_file.write_text("old backup")

            # Set mtime to be very old (100 days ago)
            import time
            old_time = time.time() - (100 * 86400)
            os.utime(old_file, (old_time, old_time))

            # Create a new backup file
            new_file = backup_dir / "chatui_backup_20240101.tar.gz"
            new_file.write_text("new backup")

            cleanup_old_backups(backup_dir, retention_days=7)

            # Old file should be deleted
            assert not old_file.exists()
            # New file should still exist
            assert new_file.exists()


class TestHealthConfig:
    """Tests for HealthConfig dataclass."""

    def test_default_values(self):
        """Test default configuration values."""
        config = HealthConfig()
        assert config.host == "localhost"
        assert config.port == "27017"
        assert config.database == "chatui"
        assert config.timeout == 5


class TestHealthResult:
    """Tests for HealthResult dataclass."""

    def test_healthy_result(self):
        """Test healthy result."""
        result = HealthResult(healthy=True, checks=[])
        assert result.healthy is True

    def test_unhealthy_result(self):
        """Test unhealthy result with checks."""
        result = HealthResult(
            healthy=False,
            checks=[("connection", False, "Connection failed")],
        )
        assert result.healthy is False
        assert len(result.checks) == 1


class TestRunMongosh:
    """Tests for run_mongosh function."""

    @patch('subprocess.run')
    def test_successful_command(self, mock_run):
        """Test successful mongosh command."""
        mock_run.return_value = MagicMock(
            returncode=0,
            stdout="success",
            stderr="",
        )

        rc, stdout, stderr = run_mongosh("db.ping()")
        assert rc == 0

    @patch('subprocess.run')
    def test_failed_command(self, mock_run):
        """Test failed mongosh command."""
        mock_run.return_value = MagicMock(
            returncode=1,
            stdout="",
            stderr="error",
        )

        rc, stdout, stderr = run_mongosh("invalid_command")
        assert rc == 1


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
