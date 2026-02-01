#!/usr/bin/env python3
"""Tests for stop_workspace module."""

import os
import sys
from pathlib import Path
from unittest import TestCase, mock

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))
sys.path.insert(0, str(Path(__file__).parent.parent / "cloud" / "gcp"))

from cloud.gcp.stop_workspace import (
    WorkspaceConfig,
    delete_instance,
    get_config_from_env,
    get_gcloud_project,
    run_command,
    stop_instance,
)


class TestWorkspaceConfig(TestCase):
    """Tests for WorkspaceConfig dataclass."""

    def test_default_values(self):
        """Test default configuration values."""
        config = WorkspaceConfig()
        self.assertEqual(config.project, "")
        self.assertEqual(config.zone, "us-central1-a")
        self.assertEqual(config.instance_name, "codeserver-dev")
        self.assertFalse(config.delete_instance)

    def test_custom_values(self):
        """Test custom configuration values."""
        config = WorkspaceConfig(
            project="my-project",
            zone="us-west1-b",
            instance_name="my-instance",
            delete_instance=True
        )
        self.assertEqual(config.project, "my-project")
        self.assertEqual(config.zone, "us-west1-b")
        self.assertEqual(config.instance_name, "my-instance")
        self.assertTrue(config.delete_instance)


class TestRunCommand(TestCase):
    """Tests for run_command function."""

    def test_successful_command(self):
        """Test running successful command."""
        rc, stdout, stderr = run_command(["echo", "hello"])
        self.assertEqual(rc, 0)
        self.assertEqual(stdout.strip(), "hello")

    def test_failed_command(self):
        """Test running failed command."""
        rc, stdout, stderr = run_command(["false"], check=False)
        self.assertNotEqual(rc, 0)

    def test_command_not_found(self):
        """Test command not found."""
        rc, stdout, stderr = run_command(
            ["nonexistent_cmd_12345"],
            check=False
        )
        self.assertEqual(rc, -1)
        self.assertIn("not found", stderr)


class TestGetGcloudProject(TestCase):
    """Tests for get_gcloud_project function."""

    @mock.patch('cloud.gcp.stop_workspace.run_command')
    def test_returns_project(self, mock_run):
        """Test returns project from gcloud."""
        mock_run.return_value = (0, "my-project\n", "")

        result = get_gcloud_project()

        self.assertEqual(result, "my-project")

    @mock.patch('cloud.gcp.stop_workspace.run_command')
    def test_returns_none_on_failure(self, mock_run):
        """Test returns None on gcloud failure."""
        mock_run.return_value = (1, "", "error")

        result = get_gcloud_project()

        self.assertIsNone(result)

    @mock.patch('cloud.gcp.stop_workspace.run_command')
    def test_returns_none_on_empty(self, mock_run):
        """Test returns None on empty output."""
        mock_run.return_value = (0, "", "")

        result = get_gcloud_project()

        self.assertIsNone(result)


class TestGetConfigFromEnv(TestCase):
    """Tests for get_config_from_env function."""

    @mock.patch('cloud.gcp.stop_workspace.get_gcloud_project')
    @mock.patch.dict(os.environ, {
        "PROJECT": "env-project",
        "ZONE": "europe-west1-b",
        "INSTANCE_NAME": "my-workspace",
        "DELETE_INSTANCE": "true"
    })
    def test_reads_from_env(self, mock_gcloud):
        """Test reads all values from environment."""
        config = get_config_from_env()

        self.assertEqual(config.project, "env-project")
        self.assertEqual(config.zone, "europe-west1-b")
        self.assertEqual(config.instance_name, "my-workspace")
        self.assertTrue(config.delete_instance)
        mock_gcloud.assert_not_called()

    @mock.patch('cloud.gcp.stop_workspace.get_gcloud_project')
    @mock.patch.dict(os.environ, {}, clear=True)
    def test_uses_gcloud_project_as_fallback(self, mock_gcloud):
        """Test uses gcloud project when PROJECT not set."""
        mock_gcloud.return_value = "gcloud-project"

        config = get_config_from_env()

        self.assertEqual(config.project, "gcloud-project")
        mock_gcloud.assert_called_once()

    @mock.patch('cloud.gcp.stop_workspace.get_gcloud_project')
    @mock.patch.dict(os.environ, {}, clear=True)
    def test_uses_defaults(self, mock_gcloud):
        """Test uses default values."""
        mock_gcloud.return_value = None

        config = get_config_from_env()

        self.assertEqual(config.project, "")
        self.assertEqual(config.zone, "us-central1-a")
        self.assertEqual(config.instance_name, "codeserver-dev")
        self.assertFalse(config.delete_instance)

    @mock.patch('cloud.gcp.stop_workspace.get_gcloud_project')
    @mock.patch.dict(os.environ, {"DELETE_INSTANCE": "false"}, clear=True)
    def test_delete_instance_false(self, mock_gcloud):
        """Test DELETE_INSTANCE=false."""
        mock_gcloud.return_value = None

        config = get_config_from_env()

        self.assertFalse(config.delete_instance)

    @mock.patch('cloud.gcp.stop_workspace.get_gcloud_project')
    @mock.patch.dict(os.environ, {"DELETE_INSTANCE": "TRUE"}, clear=True)
    def test_delete_instance_case_insensitive(self, mock_gcloud):
        """Test DELETE_INSTANCE is case insensitive."""
        mock_gcloud.return_value = None

        config = get_config_from_env()

        self.assertTrue(config.delete_instance)


