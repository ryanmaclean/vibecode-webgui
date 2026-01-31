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

"""Tests for kind module."""

import stat
import sys
import tempfile
from pathlib import Path
from unittest import TestCase, mock

sys.path.insert(0, str(__file__).rsplit("/", 2)[0])

from kind import (
    kind_set_scripts_dir,
    kind_get_scripts_dir,
    kind_run_step,
    kind_run_command,
    kind_cluster_exists,
    kind_create_cluster,
    kind_delete_cluster,
    kind_load_image,
)


class TestKindSetScriptsDir(TestCase):
    """Tests for kind_set_scripts_dir function."""

    def test_set_scripts_dir(self):
        """Test setting scripts directory."""
        import kind
        kind.KIND_SCRIPTS_DIR = None
        
        kind_set_scripts_dir("/path/to/scripts")
        
        self.assertEqual(kind_get_scripts_dir(), Path("/path/to/scripts"))


class TestKindGetScriptsDir(TestCase):
    """Tests for kind_get_scripts_dir function."""

    def test_get_scripts_dir_before_set(self):
        """Test getting scripts directory before setting."""
        import kind
        kind.KIND_SCRIPTS_DIR = None
        
        result = kind_get_scripts_dir()
        
        self.assertIsNone(result)

    def test_get_scripts_dir_after_set(self):
        """Test getting scripts directory after setting."""
        import kind
        kind_set_scripts_dir("/test/path")
        
        result = kind_get_scripts_dir()
        
        self.assertEqual(result, Path("/test/path"))


class TestKindRunStep(TestCase):
    """Tests for kind_run_step function."""

    def test_run_step_without_scripts_dir(self):
        """Test run_step fails when scripts dir not set."""
        import kind
        kind.KIND_SCRIPTS_DIR = None
        
        result = kind_run_step("Test step", "script.sh")
        
        self.assertFalse(result)

    @mock.patch('subprocess.run')
    def test_run_step_script_not_found_required(self, mock_run):
        """Test run_step fails when required script not found."""
        with tempfile.TemporaryDirectory() as tmpdir:
            import kind
            kind_set_scripts_dir(tmpdir)
            
            result = kind_run_step("Test step", "nonexistent.sh", "required")
            
            self.assertFalse(result)

    @mock.patch('subprocess.run')
    def test_run_step_script_not_found_optional(self, mock_run):
        """Test run_step succeeds when optional script not found."""
        with tempfile.TemporaryDirectory() as tmpdir:
            import kind
            kind_set_scripts_dir(tmpdir)
            
            result = kind_run_step("Test step", "nonexistent.sh", "optional")
            
            self.assertTrue(result)

    @mock.patch('subprocess.run')
    def test_run_step_success(self, mock_run):
        """Test run_step succeeds when script runs successfully."""
        mock_run.return_value = mock.Mock(returncode=0)
        
        with tempfile.TemporaryDirectory() as tmpdir:
            script_path = Path(tmpdir) / "test.sh"
            script_path.write_text("#!/bin/bash\necho hello")
            
            import kind
            kind_set_scripts_dir(tmpdir)
            
            result = kind_run_step("Test step", "test.sh")
            
            self.assertTrue(result)

    @mock.patch('subprocess.run')
    def test_run_step_failure_required(self, mock_run):
        """Test run_step fails when required script fails."""
        mock_run.return_value = mock.Mock(returncode=1)
        
        with tempfile.TemporaryDirectory() as tmpdir:
            script_path = Path(tmpdir) / "test.sh"
            script_path.write_text("#!/bin/bash\nexit 1")
            
            import kind
            kind_set_scripts_dir(tmpdir)
            
            result = kind_run_step("Test step", "test.sh", "required")
            
            self.assertFalse(result)

    @mock.patch('subprocess.run')
    def test_run_step_failure_optional(self, mock_run):
        """Test run_step succeeds when optional script fails."""
        mock_run.return_value = mock.Mock(returncode=1)
        
        with tempfile.TemporaryDirectory() as tmpdir:
            script_path = Path(tmpdir) / "test.sh"
            script_path.write_text("#!/bin/bash\nexit 1")
            
            import kind
            kind_set_scripts_dir(tmpdir)
            
            result = kind_run_step("Test step", "test.sh", "optional")
            
            self.assertTrue(result)


