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

"""Tests for pgvector module."""

import sys
from unittest import TestCase, mock

sys.path.insert(0, str(__file__).rsplit("/", 2)[0])

from pgvector import (
    pgvector_start_container,
    pgvector_wait_for_start,
    pgvector_exec_sql,
    pgvector_stop_container,
)


class TestPgvectorStartContainer(TestCase):
    """Tests for pgvector_start_container function."""

    @mock.patch('subprocess.run')
    def test_start_container_success(self, mock_run):
        """Test starting container successfully."""
        mock_run.return_value = mock.Mock(returncode=0)
        
        result = pgvector_start_container(
            "test-container",
            5432,
            "testdb",
            "testuser",
            "testpass"
        )
        
        self.assertTrue(result)

    @mock.patch('subprocess.run')
    def test_start_container_failure(self, mock_run):
        """Test starting container failure."""
        # First call (rm -f) succeeds, second call (run) fails
        mock_run.side_effect = [
            mock.Mock(returncode=0),
            mock.Mock(returncode=1)
        ]
        
        result = pgvector_start_container(
            "test-container",
            5432,
            "testdb",
            "testuser",
            "testpass"
        )
        
        self.assertFalse(result)

    @mock.patch('subprocess.run')
    def test_start_container_with_custom_image(self, mock_run):
        """Test starting container with custom image."""
        mock_run.return_value = mock.Mock(returncode=0)
        
        result = pgvector_start_container(
            "test-container",
            5432,
            "testdb",
            "testuser",
            "testpass",
            image="custom/pgvector"
        )
        
        self.assertTrue(result)
        # Check that the custom image was used
        calls = mock_run.call_args_list
        docker_run_call = calls[1]  # Second call is the docker run
        self.assertIn("custom/pgvector", docker_run_call[0][0])


class TestPgvectorWaitForStart(TestCase):
    """Tests for pgvector_wait_for_start function."""

    @mock.patch('subprocess.run')
    @mock.patch('time.sleep')
    def test_wait_for_start_success(self, mock_sleep, mock_run):
        """Test waiting for container to start successfully."""
        mock_run.return_value = mock.Mock(returncode=0)
        
        result = pgvector_wait_for_start(
            "test-container",
            "testuser",
            "testdb"
        )
        
        self.assertTrue(result)

    @mock.patch('subprocess.run')
    @mock.patch('time.sleep')
    def test_wait_for_start_timeout(self, mock_sleep, mock_run):
        """Test waiting for container times out."""
        mock_run.return_value = mock.Mock(returncode=1)
        
        result = pgvector_wait_for_start(
            "test-container",
            "testuser",
            "testdb",
            retries=3,
            delay_seconds=1
        )
        
        self.assertFalse(result)
        self.assertEqual(mock_sleep.call_count, 3)

    @mock.patch('subprocess.run')
    @mock.patch('time.sleep')
    def test_wait_for_start_eventual_success(self, mock_sleep, mock_run):
        """Test waiting for container eventually succeeds."""
        mock_run.side_effect = [
            mock.Mock(returncode=1),
            mock.Mock(returncode=1),
            mock.Mock(returncode=0)
        ]
        
        result = pgvector_wait_for_start(
            "test-container",
            "testuser",
            "testdb",
            retries=5,
            delay_seconds=1
        )
        
        self.assertTrue(result)
        self.assertEqual(mock_sleep.call_count, 2)


class TestPgvectorExecSql(TestCase):
    """Tests for pgvector_exec_sql function."""

    @mock.patch('subprocess.run')
    def test_exec_sql_success(self, mock_run):
        """Test executing SQL successfully."""
        mock_run.return_value = mock.Mock(
            returncode=0,
            stdout="result",
            stderr=""
        )
        
        result = pgvector_exec_sql(
            "test-container",
            "testuser",
            "testdb",
            "SELECT 1"
        )
        
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "result")

    @mock.patch('subprocess.run')
    def test_exec_sql_failure(self, mock_run):
        """Test executing SQL failure."""
        mock_run.return_value = mock.Mock(
            returncode=1,
            stdout="",
            stderr="ERROR: syntax error"
        )
        
        result = pgvector_exec_sql(
            "test-container",
            "testuser",
            "testdb",
            "INVALID SQL"
        )
        
        self.assertEqual(result.returncode, 1)


class TestPgvectorStopContainer(TestCase):
    """Tests for pgvector_stop_container function."""

    @mock.patch('subprocess.run')
    def test_stop_container_success(self, mock_run):
        """Test stopping container successfully."""
        mock_run.return_value = mock.Mock(returncode=0)
        
        result = pgvector_stop_container("test-container")
        
        self.assertTrue(result)

    @mock.patch('subprocess.run')
    def test_stop_container_failure(self, mock_run):
        """Test stopping container failure."""
        mock_run.return_value = mock.Mock(returncode=1)
        
        result = pgvector_stop_container("test-container")
        
        self.assertFalse(result)


if __name__ == '__main__':
    import unittest
    unittest.main()