class TestStopInstance(TestCase):
    """Tests for stop_instance function."""

    @mock.patch('cloud.gcp.stop_workspace.run_command')
    def test_calls_gcloud_stop(self, mock_run):
        """Test calls gcloud compute instances stop."""
        mock_run.return_value = (0, "", "")
        config = WorkspaceConfig(
            project="test-project",
            zone="us-central1-a",
            instance_name="test-instance"
        )

        result = stop_instance(config)

        self.assertTrue(result)
        mock_run.assert_called_once()
        call_args = mock_run.call_args[0][0]
        self.assertIn("gcloud", call_args)
        self.assertIn("stop", call_args)
        self.assertIn("test-instance", call_args)
        self.assertIn("--project", call_args)
        self.assertIn("test-project", call_args)

    @mock.patch('cloud.gcp.stop_workspace.run_command')
    def test_returns_true_on_failure(self, mock_run):
        """Test returns True even on failure (instance might be stopped)."""
        mock_run.return_value = (1, "", "error")
        config = WorkspaceConfig(project="p", zone="z", instance_name="i")

        result = stop_instance(config)

        self.assertTrue(result)


class TestDeleteInstance(TestCase):
    """Tests for delete_instance function."""

    @mock.patch('cloud.gcp.stop_workspace.run_command')
    def test_calls_gcloud_delete(self, mock_run):
        """Test calls gcloud compute instances delete."""
        mock_run.return_value = (0, "", "")
        config = WorkspaceConfig(
            project="test-project",
            zone="us-central1-a",
            instance_name="test-instance"
        )

        result = delete_instance(config)

        self.assertTrue(result)
        call_args = mock_run.call_args[0][0]
        self.assertIn("delete", call_args)
        self.assertIn("--keep-disks", call_args)
        self.assertIn("--quiet", call_args)

    @mock.patch('cloud.gcp.stop_workspace.run_command')
    def test_returns_false_on_failure(self, mock_run):
        """Test returns False on failure."""
        mock_run.return_value = (1, "", "error")
        config = WorkspaceConfig(project="p", zone="z", instance_name="i")

        result = delete_instance(config)

        self.assertFalse(result)


class TestMain(TestCase):
    """Tests for main function."""

    @mock.patch('cloud.gcp.stop_workspace.stop_instance')
    @mock.patch('cloud.gcp.stop_workspace.get_config_from_env')
    def test_main_success(self, mock_config, mock_stop):
        """Test successful main execution."""
        from cloud.gcp.stop_workspace import main

        mock_config.return_value = WorkspaceConfig(
            project="test-project",
            zone="us-central1-a",
            instance_name="test-instance"
        )
        mock_stop.return_value = True

        result = main()

        self.assertEqual(result, 0)
        mock_stop.assert_called_once()

    @mock.patch('cloud.gcp.stop_workspace.get_config_from_env')
    def test_main_no_project(self, mock_config):
        """Test main fails when no project."""
        from cloud.gcp.stop_workspace import main

        mock_config.return_value = WorkspaceConfig(project="")

        result = main()

        self.assertEqual(result, 1)

    @mock.patch('cloud.gcp.stop_workspace.delete_instance')
    @mock.patch('cloud.gcp.stop_workspace.stop_instance')
    @mock.patch('cloud.gcp.stop_workspace.get_config_from_env')
    def test_main_with_delete(self, mock_config, mock_stop, mock_delete):
        """Test main with delete flag."""
        from cloud.gcp.stop_workspace import main

        mock_config.return_value = WorkspaceConfig(
            project="test-project",
            zone="us-central1-a",
            instance_name="test-instance"
        )
        mock_stop.return_value = True
        mock_delete.return_value = True

        result = main(delete=True)

        self.assertEqual(result, 0)
        mock_delete.assert_called_once()

    @mock.patch('cloud.gcp.stop_workspace.stop_instance')
    @mock.patch('cloud.gcp.stop_workspace.get_config_from_env')
    def test_main_overrides_with_args(self, mock_config, mock_stop):
        """Test main overrides config with arguments."""
        from cloud.gcp.stop_workspace import main

        mock_config.return_value = WorkspaceConfig(
            project="default-project",
            zone="default-zone",
            instance_name="default-instance"
        )
        mock_stop.return_value = True

        result = main(
            project="arg-project",
            zone="arg-zone",
            instance_name="arg-instance"
        )

        self.assertEqual(result, 0)
        # Check the config passed to stop_instance
        call_config = mock_stop.call_args[0][0]
        self.assertEqual(call_config.project, "arg-project")
        self.assertEqual(call_config.zone, "arg-zone")
        self.assertEqual(call_config.instance_name, "arg-instance")


if __name__ == '__main__':
    import unittest
    unittest.main()