class TestKindRunCommand(TestCase):
    """Tests for kind_run_command function."""

    @mock.patch('subprocess.run')
    def test_run_command(self, mock_run):
        """Test running a command."""
        mock_run.return_value = mock.Mock(returncode=0, stdout="output", stderr="")
        
        result = kind_run_command(["echo", "hello"])
        
        self.assertEqual(result.returncode, 0)


class TestKindClusterExists(TestCase):
    """Tests for kind_cluster_exists function."""

    @mock.patch('subprocess.run')
    def test_cluster_exists(self, mock_run):
        """Test cluster exists."""
        mock_run.return_value = mock.Mock(returncode=0, stdout="kind\n")
        
        result = kind_cluster_exists("kind")
        
        self.assertTrue(result)

    @mock.patch('subprocess.run')
    def test_cluster_not_exists(self, mock_run):
        """Test cluster does not exist."""
        mock_run.return_value = mock.Mock(returncode=0, stdout="other-cluster\n")
        
        result = kind_cluster_exists("kind")
        
        self.assertFalse(result)

    @mock.patch('subprocess.run')
    def test_cluster_check_fails(self, mock_run):
        """Test cluster check fails."""
        mock_run.return_value = mock.Mock(returncode=1, stdout="")
        
        result = kind_cluster_exists("kind")
        
        self.assertFalse(result)


class TestKindCreateCluster(TestCase):
    """Tests for kind_create_cluster function."""

    @mock.patch('subprocess.run')
    def test_create_cluster_success(self, mock_run):
        """Test creating cluster successfully."""
        mock_run.return_value = mock.Mock(returncode=0)
        
        result = kind_create_cluster("test-cluster")
        
        self.assertTrue(result)

    @mock.patch('subprocess.run')
    def test_create_cluster_with_config(self, mock_run):
        """Test creating cluster with config."""
        mock_run.return_value = mock.Mock(returncode=0)
        
        result = kind_create_cluster("test-cluster", "/path/to/config.yaml")
        
        self.assertTrue(result)
        call_args = mock_run.call_args[0][0]
        self.assertIn("--config", call_args)
        self.assertIn("/path/to/config.yaml", call_args)

    @mock.patch('subprocess.run')
    def test_create_cluster_failure(self, mock_run):
        """Test creating cluster failure."""
        mock_run.return_value = mock.Mock(returncode=1)
        
        result = kind_create_cluster("test-cluster")
        
        self.assertFalse(result)


class TestKindDeleteCluster(TestCase):
    """Tests for kind_delete_cluster function."""

    @mock.patch('subprocess.run')
    def test_delete_cluster_success(self, mock_run):
        """Test deleting cluster successfully."""
        mock_run.return_value = mock.Mock(returncode=0)
        
        result = kind_delete_cluster("test-cluster")
        
        self.assertTrue(result)

    @mock.patch('subprocess.run')
    def test_delete_cluster_failure(self, mock_run):
        """Test deleting cluster failure."""
        mock_run.return_value = mock.Mock(returncode=1)
        
        result = kind_delete_cluster("test-cluster")
        
        self.assertFalse(result)


class TestKindLoadImage(TestCase):
    """Tests for kind_load_image function."""

    @mock.patch('subprocess.run')
    def test_load_image_success(self, mock_run):
        """Test loading image successfully."""
        mock_run.return_value = mock.Mock(returncode=0)
        
        result = kind_load_image("my-image:latest")
        
        self.assertTrue(result)

    @mock.patch('subprocess.run')
    def test_load_image_failure(self, mock_run):
        """Test loading image failure."""
        mock_run.return_value = mock.Mock(returncode=1)
        
        result = kind_load_image("my-image:latest")
        
        self.assertFalse(result)


if __name__ == '__main__':
    import unittest
    unittest.main()